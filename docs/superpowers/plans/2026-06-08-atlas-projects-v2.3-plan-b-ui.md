# atlas.projects V2.3 — Plan B: UI

## Tasks

- [ ] B1. Add SDK methods: dependencies (listDependencies, addDependency, removeDependency), fields (listFields, createField, updateField, deleteField), fieldValues (getFieldValues, upsertFieldValues), export (exportCsv)
- [ ] B2. Add hooks to `useProjectsData.js`: useTaskDependencies, useAddDependency, useRemoveDependency, useProjectFields, useCreateField, useUpdateField, useDeleteField, useTaskFieldValues, useUpsertFieldValues
- [ ] B3. `TaskDetailPanel`: add "Dependencias" section with blocker/blocking lists and combobox picker; add "Repetir" SelectField; add "Campos" section rendering ProjectFields with inline edit
- [ ] B4. KanbanView `TaskCard`: show `Lock` icon when task has unresolved blockers (pass `isBlocked` prop from parent); show `RefreshCw` chip for recurring tasks
- [ ] B5. Extend ListViewCard (or equivalent) with same lock + recurring indicators
- [ ] B6. `ProjectFieldsSheet.jsx`: sheet for managing project custom fields (list, add, edit, delete, reorder with up/down)
- [ ] B7. Wire "Gestionar campos" trigger in project settings or header area
- [ ] B8. Export button in project header — calls SDK export, triggers browser download
- [ ] B9. Verify no file exceeds 1000 lines; split if needed
