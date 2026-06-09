# atlas.projects V2.3 — Plan A: API

## Tasks

- [ ] A1. Migration `20260608250000_atlas_projects_v2_3`: task_dependency, rrule columns on task, project_field, task_field_value
- [ ] A2. Update `prisma/schema.prisma`: TaskDependency, ProjectField, TaskFieldValue models + Task/Project relation additions
- [ ] A3. `pnpm exec prisma migrate deploy` + `pnpm db:generate`
- [ ] A4. Dependencies service in `projects-tasks-service.js`: listDependencies, addDependency (cycle guard + self-dependency guard), removeDependency
- [ ] A5. Dependencies routes: GET/POST/DELETE `/projects/:id/tasks/:tid/dependencies`
- [ ] A6. `computeRruleNextAt(rrule)` helper in projects service; extend `updateTask` to accept `rrule` and set `rrule_next_at`; include `rrule` in `getTask` response
- [ ] A7. Worker recurring task tick: query done+rrule+overdue tasks, clone into new task with next rrule_next_at
- [ ] A8. Custom fields service: listFields, createField, updateField, deleteField; task field-values service: getFieldValues, upsertFieldValues
- [ ] A9. Custom fields routes: GET/POST/PATCH/DELETE `/projects/:id/fields`; task field-values routes: GET/PUT `/projects/:id/tasks/:tid/field-values`
- [ ] A10. Extend `getTask` response to include `fieldValues` with field metadata
- [ ] A11. CSV export: `GET /projects/:id/export?format=csv` — streams CSV with all tasks + custom field columns
- [ ] A12. `node --check` all modified API files
