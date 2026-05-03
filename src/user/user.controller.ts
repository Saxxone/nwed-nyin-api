import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Put,
  Delete,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { User, User as UserModel } from 'src/generated/prisma/client';
import { JwtPayload, Public } from 'src/auth/auth.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { SelfUpdateUserDto } from './dto/update-user.dto';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Public()
  @Post('register')
  async signupUser(
    @Body()
    userData: CreateUserDto,
  ): Promise<UserModel> {
    return this.userService.createUser(userData);
  }

  @Get('/:id')
  async getUserById(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ): Promise<Omit<User, 'password'>> {
    return this.userService.findUserAuthorized(req.user.user_id, id);
  }

  @Put('update/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() data: SelfUpdateUserDto,
    @Req() req: Request & { user: JwtPayload },
  ): Promise<UserModel> {
    return this.userService.updateAuthenticatedProfile(
      req.user.user_id,
      id,
      data,
    );
  }

  @Delete('delete/:id')
  async deleteUser(
    @Param('id') id: string,
    @Req() req: Request & { user: JwtPayload },
  ): Promise<UserModel> {
    return this.userService.deleteUserAuthorized(req.user.user_id, id);
  }
}
