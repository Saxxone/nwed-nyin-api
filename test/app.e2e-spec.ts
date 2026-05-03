import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { beforeEach, describe, it } from '@jest/globals';

type SupertestRequest = (
  app: Parameters<typeof request.agent>[0],
) => ReturnType<typeof request.agent>;

const supertestRequest = ((request as unknown as { default?: SupertestRequest })
  .default ?? request) as SupertestRequest;

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return supertestRequest(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Nwed nyin API! v1');
  });
});
