// Single source of truth for which module keys have offline support. Also
// doubles as the /sync/pull "modules" request list, so it must stay
// canonical-only (runly.*) — listing both spellings here would make the sync
// engine pull every record twice under two different moduleKey values.
// isModuleOfflineBlocked (apps/desktop/src/lib/moduleLauncher.js) normalizes
// an atlas.*-keyed module (a pre-cutover install) before comparing here.
// Imported by OfflineProvider (for sync) and by the desktop UI (for navigation guard).
export const OFFLINE_MODULES = [
  'runly.contacts',
  'runly.hr',
  'custom.fleet',
  'runly.calendar',
  'runly.catalog',
  'runly.ledger',
]
