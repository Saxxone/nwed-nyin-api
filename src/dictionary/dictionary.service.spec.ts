import { Test, TestingModule } from '@nestjs/testing';
import { DictionaryService } from './dictionary.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { FileService } from '../file/file.service';

describe('DictionaryService', () => {
  let service: DictionaryService;
  let prisma: {
    $transaction: jest.Mock;
    word: {
      findMany: jest.Mock;
      count: jest.Mock;
    };
    wordPronunciationAudio: {
      count: jest.Mock;
    };
    partOfSpeech: {
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      word: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      wordPronunciationAudio: {
        count: jest.fn(),
      },
      partOfSpeech: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DictionaryService,
        { provide: PrismaService, useValue: prisma },
        { provide: UserService, useValue: {} },
        { provide: FileService, useValue: {} },
      ],
    }).compile();

    service = module.get<DictionaryService>(DictionaryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('finds words with pagination and counts', async () => {
    const response = [[{ id: 'word-1', term: 'ụlọ' }], 1, 0];
    prisma.$transaction.mockResolvedValue(response);

    await expect(
      service.findAll({ cursor: 'undefined', skip: 0, take: 50 }),
    ).resolves.toEqual({
      words: response[0],
      totalCount: 1,
      audioCount: 0,
    });

    expect(prisma.word.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        skip: 0,
        orderBy: { term: 'asc' },
      }),
    );
    expect(prisma.word.findMany.mock.calls[0][0]).not.toHaveProperty('cursor');
  });

  it('fetches parts of speech', async () => {
    const partsOfSpeech = [{ id: 'noun', name: 'Noun' }];
    prisma.partOfSpeech.findMany.mockResolvedValue(partsOfSpeech);

    await expect(service.findAllPartsOfSpeech()).resolves.toBe(partsOfSpeech);
  });

  it('searches term and alternative spelling fields', async () => {
    prisma.word.findMany.mockResolvedValue([]);

    await expect(service.search('ulo')).resolves.toEqual([]);

    expect(prisma.word.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { term: { contains: 'ulo' } },
            { alt_spelling: { contains: 'ulo' } },
          ],
        },
        take: 5,
      }),
    );
  });
});
