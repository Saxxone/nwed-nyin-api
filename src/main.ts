import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common'; // Import ValidationPipe

async function bootstrap() {
  const ui_base_url = process.env.UI_BASE_URL || 'https://nwednyin.org';
  const api_base_url = process.env.API_BASE_URL || 'http://localhost:8080';
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ui_base_url,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
  });
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(8080);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
