import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { DictionaryService } from '../dictionary/dictionary.service';

type AnyMock = Mock<(...args: any[]) => any>;

describe('FileController', () => {
  let controller: FileController;
  let fileService: {
    findAll: AnyMock;
    findOne: AnyMock;
    getFilesUrls: AnyMock;
    update: AnyMock;
    remove: AnyMock;
  };
  let dictionaryService: {
    updateWordPronunciation: AnyMock;
  };

  beforeEach(async () => {
    fileService = {
      findAll: jest.fn<(...args: any[]) => any>(),
      findOne: jest.fn<(...args: any[]) => any>(),
      getFilesUrls: jest.fn<(...args: any[]) => any>(),
      update: jest.fn<(...args: any[]) => any>(),
      remove: jest.fn<(...args: any[]) => any>(),
    };
    dictionaryService = {
      updateWordPronunciation: jest.fn<(...args: any[]) => any>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FileController],
      providers: [
        { provide: FileService, useValue: fileService },
        { provide: DictionaryService, useValue: dictionaryService },
      ],
    }).compile();

    controller = module.get<FileController>(FileController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates file listing to the file service', () => {
    fileService.findAll.mockReturnValue('files');

    expect(controller.findAll()).toBe('files');
  });

  it('fetches file URLs for provided ids', async () => {
    const urls = [{ id: 'file-1', url: '/files/file-1.jpg' }];
    fileService.getFilesUrls.mockResolvedValue(urls);

    await expect(controller.getFileUrls(['file-1'])).resolves.toBe(urls);

    expect(fileService.getFilesUrls).toHaveBeenCalledWith(['file-1']);
  });

  it('updates files by id', () => {
    const dto = { caption: 'Caption' };
    fileService.update.mockReturnValue('updated');

    expect(controller.update('file-1', dto as any)).toBe('updated');

    expect(fileService.update).toHaveBeenCalledWith('file-1', dto);
  });
});
