# atlas.projects — Current State Spec

**Date:** 2026-08-30
**Module:** `atlas.projects` (CORE). Manifest in `feature-modules.js`.
**Status:** Post-audit reference (2026-08-30 pass).

---

## 1. Layout

```
apps/api/src/routes/projects/
  projects-routes.js            (~625) createProjectsRouter — all HTTP routes
  projects-service.js           projects, members, task statuses
  tasks-service.js              tasks, subtasks, assignees, bulk ops (Prisma)
  projects-dependencies-service.js  projects-fields-service.js
  projects-recurring-service.js  projects-notification-service.js
  projects-calendar-bridge.js   optional two-way sync to atlas.calendar
  __tests__/  6 files
apps/desktop/src/modules/atlas.projects/  Kanban / List / Timeline / TaskDetail
```

## 2. Data model

Prisma models: `Project` (`companyId`, `ownerId`, `taskCounter`, `calendarId`),
`ProjectMember` (`role` OWNER | MEMBER | VIEWER), `TaskStatus`, `Task`
(`parentTaskId` for subtasks, `taskNumber`), `TaskAssignee`, `TaskDependency`,
`ProjectField` + `TaskFieldValue`. Task comments/reactions use the shared
`services/comments-service.js` (`'Task'` entity), **not** `tasks-service`.

## 3. Authorization (rebuilt 2026-08-30)

Before: only `GET/PATCH/DELETE /projects/:id` checked project membership; every
other `/projects/:id/*` route trusted the company-wide RBAC permission
(`projects.task.update`, …) + the `projectId` in the URL. That allowed a member
of project A to read/write project B, a caller who guessed a project id to reach
another **company's** project, and `addMember` to add anyone (incl. self) to any
project.

Now: **`requireProjectAccess(minRole)`** middleware sits on all 40 `/projects/:id/*`
routes, right after `requirePermission(...)`:

1. loads the project (`id`, `companyId`, `ownerId`);
2. 404 if missing or `project.companyId !== callerCompanyId`;
3. resolves the caller's role — `OWNER` if `ownerId` match, else the
   `ProjectMember.role`; 404 if none;
4. 403 if `role` rank < `minRole` rank (VIEWER 1 < MEMBER 2 < OWNER 3);
5. sets `c.set('projectRole', role)`.

Role required per route family:

| Routes | minRole |
|---|---|
| project / member / status / field / calendar-sync **mutations** | OWNER |
| task / comment / attachment / dependency / field-value **writes** | MEMBER |
| all reads, `GET /projects/:id/export` | VIEWER |

`addMember` additionally verifies the invitee has an enabled `membership` in the
project's company (403 otherwise). `createProject` writes the project + its
template statuses + the owner `ProjectMember` in a single `prisma.$transaction`.

## 4. Permissions

`projects.access` (nav), `projects.project.{read,create,update,delete}`,
`projects.task.{read,create,update,delete}`, `projects.member.manage`. Already
in `permission-catalog.js`. These are the coarse company-wide gate;
`requireProjectAccess` is the fine per-project gate on top.

## 5. Tasks

`createTask` bumps `Project.taskCounter` and creates the task in one
`$transaction`. `listTasks` supports `includeSubtasks`, filters, and adds an
attachment count via `fileAsset.groupBy`. Recurring tasks use bounded RRULE
presets (`computeRruleNextAt`). `deleteStatus` reassigns orphaned tasks to the
default status before deleting.

## 6. Calendar bridge

`projects-calendar-bridge.js` (best-effort, swallows errors) optionally creates a
`CalendarCalendar` per project, mirrors tasks-with-due-dates as
`CalendarEvent`s, and grants project members `VIEWER` calendar shares. Detaches
a mirrored event on local edit.

## 7. UI

Kanban / List / Timeline / Agenda views, `TaskDetailPanel` (1050 lines — the
biggest file, watch), `ProjectFormModal`, `MembersPanel`, `StatusEditor`,
`ProjectFieldsSheet`. Uses `@atlas/ui`.

## 8. Tests

6 files, 44 tests, all green. New `project-access.test.js` covers cross-company
404, non-member 404, VIEWER→OWNER-route 403, OWNER pass-through, MEMBER read.
The 9 previously-failing `tasks-service{,-v2}` tests were mock rot (`$transaction`,
`fileAsset.groupBy`) + dead `createComment`/`updateComment` blocks (removed —
they tested a `tasks-service` API that never shipped).

## 9. Known gaps / follow-ups (backlog D4-a … D4-c)

- `getProject` still re-implements a membership check now covered by the
  middleware (harmless redundancy).
- `updateProject`/`archiveProject` service errors say 403 vs `getProject`'s 404
  (middleware 404s first, so mostly moot).
- Browser responsive QA of the project views.
- `TaskDetailPanel.jsx` 1050 lines.

## 10. Verification (2026-08-30)

- `node --check` on all touched files — pass.
- `node --test routes/projects/__tests__/*.test.js` — 44/44.
- `node --test` full API dirs — **781 / 0** (was 646 / 26).
- `pnpm --filter @atlas/desktop build:web` — pass.
