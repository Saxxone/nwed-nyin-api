import * as dotenv from 'dotenv';

dotenv.config();

export const jwtConstants = {
  secret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
};

/** Access JWT lifetime in days (must match `AuthToken` row for access tokens). */
export const ACCESS_TOKEN_TTL_DAYS = 30;

/** Refresh JWT lifetime in days (must match `AuthToken` row for refresh tokens). */
export const REFRESH_TOKEN_TTL_DAYS = 90;
