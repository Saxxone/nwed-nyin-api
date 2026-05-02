import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { UserService } from '../user/user.service';

type AnyMock = Mock<(...args: any[]) => any>;

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    signIn: AnyMock;
    refresh: AnyMock;
    signInGoogle: AnyMock;
    signUpGoogle: AnyMock;
    signOut: AnyMock;
  };
  let userService: {
    findUser: AnyMock;
  };

  beforeEach(async () => {
    authService = {
      signIn: jest.fn<(...args: any[]) => any>(),
      refresh: jest.fn<(...args: any[]) => any>(),
      signInGoogle: jest.fn<(...args: any[]) => any>(),
      signUpGoogle: jest.fn<(...args: any[]) => any>(),
      signOut: jest.fn<(...args: any[]) => any>(),
    };
    userService = {
      findUser: jest.fn<(...args: any[]) => any>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: UserService, useValue: userService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('signs in with email and password', async () => {
    const response = { access_token: 'access-token' };
    authService.signIn.mockResolvedValue(response);

    await expect(
      controller.signIn({ email: 'editor@example.com', password: 'secret' }),
    ).resolves.toBe(response);

    expect(authService.signIn).toHaveBeenCalledWith(
      'editor@example.com',
      'secret',
    );
  });

  it('rejects refresh requests without a token', async () => {
    await expect(controller.refresh('')).rejects.toThrow(UnauthorizedException);
    expect(authService.refresh).not.toHaveBeenCalled();
  });

  it('refreshes an access token when a refresh token is provided', async () => {
    authService.refresh.mockResolvedValue({ access_token: 'new-token' });

    await expect(controller.refresh('refresh-token')).resolves.toEqual({
      access_token: 'new-token',
    });

    expect(authService.refresh).toHaveBeenCalledWith('refresh-token');
  });

  it('returns the authenticated user profile', async () => {
    const user = { id: 'user-1', email: 'editor@example.com' };
    userService.findUser.mockResolvedValue(user);

    await expect(controller.getProfile('user-1')).resolves.toBe(user);

    expect(userService.findUser).toHaveBeenCalledWith('user-1');
  });
});
