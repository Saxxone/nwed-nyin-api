import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { ArticleController } from './article.controller';
import { ArticleService } from './article.service';
import { FileService } from '../file/file.service';

type AnyMock = Mock<(...args: any[]) => any>;

describe('ArticleController', () => {
  let controller: ArticleController;
  let articleService: {
    create: AnyMock;
    findAll: AnyMock;
    search: AnyMock;
    findRelated: AnyMock;
    findOne: AnyMock;
    update: AnyMock;
    remove: AnyMock;
  };
  let fileService: {
    streamStaticFile: AnyMock;
  };

  beforeEach(async () => {
    articleService = {
      create: jest.fn<(...args: any[]) => any>(),
      findAll: jest.fn<(...args: any[]) => any>(),
      search: jest.fn<(...args: any[]) => any>(),
      findRelated: jest.fn<(...args: any[]) => any>(),
      findOne: jest.fn<(...args: any[]) => any>(),
      update: jest.fn<(...args: any[]) => any>(),
      remove: jest.fn<(...args: any[]) => any>(),
    };
    fileService = {
      streamStaticFile: jest.fn<(...args: any[]) => any>(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArticleController],
      providers: [
        { provide: ArticleService, useValue: articleService },
        { provide: FileService, useValue: fileService },
      ],
    }).compile();

    controller = module.get<ArticleController>(ArticleController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('fetches published articles with numeric pagination defaults', async () => {
    const articles = [{ id: 'article-1', title: 'Title' }];
    articleService.findAll.mockResolvedValue(articles);

    await expect(controller.findAll(undefined, undefined)).resolves.toBe(
      articles,
    );

    expect(articleService.findAll).toHaveBeenCalledWith({ skip: 0, take: 10 });
  });

  it('trims article search terms and applies pagination defaults', async () => {
    articleService.search.mockResolvedValue([]);

    await expect(
      controller.search('  title  ', undefined, 25),
    ).resolves.toEqual([]);

    expect(articleService.search).toHaveBeenCalledWith({
      term: 'title',
      skip: 0,
      take: 25,
    });
  });

  it('fetches related articles from article or word context', async () => {
    articleService.findRelated.mockResolvedValue([]);

    await expect(
      controller.findRelated(
        'word',
        undefined,
        'culture, ibibio',
        'seen-one,seen-two',
        3,
      ),
    ).resolves.toEqual([]);

    expect(articleService.findRelated).toHaveBeenCalledWith({
      source: 'word',
      slug: undefined,
      terms: ['culture', ' ibibio'],
      excludeSlugs: ['seen-one', 'seen-two'],
      take: 3,
    });
  });

  it('fetches an article by slug', async () => {
    const article = { id: 'article-1', slug: 'first-post' };
    articleService.findOne.mockResolvedValue(article);

    await expect(controller.findOne('first-post')).resolves.toBe(article);

    expect(articleService.findOne).toHaveBeenCalledWith('first-post');
  });

  it('publishes articles for the authenticated user', async () => {
    const dto = { title: 'Title', content: 'Body' };
    const article = { id: 'article-1', ...dto };
    articleService.create.mockResolvedValue(article);

    await expect(
      controller.create(dto as any, { user: { sub: 'editor@example.com' } }),
    ).resolves.toBe(article);

    expect(articleService.create).toHaveBeenCalledWith(
      dto,
      'editor@example.com',
    );
  });

  it('sets markdown response headers before streaming content', async () => {
    const stream = { stream: true };
    const response = { set: jest.fn() };
    fileService.streamStaticFile.mockResolvedValue(stream);

    await expect(
      controller.getArticleContent('articles/post.md', response as any),
    ).resolves.toBe(stream);

    expect(response.set).toHaveBeenCalledWith({
      'Content-Type': 'text/markdown',
      'Accept-Ranges': 'bytes',
      'Content-Disposition': 'inline; filename="articles/post.md.md"',
    });
    expect(fileService.streamStaticFile).toHaveBeenCalledWith(
      'articles/post.md',
      'articles',
    );
  });
});
