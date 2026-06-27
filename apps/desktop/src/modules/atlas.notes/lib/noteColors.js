// Background color palette for notes.
// `value` is what gets persisted in the DB (light pastel applied to the editor).
// `swatch` is a more saturated version used ONLY in the color picker so colors are recognizable.
// `dark` is the deep equivalent applied in dark mode.
export const NOTE_BACKGROUND_COLORS = [
  { label: 'Predeterminado', value: null,      swatch: null,      dark: null      },
  { label: 'Crema',          value: '#fefce8', swatch: '#fef08a', dark: '#1e1a00' },
  { label: 'Menta',          value: '#f0fdf4', swatch: '#bbf7d0', dark: '#001a08' },
  { label: 'Cielo',          value: '#eff6ff', swatch: '#bfdbfe', dark: '#00101f' },
  { label: 'Lavanda',        value: '#faf5ff', swatch: '#e9d5ff', dark: '#0d0818' },
  { label: 'Rosa',           value: '#fff1f2', swatch: '#fecdd3', dark: '#1f0008' },
  { label: 'Melocoton',      value: '#fff7ed', swatch: '#fed7aa', dark: '#1a0d00' },
  { label: 'Hielo',          value: '#f0f9ff', swatch: '#bae6fd', dark: '#001525' },
  { label: 'Lima',           value: '#f7fee7', swatch: '#d9f99d', dark: '#0d1a00' },
  { label: 'Coral',          value: '#fef2f2', swatch: '#fca5a5', dark: '#1a0000' },
  { label: 'Violeta',        value: '#f5f3ff', swatch: '#ddd6fe', dark: '#0d0c20' },
  { label: 'Arena',          value: '#fdf4ff', swatch: '#f5d0fe', dark: '#180020' },
]

// Map: stored DB value (light hex) → dark-mode equivalent
export const DARK_BG_MAP = Object.fromEntries(
  NOTE_BACKGROUND_COLORS
    .filter(c => c.value && c.dark)
    .map(c => [c.value, c.dark])
)
