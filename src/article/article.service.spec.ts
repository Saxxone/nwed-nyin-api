import { Test, TestingModule } from '@nestjs/testing';
import { ArticleService } from './article.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { FileService } from '../file/file.service';

describe('ArticleService', () => {
  let service: ArticleService;
  let prisma: {
    article: {
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      article: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleService,
        { provide: PrismaService, useValue: prisma },
        { provide: UserService, useValue: {} },
        { provide: FileService, useValue: {} },
      ],
    }).compile();

    service = module.get<ArticleService>(ArticleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('finds published articles with pagination', async () => {
    const articles = [{ id: 'article-1', title: 'Title' }];
    prisma.article.findMany.mockResolvedValue(articles);

    await expect(service.findAll({ skip: 5, take: 10 })).resolves.toEqual(
      articles,
    );

    expect(prisma.article.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'PUBLISHED' },
        skip: 5,
        take: 10,
        orderBy: { created_at: 'desc' },
      }),
    );
  });

  it('falls back to findAll for blank searches', async () => {
    const findAllSpy = jest.spyOn(service, 'findAll').mockResolvedValue([]);

    await expect(
      service.search({ term: '   ', skip: 0, take: 10 }),
    ).resolves.toEqual([]);

    expect(findAllSpy).toHaveBeenCalledWith({ skip: 0, take: 10 });
    expect(prisma.article.findMany).not.toHaveBeenCalled();
  });

  it('searches article fields for non-empty terms', async () => {
    prisma.article.findMany.mockResolvedValue([]);

    await expect(
      service.search({ term: ' title ', skip: 0, take: 10 }),
    ).resolves.toEqual([]);

    expect(prisma.article.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          OR: expect.arrayContaining([
            { title: { contains: 'title' } },
            { summary: { contains: 'title' } },
            { slug: { contains: 'title' } },
          ]),
        }),
        skip: 0,
        take: 10,
      }),
    );
  });
});
