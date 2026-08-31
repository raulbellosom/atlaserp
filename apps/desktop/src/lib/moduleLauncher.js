// Pure helpers shared by useModuleLauncher, ModuleCard and AppContextMenu.
// No React / DOM dependencies so they can be unit-tested with `node --test`.

const MENU_MARGIN = 8;

export function isModuleOfflineBlocked(isOnline, module, offlineModules) {
  return !isOnline && !offlineModules.includes(module.key);
}

// Accepts a mouse/pointer event ({clientX,clientY}) or a plain {x,y} object.
// Calls preventDefault() when given an event. Returns {x,y} or null.
export function resolveMenuAnchor(input) {
  if (!input) return null;
  if (typeof input.preventDefault === 'function') input.preventDefault();
  const x = Number.isFinite(input.clientX) ? input.clientX : input.x;
  const y = Number.isFinite(input.clientY) ? input.clientY : input.y;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

// Given a desired top-left anchor, the menu size and the viewport size,
// return {left, top} that keeps the menu fully visible with a small margin.
export function clampMenuToViewport(anchor, size, viewport, margin = MENU_MARGIN) {
  const maxLeft = Math.max(margin, viewport.width - size.width - margin);
  const maxTop = Math.max(margin, viewport.height - size.height - margin);
  return {
    left: Math.min(Math.max(margin, anchor.x), maxLeft),
    top: Math.min(Math.max(margin, anchor.y), maxTop),
  };
}

export function favoriteToggleLabel(isFavorite) {
  return isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos';
}

export function shouldOpenInNewTab(e) {
  return Boolean(e && (e.ctrlKey || e.metaKey || e.button === 1));
}

export function isCoarsePointer() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}
