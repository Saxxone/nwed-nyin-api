import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';

type AnyMock = Mock<(...args: any[]) => any>;

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

describe('UserService', () => {
  let service: UserService;
  let prisma: {
    user: {
      create: AnyMock;
      findFirst: AnyMock;
      update: AnyMock;
      delete: AnyMock;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        create: jest.fn<(...args: any[]) => any>(),
        findFirst: jest.fn<(...args: any[]) => any>(),
        update: jest.fn<(...args: any[]) => any>(),
        delete: jest.fn<(...args: any[]) => any>(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UserService>(UserService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates users with hashed passwords and default viewer role', async () => {
    process.env.DEFAULT_PROFILE_IMG = '/profiles/default.jpg';
    (bcrypt.hash as AnyMock).mockResolvedValue('hashed-password');
    const user = { id: 'user-1', email: 'editor@example.com' };
    prisma.user.create.mockResolvedValue(user);

    await expect(
      service.createUser({
        name: 'Editor',
        email: 'editor@example.com',
        password: 'secret',
      }),
    ).resolves.toBe(user);

    expect(bcrypt.hash).toHaveBeenCalledWith('secret', 10);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Editor',
        email: 'editor@example.com',
        img: '/profiles/default.jpg',
        role: 'VIEWER',
        password: 'hashed-password',
      }),
    });
  });

  it('finds a user by email or id', async () => {
    const user = { id: 'user-1', email: 'editor@example.com' };
    prisma.user.findFirst.mockResolvedValue(user);

    await expect(service.findUser('editor@example.com')).resolves.toBe(user);

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ email: 'editor@example.com' }, { id: 'editor@example.com' }],
      },
    });
  });

  it('throws when a user cannot be found', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.findUser('missing@example.com')).rejects.toThrow(
      NotFoundException,
    );
  });
});
