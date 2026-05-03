# Atlas ERP — Supabase + Prisma Strategy

## Supabase instance

| Endpoint | URL |
|---|---|
| API | https://supabase.racoondevs.com |
| Studio | https://studio.supabase.racoondevs.com |

Dedicated to Atlas ERP. Not shared with other projects.

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

Get connection strings from Supabase Studio → Settings → Database → Connection String.

```bash
# schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

```bash
# .env
DATABASE_URL=postgresql://postgres:[password]@db.supabase.racoondevs.com:5432/postgres
DIRECT_URL=postgresql://postgres:[password]@db.supabase.racoondevs.com:5432/postgres
```

Self-hosted Supabase typically does not use pgBouncer by default, so DATABASE_URL and DIRECT_URL may have the same value. Verify in Studio.

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
# After changing prisma/schema.prisma:
pnpm db:generate   # regenerate Prisma client
pnpm db:migrate    # apply migration to Supabase PostgreSQL
```

Migrations committed to git in `prisma/migrations/`. Never run `prisma migrate reset` on production.

## Hard rules

- Do not access Supabase tables directly from React (`supabase.from('table').select()`)
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` in frontend or VITE_ env vars
- Do not call `supabase.auth.signUp()` from frontend for ERP user creation — use Atlas API
- Do not bypass Atlas API for critical ERP writes
