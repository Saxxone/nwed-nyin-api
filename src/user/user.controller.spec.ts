import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { UserController } from './user.controller';
import { UserService } from './user.service';

type AnyMock = Mock<(...args: any[]) => any>;

describe('UserController', () => {
  let controller: UserController;
  let userService: {
    createUser: AnyMock;
    updateAuthenticatedProfile: AnyMock;
  };

  beforeEach(async () => {
    userService = {
      createUser: jest.fn<(...args: any[]) => any>(),
      updateAuthenticatedProfile: jest.fn<(...args: any[]) => any>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: userService }],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('registers a new user', async () => {
    const dto = {
      name: 'Editor',
      email: 'editor@example.com',
      password: 'secret',
    };
    const user = { id: 'user-1', ...dto };
    userService.createUser.mockResolvedValue(user);

    await expect(controller.signupUser(dto)).resolves.toBe(user);

    expect(userService.createUser).toHaveBeenCalledWith(dto);
  });

  it('propagates registration errors', async () => {
    userService.createUser.mockRejectedValue(new Error('duplicate user'));

    await expect(
      controller.signupUser({
        name: 'Editor',
        email: 'editor@example.com',
        password: 'secret',
      }),
    ).rejects.toThrow('duplicate user');
  });

  it('updates users by id', async () => {
    const user = { id: 'user-1', name: 'Updated' };
    userService.updateAuthenticatedProfile.mockResolvedValue(user);
    const req = { user: { user_id: 'user-1', sub: 'e@example.com' } };

    await expect(
      controller.updateUser('user-1', { name: 'Updated' }, req as any),
    ).resolves.toBe(user);

    expect(userService.updateAuthenticatedProfile).toHaveBeenCalledWith(
      'user-1',
      'user-1',
      { name: 'Updated' },
    );
  });
});
