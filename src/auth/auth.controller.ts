import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  UnauthorizedException,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { SignInDto } from './dto/sign-in.dto';
import { AuthGuard, JwtPayload, Public } from './auth.guard';
import { UserService } from 'src/user/user.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login/google')
  async googleLogin(@Body('token') token: string) {
    return await this.authService.signInGoogle(token);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('signup/google')
  async googleSignup(@Body('token') token: string) {
    return await this.authService.signUpGoogle(token);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async signIn(@Body() signInDto: SignInDto) {
    return await this.authService.signIn(signInDto.email, signInDto.password);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Body('refresh_token') refresh_token: string) {
    if (!refresh_token) {
      throw new UnauthorizedException('Refresh Token not provided');
    }
    return this.authService.refresh(refresh_token);
  }

  /** Revokes JWT rows for bearer user (preferred logout). */
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logoutAuthenticated(
    @Req() req: Request & { user: JwtPayload },
  ): Promise<{ message: string }> {
    return this.authService.revokeSessions(req.user.user_id);
  }

  /** Alias for tooling that still submits password logout. */
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('logout/password')
  async signOutLegacy(@Body() signInDto: SignInDto) {
    return await this.authService.signOut(signInDto.email, signInDto.password);
  }

  @UseGuards(AuthGuard)
  @Get('profile')
  async getProfile(@Req() req: Request & { user: JwtPayload }) {
    return await this.userService.findUser(req.user.user_id);
  }
}
