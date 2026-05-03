import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { FileService } from '../file/file.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { DictionaryService } from './dictionary.service';

type AnyMock = jest.Mock<any>;

describe('DictionaryService', () => {
  let service: DictionaryService;
  let prisma: {
    $queryRaw: AnyMock;
    word: {
      findMany: AnyMock;
      findFirst: AnyMock;
      count: AnyMock;
    };
    wordPronunciationAudio: {
      count: AnyMock;
    };
    partOfSpeech: {
      findMany: AnyMock;
    };
  };

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn(),
      word: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
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
    const words = [{ id: 'word-1', term: 'ụlọ' }];
    prisma.$queryRaw.mockResolvedValue([{ id: 'word-1' }]);
    prisma.word.findMany.mockResolvedValue(words);
    prisma.word.count.mockResolvedValue(1);
    prisma.wordPronunciationAudio.count.mockResolvedValue(0);

    await expect(
      service.findAll({ cursor: 'undefined', skip: 0, take: 50 }),
    ).resolves.toEqual({
      words,
      totalCount: 1,
      audioCount: 0,
    });

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.word.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ['word-1'] },
          deleted_at: null,
        },
      }),
    );
    expect(prisma.word.findFirst).not.toHaveBeenCalled();
  });

  it('uses a normalized cursor sort for subsequent dictionary pages', async () => {
    prisma.word.findFirst.mockResolvedValue({ id: 'cursor-1', term: 'Aba' });
    prisma.$queryRaw.mockResolvedValue([{ id: 'word-2' }, { id: 'word-1' }]);
    prisma.word.findMany.mockResolvedValue([
      { id: 'word-1', term: 'aafo' },
      { id: 'word-2', term: 'abakpa' },
    ]);
    prisma.word.count.mockResolvedValue(2);
    prisma.wordPronunciationAudio.count.mockResolvedValue(0);

    await expect(
      service.findAll({ cursor: 'cursor-1', skip: 0, take: 2 }),
    ).resolves.toEqual({
      words: [
        { id: 'word-2', term: 'abakpa' },
        { id: 'word-1', term: 'aafo' },
      ],
      totalCount: 2,
      audioCount: 0,
    });

    expect(prisma.word.findFirst).toHaveBeenCalledWith({
      where: { id: 'cursor-1', deleted_at: null },
      select: { id: true, term: true },
    });
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
          AND: [
            {
              OR: [
                { term: { contains: 'ulo' } },
                { alt_spelling: { contains: 'ulo' } },
              ],
            },
            { deleted_at: null },
          ],
        },
        take: 5,
      }),
    );
  });
});
