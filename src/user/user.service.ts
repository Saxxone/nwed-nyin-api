import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateFedUserDto, CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(d: CreateUserDto): Promise<User> {
    const default_img = process.env.DEFAULT_PROFILE_IMG;

    const data = {
      ...d,
      img: d.img ?? default_img,
      password: await bcrypt.hash(d.password, 10),
    };

    return this.prisma.user.create({
      data,
    });
  }

  async createFedUser(data: CreateFedUserDto): Promise<User> {
    return await this.prisma.user.create({ data });
  }

  async updateUser(params: {
    where: Prisma.UserWhereUniqueInput;
    data: UpdateUserDto;
  }): Promise<User> {
    const { where, data } = params;
    return this.prisma.user.update({
      data,
      where,
    });
  }

  async findUser(
    usernameOrEmail: string,
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
        OR: [{ email: usernameOrEmail }, { id: usernameOrEmail }],
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user as User;
  }

  async deleteUser(where: Prisma.UserWhereUniqueInput): Promise<User> {
    return this.prisma.user.delete({
      where,
    });
  }
}
