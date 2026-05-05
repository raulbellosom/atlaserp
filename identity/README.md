# Identity Assets

This directory is the source of truth for Atlas ERP brand resources.

## Canonical sources

- `atlas-erp_app_icon.png`: master icon source used to generate Tauri and web icons.
- `atlas-erp_primary_logo.png`: main square logo variant.
- `atlas-erp_horizontal_logo.png`: horizontal logo for metadata/share cards.
- `atlas-erp_vertical_logo.png`: vertical logo variant.
- `atlas-erp_isotype_only.png`: symbol-only variant.
- `atlas-erp_monochrome_light.png`: monochrome for dark backgrounds.
- `atlas-erp_monochrome_dark.png`: monochrome for light backgrounds.

## Official color palette

```css
:root {
  --atlas-navy: #0A1D44;
  --atlas-navy-2: #102A5E;
  --atlas-navy-dark: #06152F;
  --atlas-blue: #0A7BFF;
  --atlas-cyan: #21C7FF;
  --atlas-gray-light: #E6EAF0;
  --atlas-gray-text: #5F6B7A;
}
```

Use this as the canonical Atlas ERP palette across web, desktop, and brand collateral.

## Build flow

Run:

```bash
pnpm brand:build
```

This command will:

1. Regenerate desktop icon bundles in `apps/desktop/src-tauri/icons`.
2. Regenerate transparent brand PNG variants in `apps/desktop/public/brand` from the master files in `identity/`.
3. Refresh metadata-related files (`favicon`, `manifest`, `og-image`).

## SVG guidance

If SVG masters are available, store them alongside the PNG assets using the same base names.
Keep PNG files as production fallbacks until the full SVG export pipeline is added.
