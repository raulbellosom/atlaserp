# Offline Architecture Design — Atlas ERP

**Date:** 2026-06-06  
**Status:** Approved — ready for implementation planning  
**Author:** Raul Belloso Medina  

---

## 1. Context & Goals

Atlas ERP is a self-hosted modular ERP deployed in Docker per customer. The frontend is a React + Vite app running inside a Tauri native window on desktop and optionally as a PWA in the browser. Field workers (logistics, fleet, HR) may spend entire workdays without internet connectivity and need to continue working without interruption.

**Goals:**
- Users can read and write data in selected modules with no internet connection for up to a full workday (or longer).
- When connectivity is restored, offline changes sync automatically to the server.
- Conflicts are handled per-module with strategies appropriate to the data risk level.
- The solution works identically in the Tauri desktop app and a PWA browser tab.
- No existing screen component requires changes to benefit from offline support.

**Non-goals (out of scope for this design):**
- Offline support for finance/ledger, stock movements, billing, permissions, or module lifecycle.
- Real-time multi-user collaboration (CRDT, operational transforms).
- SQLite via Tauri plugin (deferred to a future phase for heavy modules).

---

## 2. Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Offline scope | Full offline-first (read + write queue) | Field workers need an entire day of offline operation |
| Local database | IndexedDB via Dexie.js, first phase | Works in Tauri WebView and PWA identically; no Rust plugin needed |
| Future local DB | Tauri SQLite plugin for heavy modules | Deferred — evaluate for ledger/catalog reporting in a later phase |
| Conflict resolution | Hybrid per module | Low-risk data uses last-write-wins; dangerous data blocks offline writes entirely |
| Auth offline | Full offline grace period | JWT stored in SessionVault; writes queue locally; refresh replays on reconnect |
| Auth grace cap | 7 days (Supabase refresh token TTL) | Covers extended field trips; configurable in Supabase dashboard |

---

## 3. Repository Audit Findings

Findings from the pre-design repository audit (2026-06-06):

| Area | Current State |
|---|---|
| Desktop runtime | Tauri fully implemented (`src-tauri/tauri.conf.json`). No Electron anywhere. |
| PWA / workbox | Not present — no `vite-plugin-pwa`, no workbox config, no PWA manifest. |
| Service worker | Exists (`public/sw-notifications.js`) but handles **push notifications only**. No caching layer. |
| IndexedDB | Zero usage anywhere in the codebase. |
| React Query cache | In-memory only. `staleTime: 5min`, `gcTime: 10min`. No persistence. |
| SDK transport | `packages/sdk/src/index.js` — pure `fetch` wrapper, no retry/cache/offline logic. |
| Raw fetch bypasses | Calendar hooks (`useCalendarData.js`) and fleet file operations (`VehicleImageCell.jsx`) use raw `fetch()` outside the SDK. |
| Zustand persistence | Theme + sidebar state only (localStorage). No entity data persisted. |
| Auth session | Supabase session in Supabase internal storage. No offline vault. |
| Backend sync | No `/sync` endpoint. No `SyncMutationLog` or `SyncCursor` tables. |
| Module manifests | No `offline` flag or declaration in any manifest. |
| Background worker | Push notification delivery only (polls DB every 30s). |

---

## 4. Overall Architecture

### New package

```
packages/offline/              @atlas/offline
  src/
    db.js                      Dexie instance + schema versioning
    mutation-queue.js          Pending writes, retry, idempotency
    sync-engine.js             Orchestrates push/pull with server
    conflict.js                Per-module conflict strategies
    session-vault.js           Stores JWT/refresh token offline
    online-detector.js         navigator.onLine + health probe
    index.js                   Public API
```

### Modified packages (minimal surface)

```
packages/sdk/src/index.js      Add offline transport intercept (~20 lines)
packages/ui/src/index.js       Export 4 new offline UI components
packages/ui/src/components/    OfflineIndicator, SyncStatusBar,
                               PendingMutationsPanel, ConflictDialog
apps/desktop/src/main.jsx      PersistQueryClientProvider wrapping
apps/desktop/src/app/AtlasApp.jsx   Wrap with OfflineProvider
apps/api/src/index.js          Register /sync route group
apps/api/src/routes/sync.js    NEW — sync endpoint group
apps/api/src/services/sync-service.js  NEW — sync business logic
apps/worker/src/index.js       Add SyncMutationLog cleanup job
prisma/schema.prisma           Add SyncMutationLog + SyncCursor models
pnpm-workspace.yaml            Add packages/offline
```

**Files that do NOT change:** All existing screen components, all existing API route files, all AME3 module views, existing Prisma models.

### Data flow diagram

```
┌─────────────────────────────────────────────────────────┐
│                React App (Tauri WebView / Browser)       │
│                                                         │
│  ┌──────────────┐   reads   ┌─────────────────────┐     │
│  │ React Query  │◄─────────│   @atlas/offline      │     │
│  │  (UI layer)  │           │  OfflineDatabase      │     │
│  └──────┬───────┘           │  (Dexie / IndexedDB)  │     │
│         │ mutations         └────────┬──────────────┘     │
│         ▼                           │ sync                │
│  ┌──────────────┐                   │                     │
│  │  SDK client  │◄──────────────────┘                     │
│  │ (transport)  │  online: direct fetch                    │
│  └──────┬───────┘  offline: queue in MutationQueue        │
└─────────┼───────────────────────────────────────────────┘
          │ HTTPS (when online)
          ▼
┌─────────────────────────────────────────────────────────┐
│                  Hono API (apps/api)                     │
│                                                         │
│  Existing routes unchanged    NEW: /sync endpoint group  │
│                               /sync/pull  — fetch deltas │
│                               /sync/push  — apply queue  │
│                               /sync/ack   — confirm recv │
│                               /sync/status — health info │
└─────────────────────────────────────────────────────────┘
          │
          ▼
    Supabase PostgreSQL
    (adds SyncMutationLog + SyncCursor tables)
```

### Key principle: React Query stays as the UI cache

React Query continues to be what all components talk to. The offline layer sits **between React Query and the network**. When online, React Query fetches from the server as today. When offline, React Query reads from the local Dexie database. Zero changes required to existing screen components.

### Offline data scoping

Every piece of offline data is keyed by:

```
{ apiBaseUrl, companyId, userId, moduleKey, schemaVersion }
```

This prevents one user's offline data from leaking into another user's session on the same device.

---

## 5. Local Database Schema (Dexie / IndexedDB)

One IndexedDB database per device, namespaced by `apiBaseUrl + companyId + userId`.

### Table: `offline_records`

Stores cached entity records pulled from the server.

| Field | Type | Description |
|---|---|---|
| `[moduleKey+entityType+id]` | compound PK | Unique per record |
| `moduleKey` | string | e.g. `atlas.contacts` |
| `entityType` | string | Model name, e.g. `contact` |
| `id` | UUID v7 | Matches server record ID |
| `data` | JSON | Full record payload |
| `version` | ISO timestamp | Server `updatedAt` — used for conflict detection |
| `pulledAt` | ISO timestamp | When we last fetched this from server |
| `companyId` | UUID | Company scope |
| `dirty` | boolean | Has unsaved local changes |

### Table: `mutation_queue`

Stores pending writes waiting to sync.

| Field | Type | Description |
|---|---|---|
| `id` | UUID v7 | Local mutation ID |
| `idempotencyKey` | UUID v7 | Sent to server — prevents duplicate apply |
| `moduleKey` | string | |
| `entityType` | string | |
| `recordId` | UUID v7 or null | null for CREATE operations |
| `operation` | string | `CREATE` \| `UPDATE` \| `DELETE` |
| `payload` | JSON | Full record for CREATE; field diff for UPDATE |
| `status` | string | `PENDING` \| `SYNCING` \| `CONFLICT` \| `FAILED` \| `DONE` |
| `queuedAt` | ISO timestamp | |
| `attempts` | integer | Retry count |
| `lastError` | string | Last failure reason |
| `companyId` | UUID | |
| `userId` | UUID | |

### Table: `sync_state`

Per-module sync cursor. One row per `(moduleKey, entityType)`.

| Field | Type | Description |
|---|---|---|
| `[moduleKey+entityType]` | compound PK | |
| `lastPullAt` | ISO timestamp | Last successful pull |
| `serverCursor` | ISO timestamp | Opaque delta cursor from `/sync/pull` |
| `schemaVersion` | string | Module version at time of last sync |

### Table: `session_vault`

Single-row table (`id = 'current'`) storing auth session for offline use.

| Field | Type | Description |
|---|---|---|
| `id` | string | Always `'current'` |
| `accessToken` | string | Current JWT |
| `refreshToken` | string | For token renewal on reconnect |
| `expiresAt` | ISO timestamp | JWT expiry |
| `userProfile` | JSON | Full `/user/me` response |
| `companyId` | UUID | |
| `apiBaseUrl` | string | |
| `storedAt` | ISO timestamp | |

### Table: `conflicts`

Unresolved conflicts waiting for user action.

| Field | Type | Description |
|---|---|---|
| `id` | UUID v7 | |
| `mutationId` | UUID v7 | Which `mutation_queue` entry triggered this |
| `moduleKey` | string | |
| `entityType` | string | |
| `recordId` | UUID v7 | |
| `localData` | JSON | What the local device had |
| `serverData` | JSON | What the server returned |
| `detectedAt` | ISO timestamp | |
| `status` | string | `PENDING` \| `RESOLVED_LOCAL` \| `RESOLVED_SERVER` |

### Schema versioning

When a module's version field changes (e.g. `0.1.0` → `0.2.0`), the sync engine compares `sync_state.schemaVersion` against the live manifest. On mismatch:

1. Drop that module's `offline_records` entries.
2. Drop that module's `mutation_queue` entries (surface a warning if any are pending).
3. Re-pull from the server from scratch.
4. Write the new `schemaVersion` into `sync_state`.

---

## 6. Module Offline Declaration

Each module manifest gains an optional `offline` block. Absence of the block means the module is online-only.

```javascript
// Example: modules/custom/custom.fleet/module.manifest.js
export default defineAtlasModule({
  key: 'custom.fleet',
  // ... existing fields unchanged ...

  offline: {
    enabled: true,
    models: ['vehicle', 'driver'],     // AME3 model names to sync locally
    strategy: 'last-write-wins',       // conflict strategy for this module
    allowCreate: true,                 // can queue offline CREATEs
    allowUpdate: true,                 // can queue offline UPDATEs
    allowDelete: false,                // DELETE always requires connectivity
    maxRecords: 5000,                  // safety cap on local cache size
    pullFields: null,                  // null = all fields; or array to limit
  },
})
```

### Conflict strategies

| Strategy | Behavior | Recommended for |
|---|---|---|
| `last-write-wins` | Offline edit overwrites server on sync regardless of conflict | Low-risk catalog data: contacts, fleet, HR titles |
| `server-wins` | Offline edit discarded silently if server changed the record | Medium-risk shared records |
| `conflict-ui` | User sees side-by-side comparison and picks which fields win | High-value shared records (Phase 4) |
| `readonly` | Module data is cached for reading; offline writes blocked | Reference data the user needs to look up |
| *(no offline block)* | Module is fully online-only | Ledger, stock, identity, permissions |

---

## 7. Sync Engine

### Online/offline detection

```
OnlineDetector:
  - Listens to window 'online' / 'offline' events
  - Polls navigator.onLine as fallback
  - Runs a HEAD /health probe every 30s to confirm real connectivity
    (navigator.onLine can lie on some networks)
  - Broadcasts state via useOfflineStore (Zustand)
```

### Mutation queue lifecycle

```
User action (form submit, delete, etc.)
        │
        ▼
SDK transport intercept
        │
   online? ──YES──► normal fetch ──success──► React Query invalidation
        │                          │
        NO                      failure (5xx / timeout)
        │                          │
        └──────────────┬───────────┘
                       ▼
         Write to mutation_queue (status: PENDING)
         Optimistic update to offline_records
         React Query reads from offline_records
                       │
               online restored
                       │
                       ▼
         SyncEngine.push()
           - Reads PENDING mutations in queuedAt ASC order
           - Sets status → SYNCING
           - POST /sync/push (batch of up to 50 mutations)
           - Each mutation includes idempotencyKey
                       │
         Server responds per mutation:
           ├── OK        → status → DONE, update offline_records
           ├── CONFLICT  → status → CONFLICT, write to conflicts table
           └── ERROR     → status → FAILED, increment attempts
                       │
         After push: SyncEngine.pull()
           - GET /sync/pull?cursor={serverCursor}&modules=...
           - Server returns records changed since cursor
           - Merge into offline_records
           - Update sync_state.serverCursor
```

### Retry policy

| Attempts | Retry after |
|---|---|
| 0 | 5 seconds |
| 1 | 30 seconds |
| 2 | 5 minutes |
| ≥ 3 | Mark `FAILED`, surface in UI, stop retrying |

Failed mutations are never silently dropped. The user sees them in `PendingMutationsPanel` and can retry manually or discard.

### Idempotency

The server stores `idempotencyKey` of every applied mutation in `SyncMutationLog` for 72 hours. If the same key arrives twice (e.g. client retried after a timeout where the server already succeeded), the server returns `OK` with the existing result instead of applying the mutation twice. Critical for CREATE operations where a second apply would duplicate a record.

### Pull triggers

| Trigger | Action |
|---|---|
| App comes online | Pull all enabled offline modules |
| App foregrounds (Tauri) | Pull modules with `lastPullAt` > 5 min ago |
| Manual "Sincronizar ahora" button | Force pull all modules |
| Module screen opened | Pull that module if `lastPullAt` > staleTime |
| Background every 10 min | Pull via sync engine timer |

---

## 8. Auth Offline Grace Period

```
SessionVault stores:
  accessToken   — used for all queued mutation headers
  refreshToken  — used to obtain new accessToken on reconnect
  expiresAt     — accessToken expiry
  storedAt      — when vault was last written

While offline:
  - User stays logged in indefinitely on the local device
  - accessToken is attached to queued mutation payloads
  - No JWT validation occurs offline (validation is server-side)
  - Mutations accumulate in mutation_queue

On reconnect:
  1. Attempt token refresh using refreshToken → new accessToken from Supabase
  2. Refresh success → update SessionVault → proceed with SyncEngine.push()
  3. Refresh fails (token revoked / user disabled):
     - Force logout
     - Surface message: "Tu sesion ha expirado. Por favor inicia sesion de nuevo.
       Tus cambios offline han sido conservados y se sincronizaran al iniciar sesion."
     - After login, sync resumes from the same mutation_queue

Grace period cap: 7 days
  Supabase refresh token TTL is configurable — set to 7 days for field worker scenarios.
  Configurable in Supabase dashboard under Auth > Settings.
```

---

## 9. Backend API Changes

### New Prisma models

```prisma
model SyncMutationLog {
  id             String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  idempotencyKey String   @unique @db.Uuid
  companyId      String   @db.Uuid
  userId         String   @db.Uuid
  moduleKey      String
  entityType     String
  operation      String
  recordId       String?  @db.Uuid
  appliedAt      DateTime @default(now())
  expiresAt      DateTime

  @@index([idempotencyKey])
  @@index([companyId, appliedAt])
}

model SyncCursor {
  id          String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  companyId   String   @db.Uuid
  moduleKey   String
  entityType  String
  cursor      DateTime
  updatedAt   DateTime @updatedAt

  @@unique([companyId, moduleKey, entityType])
}
```

No existing models are modified. No AME3 module tables are touched.

### New route group: `apps/api/src/routes/sync.js`

```
POST  /sync/push     Apply a batch of offline mutations
GET   /sync/pull     Fetch records changed since cursor
POST  /sync/ack      Acknowledge successful receipt (updates SyncCursor)
GET   /sync/status   Returns per-module sync health for the client
```

### `POST /sync/push` contract

**Request:**
```json
{
  "mutations": [
    {
      "idempotencyKey": "uuid-v7",
      "moduleKey": "atlas.contacts",
      "entityType": "contact",
      "operation": "UPDATE",
      "recordId": "uuid-v7",
      "payload": { "name": "Raul B.", "phone": "+1..." },
      "queuedAt": "2026-06-06T10:00:00Z",
      "clientVersion": "0.2.1"
    }
  ]
}
```

**Response:**
```json
{
  "results": [
    {
      "idempotencyKey": "uuid-v7",
      "status": "OK",
      "record": { "...current server record..." },
      "conflictFields": []
    }
  ]
}
```

**Status values:** `OK` | `CONFLICT` | `NOT_FOUND` | `PERMISSION_DENIED` | `ERROR`

**Server logic per mutation:**
1. Check `SyncMutationLog` — if `idempotencyKey` exists, return `OK` with existing record.
2. Validate user has write permission for the module.
3. Load current server record.
4. Compare `payload` field timestamps against server `updatedAt`.
5. No conflict → apply, write to `SyncMutationLog`, return `OK`.
6. Conflict detected → apply module strategy:
   - `last-write-wins` → apply, return `OK`
   - `server-wins` → skip, return `CONFLICT` with server record
   - `conflict-ui` → skip, return `CONFLICT` with both versions

### `GET /sync/pull` contract

**Query params:** `modules=atlas.contacts,custom.fleet`, `cursor=ISO-timestamp`, `companyId=uuid`

**Response:**
```json
{
  "records": [
    {
      "moduleKey": "atlas.contacts",
      "entityType": "contact",
      "id": "uuid-v7",
      "data": { "...full record..." },
      "version": "2026-06-06T09:30:00Z",
      "deleted": false
    }
  ],
  "nextCursor": "2026-06-06T09:30:00Z",
  "hasMore": false
}
```

`deleted: true` entries tell the client to remove the record from `offline_records`. Handles the case where a record was deleted online while a device was editing it offline — the client receives the tombstone on pull and surfaces a conflict.

### Worker cleanup job

`apps/worker/src/index.js` gains:
```javascript
// Runs every 6 hours
// Deletes SyncMutationLog rows where expiresAt < now()
createSyncLogCleanupWorker({ prisma })
```

---

## 10. Frontend Architecture Changes

### `@atlas/offline` public API

```javascript
export { OfflineProvider }           // React context, wraps entire app
export { useOfflineStatus }          // { isOnline, lastSyncAt, pendingCount }
export { useOfflineStore }           // Zustand store for sync state
export { usePendingMutations }       // list of queued/failed mutations
export { useConflicts }              // list of unresolved conflicts
export { offlineDb }                 // Dexie instance (SDK internal use only)
export { SyncEngine }                // used by OfflineProvider internally
export { createOfflineTransport }    // SDK transport factory
```

### SDK transport intercept

`packages/sdk/src/index.js` — the `request()` function gains:

```javascript
async function request(path, options = {}) {
  if (!navigator.onLine && isMutation(options.method)) {
    return offlineTransport.queue(path, options)    // write to mutation_queue
  }
  if (!navigator.onLine) {
    return offlineTransport.readLocal(path, options) // read from offline_records
  }
  const response = await fetch(`${baseUrl}${path}`, options)
  // ... existing error handling unchanged ...
}
```

### React Query persistence

`apps/desktop/src/main.jsx`:

```javascript
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createDexiePersister } from '@atlas/offline'

// Persists React Query cache to offline_records between sessions.
// Hydrates on app load so screens render immediately from cache.
```

### New UI components

| Component | Purpose | Location in UI |
|---|---|---|
| `OfflineIndicator` | Pill in top bar: "Sin conexion — 3 cambios pendientes" | AppShell header |
| `SyncStatusBar` | Last sync time + per-module status | Configuracion > Sincronizacion |
| `PendingMutationsPanel` | List of queued/failed mutations with retry/discard | Accessible from OfflineIndicator |
| `ConflictDialog` | Side-by-side field comparison, user picks which version wins | Modal, triggered when conflicts table has PENDING rows |

`OfflineIndicator` is the only always-visible UI change. All other components are on-demand.

### Raw fetch calls that need SDK migration (Phase 2)

These two files bypass the SDK and will not benefit from the offline transport intercept until migrated:

| File | Issue |
|---|---|
| `apps/desktop/src/modules/atlas.calendar/hooks/useCalendarData.js` | Has its own `apiFetch()` wrapper |
| `apps/desktop/src/modules/atlas.fleet/components/VehicleImageCell.jsx` | Direct `fetch()` for signed URLs and documents |

Migration: replace `apiFetch()` calls with SDK client calls in Phase 2.

---

## 11. Module Classification

### Tier 0 — App shell (offline always, Phase 1)

| Area | Offline behavior |
|---|---|
| AppShell / layout | Renders from cached module manifest |
| Auth session | Kept alive via SessionVault |
| Module registry | Installed modules list cached locally |
| Theme / branding | Already in localStorage |
| Launcher / Home | Cached favorites, recent screens, module tiles |

### Tier 1 — Full offline CRUD (Phase 2–3)

| Module | Strategy | Create | Update | Delete |
|---|---|---|---|---|
| `atlas.contacts` | last-write-wins | Yes | Yes | No |
| `atlas.hr` (departments, job titles, employees) | last-write-wins | Yes | Yes | No |
| `custom.fleet` (vehicles, drivers) | last-write-wins | Yes | Yes | No |
| `atlas.catalog` (products, categories) | last-write-wins | Yes | Yes | No |

### Tier 2 — Read cache only (Phase 2)

| Module | Cached data | Why writes blocked |
|---|---|---|
| `atlas.identity` | User list, role names | Permission changes must be immediate |
| `atlas.company` | Company info, branding | Rarely changes |
| `atlas.files` (browse) | File metadata | Upload requires connectivity |
| `atlas.calendar` | Events, calendars | Deferred to Phase 4 |

### Tier 3 — Online-only

| Module | Reason |
|---|---|
| `atlas.ledger` / finance | Double-entry — out-of-order entries corrupt the books |
| Catalog stock movements | Offline creates cause phantom stock |
| `atlas.identity` writes | Security — must be authoritative immediately |
| Module install / uninstall | Requires server-side DB provisioning |
| Stripe / billing | Real-time server confirmation required |
| Website publish / deploy | File upload + CDN invalidation |
| SMTP / instance settings | Must take effect immediately |
| Permissions / RBAC writes | Must be authoritative immediately |

---

## 12. Phased Implementation Plan

### Phase 1 — Foundation (no offline writes yet)

- Create `packages/offline`: Dexie schema, SessionVault, OnlineDetector, OfflineProvider
- Add `OfflineIndicator` to AppShell
- Persist React Query cache to IndexedDB via `PersistQueryClientProvider`
- App shell renders from cache immediately on load
- JWT stored in SessionVault — user stays logged in offline
- No mutation queue yet — writes still fail offline with a clear error message

**Deliverable:** App opens instantly from cache. User sees "Sin conexion" indicator. No data loss. No writes queued.

### Phase 2 — Read cache + pull sync

- Implement `/sync/pull` endpoint and `SyncCursor` table
- `SyncEngine.pull()` populates `offline_records` for Tier 1 modules
- SDK `readLocal()` — React Query reads from Dexie when offline
- `atlas.contacts`, `atlas.hr`, `custom.fleet`, `atlas.catalog` serve from cache offline
- Migrate `useCalendarData.js` and `VehicleImageCell.jsx` from raw fetch to SDK
- `SyncStatusBar` with last sync timestamp

**Deliverable:** Users can browse Tier 1 and Tier 2 modules with no connectivity.

### Phase 3 — Mutation queue + push sync

- Implement `/sync/push` endpoint and `SyncMutationLog` table
- SDK transport intercept queues mutations when offline
- `SyncEngine.push()` replays queue on reconnect
- `PendingMutationsPanel` — user can see, retry, or discard queued changes
- `last-write-wins` strategy live for Tier 1 modules
- Idempotency keys prevent duplicate creates

**Deliverable:** Full offline CRUD for Tier 1 modules. First safe production deployment of offline writes.

### Phase 4 — Conflict resolution UI

- `ConflictDialog` component
- `conflict-ui` strategy available in module offline declarations
- `conflicts` table surfaced in UI
- `atlas.calendar` added to Tier 2 offline read cache

**Deliverable:** Users can resolve conflicts manually. `conflict-ui` strategy available for any module.

### Phase 5 — Tauri SQLite (future, optional)

- Evaluate `tauri-plugin-sql` for `atlas.ledger` read-only cache
- Heavy reporting modules that need local SQL joins
- This phase is explicitly deferred and requires a separate spec

---

## 13. Risks & Tradeoffs

| Risk | Mitigation |
|---|---|
| Sensitive data stored locally in IndexedDB | Data is scoped by userId + companyId. Tauri app runs in a sandboxed WebView — IndexedDB is not accessible from other apps. For shared/public devices, document that offline should be disabled. |
| JWT stored in SessionVault is sensitive | Stored in IndexedDB (same security model as Supabase's own session storage). No additional risk beyond current session handling. |
| Stale data shown to users | `pulledAt` timestamp is always visible in SyncStatusBar. Stale data is labeled as such in the UI. |
| Mutation queue grows unbounded on long offline periods | `maxRecords` cap per module + `FAILED` after 3 attempts limits growth. |
| Schema changes break cached data | `schemaVersion` check on every sync — automatic full re-pull on version mismatch. |
| Unique field violations on CREATE sync | Server returns `ERROR` or `CONFLICT` with details. User sees it in `PendingMutationsPanel`. |
| Offline writes for Calendar conflict with invites | Calendar is Tier 2 (read-only cache) until Phase 4. |
| Raw fetch calls in Calendar and Fleet not intercepted | These are explicitly listed for migration in Phase 2 before those modules go offline-capable. |

---

## 14. Documentation Requirements

When implementing each phase, the following docs must be updated:

- `docs/ai-context/ame3-modules.md` — document the `offline` block in module manifests
- `docs/ai-context/ame3-runtime-capabilities.md` — document the 4 new UI components
- `docs/02_module_system.md` — add offline declaration to module authoring guide
- `packages/offline/README.md` — package-level developer docs for the sync engine
- `CLAUDE.md` — add `@atlas/offline` to architecture overview

---

## 15. First Safe Milestone

**Phase 1 only.** No offline writes. Zero risk to data integrity.

Scope:
1. `packages/offline` package with Dexie schema + SessionVault + OnlineDetector + OfflineProvider
2. `OfflineIndicator` component in AppShell header
3. React Query cache persisted to IndexedDB via `PersistQueryClientProvider`
4. SessionVault writes JWT on login, reads on app load

This milestone can be shipped to production without any change to the API, without any new sync endpoint, and without any module manifests being modified. It is a pure frontend addition. Rollback is trivial — remove `OfflineProvider` from `AtlasApp.jsx`.
