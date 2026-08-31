// Default values for the "app.view" user preference (launcher / home screen).
// Kept in its own module so it can be unit-tested without pulling in the
// react-query / auth wiring of useAppViewPrefs.js.
export const DEFAULTS = {
  sortMode: "az",
  viewMode: "cards",
  favoritesFirst: true,
  favorites: [],
};
