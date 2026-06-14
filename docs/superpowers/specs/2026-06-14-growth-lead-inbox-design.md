# Growth Lead Inbox

Date: 2026-06-14
Status: Proposed
Author: Codex
Spec file: `docs/superpowers/specs/2026-06-14-growth-lead-inbox-design.md`
Plan file: `docs/superpowers/plans/2026-06-14-growth-lead-inbox.md`

---

## 1. Feature title

Growth Lead Inbox

## 2. Status

Proposed

## 3. Context

Storefront Capture Foundation creates normalized leads and activities from public forms, but no ERP user can triage, qualify, assign, annotate, or convert them.

## 4. Problem

Form submissions remain passive records. Atlas needs a bounded pre-CRM workflow that turns web interest into an accountable, auditable contact decision without polluting `atlas.contacts`.

## 5. Goals

1. Provide a responsive Growth lead inbox and detail timeline.
2. Support status, priority, assignee, notes, filtering, and manual lead creation.
3. Convert a lead transactionally into a new or existing Contact.
4. Notify the configured assignee through Atlas notification channels.

## 6. Non-goals

1. Opportunities, deal value, forecasts, configurable pipelines, tasks, or round-robin assignment.
2. Automated Contact creation.
3. Bulk import or external CRM synchronization.

## 7. User stories

- As a sales user, I want to qualify web leads so I can focus on useful inquiries.
- As a manager, I want ownership and filters so unattended leads are visible.
- As a contact administrator, I want controlled conversion so duplicate Contacts are avoided.

## 8. UX requirements

- Every screen starts with `PageHeader`.
- Inbox uses `StatCard`, `FilterBar`, `SearchInput`, and `DataTable`.
- Detail uses cards, badges, `ContactPicker`, `TextareaField`, `AttachmentsPanel`, and a timeline.
- Loading uses `Skeleton`/`LoadingState`; empty and error cases use `EmptyState`/`ErrorState`.
- Disable and conversion confirmations use `ConfirmDialog`.
- UI labels are Spanish.

## 9. Routes/screens

| Route | Screen | Module | Description |
|---|---|---|---|
| `/app/m/atlas.growth/leads` | `GrowthLeadsScreen` | `atlas.growth` | Lead inbox |
| `/app/m/atlas.growth/leads/:id` | `GrowthLeadDetailScreen` | `atlas.growth` | Lead detail and timeline |

## 10. Data model

Use Growth models from Spec A.

`GrowthLead` status values: `new`, `follow_up`, `qualified`, `discarded`, `converted`.

Priority values: `low`, `normal`, `high`.

Add/confirm fields: `assigneeUserId`, `convertedContactId`, `convertedAt`, `discardReason`, `notesSummary`, `enabled`, optimistic `updatedAt`.

`GrowthLeadActivity` types: `submission`, `status_changed`, `priority_changed`, `assigned`, `note`, `converted`, `reopened`, `disabled`, `enabled`.

## 11. Prisma impact

New models: N/A beyond Spec A.

Modified models: N/A. Spec A provisions all operational lead fields required by this phase.

New migration required: No.

## 12. API contract

All endpoints require authentication and company context.

- `GET /growth/leads/summary` guarded by `growth.leads.read`.
- `GET /growth/leads` guarded by `growth.leads.read`; filters status, priority, assignee, form, campaign, date, search, page, pageSize.
- `POST /growth/leads` guarded by `growth.leads.create`.
- `GET /growth/leads/:id` guarded by `growth.leads.read`.
- `PATCH /growth/leads/:id` guarded by `growth.leads.update`; assignment additionally requires `growth.leads.assign`.
- `POST /growth/leads/:id/notes` guarded by `growth.leads.update`.
- `POST /growth/leads/:id/convert` guarded by `growth.leads.convert`.
- `PATCH /growth/leads/:id/enabled` guarded by `growth.leads.delete`.

Conversion body:

```json
{ "mode": "existing", "contactId": "uuid" }
```

or:

```json
{
  "mode": "create",
  "contact": { "type": "customer", "name": "...", "email": "...", "phone": "..." }
}
```

## 13. SDK contract

Extract internal Website methods from `packages/sdk/src/index.js` before adding `growth`.

Domain `atlas.growth`:

- `getLeadSummary(token, query?)`
- `listLeads(token, query?)`
- `getLead(id, token)`
- `createLead(payload, token)`
- `updateLead(id, payload, token)`
- `addLeadNote(id, note, token)`
- `convertLead(id, payload, token)`
- `setLeadEnabled(id, enabled, token)`

## 14. Validator contract

- `growthLeadCreateSchema`
- `growthLeadUpdateSchema`
- `growthLeadNoteSchema`
- `growthLeadConvertSchema`
- `growthLeadQuerySchema`

## 15. Module manifest impact

Update `atlas.growth`:

- navigation entry “Leads”, path `/leads`, icon `UserRoundSearch`, permission `growth.leads.read`.
- ACL maps lead actions and `GrowthLead` CRUD.

## 16. Navigation impact

| Label | Path | Icon | Layout | permissionKey |
|---|---|---|---|---|
| Leads | `/leads` | `UserRoundSearch` | `main` | `growth.leads.read` |

## 17. Blueprint impact

N/A. Screens are official custom React screens.

## 18. RBAC/permissions

- `growth.leads.read`: summary, list, detail, navigation.
- `growth.leads.create`: manual creation.
- `growth.leads.update`: status, priority, notes.
- `growth.leads.delete`: enable/disable.
- `growth.leads.assign`: assignee changes.
- `growth.leads.convert`: Contact conversion.

Contact creation during conversion also requires `contacts.contacts.create`; linking an existing Contact requires `contacts.contacts.read`.

## 19. Multi-company behavior

All lead, activity, Contact candidate, form, and assignee queries are scoped to the authenticated company. Cross-company IDs return 404.

## 20. Files/storage impact

Lead detail supports existing file attachments with `moduleKey=atlas.growth`, `entityType=GrowthLead`, and entity ID prefix. Add `GrowthLead` to the files allowlist.

## 21. Export/import requirements

N/A.

## 22. Audit log requirements

Actions: `growth.lead.create`, `update`, `assign`, `status_change`, `note`, `convert`, `enable`, `disable`.

Conversion audit records lead and Contact IDs; activity payloads omit sensitive submission bodies.

## 23. Edge cases

1. Converted is terminal.
2. Discarded may reopen to `follow_up`.
3. Disabled leads cannot mutate or convert until enabled.
4. Concurrent conversion returns conflict and does not create a second Contact.
5. Assignee must have an active company membership.
6. Existing Contact must belong to the same company.

## 24. Risks

1. Duplicate Contacts. Mitigation: candidate search and explicit user choice.
2. Permission escalation during conversion. Mitigation: require both Growth and Contacts permissions.
3. Lost updates. Mitigation: `updatedAt` precondition on operational mutations.

## 25. Acceptance criteria

1. Given `growth.leads.read`, when navigating to Leads, then inbox metrics and rows load.
2. Given no assign permission, when changing assignee, then API returns 403.
3. Given a discarded lead, when reopened, then status becomes `follow_up` and an activity is written.
4. Given conversion to a new Contact, when successful, then one Contact exists and lead is `converted`.
5. Given conversion failure, then no partial Contact or converted state remains.
6. Given an assigned new lead, then Atlas publishes an internal notification and respects delivery preferences.

## 26. Verification plan

- `node --test apps/api/src/routes/growth/__tests__/growth-lead-service.test.js`
- `node --test apps/api/src/routes/growth/__tests__/growth-lead-routes.test.js`
- `node --test packages/sdk/src/__tests__/growth-domain.test.js`
- `pnpm --filter @atlas/desktop build:web`
- Manual RBAC and responsive browser QA.

## 27. Rollback plan

Hide Growth navigation, disable protected routes, and leave captured leads intact. If schema fields were added, remove them only through a new forward migration after export.

## 28. Future enhancements

1. Tasks and reminders.
2. Round-robin teams.
3. Opportunities and deal pipeline.
4. CRM synchronization.
