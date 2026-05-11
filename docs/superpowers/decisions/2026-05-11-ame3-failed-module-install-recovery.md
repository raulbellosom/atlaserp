# AME3 Decision Log: Failed Module Install Recovery and Partial Cleanup

Date: 2026-05-11  
Scope: AME3 Task 1 lifecycle gap remediation  
Related spec: `docs/superpowers/specs/2026-05-10-ame3-atlas-orm-blueprint-renderer-design.md`  
Related plan: `docs/superpowers/plans/2026-05-10-ame3-atlas-orm-blueprint-renderer.md`

## Decision

During Task 1 validation, installation failures in custom modules exposed a lifecycle dead-end (`status=ERROR`) that blocked recovery from the Module Catalog.

The platform now adopts the following rules:

1. A module in `ERROR` must always be recoverable.
2. `ERROR` is not a dead-end state in the Module Catalog.
3. The UI must expose actionable recovery options for `ERROR`.
4. Failed installs must preserve diagnostic details sufficient to explain the failure.
5. Partial installs must not leave the system in an unrecoverable state.
6. Destructive cleanup requires dry-run analysis and explicit typed confirmation (`ACEPTO`) when physical tables or data may be removed.
7. Developers/users must not need manual SQL patches to recover a module.

## Implementation Direction

1. Install failure handling must force `enabled=false`, deactivate module permissions, persist structured `lifecycleConfig.lastError`, and write `core.module.install.error`.
2. Recovery APIs must support non-destructive reset to `UNINSTALLED` without dropping tables or deleting migration history by default.
3. Physical cleanup may only target module-owned tables proven by both `AtlasModel.tableName` and `lifecycleConfig.ownedTables`.
4. Migration ledger deletion is permitted only for tables that were explicitly and successfully dropped in confirmed cleanup.

## Notes

This is an approved deviation/addendum to AME3 Task 1 execution and must be completed before continuing to Task 2.

### Shared Validator Justification

The new schemas added to `packages/validators/src/index.js` are platform-level module lifecycle contracts, not module-domain validators:

- `moduleClearErrorSchema`
- `moduleCleanupDryRunSchema`
- `moduleCleanupSchema`

These schemas validate shared Atlas Core endpoints under `/modules/:key/*` and apply to any module in lifecycle recovery states. This does not violate the AME3 rule that `custom.fleet` domain validators must remain in `modules/custom/custom.fleet/validators/index.js`.
