# Platform Settings — SMTP

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global SMTP configuration screen at `/app/settings/integrations/smtp` and an `smtp-service.js` that any module can use to send emails via `nodemailer`.

**Architecture:** Credentials persist in the existing `InstanceConfig` table (key-value store). The SMTP password is AES-256-GCM encrypted before storage using `JWT_SECRET` as the key derivation input. `createSmtpService({ prisma })` reads and decrypts credentials at call time. A test endpoint sends a verification email to the logged-in user.

**Tech Stack:** React 18, TanStack Query, Tailwind, `@atlas/ui`, `nodemailer`, Node.js `crypto`

---

## File Map

### Create
- `apps/api/src/services/smtp-service.js` — shared email sender (reads InstanceConfig)
- `apps/api/src/routes/settings-routes.js` — `GET/POST /settings/smtp` and `POST /settings/smtp/test`
- `apps/desktop/src/modules/platform-settings/screens/SmtpSettingsScreen.jsx` — admin UI

### Modify
- `apps/api/src/index.js` — mount settings router
- `apps/desktop/src/app/ModuleOutlet.jsx` — register settings screen route
- `apps/desktop/src/app/AppShell.jsx` (or wherever sidebar nav is built) — add "Configuracion" nav entry

---

## Task 1 — Crypto helpers + smtp-service.js

**Files:**
- Create: `apps/api/src/services/smtp-service.js`

`nodemailer` is likely already in the project (check `apps/api/package.json`). If not, it must be added: `pnpm --filter @atlas/api add nodemailer`.

- [ ] **Step 1: Check if nodemailer is installed**

  ```bash
  grep "nodemailer" apps/api/package.json
  ```
  If not present, run:
  ```bash
  pnpm --filter @atlas/api add nodemailer
  ```

- [ ] **Step 2: Create smtp-service.js**

  ```js
  // apps/api/src/services/smtp-service.js
  import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
  import nodemailer from 'nodemailer'

  const ALGORITHM = 'aes-256-gcm'
  const SALT = 'atlas-smtp-v1'

  function deriveKey() {
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET is not set')
    return scryptSync(secret, SALT, 32)
  }

  export function encryptPassword(plaintext) {
    const key = deriveKey()
    const iv  = randomBytes(12)
    const cipher = createCipheriv(ALGORITHM, key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return Buffer.concat([iv, tag, encrypted]).toString('base64')
  }

  export function decryptPassword(ciphertext) {
    const key  = deriveKey()
    const buf  = Buffer.from(ciphertext, 'base64')
    const iv   = buf.subarray(0, 12)
    const tag  = buf.subarray(12, 28)
    const data = buf.subarray(28)
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  }

  export function createSmtpService({ prisma }) {
    async function getConfig() {
      const rows = await prisma.instanceConfig.findMany({
        where: {
          key: {
            in: ['smtp.host', 'smtp.port', 'smtp.user', 'smtp.pass',
                 'smtp.from_name', 'smtp.from_email', 'smtp.tls'],
          },
        },
      })
      const cfg = Object.fromEntries(rows.map((r) => [r.key, r.value]))
      if (!cfg['smtp.host'] || !cfg['smtp.user']) return null

      return {
        host:      cfg['smtp.host'],
        port:      Number(cfg['smtp.port'] ?? 587),
        user:      cfg['smtp.user'],
        pass:      cfg['smtp.pass'] ? decryptPassword(cfg['smtp.pass']) : '',
        fromName:  cfg['smtp.from_name'] ?? '',
        fromEmail: cfg['smtp.from_email'] ?? cfg['smtp.user'],
        tls:       cfg['smtp.tls'] === 'true',
      }
    }

    async function sendEmail({ to, subject, html, text }) {
      const config = await getConfig()
      if (!config) throw new Error('SMTP no configurado')

      const transporter = nodemailer.createTransport({
        host:   config.host,
        port:   config.port,
        secure: config.tls,
        auth:   { user: config.user, pass: config.pass },
      })

      await transporter.sendMail({
        from:    `"${config.fromName}" <${config.fromEmail}>`,
        to,
        subject,
        html,
        text,
      })
    }

    async function isConfigured() {
      const config = await getConfig()
      return Boolean(config)
    }

    return { sendEmail, isConfigured, getConfig }
  }
  ```

- [ ] **Step 3: Verify syntax**

  ```bash
  node --check apps/api/src/services/smtp-service.js
  ```

---

## Task 2 — Settings API routes

**Files:**
- Create: `apps/api/src/routes/settings-routes.js`

- [ ] **Step 1: Create the settings router**

  ```js
  // apps/api/src/routes/settings-routes.js
  import { Hono } from 'hono'
  import { z } from 'zod'
  import { zValidator } from '@hono/zod-validator'
  import { encryptPassword, createSmtpService } from '../services/smtp-service.js'

  const smtpSchema = z.object({
    host:       z.string().min(1),
    port:       z.number().int().min(1).max(65535).default(587),
    user:       z.string().min(1),
    pass:       z.string().optional(),
    from_name:  z.string().optional(),
    from_email: z.string().email().optional(),
    tls:        z.boolean().default(false),
  })

  export function createSettingsRouter({ prisma, requirePermission }) {
    const app = new Hono()

    app.get('/settings/smtp', requirePermission('platform.settings.manage'), async (c) => {
      const rows = await prisma.instanceConfig.findMany({
        where: {
          key: {
            in: ['smtp.host', 'smtp.port', 'smtp.user',
                 'smtp.from_name', 'smtp.from_email', 'smtp.tls'],
          },
        },
      })
      const cfg = Object.fromEntries(rows.map((r) => [r.key, r.value]))
      return c.json({
        data: {
          host:       cfg['smtp.host']       ?? '',
          port:       Number(cfg['smtp.port'] ?? 587),
          user:       cfg['smtp.user']       ?? '',
          from_name:  cfg['smtp.from_name']  ?? '',
          from_email: cfg['smtp.from_email'] ?? '',
          tls:        cfg['smtp.tls'] === 'true',
          configured: Boolean(cfg['smtp.host'] && cfg['smtp.user']),
        },
      })
    })

    app.post(
      '/settings/smtp',
      requirePermission('platform.settings.manage'),
      zValidator('json', smtpSchema),
      async (c) => {
        const data = c.req.valid('json')

        const entries = [
          { key: 'smtp.host',       value: data.host },
          { key: 'smtp.port',       value: String(data.port) },
          { key: 'smtp.user',       value: data.user },
          { key: 'smtp.from_name',  value: data.from_name  ?? '' },
          { key: 'smtp.from_email', value: data.from_email ?? '' },
          { key: 'smtp.tls',        value: String(data.tls) },
        ]

        if (data.pass) {
          entries.push({ key: 'smtp.pass', value: encryptPassword(data.pass) })
        }

        await Promise.all(
          entries.map((e) =>
            prisma.instanceConfig.upsert({
              where:  { key: e.key },
              create: { key: e.key, value: e.value },
              update: { value: e.value },
            }),
          ),
        )

        return c.json({ ok: true })
      },
    )

    app.post('/settings/smtp/test', requirePermission('platform.settings.manage'), async (c) => {
      const smtpSvc = createSmtpService({ prisma })
      const userId  = c.get('userId') ?? c.get('user')?.id

      const userProfile = await prisma.userProfile.findFirst({
        where: { id: userId },
        select: { email: true },
      })

      try {
        await smtpSvc.sendEmail({
          to:      userProfile?.email ?? 'test@example.com',
          subject: 'Atlas ERP — Prueba de SMTP',
          html:    '<p>La configuracion SMTP funciona correctamente.</p>',
          text:    'La configuracion SMTP funciona correctamente.',
        })
        return c.json({ ok: true })
      } catch (err) {
        return c.json({ error: err.message }, 400)
      }
    })

    return app
  }
  ```

- [ ] **Step 2: Mount the settings router in apps/api/src/index.js**

  Near the top of `apps/api/src/index.js`, add the import:
  ```js
  import { createSettingsRouter } from './routes/settings-routes.js'
  ```

  Then near where other authenticated routers are mounted, add:
  ```js
  app.route('/', createSettingsRouter({ prisma, requirePermission }))
  ```

- [ ] **Step 3: Add `platform.settings.manage` permission to permission catalog**

  Open `apps/api/src/permission-catalog.js` and add:
  ```js
  { key: 'platform.settings.manage', label: 'Gestionar configuracion de la plataforma', module: 'platform' },
  ```

- [ ] **Step 4: Verify syntax**

  ```bash
  node --check apps/api/src/routes/settings-routes.js
  node --check apps/api/src/index.js
  ```

---

## Task 3 — SMTP settings screen

**Files:**
- Create: `apps/desktop/src/modules/platform-settings/screens/SmtpSettingsScreen.jsx`

- [ ] **Step 1: Create directory**

  ```bash
  mkdir -p apps/desktop/src/modules/platform-settings/screens
  ```

- [ ] **Step 2: Create SmtpSettingsScreen.jsx**

  ```jsx
  // apps/desktop/src/modules/platform-settings/screens/SmtpSettingsScreen.jsx
  import { useState, useEffect } from 'react'
  import { useQuery, useMutation } from '@tanstack/react-query'
  import { useAuth } from '../../../auth/AuthProvider.jsx'
  import { getApiUrl } from '../../../lib/runtimeConfig.js'
  import { Button, Input, Label, Switch } from '@atlas/ui'
  import { toast } from 'sonner'

  async function apiFetch(path, token, options = {}) {
    const res = await fetch(`${getApiUrl()}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    return res.json()
  }

  const EMPTY = { host: '', port: '587', user: '', pass: '', from_name: '', from_email: '', tls: false }

  export default function SmtpSettingsScreen() {
    const { session } = useAuth()
    const token = session?.access_token

    const [form, setForm] = useState(EMPTY)
    const [passChanged, setPassChanged] = useState(false)

    const configQuery = useQuery({
      queryKey: ['smtp-settings', token],
      queryFn: () => apiFetch('/settings/smtp', token),
      enabled: Boolean(token),
    })

    useEffect(() => {
      const data = configQuery.data?.data
      if (!data) return
      setForm({
        host:       data.host,
        port:       String(data.port),
        user:       data.user,
        pass:       '',
        from_name:  data.from_name,
        from_email: data.from_email,
        tls:        data.tls,
      })
    }, [configQuery.data])

    const saveMutation = useMutation({
      mutationFn: (data) => apiFetch('/settings/smtp', token, { method: 'POST', body: JSON.stringify(data) }),
      onSuccess: () => {
        toast.success('Configuracion SMTP guardada')
        setPassChanged(false)
        configQuery.refetch()
      },
      onError: (err) => toast.error(err.message),
    })

    const testMutation = useMutation({
      mutationFn: () => apiFetch('/settings/smtp/test', token, { method: 'POST' }),
      onSuccess: () => toast.success('Email de prueba enviado correctamente'),
      onError: (err) => toast.error(`Error: ${err.message}`),
    })

    function handleSubmit(e) {
      e.preventDefault()
      const payload = {
        host:       form.host,
        port:       Number(form.port),
        user:       form.user,
        from_name:  form.from_name  || undefined,
        from_email: form.from_email || undefined,
        tls:        form.tls,
      }
      if (passChanged && form.pass) payload.pass = form.pass
      saveMutation.mutate(payload)
    }

    const configured = configQuery.data?.data?.configured ?? false

    return (
      <div className="p-8 max-w-lg space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">Configuracion SMTP</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Credenciales para el envio de emails desde la plataforma (formularios, notificaciones, etc.)
          </p>
        </div>

        {configured && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
            SMTP configurado
          </div>
        )}

        {configQuery.isPending ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <Label htmlFor="smtp-host">Servidor (host)</Label>
                <Input id="smtp-host" placeholder="smtp.gmail.com" value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="smtp-port">Puerto</Label>
                <Input id="smtp-port" type="number" value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))} required />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="smtp-user">Usuario</Label>
              <Input id="smtp-user" type="email" placeholder="usuario@dominio.com" value={form.user} onChange={(e) => setForm((f) => ({ ...f, user: e.target.value }))} required />
            </div>

            <div className="space-y-1">
              <Label htmlFor="smtp-pass">
                Contraseña {configured && !passChanged && <span className="text-[hsl(var(--muted-foreground))] font-normal">(dejar en blanco para mantener)</span>}
              </Label>
              <Input
                id="smtp-pass"
                type="password"
                placeholder={configured ? '••••••••' : ''}
                value={form.pass}
                onChange={(e) => { setForm((f) => ({ ...f, pass: e.target.value })); setPassChanged(true) }}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="smtp-from-name">Nombre del remitente</Label>
              <Input id="smtp-from-name" placeholder="Atlas ERP" value={form.from_name} onChange={(e) => setForm((f) => ({ ...f, from_name: e.target.value }))} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="smtp-from-email">Email del remitente</Label>
              <Input id="smtp-from-email" type="email" value={form.from_email} onChange={(e) => setForm((f) => ({ ...f, from_email: e.target.value }))} />
            </div>

            <div className="flex items-center gap-2">
              <Switch id="smtp-tls" checked={form.tls} onCheckedChange={(v) => setForm((f) => ({ ...f, tls: v }))} />
              <Label htmlFor="smtp-tls">Usar TLS / SSL</Label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={saveMutation.isPending} className="flex-1">
                {saveMutation.isPending ? 'Guardando...' : 'Guardar configuracion'}
              </Button>
              {configured && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending}
                >
                  {testMutation.isPending ? 'Enviando...' : 'Enviar prueba'}
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
    )
  }
  ```

- [ ] **Step 3: Verify syntax**

  ```bash
  node --check apps/desktop/src/modules/platform-settings/screens/SmtpSettingsScreen.jsx
  ```

---

## Task 4 — Wire screen into ModuleOutlet and sidebar nav

**Files:**
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx`
- Modify: `apps/desktop/src/app/AppShell.jsx` (or equivalent nav file)

- [ ] **Step 1: Add settings route to ModuleOutlet screen map**

  In `apps/desktop/src/app/ModuleOutlet.jsx`, add to the screen map:
  ```js
  'platform.settings/smtp': () => import('../modules/platform-settings/screens/SmtpSettingsScreen.jsx'),
  ```

  The route path for this screen will be `/app/m/platform.settings/smtp`. Make sure the module key `platform.settings` is handled in the outlet's routing logic — if ModuleOutlet only loads AME3-registered modules, you may need to add a static route directly in `apps/desktop/src/main.jsx` instead:

  ```jsx
  // In main.jsx, inside the authenticated /app routes:
  import { lazy } from 'react'
  const SmtpSettingsScreen = lazy(() => import('./modules/platform-settings/screens/SmtpSettingsScreen.jsx'))

  // Inside the <Route path="app"> children:
  <Route path="settings/smtp" element={<SmtpSettingsScreen />} />
  ```

  Check which approach is consistent with how the existing app routes are set up, then use that pattern.

- [ ] **Step 2: Read AppShell.jsx to find the sidebar navigation construction**

  The sidebar navigation items come from module manifests resolved at runtime. For settings (which is not an AME3 module), add a static navigation entry directly in the shell. Find where navigation items are rendered and add a "Configuracion" section or append a "SMTP" entry under a settings group.

  Look for a pattern like:
  ```jsx
  const staticNavItems = [
    // ...
  ]
  ```
  Or look for where admin-only nav entries are hard-coded. Add:
  ```jsx
  { label: 'SMTP', path: '/app/settings/smtp', icon: 'Mail' }
  ```
  under a "Configuracion" group visible only to users with `platform.settings.manage` permission.

- [ ] **Step 3: Verify syntax**

  ```bash
  node --check apps/desktop/src/app/ModuleOutlet.jsx
  ```

---

## Task 5 — Smoke-test

- [ ] **Step 1: Start dev servers**

  ```bash
  pnpm dev
  ```

- [ ] **Step 2: Verify settings screen loads**

  Navigate to the SMTP settings page. Confirm the form renders.

- [ ] **Step 3: Save a test SMTP config**

  Enter a valid SMTP config (e.g. Gmail SMTP or Mailtrap credentials). Click "Guardar configuracion". Confirm success toast.

- [ ] **Step 4: Test send**

  Click "Enviar prueba". Confirm the email arrives in the inbox (or check Mailtrap).

- [ ] **Step 5: Verify GET returns config without password**

  ```bash
  curl http://localhost:4010/settings/smtp \
    -H "Authorization: Bearer $ATLAS_TOKEN"
  ```
  Expected: response includes `host`, `port`, `user`, `configured: true` but no `pass` field.

- [ ] **Step 6: Commit**

  ```bash
  git add apps/api/src/services/smtp-service.js \
          apps/api/src/routes/settings-routes.js \
          apps/api/src/index.js \
          apps/api/src/permission-catalog.js \
          apps/desktop/src/modules/platform-settings/ \
          apps/desktop/src/app/ModuleOutlet.jsx \
          apps/desktop/src/app/AppShell.jsx
  git commit -m "feat(settings): add SMTP configuration screen and smtp-service"
  ```
