import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma, Role } from 'src/generated/prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateFedUserDto, CreateUserDto } from './dto/create-user.dto';
import { SelfUpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(d: CreateUserDto): Promise<User> {
    const default_img = process.env.DEFAULT_PROFILE_IMG;

    const data = {
      ...d,
      img: d.img ?? default_img,
      role: Role.VIEWER,
      password: await bcrypt.hash(d.password, 10),
    };

    return this.prisma.user.create({
      data,
    });
  }

  async createFedUser(data: CreateFedUserDto): Promise<User> {
    const user = {
      ...data,
      role: Role.VIEWER,
    };

    return await this.prisma.user.create({ data: user });
  }

  /** @internal Bypasses ACL—only for trusted server callers. */
  async updateUser(params: {
    where: Prisma.UserWhereUniqueInput;
    data: Prisma.UserUpdateInput;
  }): Promise<User> {
    const { where, data } = params;
    return this.prisma.user.update({
      data,
      where,
    });
  }

  async updateAuthenticatedProfile(
    actor_user_id: string,
    target_id: string,
    dto: SelfUpdateUserDto,
  ): Promise<User> {
    const actor = await this.prisma.user.findUnique({
      where: { id: actor_user_id },
    });
    const target_user = await this.prisma.user.findUnique({
      where: { id: target_id },
    });

    if (!actor || !target_user) {
      throw new NotFoundException('User not found');
    }

    const self = actor.id === target_id;
    const is_admin = actor.role === Role.ADMIN;

    if (!self && !is_admin) {
      throw new ForbiddenException('Cannot modify another user');
    }

    if (dto.role !== undefined && !is_admin) {
      throw new ForbiddenException('Cannot change role');
    }

    if (dto.password !== undefined && !(self || is_admin)) {
      throw new ForbiddenException('Cannot change password for another user');
    }

    const data: Prisma.UserUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.img !== undefined) data.img = dto.img;

    if (dto.active !== undefined) {
      if (!is_admin && dto.active !== target_user.active) {
        throw new ForbiddenException('Cannot change active flag');
      }
      if (is_admin) data.active = dto.active;
    }

    if (dto.role !== undefined && is_admin) {
      data.role = dto.role;
    }

    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma.user.update({
      where: { id: target_id },
      data,
    });
  }

  async findUser(
    email: string,
    options?: {
      withPassword?: boolean;
    },
  ): Promise<User | null> {
    const user = await this.prisma.user.findFirst({
      ...(options?.withPassword && {
        select: {
          password: options?.withPassword,
          id: true,
          email: true,
          img: true,
        },
      }),

      where: {
        OR: [{ email: email }, { id: email }],
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user as User;
  }

  /** Returns requested user profile when caller may read it (self or admin only). */
  async findUserAuthorized(
    actor_user_id: string,
    lookup_id: string,
  ): Promise<Omit<User, 'password'>> {
    const actor = await this.prisma.user.findUnique({
      where: { id: actor_user_id },
    });
    if (!actor) {
      throw new NotFoundException('User not found');
    }

    const is_self = actor_user_id === lookup_id;
    const is_admin = actor.role === Role.ADMIN;
    if (!is_self && !is_admin) {
      throw new ForbiddenException('Forbidden');
    }

    const looked_up = await this.prisma.user.findUnique({
      where: { id: lookup_id },
    });
    if (!looked_up) {
      throw new NotFoundException('User not found');
    }

    const { password: _pw, ...rest } = looked_up;
    void _pw;
    return rest;
  }

  async deleteUserAuthorized(
    actor_user_id: string,
    target_id: string,
  ): Promise<User> {
    const actor = await this.prisma.user.findUnique({
      where: { id: actor_user_id },
    });

    const is_admin = actor?.role === Role.ADMIN;

    const is_self = actor_user_id === target_id;

    if (!actor || !(is_admin || is_self)) {
      throw new ForbiddenException('Forbidden');
    }

    return this.prisma.user.delete({
      where: { id: target_id },
    });
  }

  async deleteUser(where: Prisma.UserWhereUniqueInput): Promise<User> {
    return this.prisma.user.delete({
      where,
    });
  }
}
