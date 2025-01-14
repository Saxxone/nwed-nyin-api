import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { jwtConstants } from './constants';
import { GoogleAuthUser, AuthUser } from './dto/sign-in.dto';
import { User } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as https from 'https';
import { join } from 'path';
import * as fs from 'fs';
import { CreateFedUserDto } from 'src/user/dto/create-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from './auth.guard';
import { Request } from 'express';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async signIn(email: string, pass: string): Promise<Partial<AuthUser>> {
    const user = await this.userService.findUser(email, { withPassword: true });

    if (!user) {
      throw new UnauthorizedException();
    }

    const isPasswordValid = await bcrypt.compare(pass, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException();
    }

    if (user.password) delete user.password;

    return {
      ...user,
      ...(await this.generateTokens(user)),
    };
  }

  async signOut(email: string, pass: string): Promise<any> {
    const user = await this.userService.findUser(email, { withPassword: true });

    if (!user) {
      throw new UnauthorizedException();
    }

    const isPasswordValid = await bcrypt.compare(pass, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException();
    }

    return {
      message: 'Logged out successfully',
    };
  }

  async signInGoogle(token: string): Promise<Partial<AuthUser>> {
    return await this.prisma.$transaction(async (prisma) => {
      try {
        const payload: GoogleAuthUser = await this.jwtService.decode(token);

        const user = await prisma.user.findUnique({
          where: { email: payload.email },
        });

        const client_id = process.env.GOOGLE_AUTH_CLIENT_ID;
        const default_img = process.env.DEFAULT_PROFILE_IMG;

        if (client_id !== payload.aud) {
          throw new UnauthorizedException();
        }

        if (!user) {
          throw new UnauthorizedException();
        }
        const { password, ...rest } = user;

        if (user.img === default_img) {
          const { url, file } = this.createImgPath();
          await this.downloadImage(payload.picture, file);
          await prisma.user.update({
            where: { id: user.id },
            data: { img: url },
          });
        }
        return {
          ...rest,
          ...(await this.generateTokens(user)),
        };
      } catch (error) {
        console.error('Error in signInGoogle:', error); // Important: Log the error
        throw error;
      }
    });
  }

  async signUpGoogle(token: string): Promise<Partial<AuthUser>> {
    const payload: GoogleAuthUser = await this.jwtService.decode(token);

    let img_url = process.env.DEFAULT_PROFILE_IMG;

    const user = await this.prisma.user.findFirst({
      where: {
        email: payload.email,
      },
    });

    const client_id = process.env.GOOGLE_AUTH_CLIENT_ID;

    if (client_id !== payload.aud) {
      throw new UnauthorizedException();
    }

    if (user) {
      return this.signInGoogle(token);
    } else {
      try {
        const { url, file } = this.createImgPath();
        await this.downloadImage(payload.picture, file);
        img_url = url;
      } catch (error) {
        console.error('Error downloading or saving image:', error);
      }

      const u: CreateFedUserDto = {
        name: payload.name,
        email: payload.email,
        img: img_url,
      };

      const new_user = await this.userService.createFedUser(u);

      if (new_user.password) delete new_user.password;

      return {
        ...new_user,
        ...(await this.generateTokens(new_user)),
      };
    }
  }

  private async updateUserProfile(
    user: User,
    payload: GoogleAuthUser,
    default_img: string,
  ): Promise<Partial<AuthUser>> {
    if (user.img === default_img) {
      try {
        const { url, file } = this.createImgPath();
        await this.downloadImage(payload.picture, file);
        const updated_user = await this.userService.updateUser({
          where: { id: user.id },
          data: { img: url },
        });

        if (updated_user.password) delete updated_user.password;

        return {
          ...updated_user,
          ...(await this.generateTokens(updated_user)),
        };
      } catch (error) {
        console.error('Error downloading or saving image:', error);

        if (user.password) delete user.password;

        return {
          ...user,
          ...(await this.generateTokens(user)),
        };
      }
    }
  }

  async refresh(refresh_token: string): Promise<{ access_token: string }> {
    try {
      const refresh_token_payload =
        await this.verifyrefresh_token(refresh_token);

      const newAccessToken = await this.generateAccessToken(
        refresh_token_payload,
      );
      return { access_token: newAccessToken };
    } catch (error) {
      throw new UnauthorizedException(error);
    }
  }

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
    const token_hash = await this.hashToken(token);

    try {
      const payload: JwtPayload = await this.jwtService.verifyAsync(token, {
        secret: jwtConstants.secret,
      });

      const existing_token = await this.prisma.authToken.findUnique({
        where: { token_hash },
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

          const access_token_expires_at = new Date(Date.now() + 15 * 60 * 1000);
          await this.prisma.authToken.upsert({
            where: {
              user_id_is_refresh_token: {
                user_id: refresh_token_payload.user_id,
                is_refresh_token: false,
              },
            },
            create: {
              token: new_access_token,
              token_hash: token_hash,
              user_id: refresh_token_payload.user_id,
              expires_at: access_token_expires_at,
              is_refresh_token: false,
            },
            update: {
              token: new_access_token,
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
      expiresIn: '15m',
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
    const expires_at = new Date(
      Date.now() + (is_refresh_token ? 7 : 15) * 60 * 1000,
    );
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
    const img_name = uuidv4() + '.jpg';
    const destination = join(__dirname, '../../../../', 'media');
    const media_base_url = process.env.FILE_BASE_URL;
    fs.mkdirSync(destination, { recursive: true });
    const img_path = `${media_base_url}${img_name}`;
    return { url: img_path, file: join(destination, img_name) };
  }

  private async downloadImage(url: string, filepath: string): Promise<void> {
    try {
      return await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https
          .get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
              file.close();
              resolve();
            });
          })
          .on('error', (err) => {
            fs.unlink(filepath, () => reject(err));
          });
      });
    } catch (error) {
      console.error('Error downloading image:', error);
      throw error;
    }
  }
}
