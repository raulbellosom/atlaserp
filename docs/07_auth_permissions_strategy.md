# Atlas ERP — Authentication and Permissions Strategy

## Two-layer architecture

| Concern | Owner |
|---|---|
| Email/password login | Supabase Auth |
| Session tokens (JWT) | Supabase Auth |
| Password recovery | Supabase Auth |
| User profiles | Atlas API + Prisma |
| Companies + memberships | Atlas API + Prisma |
| Roles + permissions | Atlas API + Prisma |
| Module access control | Atlas API + Prisma |

## Auth flow

1. React calls `supabase.auth.signInWithPassword({ email, password })` (anon key)
2. Supabase returns a signed JWT
3. Supabase client stores session and handles refresh automatically
4. Every `@atlas/sdk` request includes `Authorization: Bearer <jwt>`
5. Atlas API calls `supabaseAdmin.auth.getUser(jwt)` to verify (service role key)
6. API loads UserProfile by `authUserId` → Membership → Role → Permissions
7. Route handler receives verified user context

## RBAC data model

```
UserProfile (authUserId → Supabase auth.users.id)
  ↓
Membership  (UserProfile ↔ Company ↔ Role)
  ↓
Role
  ↓
RolePermission  (Role ↔ Permission)
  ↓
Permission  (key: 'contacts.read', moduleId, etc.)
```

## User vs. HR employee

```
Supabase auth.users
  ↓ (authUserId)
UserProfile          ← someone who can log in to Atlas ERP
  ↓ (optional)
HREmployee           ← HR/business record (future atlas.hr module)
```

- A `UserProfile` is an Atlas identity with login access.
- An `HREmployee` is a business record that may or may not have a login.
- Employees without user accounts are valid (contractors, archived staff).
- System users without employee records are valid (IT admins, service accounts).

`HREmployee` is added when `atlas.hr` is built. `UserProfile` exists today.

## Permission middleware (Phase 4 implementation)

```js
// apps/api/src/middleware/require-permission.js
export function requirePermission(permissionKey) {
  return async (c, next) => {
    const jwt = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!jwt) return c.json({ error: 'Unauthorized' }, 401)

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(jwt)
    if (error || !user) return c.json({ error: 'Unauthorized' }, 401)

    const profile = await prisma.userProfile.findUnique({
      where: { authUserId: user.id },
      include: {
        memberships: {
          where: { enabled: true },
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } }
              }
            }
          }
        }
      }
    })

    if (!profile || !profile.enabled) return c.json({ error: 'Forbidden' }, 403)

    const has = profile.memberships.some(m =>
      m.role.permissions.some(rp => rp.permission.key === permissionKey)
    )
    if (!has) return c.json({ error: 'Forbidden' }, 403)

    c.set('user', profile)
    await next()
  }
}
```

Usage in routes (Phase 4+):
```js
app.get('/contacts', requirePermission('contacts.read'), async (c) => { ... })
```

## Supabase Auth configuration (in Studio)

Navigate to https://studio.supabase.racoondevs.com → Authentication:
- Enable Email provider (email + password)
- JWT secret must match `JWT_SECRET` in `.env`
- Configure SMTP for password recovery emails
