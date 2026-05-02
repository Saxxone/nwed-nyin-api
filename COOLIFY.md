# Coolify Deployment

This API is intended to run in Coolify as a Dockerfile-based application.

## Application

- Source: this repository
- Base directory: `nwed-nyin-api`
- Build pack: Dockerfile
- Dockerfile: `Dockerfile`
- Exposed port: `8080`
- Health check path: `/health`

The container starts with:

```bash
npx prisma migrate deploy && npm run start:prod
```

This applies committed Prisma migrations before starting NestJS. Do not use `prisma migrate dev` against the hosted database.

## Database

Create a MySQL service in Coolify and set the API application's `DATABASE_URL` to the internal MySQL connection string that Coolify provides.

Use a separate staging database before applying new migrations to production.

## Persistent Storage

Mount a persistent volume at:

```text
/app/public
```

The API stores article markdown, uploaded files, pronunciations, and profile images under this directory. Without this volume, uploaded content is lost when Coolify replaces the container.

## Environment Variables

Set these variables in the Coolify application:

```env
PORT=8080
NODE_ENV=production
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DATABASE
UI_BASE_URL=https://www.nwednyin.org
FILE_BASE_URL=/public
PUBLIC_STORAGE_ROOT=/app/public
JWT_SECRET=replace-with-a-secure-secret
JWT_REFRESH_SECRET=replace-with-a-secure-refresh-secret
GOOGLE_AUTH_CLIENT_ID=replace-with-google-client-id
DEFAULT_PROFILE_IMG=/public/profiles/default.jpg
```

`FILE_BASE_URL` controls the public URL prefix stored in API responses. `PUBLIC_STORAGE_ROOT` controls the filesystem directory mounted as persistent storage.

## Deploy Checklist

1. Create the Coolify MySQL service.
2. Create the Coolify application from `nwed-nyin-api`.
3. Set the environment variables above.
4. Add the persistent volume mount at `/app/public`.
5. Deploy the application and confirm `/health` returns `{ "status": "ok" }`.
6. Confirm the web app uses the hosted API URL in its frontend environment.
