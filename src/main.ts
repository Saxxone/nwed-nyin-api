import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as os from 'os';
import helmet from 'helmet';
import { AppModule } from './app.module';

/** Normalize origins for comparisons (trim, no trailing slash). */
function normalizeOrigin(o: string): string {
  return o.trim().replace(/\/+$/, '');
}

/** Origins allowed for browsers (API + SPA on different localhost ports must both work). */
function corsAllowedOrigins(): string[] {
  const origins = new Set<string>();

  const primary = process.env.UI_BASE_URL || 'https://www.nwednyin.org';
  for (const chunk of primary.split(',')) {
    const o = normalizeOrigin(chunk);
    if (o.length) origins.add(o);
  }

  const extra =
    process.env.CORS_ORIGINS?.split(',').map(normalizeOrigin).filter(Boolean) ??
    [];
  for (const o of extra) origins.add(o);

  const prod = process.env.NODE_ENV === 'production';
  if (!prod || process.env.CORS_ALLOW_LOCALHOST === '1') {
    for (const dev of [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]) {
      origins.add(dev);
    }
  }

  return [...origins];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Default CORP is restrictive; SPA on :3000 loading images from API on :8080 needs cross-origin embedding.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.enableCors({
    origin: corsAllowedOrigins(),
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const network_interfaces = os.networkInterfaces();
  const local_network_ip = Object.values(network_interfaces)
    .flat()
    .find((iface) => iface?.family === 'IPv4' && !iface.internal)?.address;

  const accent = '\x1b[01m';
  const reset = '\x1b[0m';
  await app.listen(8080);
  console.log(
    `Application is running on: ${accent}${await app.getUrl()}${reset}`,
    `\nLocal network on: ${accent}http://${local_network_ip}:${process.env.PORT ?? 8080}${reset}`,
  );
}
bootstrap();
