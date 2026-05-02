import { Test, TestingModule } from '@nestjs/testing';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { DictionaryService } from '../dictionary/dictionary.service';

describe('FileController', () => {
  let controller: FileController;
  let fileService: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    getFilesUrls: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let dictionaryService: {
    updateWordPronunciation: jest.Mock;
  };

  beforeEach(async () => {
    fileService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      getFilesUrls: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    dictionaryService = {
      updateWordPronunciation: jest.fn(),
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
