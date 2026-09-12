# 10 - Brand Assets Strategy

This document defines how Atlas ERP branding resources are stored and generated for desktop, web metadata, and sharing cards.

## Source of truth

All master brand files live in `identity/`.

## Official color palette

Atlas ERP official palette:

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

Usage guideline:

- `--atlas-cyan`: primary interactive accent (sidebar active, CTAs, highlights).
- `--atlas-blue`: secondary brand accent and hover state.
- `--atlas-navy` / `--atlas-navy-2` / `--atlas-navy-dark`: dark surfaces and gradients.
- `--atlas-gray-light` / `--atlas-gray-text`: neutrals for background and text balance.

Required baseline files:

- `atlas-erp_app_icon.png`
- `atlas-erp_primary_logo.png`
- `atlas-erp_horizontal_logo.png`
- `atlas-erp_vertical_logo.png`
- `atlas-erp_isotype_only.png`
- `atlas-erp_monochrome_light.png`
- `atlas-erp_monochrome_dark.png`

## Build command

Run:

```bash
pnpm brand:build
```

What it does:

1. Runs `pnpm tauri icon` using `identity/atlas-erp_app_icon.png`.
2. Regenerates platform icons in `apps/desktop/src-tauri/icons`.
3. Rebuilds transparent brand PNGs in `apps/desktop/public/brand` from `identity/`.
4. Copies normalized static files to `apps/desktop/public` for browser metadata.
5. Updates `apps/desktop/public/site.webmanifest`.

## Generated outputs

### Native Android host

`pnpm brand:native` uses the installed Tauri icon CLI and the vector master `identity/atlas-erp_isotype.svg`. It separates the master's background, preserves the logo paths/colors, and uses the official `#E6EAF0` surface. Adaptive foregrounds include padding for circular masks; Android 13 themed icons use a monochrome silhouette.

The command updates the initialized Android project's launcher resources and the bundled recovery logo. Intermediate platform exports go to ignored `.tmp/native-brand/`. Native builds run this command automatically, and `brand:build` runs it last so its legacy raster generation cannot overwrite mobile branding. Keep the Android resources used by the APK in version control; do not add the temporary exports.

Android startup uses `androidx.core:core-splashscreen:1.2.0` with the same mark/background and a normal transition into Tauri. It does not add a second Activity or artificially delay loading. The recovery shell remains responsible for network errors after startup. iOS icon exports can be generated, but iOS launch-screen integration still requires the pending Xcode project.

References: [Tauri icon generator](https://v2.tauri.app/develop/icons/) and [Android SplashScreen migration](https://developer.android.com/develop/ui/views/launch/splash-screen/migrate).

`apps/desktop/public`:

- `favicon.ico`
- `favicon-32x32.png`
- `apple-touch-icon.png`
- `icon-192.png`
- `icon-512.png`
- `og-image.png`
- `site.webmanifest`

`apps/desktop/public/brand`:

- `atlas-logo-primary.png`
- `atlas-logo-horizontal.png`
- `atlas-logo-vertical.png`
- `atlas-logo-isotype.png`
- `atlas-logo-monochrome-light.png`
- `atlas-logo-monochrome-dark.png`

## Metadata wiring

`apps/desktop/index.html` includes:

- `description`
- `theme-color`
- favicon and webmanifest links
- Open Graph tags (`og:title`, `og:description`, `og:image`)
- Twitter share tags (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`)

## Next optional upgrades

- Add SVG masters for all canonical variants.
- Add a dedicated 1200x630 social card image export for `og-image.png`.
- Add `application/ld+json` Organization metadata once production domain is finalized.
