// Single source of truth for turning a module / navigation `icon` name (as stored
// in a module manifest) back into a renderable component.
//
// Historically the command palette, the module sidebar and the module cards each
// carried their own hand-maintained `ICON_MAP`, so a manifest icon that one of
// them had never heard of rendered a generic box. This module resolves against
// the full lucide export set plus a few legacy aliases and the custom
// `FleetVehicle` glyph, so any valid lucide name just works.

import * as LucideIcons from "lucide-react";

// Custom (non-lucide) glyphs addressable by manifest name.
export function FleetVehicleIcon({ className, size, width, height, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={width ?? size ?? 24}
      height={height ?? size ?? 24}
      {...props}
    >
      <rect x="1" y="8" width="12" height="8" rx="1" />
      <line x1="7" y1="8" x2="7" y2="16" />
      <path d="M13 10h1.5l3 4v2h-4.5V10z" />
      <path
        d="M14.5 10.5L17 14h-2.5v-3.5z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="none"
      />
      <line x1="3" y1="16" x2="17" y2="16" />
      <circle cx="5" cy="18.5" r="2" />
      <circle cx="15" cy="18.5" r="2" />
      <circle cx="21" cy="3.5" r="2" />
      <line x1="21" y1="5.5" x2="21" y2="7.5" />
      <circle cx="21" cy="3.5" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

const CUSTOM_ICONS = {
  FleetVehicle: FleetVehicleIcon,
};

// Legacy / lowercase aliases that appear in older manifests. Keyed by the
// normalized form (letters + digits only, lowercased). Values are canonical
// names resolvable via CUSTOM_ICONS or the lucide export set.
const MODULE_ICON_ALIASES = {
  truck: "Truck",
  fleetvehicle: "FleetVehicle",
  wrench: "Wrench",
  clipboardlist: "ClipboardList",
  usercheck: "UserCheck",
  bookopen: "BookOpen",
  library: "Library",
  layers: "Layers",
  menu: "Menu",
  globe: "Globe",
  forminput: "ClipboardList",
};

const FALLBACK_ICON = LucideIcons.Box;

function normalizeName(raw) {
  return raw.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function toPascalCase(raw) {
  return raw
    .split(/[^a-zA-Z0-9]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

// lucide-react's ESM namespace also carries non-icon keys (`createLucideIcon`,
// `icons`, `default`, ...). Every real icon export is PascalCase, so only accept
// names that start with an uppercase letter.
function fromLucide(key) {
  if (!key || !/^[A-Z]/.test(key)) return null;
  return LucideIcons[key] ?? null;
}

function lookup(name) {
  if (!name || typeof name !== "string") return null;
  const raw = name.trim();
  if (!raw) return null;

  if (CUSTOM_ICONS[raw]) return CUSTOM_ICONS[raw];

  const direct = fromLucide(raw);
  if (direct) return direct;

  const aliased = MODULE_ICON_ALIASES[normalizeName(raw)];
  if (aliased) return CUSTOM_ICONS[aliased] ?? fromLucide(aliased);

  return fromLucide(toPascalCase(raw));
}

// Returns the component for `name`, or `null` when it cannot be resolved.
// Use this when an unresolved icon should fall through to some other visual
// (e.g. gradient initials on a module card).
export function getModuleIconComponent(name) {
  return lookup(name);
}

// Always returns a component. `fallback` defaults to lucide's `Box`.
export function resolveModuleIcon(name, { fallback = FALLBACK_ICON } = {}) {
  return lookup(name) ?? fallback;
}

// Thin JSX wrapper around `resolveModuleIcon`.
export function ModuleNavIcon({ name, size = 15, fallback, ...props }) {
  const Icon = resolveModuleIcon(name, fallback ? { fallback } : undefined);
  return <Icon size={size} {...props} />;
}
