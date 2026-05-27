// modules/custom/custom.financia/components/index.js
// Registers custom.financia React components.
// Called at boot by apps/desktop/src/lib/moduleComponentRegistry.js.

export async function register(_registry) {
  if (typeof window === 'undefined') return
  // No table cell components needed for v0.1 — custom screens are registered via SCREEN_MAP.
  // Add cell components here if needed in future versions.
}
