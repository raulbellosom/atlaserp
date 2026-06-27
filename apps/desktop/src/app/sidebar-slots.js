import { NotesSidebarSlot } from '../modules/atlas.notes/components/NotesSidebarSlot.jsx'

// Maps module key → sidebar slot component.
// The slot is rendered below the nav items in ModuleSidebar (hidden when collapsed).
// Each component must work standalone: own data fetching, own navigation.
export const MODULE_SIDEBAR_SLOTS = {
  'atlas.notes': NotesSidebarSlot,
}
