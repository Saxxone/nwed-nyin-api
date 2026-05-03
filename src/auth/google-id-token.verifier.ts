import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client, TokenPayload } from 'google-auth-library';

/** Validated Google OIDC payload for federated login. */
export type VerifiedGooglePayload = Pick<
  TokenPayload,
  'email' | 'name' | 'picture' | 'sub'
>;

@Injectable()
export class GoogleIdTokenVerifier {
  private readonly client?: OAuth2Client;

  constructor() {
    const clientId = process.env.GOOGLE_AUTH_CLIENT_ID?.trim();
    if (clientId) {
      this.client = new OAuth2Client(clientId);
    }
  }

  /** Verifies Google's ID token (signature and standard claims via library). */
  async verify(token: string): Promise<VerifiedGooglePayload> {
    if (!token?.trim()) {
      throw new UnauthorizedException('Google token missing');
    }
    if (!this.client || !process.env.GOOGLE_AUTH_CLIENT_ID?.trim()) {
      throw new UnauthorizedException('Google sign-in not configured');
    }

    try {
      const ticket = await this.client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_AUTH_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload?.email) {
        throw new UnauthorizedException('Invalid Google token');
      }
      if (payload.email_verified !== true) {
        throw new UnauthorizedException('Google email not verified');
      }

      return {
        email: payload.email,
        name: payload.name ?? payload.email.split('@')[0],
        picture: payload.picture ?? '',
        sub: payload.sub,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid Google token');
    }
  }
}
