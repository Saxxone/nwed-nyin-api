import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { UserService } from 'src/user/user.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    signIn: jest.Mock;
    refresh: jest.Mock;
    signInGoogle: jest.Mock;
    signUpGoogle: jest.Mock;
    signOut: jest.Mock;
  };
  let userService: {
    findUser: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      signIn: jest.fn(),
      refresh: jest.fn(),
      signInGoogle: jest.fn(),
      signUpGoogle: jest.fn(),
      signOut: jest.fn(),
    };
    userService = {
      findUser: jest.fn(),
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
