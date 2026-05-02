import { Test, TestingModule } from '@nestjs/testing';
import { DictionaryController } from './dictionary.controller';
import { DictionaryService } from './dictionary.service';
import { FileService } from 'src/file/file.service';

describe('DictionaryController', () => {
  let controller: DictionaryController;
  let dictionaryService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findAllPartsOfSpeech: jest.Mock;
    jump: jest.Mock;
    search: jest.Mock;
    findWordById: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let fileService: {
    streamStaticFile: jest.Mock;
  };

  beforeEach(async () => {
    dictionaryService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findAllPartsOfSpeech: jest.fn(),
      jump: jest.fn(),
      search: jest.fn(),
      findWordById: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    fileService = {
      streamStaticFile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DictionaryController],
      providers: [
        { provide: DictionaryService, useValue: dictionaryService },
        { provide: FileService, useValue: fileService },
      ],
    }).compile();

    controller = module.get<DictionaryController>(DictionaryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('fetches dictionary words with numeric pagination params', async () => {
    const response = { words: [], totalCount: 0, audioCount: 0 };
    dictionaryService.findAll.mockResolvedValue(response);

    await expect(controller.findAll(25, 5, 'cursor-1')).resolves.toBe(
      response,
    );

    expect(dictionaryService.findAll).toHaveBeenCalledWith({
      take: 25,
      skip: 5,
      cursor: 'cursor-1',
    });
  });

  it('returns an empty search result when no term is provided', async () => {
    await expect(controller.search('')).resolves.toEqual([]);
    expect(dictionaryService.search).not.toHaveBeenCalled();
  });

  it('normalizes dictionary search terms', async () => {
    dictionaryService.search.mockResolvedValue([]);

    await expect(controller.search('  ỤLỌ  ')).resolves.toEqual([]);

    expect(dictionaryService.search).toHaveBeenCalledWith('ụlọ');
  });

  it('delegates jump requests with normalized alphabet values', async () => {
    const response = { words: [], totalCount: 0, audioCount: 0 };
    dictionaryService.jump.mockResolvedValue(response);

    await expect(controller.jump('  B  ', 'cursor-1', 25)).resolves.toBe(
      response,
    );

    expect(dictionaryService.jump).toHaveBeenCalledWith({
      alphabet: 'b',
      cursor: 'cursor-1',
      take: 25,
    });
  });

  it('creates dictionary words for the authenticated user', async () => {
    const dto = { term: 'ụlọ', definitions: [] };
    const word = { id: 'word-1', ...dto };
    dictionaryService.create.mockResolvedValue(word);

    await expect(
      controller.create(dto as any, { user: { sub: 'editor@example.com' } }),
    ).resolves.toBe(word);

    expect(dictionaryService.create).toHaveBeenCalledWith(
      dto,
      'editor@example.com',
    );
  });

  it('fetches parts of speech', async () => {
    const partsOfSpeech = [{ id: 'noun', name: 'Noun' }];
    dictionaryService.findAllPartsOfSpeech.mockResolvedValue(partsOfSpeech);

    await expect(controller.findAllPS()).resolves.toBe(partsOfSpeech);
  });
});
