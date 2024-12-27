import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ArticleModule } from './article/article.module';
import { DictionaryModule } from './dictionary/dictionary.module';

@Module({
  imports: [ArticleModule, DictionaryModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
