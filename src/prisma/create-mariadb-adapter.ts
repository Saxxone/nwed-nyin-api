import { PrismaMariaDb } from '@prisma/adapter-mariadb';

/** MariaDB-compatible driver adapter for DATABASE_URL (MySQL URIs accepted by mariadb connector). */
export function createPrismaMariaDbAdapter(): PrismaMariaDb {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required for Prisma.');
  }
  return new PrismaMariaDb(url);
}
