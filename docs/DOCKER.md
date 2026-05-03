# Docker

Atlas uses Docker only for infrastructure services — Postgres, Redis, and MinIO. The API, worker, and frontend run locally so you keep hot reload and full IDE debugging.

## Recommended setup

```bash
pnpm infra:up       # starts postgres, redis, minio in the background
pnpm dev            # starts API + Vite + worker locally
```

## Infrastructure commands

```bash
pnpm infra:up       # start Postgres + Redis + MinIO (detached)
pnpm infra:down     # stop containers (data is preserved)
pnpm infra:reset    # stop + destroy volumes + restart (wipes all data)
pnpm infra:logs     # tail logs for postgres/redis/minio
pnpm infra:status   # show running containers and ports
```

Or use docker compose directly:

```bash
docker compose -f docker-compose.local-lite.yml up -d postgres redis minio
docker compose -f docker-compose.local-lite.yml down
docker compose -f docker-compose.local-lite.yml down -v   # removes volumes
```

## Ports exposed by Docker

| Container | Port |
|---|---|
| PostgreSQL | 5432 |
| Redis | 6379 |
| MinIO API | 9000 |
| MinIO Console | 9001 |

## Full containerized stack (optional)

`docker-compose.local-lite.yml` also defines `api`, `web`, and `worker` services if you want to run everything in containers. This is useful for CI or when onboarding without a local Node setup:

```bash
docker compose -f docker-compose.local-lite.yml up --build
docker compose -f docker-compose.local-lite.yml exec api pnpm db:migrate
docker compose -f docker-compose.local-lite.yml exec api pnpm db:seed
```

Note: hot reload does not work well inside containers on Windows due to filesystem event limitations. Local dev (`pnpm dev`) is preferred.

## Tauri desktop build

The native `.exe` build must run on Windows with the Rust toolchain installed. Docker cannot produce a native Windows binary.

```bash
pnpm dev:tauri      # native window with hot reload (requires rustup + Cargo)
pnpm build          # release build
```

## Supabase self-hosted

See [../infra/supabase/README.md](../infra/supabase/README.md).
