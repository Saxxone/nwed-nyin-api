import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { DictionaryController } from './dictionary.controller';
import { DictionaryService } from './dictionary.service';
import { FileService } from '../file/file.service';

type AnyMock = Mock<(...args: any[]) => any>;

describe('DictionaryController', () => {
  let controller: DictionaryController;
  let dictionaryService: {
    create: AnyMock;
    findAll: AnyMock;
    findAllPartsOfSpeech: AnyMock;
    jump: AnyMock;
    search: AnyMock;
    findWordById: AnyMock;
    findOne: AnyMock;
    update: AnyMock;
    remove: AnyMock;
  };
  let fileService: {
    streamLegacyPublicPath: AnyMock;
  };

  beforeEach(async () => {
    dictionaryService = {
      create: jest.fn<(...args: any[]) => any>(),
      findAll: jest.fn<(...args: any[]) => any>(),
      findAllPartsOfSpeech: jest.fn<(...args: any[]) => any>(),
      jump: jest.fn<(...args: any[]) => any>(),
      search: jest.fn<(...args: any[]) => any>(),
      findWordById: jest.fn<(...args: any[]) => any>(),
      findOne: jest.fn<(...args: any[]) => any>(),
      update: jest.fn<(...args: any[]) => any>(),
      remove: jest.fn<(...args: any[]) => any>(),
    };
    fileService = {
      streamLegacyPublicPath: jest.fn<(...args: any[]) => any>(),
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
