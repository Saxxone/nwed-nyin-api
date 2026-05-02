import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let userService: {
    findUser: jest.Mock;
  };
  let jwtService: {
    signAsync: jest.Mock;
    verifyAsync: jest.Mock;
    decode: jest.Mock;
  };
  let prisma: {
    authToken: {
      upsert: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    userService = {
      findUser: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
      decode: jest.fn(),
    };
    prisma = {
      authToken: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
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
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
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
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

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
