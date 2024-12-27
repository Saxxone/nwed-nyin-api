import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const ui_base_url = process.env.UI_BASE_URL || 'http://localhost:5000';
  const api_base_url = process.env.API_BASE_URL || 'http://localhost:8080';
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ui_base_url,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
  });
  await app.listen(8080);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
