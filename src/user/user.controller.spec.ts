import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  let controller: UserController;
  let userService: {
    createUser: jest.Mock;
    findUser: jest.Mock;
    updateUser: jest.Mock;
    deleteUser: jest.Mock;
  };

  beforeEach(async () => {
    userService = {
      createUser: jest.fn(),
      findUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
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
    userService.updateUser.mockResolvedValue(user);

    await expect(controller.updateUser('user-1', { name: 'Updated' })).resolves.toBe(
      user,
    );

    expect(userService.updateUser).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { name: 'Updated' },
    });
  });
});
