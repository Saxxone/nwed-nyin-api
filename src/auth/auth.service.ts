import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/generated/prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import * as fs from 'fs';
import https from 'https';
import { isIPv4 } from 'net';
import { join } from 'path';
import { URL } from 'url';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateFedUserDto } from 'src/user/dto/create-user.dto';
import { UserService } from '../user/user.service';
import { JwtPayload } from './auth.guard';
import { jwtConstants } from './constants';
import { AuthUser } from './dto/sign-in.dto';
import { GoogleIdTokenVerifier } from './google-id-token.verifier';

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;
/** Max stored profile image download size (Google avatars stay small). */
const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const PROFILE_PIC_HOST_ALLOWLIST_SUFFIXES = [
  '.googleusercontent.com',
  '.gstatic.com',
];
const PROFILE_PIC_REQUEST_MS = 12_000;

function isApprovedProfilePictureHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return PROFILE_PIC_HOST_ALLOWLIST_SUFFIXES.some((suffix) =>
    h.endsWith(suffix),
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly googleIdTokenVerifier: GoogleIdTokenVerifier,
  ) {}

  async signIn(email: string, pass: string): Promise<Partial<AuthUser>> {
    const user = await this.userService.findUser(email, { withPassword: true });

    if (!user) {
      throw new UnauthorizedException();
    }

    const isPasswordValid = await bcrypt.compare(pass, user.password ?? '');

    if (!isPasswordValid) {
      throw new UnauthorizedException();
    }

    if (user.password) delete user.password;

    return {
      ...user,
      ...(await this.generateTokens(user)),
    };
  }

  /** Drops all bearer sessions for user (JWT rows). */
  async revokeSessions(user_id: string): Promise<{ message: string }> {
    await this.prisma.authToken.deleteMany({ where: { user_id } });
    return {
      message: 'Logged out successfully',
    };
  }

  /** @deprecated Prefer authenticated POST /auth/logout. */
  async signOut(email: string, pass: string): Promise<{ message: string }> {
    const user = await this.userService.findUser(email, { withPassword: true });

    if (!user?.password) {
      throw new UnauthorizedException();
    }

    const isPasswordValid = await bcrypt.compare(pass, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException();
    }

    await this.revokeSessions(user.id);
    return {
      message: 'Logged out successfully',
    };
  }

  async signInGoogle(token: string): Promise<Partial<AuthUser>> {
    const verified = await this.googleIdTokenVerifier.verify(token);

    try {
      const user = await this.prisma.user.findUnique({
        where: { email: verified.email },
      });

      const default_img = process.env.DEFAULT_PROFILE_IMG;

      if (!user) {
        throw new UnauthorizedException('Account does not exist');
      }

      let updated_row = user;
      if (verified.picture?.trim() && user.img === default_img) {
        const { url, file } = this.createImgPath();
        const saved = await this.downloadProfilePicture(verified.picture, file);
        if (saved) {
          await this.prisma.user.update({
            where: { id: user.id },
            data: { img: url },
          });
          updated_row =
            (await this.prisma.user.findUnique({ where: { id: user.id } })) ??
            user;
        }
      }

      const out = { ...updated_row };
      if (out.password) delete out.password;

      return {
        ...out,
        ...(await this.generateTokens(user)),
      };
    } catch (error) {
      console.error('Error in signInGoogle:', error);
      throw error;
    }
  }

  async signUpGoogle(token: string): Promise<Partial<AuthUser>> {
    const verified = await this.googleIdTokenVerifier.verify(token);

    let img_url = process.env.DEFAULT_PROFILE_IMG;

    const existing = await this.prisma.user.findFirst({
      where: {
        email: verified.email,
      },
    });

    if (existing) {
      return this.signInGoogle(token);
    }

    try {
      if (verified.picture?.trim()) {
        const { url, file } = this.createImgPath();
        const ok = await this.downloadProfilePicture(verified.picture, file);
        if (ok) img_url = url;
      }
    } catch (error) {
      console.error('Error downloading or saving image:', error);
    }

    const u: CreateFedUserDto = {
      name: verified.name,
      email: verified.email,
      img: img_url ?? process.env.DEFAULT_PROFILE_IMG ?? '',
    };

    const new_user = await this.userService.createFedUser(u);

    if (new_user.password) delete new_user.password;

    return {
      ...new_user,
      ...(await this.generateTokens(new_user)),
    };
  }

  async refresh(
    refresh_token: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    try {
      const refresh_token_payload =
        await this.verifyrefresh_token(refresh_token);

      const user = await this.prisma.user.findUnique({
        where: { id: refresh_token_payload.user_id },
      });
      if (!user) throw new UnauthorizedException('Invalid refresh token');

      const newAccessToken = await this.signToken(user);
      const newRefreshToken = await this.generaterefreshToken(user);

      await this.saveToken(user.id, newAccessToken, false);
      await this.saveToken(user.id, newRefreshToken, true);

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException(error);
    }
  }

  /** Replaces access token payload path (caller should use saved rows). Kept if needed externally. */
  async generateAccessToken(payload: JwtPayload): Promise<string> {
    const newAccessToken = await this.signToken({
      id: payload.user_id,
      email: payload.sub,
    } as User);

    await this.saveToken(payload.user_id, newAccessToken, false);
    return newAccessToken;
  }

  async verifyrefresh_token(token: string): Promise<JwtPayload> {
    const refresh_token_payload: JwtPayload = await this.jwtService.verifyAsync(
      token,
      {
        secret: jwtConstants.refreshSecret,
      },
    );

    const storedrefresh_token = await this.prisma.authToken.findUnique({
      where: {
        user_id_is_refresh_token: {
          user_id: refresh_token_payload.user_id,
          is_refresh_token: true,
        },
      },
    });

    if (
      !storedrefresh_token ||
      storedrefresh_token.token !== token ||
      storedrefresh_token.expires_at < new Date()
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return refresh_token_payload;
  }

  async verifyAccessToken(token: string, request: Request, is_public: boolean) {
    const incoming_hash = await this.hashToken(token);

    try {
      const payload: JwtPayload = await this.jwtService.verifyAsync(token, {
        secret: jwtConstants.secret,
      });

      const existing_token = await this.prisma.authToken.findUnique({
        where: { token_hash: incoming_hash },
      });

      if (!existing_token || existing_token.user_id !== payload.user_id) {
        throw new UnauthorizedException('Invalid token');
      }

      request['user'] = payload;
    } catch (error) {
      if (!is_public) {
        try {
          const refresh_token_payload: JwtPayload =
            await this.jwtService.verifyAsync(token, {
              secret: jwtConstants.refreshSecret,
            });

          const refresh_token = await this.prisma.authToken.findUnique({
            where: {
              user_id_is_refresh_token: {
                user_id: refresh_token_payload.user_id,
                is_refresh_token: true,
              },
            },
          });

          if (!refresh_token || refresh_token.token !== token) {
            throw new UnauthorizedException('Invalid refresh token.');
          }

          const new_access_token = await this.signToken({
            id: refresh_token_payload.user_id,
            email: refresh_token_payload.sub,
          } as User);

          const access_token_expires_at = new Date(
            Date.now() + 30 * MILLISECONDS_PER_DAY,
          );
          const new_access_hash = await this.hashToken(new_access_token);

          await this.prisma.authToken.upsert({
            where: {
              user_id_is_refresh_token: {
                user_id: refresh_token_payload.user_id,
                is_refresh_token: false,
              },
            },
            create: {
              token: new_access_token,
              token_hash: new_access_hash,
              user_id: refresh_token_payload.user_id,
              expires_at: access_token_expires_at,
              is_refresh_token: false,
            },
            update: {
              token: new_access_token,
              token_hash: new_access_hash,
              expires_at: access_token_expires_at,
            },
          });

          request['user'] = refresh_token_payload;
          request.headers.authorization = `Bearer ${new_access_token}`;
        } catch {
          throw new UnauthorizedException(error);
        }
      } else {
        throw new UnauthorizedException(error);
      }
    }
  }

  async generateTokens(
    user: User,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const access_token = await this.signToken(user);
    const refresh_token = await this.generaterefreshToken(user);

    await this.saveToken(user.id, access_token, false);
    await this.saveToken(user.id, refresh_token, true);

    return { access_token, refresh_token };
  }

  private async hashToken(token: string): Promise<string> {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async signToken(user: User): Promise<string> {
    const payload = {
      sub: user.email,
      user_id: user.id,
    };
    return this.jwtService.signAsync(payload, {
      secret: jwtConstants.secret,
      expiresIn: '7d',
    });
  }

  private async generaterefreshToken(user: User): Promise<string> {
    const payload = {
      sub: user.email,
      user_id: user.id,
    };
    return this.jwtService.signAsync(payload, {
      secret: jwtConstants.refreshSecret,
      expiresIn: '7d',
    });
  }

  private async saveToken(
    user_id: string,
    token: string,
    is_refresh_token: boolean,
  ): Promise<void> {
    const expires_at = new Date(Date.now() + 30 * MILLISECONDS_PER_DAY);
    const token_hash = await this.hashToken(token);

    await this.prisma.authToken.upsert({
      where: { user_id_is_refresh_token: { user_id, is_refresh_token } },
      update: { token, token_hash, expires_at },
      create: {
        user_id,
        token,
        token_hash: token_hash,
        is_refresh_token,
        expires_at,
      },
    });
  }

  private createImgPath() {
    const img_name = randomUUID() + '.jpg';
    const destination = join(__dirname, '../../../', 'public', 'profiles');
    const media_base_url = process.env.FILE_BASE_URL;
    fs.mkdirSync(destination, { recursive: true });
    const img_path = `${media_base_url}${img_name}`;
    return { url: img_path, file: join(destination, img_name) };
  }

  /** Returns parsed URL only when HTTPS + allowlisted avatar host (not IP literal). */
  private parseHttpsProfilePictureUrl(urlString: string): URL | null {
    let parsed: URL;
    try {
      parsed = new URL(urlString);
    } catch {
      return null;
    }

    if (parsed.protocol !== 'https:') {
      return null;
    }

    const host = parsed.hostname;
    if (isIPv4(host) || host.startsWith('[')) {
      return null;
    }

    if (!isApprovedProfilePictureHost(host)) {
      return null;
    }

    return parsed;
  }

  /** Returns whether a file was written (false ⇒ caller should skip DB update). */
  private async downloadProfilePicture(
    urlStr: string,
    filepath: string,
  ): Promise<boolean> {
    if (!urlStr?.trim()) {
      return false;
    }

    const parsed = this.parseHttpsProfilePictureUrl(urlStr);
    if (!parsed) return false;

    return await new Promise<boolean>((resolve_dl) => {
      const file = fs.createWriteStream(filepath);
      let downloaded = 0;
      let aborted = false;

      const fail = () => {
        if (aborted) return;
        aborted = true;
        fs.unlink(filepath, () => resolve_dl(false));
      };

      const req = https.get(
        parsed,
        {
          timeout: PROFILE_PIC_REQUEST_MS,
          headers: { 'User-Agent': 'nwed-nyin-api/1.0' },
        },
        (response) => {
          const code = response.statusCode ?? 0;
          if (code !== 200) {
            response.resume();
            file.close(fail);
            return;
          }

          response.on('data', (chunk: Buffer | string) => {
            const len = Buffer.isBuffer(chunk)
              ? chunk.length
              : Buffer.byteLength(String(chunk));
            downloaded += len;
            if (downloaded > PROFILE_IMAGE_MAX_BYTES) {
              response.destroy();
              file.close(fail);
            }
          });

          response.pipe(file);
          file.on('finish', () =>
            file.close(() => {
              if (!aborted) resolve_dl(true);
            }),
          );
          file.on('error', fail);
        },
      );

      req.on('error', fail);
      req.on('timeout', () => {
        req.destroy();
        fail();
      });
    }).catch(() => false);
  }
}
