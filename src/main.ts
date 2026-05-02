import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as os from 'os';
import { AppModule } from './app.module';

async function bootstrap() {
  const ui_base_url = process.env.UI_BASE_URL || 'https://www.nwednyin.org';
  const port = Number(process.env.PORT ?? 8080);
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ui_base_url,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
  });
  app.useGlobalPipes(new ValidationPipe());

  const network_interfaces = os.networkInterfaces();
  const local_network_ip = Object.values(network_interfaces)
    .flat()
    .find((iface) => iface?.family === 'IPv4' && !iface.internal)?.address;

  const accent = '\x1b[01m';
  const reset = '\x1b[0m';
  await app.listen(port, '0.0.0.0');
  console.log(
    `Application is running on: ${accent}${await app.getUrl()}${reset}`,
    `\nLocal network on: ${accent}http://${local_network_ip}:${port}${reset}`,
  );
}
bootstrap();
