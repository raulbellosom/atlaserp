# Atlas ERP — Supabase + Prisma Strategy

## Supabase instance

| Endpoint | URL |
|---|---|
| API | https://supabase.racoondevs.com |
| Studio | https://studio.supabase.racoondevs.com |

Dedicated to Atlas ERP. Not Supabase Cloud — self-hosted on a VPS.

## What Atlas uses from Supabase

| Feature | How Atlas uses it |
|---|---|
| PostgreSQL | Primary database for all Atlas business models, accessed via Prisma |
| Auth | Session management, JWT tokens, password recovery, admin user creation |
| Storage | Physical file storage (logos, documents, media) |
| Realtime | Future: live dashboard updates, notifications |

## Prisma owns the Atlas schema

Prisma manages all tables in the `public` schema. Supabase internal schemas (`auth`, `storage`, `realtime`, `extensions`) are **never** touched by Prisma migrations.

**Hard rule:** Never write a Prisma migration that references `auth.*`, `storage.*`, or any Supabase-internal schema.

## Database connection

PostgreSQL is **not exposed publicly**. Local development connects through an SSH tunnel.

### Open the SSH tunnel (required before any Prisma command)

```bash
ssh -L 54322:172.22.0.3:5432 root@76.13.114.109
```

Keep the terminal open. The tunnel maps local port `54322` to PostgreSQL on the VPS.

### Connection strings in .env

```bash
DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:54322/postgres
DIRECT_URL=postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:54322/postgres
```

`POSTGRES_PASSWORD` is in the VPS file at `/opt/supabase-atlaserp/supabase/docker/.env`.

### schema.prisma

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

`DATABASE_URL` and `DIRECT_URL` are identical in this self-hosted setup (no pgBouncer by default).

## Where to get credentials

All Supabase credentials come from the VPS file:
`/opt/supabase-atlaserp/supabase/docker/.env`

| .env variable | VPS .env key |
|---|---|
| `SUPABASE_ANON_KEY` | `ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | `SERVICE_ROLE_KEY` |
| `SUPABASE_JWT_SECRET` | `JWT_SECRET` |
| `DATABASE_URL` / `DIRECT_URL` | Use `POSTGRES_PASSWORD` |

**Note:** The "Settings → API" and "Settings → Database" screens in Studio may not be available on this self-hosted instance. The VPS .env file is the source of truth.

## JWT secrets — two distinct values

| Variable | Purpose |
|---|---|
| `SUPABASE_JWT_SECRET` | The secret Supabase uses to sign auth tokens. From VPS .env. |
| `JWT_SECRET` | Atlas API's own secret for any tokens Atlas generates independently. |

## Auth bridge: Supabase auth.users → Atlas UserProfile

1. Atlas API calls `supabaseAdmin.auth.admin.createUser(...)` using the service role key
2. Supabase creates the user in `auth.users`
3. Atlas API creates a `UserProfile` row with `authUserId` = Supabase auth UUID

`UserProfile.authUserId` is a string UUID — no Prisma foreign key to `auth.users` (Supabase owns that table).

On login:
1. React calls Supabase Auth → gets JWT
2. Every API request sends `Authorization: Bearer <jwt>`
3. Atlas API calls `supabaseAdmin.auth.getUser(jwt)` to verify
4. Loads UserProfile by `authUserId` → loads Membership → Role → Permissions

## Supabase Storage bucket strategy

| Bucket | Contents | Access pattern |
|---|---|---|
| `atlas-branding` | Company logos, branding assets | API-proxied signed URL |
| `atlas-files` | General uploads from any module | API-proxied signed URL |

Frontend never accesses Supabase Storage directly. Atlas API generates signed URLs or proxies bytes.

File metadata stored in `FileAsset` Prisma model (bucket, objectKey, originalName, mimeType, sizeBytes).

## Migration workflow

```bash
# 1. Open SSH tunnel first (see above)
# 2. After changing prisma/schema.prisma:
pnpm db:generate   # regenerate Prisma client
pnpm db:migrate    # apply migration via tunnel
```

Migrations committed to git in `prisma/migrations/`. Never run `prisma migrate reset` on production.

## Hard rules

- Do not access Supabase tables directly from React (`supabase.from('table').select()`)
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_JWT_SECRET` in frontend or VITE_ env vars
- Do not call `supabase.auth.signUp()` from frontend for ERP user creation — use Atlas API
- Do not bypass Atlas API for critical ERP writes
- Do not expose PostgreSQL publicly without explicit security review
