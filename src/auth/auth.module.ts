import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleIdTokenVerifier } from './google-id-token.verifier';
import { UserModule } from 'src/user/user.module';

import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { jwtConstants, ACCESS_TOKEN_TTL_DAYS } from './constants';

@Module({
  imports: [
    UserModule,
    JwtModule.register({
      global: true,
      secret: jwtConstants.secret,
      signOptions: { expiresIn: `${ACCESS_TOKEN_TTL_DAYS}d` },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleIdTokenVerifier, PrismaService],
})
export class AuthModule {}
