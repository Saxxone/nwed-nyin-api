import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*',
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
  });
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(8080);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
