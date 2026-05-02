import { Test, TestingModule } from '@nestjs/testing';
import { ArticleController } from './article.controller';
import { ArticleService } from './article.service';
import { FileService } from 'src/file/file.service';

describe('ArticleController', () => {
  let controller: ArticleController;
  let articleService: {
    create: jest.Mock;
    findAll: jest.Mock;
    search: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let fileService: {
    streamStaticFile: jest.Mock;
  };

  beforeEach(async () => {
    articleService = {
      create: jest.fn(),
      findAll: jest.fn(),
      search: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    fileService = {
      streamStaticFile: jest.fn(),
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

    await expect(controller.search('  title  ', undefined, 25)).resolves.toEqual(
      [],
    );

    expect(articleService.search).toHaveBeenCalledWith({
      term: 'title',
      skip: 0,
      take: 25,
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
