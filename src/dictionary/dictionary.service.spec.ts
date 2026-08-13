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

  it('searches term, alternative spelling, and definition meaning fields', async () => {
    prisma.word.findMany.mockResolvedValue([]);

    await expect(service.search('ulo')).resolves.toEqual([]);

    expect(prisma.word.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deleted_at: null,
          OR: [
            { term: { contains: 'ulo' } },
            { alt_spelling: { contains: 'ulo' } },
            {
              definitions: {
                some: { meaning: { contains: 'ulo' } },
              },
            },
          ],
        },
        take: 400,
      }),
    );
  });

  it('returns the word whose definition best matches a natural description', async () => {
    prisma.word.findMany.mockResolvedValue([
      {
        id: 'gathering-place',
        term: 'square',
        alt_spelling: null,
        definitions: [
          {
            id: 'square-definition',
            meaning: 'A public place where people gather.',
          },
        ],
      },
      {
        id: 'home-word',
        term: 'ufok',
        alt_spelling: 'ufọk',
        definitions: [
          { id: 'shape-definition', meaning: 'A structure.' },
          {
            id: 'home-definition',
            meaning: 'House, home, or a place where people live.',
          },
        ],
      },
    ]);

    const results = await service.search('place where people live');

    expect(results[0]).toEqual(
      expect.objectContaining({
        id: 'home-word',
        search_match: {
          field: 'meaning',
          text: 'House, home, or a place where people live.',
        },
      }),
    );
  });

  it('ranks exact terms ahead of meaning-only matches', async () => {
    prisma.word.findMany.mockResolvedValue([
      {
        id: 'meaning-match',
        term: 'ima',
        alt_spelling: null,
        definitions: [{ id: 'definition-1', meaning: 'A house full of care.' }],
      },
      {
        id: 'exact-term',
        term: 'house',
        alt_spelling: null,
        definitions: [{ id: 'definition-2', meaning: 'A building.' }],
      },
    ]);

    const results = await service.search('house');

    expect(results.map((result) => result.id)).toEqual([
      'exact-term',
      'meaning-match',
    ]);
    expect(results[0]?.search_match.field).toBe('term');
  });

  it('limits results to five and resolves score ties alphabetically then by id', async () => {
    prisma.word.findMany.mockResolvedValue(
      ['zeta', 'beta', 'alpha', 'delta', 'gamma', 'epsilon'].map(
        (term, index) => ({
          id: `word-${index}`,
          term,
          alt_spelling: null,
          definitions: [
            { id: `definition-${index}`, meaning: 'A shared place.' },
          ],
        }),
      ),
    );

    const results = await service.search('place');

    expect(results.map((result) => result.term)).toEqual([
      'alpha',
      'beta',
      'delta',
      'epsilon',
      'gamma',
    ]);
  });

  it('does not query the database for a blank search', async () => {
    await expect(service.search('  ')).resolves.toEqual([]);
    expect(prisma.word.findMany).not.toHaveBeenCalled();
  });
});
