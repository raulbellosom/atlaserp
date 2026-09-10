// apps/desktop/src/modules/atlas.chat/calls/lib/callLayout.js
//
// Pure helpers for the call-room "pin to spotlight" layout. A pin is local to
// the viewer (not synced).
export function resolvePinnedEntry(participants, pinnedIdentity) {
  if (!pinnedIdentity) return null;
  return (participants ?? []).find((e) => e.participant?.identity === pinnedIdentity) ?? null;
}

// Given the participant entries and the local pin, return the spotlight layout:
// the main tile, the strip (everyone else), and whether the screen share needs
// its own strip tile (present and not already the main).
export function spotlightStrip({ participants = [], pinnedIdentity = null, screenShareEntry = null }) {
  const mainEntry = resolvePinnedEntry(participants, pinnedIdentity);
  if (!mainEntry) return { mainEntry: null, others: [], showScreenTile: false };
  const mainId = mainEntry.participant?.identity;
  const others = participants.filter((e) => e.participant?.identity !== mainId);
  const mainIsSharing = Boolean(screenShareEntry && screenShareEntry.participant?.identity === mainId);
  return { mainEntry, others, showScreenTile: Boolean(screenShareEntry) && !mainIsSharing };
}
