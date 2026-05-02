import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { PrismaService } from '../prisma/prisma.service';

type AnyMock = Mock<(...args: any[]) => any>;

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let userService: {
    findUser: AnyMock;
  };
  let jwtService: {
    signAsync: AnyMock;
    verifyAsync: AnyMock;
    decode: AnyMock;
  };
  let prisma: {
    authToken: {
      upsert: AnyMock;
      findUnique: AnyMock;
    };
  };

  beforeEach(async () => {
    userService = {
      findUser: jest.fn<(...args: any[]) => any>(),
    };
    jwtService = {
      signAsync: jest.fn<(...args: any[]) => any>(),
      verifyAsync: jest.fn<(...args: any[]) => any>(),
      decode: jest.fn<(...args: any[]) => any>(),
    };
    prisma = {
      authToken: {
        upsert: jest.fn<(...args: any[]) => any>(),
        findUnique: jest.fn<(...args: any[]) => any>(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserService, useValue: userService },
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('signs in a user and omits the password from the response', async () => {
    const user = {
      id: 'user-1',
      email: 'editor@example.com',
      password: 'hashed-password',
    };
    userService.findUser.mockResolvedValue(user);
    (bcrypt.compare as AnyMock).mockResolvedValue(true);
    jest.spyOn(service, 'generateTokens').mockResolvedValue({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });

    await expect(service.signIn('editor@example.com', 'secret')).resolves.toEqual(
      {
        id: 'user-1',
        email: 'editor@example.com',
        access_token: 'access-token',
        refresh_token: 'refresh-token',
      },
    );

    expect(userService.findUser).toHaveBeenCalledWith('editor@example.com', {
      withPassword: true,
    });
    expect(bcrypt.compare).toHaveBeenCalledWith('secret', 'hashed-password');
  });

  it('rejects sign in when the password is invalid', async () => {
    userService.findUser.mockResolvedValue({
      id: 'user-1',
      email: 'editor@example.com',
      password: 'hashed-password',
    });
    (bcrypt.compare as AnyMock).mockResolvedValue(false);

    await expect(service.signIn('editor@example.com', 'wrong')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('refreshes an access token from a valid refresh token', async () => {
    jest.spyOn(service, 'verifyrefresh_token').mockResolvedValue({
      sub: 'editor@example.com',
      user_id: 'user-1',
    });
    jest.spyOn(service, 'generateAccessToken').mockResolvedValue('new-access');

    await expect(service.refresh('refresh-token')).resolves.toEqual({
      access_token: 'new-access',
    });
  });
});
