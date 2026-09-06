// Pure helpers for the in-call chat panel's mobile view state. No React, no
// DOM — see CallRoom.jsx for the stateful wiring.

export const CALL_VIEWS = ["video", "screen", "chat"];

// Given the user's chosen mobile view and whether a screen share is live,
// return the view that should actually render. "screen" collapses back to
// "video" the moment the share ends; anything unrecognised falls back to
// "video".
export function nextCallView(view, { hasScreenShare = false } = {}) {
  if (!CALL_VIEWS.includes(view)) return "video";
  if (view === "screen" && !hasScreenShare) return "video";
  return view;
}

// The "Pantalla" segment of the switcher only exists while a share is live.
export function shouldShowScreenSegment(hasScreenShare) {
  return Boolean(hasScreenShare);
}
