import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppService } from './app.service';
import { ArticleModule } from './article/article.module';
import { DictionaryModule } from './dictionary/dictionary.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthGuard } from './auth/auth.guard';
import { LoggingInterceptor } from './app.interceptor';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaService } from './prisma/prisma.service';
import { FileModule } from './file/file.module';
import { resolve } from 'path';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MulterModule.register({
      dest: '../articles',
    }),
    ServeStaticModule.forRoot({
      // Compiled to dist/src/*.js — repo root is two levels up (same basis as uploads in file.controller.ts).
      rootPath: resolve(__dirname, '..', '..', 'public'),
      serveRoot: '/articles/',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 200,
      },
    ]),
    ArticleModule,
    DictionaryModule,
    AuthModule,
    UserModule,
    FileModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
