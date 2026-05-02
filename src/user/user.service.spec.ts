import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

describe('UserService', () => {
  let service: UserService;
  let prisma: {
    user: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates users with hashed passwords and default editor role', async () => {
    process.env.DEFAULT_PROFILE_IMG = '/profiles/default.jpg';
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
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
        role: 'EDITOR',
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
