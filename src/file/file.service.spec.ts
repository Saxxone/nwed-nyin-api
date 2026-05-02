import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { FileService } from './file.service';
import { UserService } from '../user/user.service';
import { PrismaService } from '../prisma/prisma.service';

type AnyMock = Mock<(...args: any[]) => any>;

describe('FileService', () => {
  let service: FileService;
  let userService: {
    findUser: AnyMock;
  };
  let prisma: {
    file: {
      create: AnyMock;
      findUnique: AnyMock;
    };
  };

  beforeEach(async () => {
    userService = {
      findUser: jest.fn<(...args: any[]) => any>(),
    };
    prisma = {
      file: {
        create: jest.fn<(...args: any[]) => any>(),
        findUnique: jest.fn<(...args: any[]) => any>(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileService,
        { provide: UserService, useValue: userService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FileService>(FileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates database records for uploaded files', async () => {
    process.env.FILE_BASE_URL = '/public';
    userService.findUser.mockResolvedValue({ id: 'user-1' });
    prisma.file.create.mockResolvedValue({ id: 'file-1' });

    await expect(
      service.create(
        [
          {
            filename: 'image.jpg',
            originalname: 'image.jpg',
            mimetype: 'image/jpeg',
            size: 120,
          } as Express.Multer.File,
        ],
        'editor@example.com',
        'files',
      ),
    ).resolves.toEqual(['file-1']);

    expect(userService.findUser).toHaveBeenCalledWith('editor@example.com');
    expect(prisma.file.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        filename: 'image.jpg',
        originalname: 'image.jpg',
        mimetype: 'image/jpeg',
        type: 'IMAGE',
        owner: {
          connect: { id: 'user-1' },
        },
      }),
    });
  });

  it('returns placeholder file lookups', () => {
    expect(service.findAll()).toBe('This action returns all file');
    expect(service.findOne('file-1')).toBe('This action returns a #file-1 file');
  });
});
