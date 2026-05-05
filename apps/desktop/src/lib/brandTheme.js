function hexToRgb(hex) {
  const clean = String(hex || "")
    .trim()
    .replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
  }
  h = Math.round((h * 60 + 360) % 360);

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return {
    h,
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function adjustLightness(hsl, amount) {
  return {
    ...hsl,
    l: clamp(hsl.l + amount, 0, 100),
  };
}

function hslToCss(hsl) {
  return `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`;
}

function pickForeground({ r, g, b }) {
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? "#111827" : "#ffffff";
}

export function applyBrandTheme(primaryColor) {
  const root = document.documentElement;
  const rgb = hexToRgb(primaryColor || "#0A7BFF") || hexToRgb("#0A7BFF");
  const hsl = rgbToHsl(rgb);
  const hover = adjustLightness(hsl, -8);

  root.style.setProperty(
    "--brand-primary",
    `#${((rgb.r << 16) | (rgb.g << 8) | rgb.b).toString(16).padStart(6, "0")}`,
  );
  root.style.setProperty("--brand-primary-hover", hslToCss(hover));
  root.style.setProperty("--brand-primary-foreground", pickForeground(rgb));
  root.style.setProperty("--ring", `${hsl.h} ${hsl.s}% ${hsl.l}%`);
  root.style.setProperty(
    "--glass-tint",
    `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.10)`,
  );
  root.style.setProperty(
    "--glass-glow",
    `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.30)`,
  );
  root.style.setProperty(
    "--brand-soft",
    `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`,
  );
}
