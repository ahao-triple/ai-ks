# Runtime Environment

AI-KS uses the repository-root `.env` file as the single source for local
runtime configuration. Both the API server and the web client depend on these
values when they start.

## Setup

Create the local environment file from the checked-in example:

```bash
cp .env.example .env
```

Then edit `.env` for local ports, database connection, JWT secrets, admin
credentials, and integration mode.

## Server

The API package scripts run through `scripts/with-root-env.mjs`, which loads
the root `.env` before starting NestJS or Prisma commands.

Use:

```bash
pnpm dev:api
```

Key server variables include `API_PORT`, `DATABASE_URL`,
`PRISMA_CONNECT_ON_BOOT`, `PRISMA_SCHEMA_CHECK_ON_BOOT`, `JWT_SECRET`,
`ADMIN_JWT_SECRET`, `KUAISHOU_API_MODE`, and the real Kuaishou credentials
when real mode is used.

The API checks key database tables and columns on startup by default. If the
database schema is behind the Prisma schema, startup fails with a message that
lists the missing columns. Confirm the root `.env` `DATABASE_URL` points to the
intended database, then run:

```bash
pnpm --filter api prisma:push
```

Do not use `PRISMA_SCHEMA_CHECK_ON_BOOT=false` for normal development. It is
only for tests or short maintenance windows where the database is being updated
separately.

## Web Client

The Vite web client also reads the root `.env`. `WEB_PORT` controls the local
Vite server port, and `VITE_API_BASE_URL` controls the API base URL embedded in
the browser bundle. `API_PORT` is also used by the Vite dev proxy configuration.

Use:

```bash
pnpm dev:web
```

For the full local stack, use:

```bash
pnpm dev
```

Keep `VITE_API_BASE_URL` aligned with `API_PORT` when the API port changes.
