# Atlas Calendar — Plan A: Backend Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **NOTE ON PLAN SPLITTING:** This feature is split into Plan A (backend) and Plan B (frontend) intentionally. Large plans cause the AI to burn tokens without producing output. Always split plans with >10 tasks or with independent backend+frontend layers. See memory `feedback_split_large_plans`.

**Goal:** Add `atlas.calendar` as the seventh core module — Prisma schema, migration, manifest registration, API services (calendars, events, reminders, notifications), and API routes mounted in the main app.

**Architecture:** Core module following the `atlas.fleet`/`atlas.hr` pattern. 7 Prisma models. Services use the `createXxxService({ prisma })` factory. Routes are a Hono router registered in `apps/api/src/index.js`. No AME3 blueprint renderer — custom React components come in Plan B.

**Tech Stack:** Node.js, Hono, Prisma 7, PostgreSQL (Supabase), Zod, Node built-in test runner (`node --test`)

**Spec:** `docs/superpowers/specs/2026-05-29-atlas-calendar-design.md`

**Plan B:** `docs/superpowers/plans/2026-05-29-atlas-calendar-plan-b-frontend.md` (UI, views, modals)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add 7 models + 2 enums |
| `prisma/migrations/TIMESTAMP_add_atlas_calendar/migration.sql` | Create | Forward migration |
| `apps/api/src/manifests/official/core-modules.js` | Modify | Add `atlasCalendarManifest` + include in `coreModules` array |
| `apps/api/src/routes/calendar/calendar-service.js` | Create | Calendar CRUD + share management |
| `apps/api/src/routes/calendar/calendar-event-service.js` | Create | Event CRUD + recurrence expansion |
| `apps/api/src/routes/calendar/calendar-notification-service.js` | Create | Reminder processing + notification CRUD |
| `apps/api/src/routes/calendar/calendar-routes.js` | Create | Hono router — all calendar endpoints |
| `apps/api/src/routes/calendar/index.js` | Create | Re-export `createCalendarRouter` |
| `apps/api/src/index.js` | Modify | Import + mount calendar router, add to `CORE_MODULE_KEYS` |
| `apps/api/src/routes/calendar/__tests__/calendar-service.test.js` | Create | Service unit tests |

---

## Task 1: Prisma schema — add calendar models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums and models to the end of schema.prisma**

Open `prisma/schema.prisma` and append after the last model:

```prisma
enum CalendarShareRole {
  VIEWER
  EDITOR
  MANAGER
  @@map("calendar_share_role")
}

enum CalendarAttendeeStatus {
  PENDING
  ACCEPTED
  DECLINED
  @@map("calendar_attendee_status")
}

model CalendarCalendar {
  id         String   @id @default(uuid(7)) @db.Uuid
  ownerId    String   @db.Uuid @map("owner_id")
  name       String
  color      String   @default("#6B46C1")
  isDefault  Boolean  @default(false) @map("is_default")
  enabled    Boolean  @default(true)
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  owner      UserProfile              @relation("CalendarOwner", fields: [ownerId], references: [id])
  shares     CalendarShare[]
  events     CalendarEvent[]

  @@index([ownerId])
  @@map("calendar_calendar")
}

model CalendarShare {
  id          String            @id @default(uuid(7)) @db.Uuid
  calendarId  String            @db.Uuid @map("calendar_id")
  userId      String            @db.Uuid @map("user_id")
  role        CalendarShareRole @default(VIEWER)
  createdAt   DateTime          @default(now()) @map("created_at")

  calendar    CalendarCalendar  @relation(fields: [calendarId], references: [id], onDelete: Cascade)
  user        UserProfile       @relation("CalendarShareUser", fields: [userId], references: [id])

  @@unique([calendarId, userId])
  @@map("calendar_share")
}

model CalendarEvent {
  id              String    @id @default(uuid(7)) @db.Uuid
  calendarId      String    @db.Uuid @map("calendar_id")
  title           String
  description     String?
  startAt         DateTime  @map("start_at")
  endAt           DateTime? @map("end_at")
  allDay          Boolean   @default(false) @map("all_day")
  location        String?
  videoUrl        String?   @map("video_url")
  color           String?
  recurrenceRule  Json?     @map("recurrence_rule")
  sourceModule    String?   @map("source_module")
  sourceEntityId  String?   @db.Uuid @map("source_entity_id")
  enabled         Boolean   @default(true)
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  calendar      CalendarCalendar        @relation(fields: [calendarId], references: [id], onDelete: Cascade)
  attendees     CalendarEventAttendee[]
  reminders     CalendarReminder[]
  notifications CalendarNotification[]
  files         CalendarEventFile[]

  @@index([calendarId])
  @@index([startAt])
  @@index([sourceModule, sourceEntityId])
  @@map("calendar_event")
}

model CalendarEventFile {
  id            String   @id @default(uuid(7)) @db.Uuid
  eventId       String   @db.Uuid @map("event_id")
  fileAssetId   String   @db.Uuid @map("file_asset_id")
  createdAt     DateTime @default(now()) @map("created_at")

  event         CalendarEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  fileAsset     FileAsset     @relation(fields: [fileAssetId], references: [id])

  @@unique([eventId, fileAssetId])
  @@map("calendar_event_file")
}

model CalendarEventAttendee {
  id         String                 @id @default(uuid(7)) @db.Uuid
  eventId    String                 @db.Uuid @map("event_id")
  userId     String                 @db.Uuid @map("user_id")
  status     CalendarAttendeeStatus @default(PENDING)
  createdAt  DateTime               @default(now()) @map("created_at")

  event      CalendarEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  user       UserProfile   @relation("CalendarAttendee", fields: [userId], references: [id])

  @@unique([eventId, userId])
  @@map("calendar_event_attendee")
}

model CalendarReminder {
  id            String    @id @default(uuid(7)) @db.Uuid
  eventId       String    @db.Uuid @map("event_id")
  userId        String    @db.Uuid @map("user_id")
  minutesBefore Int       @map("minutes_before")
  sentAt        DateTime? @map("sent_at")
  createdAt     DateTime  @default(now()) @map("created_at")

  event         CalendarEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  user          UserProfile   @relation("CalendarReminder", fields: [userId], references: [id])

  @@unique([eventId, userId, minutesBefore])
  @@map("calendar_reminder")
}

model CalendarNotification {
  id         String    @id @default(uuid(7)) @db.Uuid
  userId     String    @db.Uuid @map("user_id")
  eventId    String    @db.Uuid @map("event_id")
  type       String    @default("REMINDER")
  readAt     DateTime? @map("read_at")
  createdAt  DateTime  @default(now()) @map("created_at")

  user       UserProfile   @relation("CalendarNotificationUser", fields: [userId], references: [id])
  event      CalendarEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@index([userId, readAt])
  @@map("calendar_notification")
}
```

- [ ] **Step 2: Add back-relations to UserProfile**

Find the `UserProfile` model in `prisma/schema.prisma` and add these relation fields (after the existing relations):

```prisma
  calendarOwner          CalendarCalendar[]       @relation("CalendarOwner")
  calendarShares         CalendarShare[]          @relation("CalendarShareUser")
  calendarAttendees      CalendarEventAttendee[]  @relation("CalendarAttendee")
  calendarReminders      CalendarReminder[]       @relation("CalendarReminder")
  calendarNotifications  CalendarNotification[]   @relation("CalendarNotificationUser")
```

- [ ] **Step 3: Add back-relation to FileAsset**

Find the `FileAsset` model and add:

```prisma
  calendarFiles  CalendarEventFile[]
```

- [ ] **Step 4: Validate schema**

```bash
pnpm exec prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid`

- [ ] **Step 5: Create migration**

```bash
pnpm exec prisma migrate dev --name add_atlas_calendar
```

Expected: Migration created and applied. Tables `calendar_calendar`, `calendar_share`, `calendar_event`, `calendar_event_file`, `calendar_event_attendee`, `calendar_reminder`, `calendar_notification` created in DB.

- [ ] **Step 6: Regenerate Prisma client**

```bash
pnpm db:generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(calendar): add atlas.calendar prisma schema and migration"
```

---

## Task 2: Module manifest

**Files:**
- Modify: `apps/api/src/manifests/official/core-modules.js`

- [ ] **Step 1: Add atlasCalendarManifest before the coreModules export**

Open `apps/api/src/manifests/official/core-modules.js`. Before the `export const coreModules = [...]` line, add:

```js
export const atlasCalendarManifest = createModuleManifest({
  key: 'atlas.calendar',
  name: 'Calendario',
  description: 'Calendario personal y compartido con eventos, recordatorios y vistas por dia, semana y mes.',
  version: '0.1.0',
  kind: MODULE_KINDS.CORE,
  core: true,
  uninstallable: false,
  icon: 'Calendar',
  color: '#7C3AED',
  accentColor: '#6D28D9',
  initials: 'CA',
  category: 'sistema',
  summary: 'Calendarios personales, eventos y recordatorios',
  dependencies: [{ key: 'atlas.core' }, { key: 'atlas.identity' }],
  navigation: [
    {
      label: 'Calendario',
      path: '/app/m/atlas.calendar/calendar',
      icon: 'Calendar',
      layout: 'main',
      permissionKey: 'calendar.access',
    },
  ],
  permissions: [
    { key: 'calendar.access',           name: 'Acceso al calendario' },
    { key: 'calendar.calendars.read',   name: 'Ver calendarios' },
    { key: 'calendar.calendars.create', name: 'Crear calendarios' },
    { key: 'calendar.calendars.update', name: 'Editar calendarios' },
    { key: 'calendar.calendars.delete', name: 'Eliminar calendarios' },
    { key: 'calendar.events.read',      name: 'Ver eventos' },
    { key: 'calendar.events.create',    name: 'Crear eventos' },
    { key: 'calendar.events.update',    name: 'Editar eventos' },
    { key: 'calendar.events.delete',    name: 'Eliminar eventos' },
    { key: 'calendar.share.manage',     name: 'Gestionar accesos compartidos' },
  ],
  acl: {
    module: 'calendar.access',
    actions: {
      'calendar.calendars.read':   'calendar.calendars.read',
      'calendar.calendars.create': 'calendar.calendars.create',
      'calendar.calendars.update': 'calendar.calendars.update',
      'calendar.calendars.delete': 'calendar.calendars.delete',
      'calendar.events.read':      'calendar.events.read',
      'calendar.events.create':    'calendar.events.create',
      'calendar.events.update':    'calendar.events.update',
      'calendar.events.delete':    'calendar.events.delete',
      'calendar.share.manage':     'calendar.share.manage',
    },
  },
  exposes: {
    'calendar.createEvent': 'function',
    'calendar.getEvents':   'function',
  },
  consumes: ['atlas.files'],
});
```

- [ ] **Step 2: Add atlasCalendarManifest to coreModules array**

Find the `export const coreModules = [` line and add `atlasCalendarManifest` to the array:

```js
export const coreModules = [
  atlasCoreMap,
  identityMap,
  filesMap,
  companyMap,
  contactsMap,
  hrMap,
  atlasFleetManifest,
  atlasLedgerManifest,
  atlasWebsiteManifest,
  atlasCalendarManifest,
];
```

- [ ] **Step 3: Syntax check**

```bash
node --check apps/api/src/manifests/official/core-modules.js
```

Expected: No output (clean)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/manifests/official/core-modules.js
git commit -m "feat(calendar): register atlas.calendar manifest in core-modules"
```

---

## Task 3: Calendar service (calendars + shares)

**Files:**
- Create: `apps/api/src/routes/calendar/calendar-service.js`

- [ ] **Step 1: Create the service file**

Create `apps/api/src/routes/calendar/calendar-service.js`:

```js
export class CalendarServiceError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'CalendarServiceError'
    this.status = status
  }
}

export function createCalendarService({ prisma }) {
  async function ensureDefaultCalendar(userId) {
    const existing = await prisma.calendarCalendar.findFirst({
      where: { ownerId: userId, isDefault: true, enabled: true },
    })
    if (existing) return existing
    return prisma.calendarCalendar.create({
      data: { ownerId: userId, name: 'Mi calendario', color: '#6B46C1', isDefault: true },
    })
  }

  async function listCalendars(userId) {
    const owned = await prisma.calendarCalendar.findMany({
      where: { ownerId: userId, enabled: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    })
    const shared = await prisma.calendarShare.findMany({
      where: { userId },
      include: {
        calendar: { where: { enabled: true } },
      },
    })
    const sharedCalendars = shared
      .filter((s) => s.calendar)
      .map((s) => ({ ...s.calendar, _sharedRole: s.role, _shareId: s.id }))
    return { owned, shared: sharedCalendars }
  }

  async function createCalendar(userId, { name, color }) {
    if (!name?.trim()) throw new CalendarServiceError('El nombre es requerido.', 400)
    return prisma.calendarCalendar.create({
      data: { ownerId: userId, name: name.trim(), color: color ?? '#6B46C1' },
    })
  }

  async function updateCalendar(userId, calendarId, { name, color }) {
    const calendar = await prisma.calendarCalendar.findFirst({
      where: { id: calendarId, ownerId: userId, enabled: true },
    })
    if (!calendar) throw new CalendarServiceError('Calendario no encontrado.', 404)
    return prisma.calendarCalendar.update({
      where: { id: calendarId },
      data: {
        ...(name?.trim() ? { name: name.trim() } : {}),
        ...(color ? { color } : {}),
      },
    })
  }

  async function deleteCalendar(userId, calendarId) {
    const calendar = await prisma.calendarCalendar.findFirst({
      where: { id: calendarId, ownerId: userId, enabled: true },
    })
    if (!calendar) throw new CalendarServiceError('Calendario no encontrado.', 404)
    if (calendar.isDefault) throw new CalendarServiceError('No se puede eliminar el calendario por defecto.', 400)
    await prisma.calendarCalendar.update({ where: { id: calendarId }, data: { enabled: false } })
  }

  async function shareCalendar(ownerId, calendarId, { userId, role }) {
    const calendar = await prisma.calendarCalendar.findFirst({
      where: { id: calendarId, ownerId, enabled: true },
    })
    if (!calendar) throw new CalendarServiceError('Calendario no encontrado.', 404)
    if (userId === ownerId) throw new CalendarServiceError('No puedes invitarte a ti mismo.', 400)
    const validRoles = ['VIEWER', 'EDITOR', 'MANAGER']
    if (!validRoles.includes(role)) throw new CalendarServiceError('Rol invalido.', 400)
    try {
      return await prisma.calendarShare.create({ data: { calendarId, userId, role } })
    } catch (err) {
      if (err?.code === 'P2002') throw new CalendarServiceError('El usuario ya tiene acceso a este calendario.', 409)
      throw err
    }
  }

  async function updateShare(ownerId, calendarId, shareId, { role }) {
    const calendar = await prisma.calendarCalendar.findFirst({
      where: { id: calendarId, ownerId, enabled: true },
    })
    if (!calendar) throw new CalendarServiceError('Calendario no encontrado.', 404)
    const share = await prisma.calendarShare.findFirst({ where: { id: shareId, calendarId } })
    if (!share) throw new CalendarServiceError('Acceso compartido no encontrado.', 404)
    const validRoles = ['VIEWER', 'EDITOR', 'MANAGER']
    if (!validRoles.includes(role)) throw new CalendarServiceError('Rol invalido.', 400)
    return prisma.calendarShare.update({ where: { id: shareId }, data: { role } })
  }

  async function deleteShare(ownerId, calendarId, shareId) {
    const calendar = await prisma.calendarCalendar.findFirst({
      where: { id: calendarId, ownerId, enabled: true },
    })
    if (!calendar) throw new CalendarServiceError('Calendario no encontrado.', 404)
    const share = await prisma.calendarShare.findFirst({ where: { id: shareId, calendarId } })
    if (!share) throw new CalendarServiceError('Acceso compartido no encontrado.', 404)
    await prisma.calendarShare.delete({ where: { id: shareId } })
  }

  async function getCalendarRole(userId, calendarId) {
    const calendar = await prisma.calendarCalendar.findFirst({
      where: { id: calendarId, enabled: true },
    })
    if (!calendar) return null
    if (calendar.ownerId === userId) return 'OWNER'
    const share = await prisma.calendarShare.findFirst({ where: { calendarId, userId } })
    return share?.role ?? null
  }

  return {
    ensureDefaultCalendar,
    listCalendars,
    createCalendar,
    updateCalendar,
    deleteCalendar,
    shareCalendar,
    updateShare,
    deleteShare,
    getCalendarRole,
  }
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/api/src/routes/calendar/calendar-service.js
```

Expected: No output (clean)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/calendar/calendar-service.js
git commit -m "feat(calendar): add calendar-service (calendars + shares)"
```

---

## Task 4: Event service (CRUD + recurrence expansion)

**Files:**
- Create: `apps/api/src/routes/calendar/calendar-event-service.js`

- [ ] **Step 1: Create the service file**

Create `apps/api/src/routes/calendar/calendar-event-service.js`:

```js
import { CalendarServiceError } from './calendar-service.js'

function expandRecurrence(event, rangeStart, rangeEnd) {
  const rule = event.recurrenceRule
  if (!rule) return []

  const instances = []
  const { freq, interval = 1, until, count } = rule
  const start = new Date(event.startAt)
  const duration = event.endAt ? new Date(event.endAt) - start : 60 * 60 * 1000
  const rangeStartMs = new Date(rangeStart).getTime()
  const rangeEndMs = new Date(rangeEnd).getTime()
  const untilMs = until ? new Date(until).getTime() : Infinity
  const maxInstances = count ?? 365

  let current = new Date(start)
  let generated = 0

  while (current.getTime() <= rangeEndMs && current.getTime() <= untilMs && generated < maxInstances) {
    if (current.getTime() >= rangeStartMs) {
      const instanceEnd = new Date(current.getTime() + duration)
      instances.push({
        ...event,
        id: `${event.id}_${current.toISOString().slice(0, 10).replace(/-/g, '')}`,
        startAt: new Date(current),
        endAt: instanceEnd,
        _isRecurrenceInstance: true,
        _baseEventId: event.id,
      })
      generated++
    }

    if (freq === 'DAILY') {
      current = new Date(current.getTime() + interval * 24 * 60 * 60 * 1000)
    } else if (freq === 'WEEKLY') {
      current = new Date(current.getTime() + interval * 7 * 24 * 60 * 60 * 1000)
    } else if (freq === 'MONTHLY') {
      const next = new Date(current)
      next.setMonth(next.getMonth() + interval)
      current = next
    } else {
      break
    }
  }

  return instances
}

export function createCalendarEventService({ prisma }) {
  async function getAccessibleCalendarIds(userId) {
    const owned = await prisma.calendarCalendar.findMany({
      where: { ownerId: userId, enabled: true },
      select: { id: true },
    })
    const shared = await prisma.calendarShare.findMany({
      where: { userId },
      select: { calendarId: true },
    })
    return [
      ...owned.map((c) => c.id),
      ...shared.map((s) => s.calendarId),
    ]
  }

  async function listEvents({ userId, start, end, calendarIds, sourceModule, sourceEntityId }) {
    if (!start || !end) throw new CalendarServiceError('start y end son requeridos.', 400)

    const accessibleIds = await getAccessibleCalendarIds(userId)
    const filterIds = calendarIds?.length
      ? calendarIds.filter((id) => accessibleIds.includes(id))
      : accessibleIds

    const where = {
      calendarId: { in: filterIds },
      enabled: true,
      ...(sourceModule ? { sourceModule } : {}),
      ...(sourceEntityId ? { sourceEntityId } : {}),
    }

    const events = await prisma.calendarEvent.findMany({
      where: {
        ...where,
        OR: [
          { recurrenceRule: null, startAt: { gte: new Date(start), lte: new Date(end) } },
          { recurrenceRule: { not: null }, startAt: { lte: new Date(end) } },
        ],
      },
      include: {
        calendar: { select: { id: true, name: true, color: true, ownerId: true } },
        attendees: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      },
      orderBy: { startAt: 'asc' },
    })

    const result = []
    for (const event of events) {
      if (!event.recurrenceRule) {
        result.push(event)
      } else {
        const instances = expandRecurrence(event, start, end)
        result.push(...instances)
      }
    }

    return result.sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
  }

  async function getEvent(userId, eventId) {
    const accessibleIds = await getAccessibleCalendarIds(userId)
    const event = await prisma.calendarEvent.findFirst({
      where: { id: eventId, calendarId: { in: accessibleIds }, enabled: true },
      include: {
        calendar: { select: { id: true, name: true, color: true, ownerId: true } },
        attendees: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        reminders: { where: { userId }, select: { id: true, minutesBefore: true } },
        files: { include: { fileAsset: { select: { id: true, name: true, mimeType: true } } } },
      },
    })
    if (!event) throw new CalendarServiceError('Evento no encontrado.', 404)
    return event
  }

  async function createEvent(userId, data) {
    const {
      calendarId, title, description, startAt, endAt, allDay,
      location, videoUrl, color, recurrenceRule,
      sourceModule, sourceEntityId,
      attendeeIds, reminderMinutes,
    } = data

    if (!title?.trim()) throw new CalendarServiceError('El titulo es requerido.', 400)
    if (!startAt) throw new CalendarServiceError('La fecha de inicio es requerida.', 400)
    if (!calendarId) throw new CalendarServiceError('El calendario es requerido.', 400)

    const accessible = await getAccessibleCalendarIds(userId)
    if (!accessible.includes(calendarId)) throw new CalendarServiceError('No tienes acceso a ese calendario.', 403)

    const event = await prisma.calendarEvent.create({
      data: {
        calendarId,
        title: title.trim(),
        description: description?.trim() ?? null,
        startAt: new Date(startAt),
        endAt: endAt ? new Date(endAt) : null,
        allDay: allDay ?? false,
        location: location?.trim() ?? null,
        videoUrl: videoUrl?.trim() ?? null,
        color: color ?? null,
        recurrenceRule: recurrenceRule ?? null,
        sourceModule: sourceModule ?? null,
        sourceEntityId: sourceEntityId ?? null,
      },
    })

    if (attendeeIds?.length) {
      await prisma.calendarEventAttendee.createMany({
        data: attendeeIds.map((uid) => ({ eventId: event.id, userId: uid })),
        skipDuplicates: true,
      })
    }

    if (reminderMinutes?.length) {
      await prisma.calendarReminder.createMany({
        data: reminderMinutes.map((min) => ({ eventId: event.id, userId, minutesBefore: min })),
        skipDuplicates: true,
      })
    }

    return getEvent(userId, event.id)
  }

  async function updateEvent(userId, eventId, data) {
    const accessible = await getAccessibleCalendarIds(userId)
    const event = await prisma.calendarEvent.findFirst({
      where: { id: eventId, calendarId: { in: accessible }, enabled: true },
      include: { calendar: true },
    })
    if (!event) throw new CalendarServiceError('Evento no encontrado.', 404)

    const isOwner = event.calendar.ownerId === userId
    const share = await prisma.calendarShare.findFirst({ where: { calendarId: event.calendarId, userId } })
    const canEdit = isOwner || share?.role === 'EDITOR' || share?.role === 'MANAGER'
    if (!canEdit) throw new CalendarServiceError('No tienes permiso para editar este evento.', 403)

    const updateData = {}
    if (data.title !== undefined) updateData.title = data.title.trim()
    if (data.description !== undefined) updateData.description = data.description?.trim() ?? null
    if (data.startAt !== undefined) updateData.startAt = new Date(data.startAt)
    if (data.endAt !== undefined) updateData.endAt = data.endAt ? new Date(data.endAt) : null
    if (data.allDay !== undefined) updateData.allDay = data.allDay
    if (data.location !== undefined) updateData.location = data.location?.trim() ?? null
    if (data.videoUrl !== undefined) updateData.videoUrl = data.videoUrl?.trim() ?? null
    if (data.color !== undefined) updateData.color = data.color ?? null
    if (data.recurrenceRule !== undefined) updateData.recurrenceRule = data.recurrenceRule ?? null

    await prisma.calendarEvent.update({ where: { id: eventId }, data: updateData })
    return getEvent(userId, eventId)
  }

  async function deleteEvent(userId, eventId) {
    const accessible = await getAccessibleCalendarIds(userId)
    const event = await prisma.calendarEvent.findFirst({
      where: { id: eventId, calendarId: { in: accessible }, enabled: true },
      include: { calendar: true },
    })
    if (!event) throw new CalendarServiceError('Evento no encontrado.', 404)

    const isOwner = event.calendar.ownerId === userId
    const share = await prisma.calendarShare.findFirst({ where: { calendarId: event.calendarId, userId } })
    const canDelete = isOwner || share?.role === 'MANAGER'
    if (!canDelete) throw new CalendarServiceError('No tienes permiso para eliminar este evento.', 403)

    await prisma.calendarEvent.update({ where: { id: eventId }, data: { enabled: false } })
  }

  async function addAttendee(userId, eventId, attendeeUserId) {
    const accessible = await getAccessibleCalendarIds(userId)
    const event = await prisma.calendarEvent.findFirst({
      where: { id: eventId, calendarId: { in: accessible }, enabled: true },
      include: { calendar: true },
    })
    if (!event) throw new CalendarServiceError('Evento no encontrado.', 404)

    const isOwner = event.calendar.ownerId === userId
    const share = await prisma.calendarShare.findFirst({ where: { calendarId: event.calendarId, userId } })
    if (!isOwner && share?.role !== 'MANAGER') {
      throw new CalendarServiceError('No tienes permiso para agregar invitados.', 403)
    }

    try {
      return await prisma.calendarEventAttendee.create({ data: { eventId, userId: attendeeUserId } })
    } catch (err) {
      if (err?.code === 'P2002') throw new CalendarServiceError('El usuario ya es invitado.', 409)
      throw err
    }
  }

  async function updateAttendeeStatus(userId, eventId, attendeeId, status) {
    const validStatuses = ['ACCEPTED', 'DECLINED', 'PENDING']
    if (!validStatuses.includes(status)) throw new CalendarServiceError('Estado invalido.', 400)

    const attendee = await prisma.calendarEventAttendee.findFirst({
      where: { id: attendeeId, eventId, userId },
    })
    if (!attendee) throw new CalendarServiceError('Invitado no encontrado.', 404)
    return prisma.calendarEventAttendee.update({ where: { id: attendeeId }, data: { status } })
  }

  async function addReminder(userId, eventId, minutesBefore) {
    if (!Number.isFinite(minutesBefore) || minutesBefore < 0) {
      throw new CalendarServiceError('minutesBefore debe ser un numero positivo.', 400)
    }
    try {
      return await prisma.calendarReminder.create({ data: { eventId, userId, minutesBefore } })
    } catch (err) {
      if (err?.code === 'P2002') throw new CalendarServiceError('Ya existe ese recordatorio.', 409)
      throw err
    }
  }

  async function deleteReminder(userId, eventId, reminderId) {
    const reminder = await prisma.calendarReminder.findFirst({ where: { id: reminderId, eventId, userId } })
    if (!reminder) throw new CalendarServiceError('Recordatorio no encontrado.', 404)
    await prisma.calendarReminder.delete({ where: { id: reminderId } })
  }

  return {
    listEvents,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    addAttendee,
    updateAttendeeStatus,
    addReminder,
    deleteReminder,
  }
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/api/src/routes/calendar/calendar-event-service.js
```

Expected: No output (clean)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/calendar/calendar-event-service.js
git commit -m "feat(calendar): add calendar-event-service with recurrence expansion"
```

---

## Task 5: Notification service (reminders + in-app notifications)

**Files:**
- Create: `apps/api/src/routes/calendar/calendar-notification-service.js`

- [ ] **Step 1: Create the service file**

Create `apps/api/src/routes/calendar/calendar-notification-service.js`:

```js
import { CalendarServiceError } from './calendar-service.js'

export function createCalendarNotificationService({ prisma }) {
  async function getNotifications(userId, { unreadOnly = true } = {}) {
    return prisma.calendarNotification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      include: {
        event: {
          select: { id: true, title: true, startAt: true, calendarId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }

  async function markRead(userId, notificationId) {
    const notification = await prisma.calendarNotification.findFirst({
      where: { id: notificationId, userId },
    })
    if (!notification) throw new CalendarServiceError('Notificacion no encontrada.', 404)
    return prisma.calendarNotification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    })
  }

  async function markAllRead(userId) {
    await prisma.calendarNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    })
  }

  async function processReminders() {
    const now = new Date()
    const pendingReminders = await prisma.calendarReminder.findMany({
      where: { sentAt: null },
      include: {
        event: { select: { id: true, title: true, startAt: true, enabled: true } },
      },
    })

    const toFire = pendingReminders.filter((r) => {
      if (!r.event.enabled) return false
      const triggerTime = new Date(r.event.startAt.getTime() - r.minutesBefore * 60 * 1000)
      return triggerTime <= now
    })

    if (!toFire.length) return { processed: 0 }

    await prisma.calendarNotification.createMany({
      data: toFire.map((r) => ({
        userId: r.userId,
        eventId: r.eventId,
        type: 'REMINDER',
      })),
      skipDuplicates: true,
    })

    await prisma.calendarReminder.updateMany({
      where: { id: { in: toFire.map((r) => r.id) } },
      data: { sentAt: now },
    })

    return { processed: toFire.length }
  }

  return { getNotifications, markRead, markAllRead, processReminders }
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/api/src/routes/calendar/calendar-notification-service.js
```

Expected: No output (clean)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/calendar/calendar-notification-service.js
git commit -m "feat(calendar): add calendar-notification-service"
```

---

## Task 6: Calendar routes (Hono router)

**Files:**
- Create: `apps/api/src/routes/calendar/calendar-routes.js`
- Create: `apps/api/src/routes/calendar/index.js`

- [ ] **Step 1: Create calendar-routes.js**

Create `apps/api/src/routes/calendar/calendar-routes.js`:

```js
import { Hono } from 'hono'
import { createCalendarService, CalendarServiceError } from './calendar-service.js'
import { createCalendarEventService } from './calendar-event-service.js'
import { createCalendarNotificationService } from './calendar-notification-service.js'

function getUserId(c) {
  return c.get('userContext')?.profile?.id ?? null
}

function handleError(c, err, fallback) {
  if (err instanceof CalendarServiceError) return c.json({ error: err.message }, err.status)
  if (process.env.NODE_ENV !== 'production') console.error('[atlas.calendar]', err)
  return c.json({ error: fallback }, 500)
}

export function createCalendarRouter({ prisma, requirePermission }) {
  const app = new Hono()
  const svc = createCalendarService({ prisma })
  const eventSvc = createCalendarEventService({ prisma })
  const notifSvc = createCalendarNotificationService({ prisma })

  // ── Calendars ──────────────────────────────────────────────────────────────

  app.get('/calendar/calendars', requirePermission('calendar.calendars.read'), async (c) => {
    try {
      const userId = getUserId(c)
      await svc.ensureDefaultCalendar(userId)
      const result = await svc.listCalendars(userId)
      return c.json(result)
    } catch (err) {
      return handleError(c, err, 'No se pudieron obtener los calendarios.')
    }
  })

  app.post('/calendar/calendars', requirePermission('calendar.calendars.create'), async (c) => {
    try {
      const userId = getUserId(c)
      const body = await c.req.json()
      const calendar = await svc.createCalendar(userId, body)
      return c.json(calendar, 201)
    } catch (err) {
      return handleError(c, err, 'No se pudo crear el calendario.')
    }
  })

  app.patch('/calendar/calendars/:id', requirePermission('calendar.calendars.update'), async (c) => {
    try {
      const userId = getUserId(c)
      const body = await c.req.json()
      const calendar = await svc.updateCalendar(userId, c.req.param('id'), body)
      return c.json(calendar)
    } catch (err) {
      return handleError(c, err, 'No se pudo actualizar el calendario.')
    }
  })

  app.delete('/calendar/calendars/:id', requirePermission('calendar.calendars.delete'), async (c) => {
    try {
      const userId = getUserId(c)
      await svc.deleteCalendar(userId, c.req.param('id'))
      return c.json({ ok: true })
    } catch (err) {
      return handleError(c, err, 'No se pudo eliminar el calendario.')
    }
  })

  app.post('/calendar/calendars/:id/share', requirePermission('calendar.share.manage'), async (c) => {
    try {
      const userId = getUserId(c)
      const body = await c.req.json()
      const share = await svc.shareCalendar(userId, c.req.param('id'), body)
      return c.json(share, 201)
    } catch (err) {
      return handleError(c, err, 'No se pudo compartir el calendario.')
    }
  })

  app.patch('/calendar/calendars/:id/share/:shareId', requirePermission('calendar.share.manage'), async (c) => {
    try {
      const userId = getUserId(c)
      const body = await c.req.json()
      const share = await svc.updateShare(userId, c.req.param('id'), c.req.param('shareId'), body)
      return c.json(share)
    } catch (err) {
      return handleError(c, err, 'No se pudo actualizar el acceso.')
    }
  })

  app.delete('/calendar/calendars/:id/share/:shareId', requirePermission('calendar.share.manage'), async (c) => {
    try {
      const userId = getUserId(c)
      await svc.deleteShare(userId, c.req.param('id'), c.req.param('shareId'))
      return c.json({ ok: true })
    } catch (err) {
      return handleError(c, err, 'No se pudo revocar el acceso.')
    }
  })

  // ── Events ─────────────────────────────────────────────────────────────────

  app.get('/calendar/events', requirePermission('calendar.events.read'), async (c) => {
    try {
      const userId = getUserId(c)
      const { start, end, source_module, source_entity_id } = c.req.query()
      const calendarIds = c.req.queries('calendar_ids') ?? []
      const events = await eventSvc.listEvents({
        userId, start, end, calendarIds,
        sourceModule: source_module,
        sourceEntityId: source_entity_id,
      })
      return c.json(events)
    } catch (err) {
      return handleError(c, err, 'No se pudieron obtener los eventos.')
    }
  })

  app.post('/calendar/events', requirePermission('calendar.events.create'), async (c) => {
    try {
      const userId = getUserId(c)
      const body = await c.req.json()
      const event = await eventSvc.createEvent(userId, body)
      return c.json(event, 201)
    } catch (err) {
      return handleError(c, err, 'No se pudo crear el evento.')
    }
  })

  app.get('/calendar/events/:id', requirePermission('calendar.events.read'), async (c) => {
    try {
      const userId = getUserId(c)
      const event = await eventSvc.getEvent(userId, c.req.param('id'))
      return c.json(event)
    } catch (err) {
      return handleError(c, err, 'No se pudo obtener el evento.')
    }
  })

  app.patch('/calendar/events/:id', requirePermission('calendar.events.update'), async (c) => {
    try {
      const userId = getUserId(c)
      const body = await c.req.json()
      const event = await eventSvc.updateEvent(userId, c.req.param('id'), body)
      return c.json(event)
    } catch (err) {
      return handleError(c, err, 'No se pudo actualizar el evento.')
    }
  })

  app.delete('/calendar/events/:id', requirePermission('calendar.events.delete'), async (c) => {
    try {
      const userId = getUserId(c)
      await eventSvc.deleteEvent(userId, c.req.param('id'))
      return c.json({ ok: true })
    } catch (err) {
      return handleError(c, err, 'No se pudo eliminar el evento.')
    }
  })

  app.post('/calendar/events/:id/attendees', requirePermission('calendar.events.update'), async (c) => {
    try {
      const userId = getUserId(c)
      const { user_id } = await c.req.json()
      const attendee = await eventSvc.addAttendee(userId, c.req.param('id'), user_id)
      return c.json(attendee, 201)
    } catch (err) {
      return handleError(c, err, 'No se pudo agregar el invitado.')
    }
  })

  app.patch('/calendar/events/:id/attendees/:attendeeId', requirePermission('calendar.events.update'), async (c) => {
    try {
      const userId = getUserId(c)
      const { status } = await c.req.json()
      const attendee = await eventSvc.updateAttendeeStatus(userId, c.req.param('id'), c.req.param('attendeeId'), status)
      return c.json(attendee)
    } catch (err) {
      return handleError(c, err, 'No se pudo actualizar el estado.')
    }
  })

  app.post('/calendar/events/:id/reminders', requirePermission('calendar.events.create'), async (c) => {
    try {
      const userId = getUserId(c)
      const { minutes_before } = await c.req.json()
      const reminder = await eventSvc.addReminder(userId, c.req.param('id'), minutes_before)
      return c.json(reminder, 201)
    } catch (err) {
      return handleError(c, err, 'No se pudo crear el recordatorio.')
    }
  })

  app.delete('/calendar/events/:id/reminders/:reminderId', requirePermission('calendar.events.update'), async (c) => {
    try {
      const userId = getUserId(c)
      await eventSvc.deleteReminder(userId, c.req.param('id'), c.req.param('reminderId'))
      return c.json({ ok: true })
    } catch (err) {
      return handleError(c, err, 'No se pudo eliminar el recordatorio.')
    }
  })

  // ── Notifications ──────────────────────────────────────────────────────────

  app.get('/calendar/notifications', requirePermission('calendar.access'), async (c) => {
    try {
      const userId = getUserId(c)
      const { unread_only } = c.req.query()
      const notifications = await notifSvc.getNotifications(userId, {
        unreadOnly: unread_only !== 'false',
      })
      return c.json(notifications)
    } catch (err) {
      return handleError(c, err, 'No se pudieron obtener las notificaciones.')
    }
  })

  app.patch('/calendar/notifications/:id/read', requirePermission('calendar.access'), async (c) => {
    try {
      const userId = getUserId(c)
      const notification = await notifSvc.markRead(userId, c.req.param('id'))
      return c.json(notification)
    } catch (err) {
      return handleError(c, err, 'No se pudo marcar como leida.')
    }
  })

  app.patch('/calendar/notifications/read-all', requirePermission('calendar.access'), async (c) => {
    try {
      const userId = getUserId(c)
      await notifSvc.markAllRead(userId)
      return c.json({ ok: true })
    } catch (err) {
      return handleError(c, err, 'No se pudo marcar todo como leido.')
    }
  })

  // ── Internal: process reminders (called by worker/cron) ───────────────────

  app.post('/calendar/internal/process-reminders', async (c) => {
    const secret = c.req.header('x-internal-secret')
    if (secret !== process.env.ATLAS_INTERNAL_SECRET && process.env.NODE_ENV === 'production') {
      return c.json({ error: 'Unauthorized' }, 401)
    }
    try {
      const result = await notifSvc.processReminders()
      return c.json(result)
    } catch (err) {
      return handleError(c, err, 'Error procesando recordatorios.')
    }
  })

  return app
}
```

- [ ] **Step 2: Create index.js**

Create `apps/api/src/routes/calendar/index.js`:

```js
export { createCalendarRouter } from './calendar-routes.js'
export { default } from './calendar-routes.js'
```

- [ ] **Step 3: Syntax check**

```bash
node --check apps/api/src/routes/calendar/calendar-routes.js
node --check apps/api/src/routes/calendar/index.js
```

Expected: No output (clean)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/calendar/
git commit -m "feat(calendar): add calendar-routes Hono router"
```

---

## Task 7: Mount router in apps/api/src/index.js

**Files:**
- Modify: `apps/api/src/index.js`

- [ ] **Step 1: Add import for createCalendarRouter**

Find the line:
```js
import { createFleetRouter } from './routes/fleet/index.js'
```

Add after it:
```js
import { createCalendarRouter } from './routes/calendar/index.js'
```

- [ ] **Step 2: Add atlas.calendar to CORE_MODULE_KEYS**

Find:
```js
const CORE_MODULE_KEYS = new Set([
  "atlas.core",
  "atlas.identity",
  "atlas.files",
  "atlas.company",
  "atlas.contacts",
  "atlas.hr",
  "atlas.fleet",
  "atlas.ledger",
]);
```

Add `"atlas.calendar"` to the set:
```js
const CORE_MODULE_KEYS = new Set([
  "atlas.core",
  "atlas.identity",
  "atlas.files",
  "atlas.company",
  "atlas.contacts",
  "atlas.hr",
  "atlas.fleet",
  "atlas.ledger",
  "atlas.calendar",
]);
```

- [ ] **Step 3: Mount the calendar router**

Find where `createFleetRouter` is mounted (search for `app.route('', createFleetRouter` or similar pattern). Add the calendar router in the same block:

```js
app.route('', createCalendarRouter({ prisma, requirePermission, moduleContext: { moduleKey: 'atlas.calendar' } }))
```

- [ ] **Step 4: Syntax check**

```bash
node --check apps/api/src/index.js
```

Expected: No output (clean)

- [ ] **Step 5: Start API and verify health**

```bash
pnpm dev:api
```

Then in another terminal:
```bash
curl http://localhost:4010/health
```

Expected: `{"status":"ok"}` or similar

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/index.js
git commit -m "feat(calendar): mount atlas.calendar router in api index"
```

---

## Task 8: Seed — run db:seed to register the manifest

- [ ] **Step 1: Run seed to register atlas.calendar manifest and permissions**

```bash
pnpm db:seed
```

Expected: Output includes `atlas.calendar` being seeded. No errors.

- [ ] **Step 2: Verify module appears in DB**

```bash
curl http://localhost:4010/modules
```

Expected: Response includes an object with `key: "atlas.calendar"` in the modules array.

- [ ] **Step 3: Commit note** — No code change needed, seed is idempotent.

---

## Task 9: Service unit tests

**Files:**
- Create: `apps/api/src/routes/calendar/__tests__/calendar-service.test.js`

- [ ] **Step 1: Create tests directory and test file**

Create `apps/api/src/routes/calendar/__tests__/calendar-service.test.js`:

```js
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createCalendarService, CalendarServiceError } from '../calendar-service.js'

// Minimal mock prisma for unit tests
function makePrisma(overrides = {}) {
  const defaults = {
    calendarCalendar: {
      findFirst: async () => null,
      findMany: async () => [],
      create: async (args) => ({ id: 'cal-1', ...args.data }),
      update: async (args) => ({ id: args.where.id, ...args.data }),
    },
    calendarShare: {
      findFirst: async () => null,
      findMany: async () => [],
      create: async (args) => ({ id: 'share-1', ...args.data }),
      update: async (args) => ({ id: args.where.id, ...args.data }),
      delete: async () => {},
    },
  }
  return {
    calendarCalendar: { ...defaults.calendarCalendar, ...(overrides.calendarCalendar ?? {}) },
    calendarShare: { ...defaults.calendarShare, ...(overrides.calendarShare ?? {}) },
  }
}

describe('createCalendarService', () => {
  describe('createCalendar', () => {
    it('creates a calendar with trimmed name', async () => {
      const prisma = makePrisma()
      const svc = createCalendarService({ prisma })
      const result = await svc.createCalendar('user-1', { name: '  Trabajo  ' })
      assert.equal(result.name, 'Trabajo')
      assert.equal(result.ownerId, 'user-1')
    })

    it('throws 400 when name is empty', async () => {
      const prisma = makePrisma()
      const svc = createCalendarService({ prisma })
      await assert.rejects(
        () => svc.createCalendar('user-1', { name: '' }),
        (err) => {
          assert.ok(err instanceof CalendarServiceError)
          assert.equal(err.status, 400)
          return true
        }
      )
    })
  })

  describe('deleteCalendar', () => {
    it('throws 404 when calendar not found', async () => {
      const prisma = makePrisma()
      const svc = createCalendarService({ prisma })
      await assert.rejects(
        () => svc.deleteCalendar('user-1', 'missing-id'),
        (err) => {
          assert.ok(err instanceof CalendarServiceError)
          assert.equal(err.status, 404)
          return true
        }
      )
    })

    it('throws 400 when trying to delete default calendar', async () => {
      const prisma = makePrisma({
        calendarCalendar: {
          findFirst: async () => ({ id: 'cal-1', ownerId: 'user-1', isDefault: true, enabled: true }),
        },
      })
      const svc = createCalendarService({ prisma })
      await assert.rejects(
        () => svc.deleteCalendar('user-1', 'cal-1'),
        (err) => {
          assert.ok(err instanceof CalendarServiceError)
          assert.equal(err.status, 400)
          return true
        }
      )
    })
  })

  describe('shareCalendar', () => {
    it('throws 400 when user tries to share with themselves', async () => {
      const prisma = makePrisma({
        calendarCalendar: {
          findFirst: async () => ({ id: 'cal-1', ownerId: 'user-1', enabled: true }),
        },
      })
      const svc = createCalendarService({ prisma })
      await assert.rejects(
        () => svc.shareCalendar('user-1', 'cal-1', { userId: 'user-1', role: 'VIEWER' }),
        (err) => {
          assert.equal(err.status, 400)
          return true
        }
      )
    })

    it('throws 400 for invalid role', async () => {
      const prisma = makePrisma({
        calendarCalendar: {
          findFirst: async () => ({ id: 'cal-1', ownerId: 'user-1', enabled: true }),
        },
      })
      const svc = createCalendarService({ prisma })
      await assert.rejects(
        () => svc.shareCalendar('user-1', 'cal-1', { userId: 'user-2', role: 'SUPERADMIN' }),
        (err) => {
          assert.equal(err.status, 400)
          return true
        }
      )
    })
  })
})
```

- [ ] **Step 2: Run tests**

```bash
node --test apps/api/src/routes/calendar/__tests__/calendar-service.test.js
```

Expected:
```
▶ createCalendarService
  ▶ createCalendar
    ✔ creates a calendar with trimmed name
    ✔ throws 400 when name is empty
  ▶ deleteCalendar
    ✔ throws 404 when calendar not found
    ✔ throws 400 when trying to delete default calendar
  ▶ shareCalendar
    ✔ throws 400 when user tries to share with themselves
    ✔ throws 400 for invalid role
ℹ tests 6
ℹ pass 6
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/calendar/__tests__/
git commit -m "test(calendar): add calendar-service unit tests"
```

---

## Verification

After all tasks are complete, run a full smoke test against the running API:

```bash
# 1. Start API
pnpm dev:api

# 2. Get a token (from browser session or login endpoint)
# Set: TOKEN=<your_jwt_token>

# 3. List calendars (auto-creates default calendar on first call)
curl -H "Authorization: Bearer $TOKEN" http://localhost:4010/calendar/calendars

# 4. Create an event
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"calendar_id":"<id_from_step_3>","title":"Reunion de prueba","start_at":"2026-06-01T10:00:00Z"}' \
  http://localhost:4010/calendar/events

# 5. List events in range
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4010/calendar/events?start=2026-06-01T00:00:00Z&end=2026-06-30T23:59:59Z"

# 6. Verify atlas.calendar appears in modules list
curl http://localhost:4010/modules
```

All 6 steps should succeed with 2xx responses and correct JSON.

---

## Next Step

Once Plan A is complete and smoke tested, proceed to:
**`docs/superpowers/plans/2026-05-29-atlas-calendar-plan-b-frontend.md`**

That plan covers: CalendarScreen, Month/Week/Day/Agenda views, sidebars, modals, Zustand store, TanStack Query hooks, notification badge, and ModuleOutlet registration.
