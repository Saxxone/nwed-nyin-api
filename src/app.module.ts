import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ArticleModule } from './article/article.module';
import { DictionaryModule } from './dictionary/dictionary.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { FileModule } from './file/file.module';

@Module({
  imports: [ArticleModule, DictionaryModule, AuthModule, UserModule, FileModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
