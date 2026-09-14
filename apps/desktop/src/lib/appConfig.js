// Current release's marketing/edition name — distinct from the semver in
// package.json. Previously "Meridian"; documented in CLAUDE.md so it's
// reused (not re-hardcoded) wherever a version/edition label shows up in the
// UI — the setup wizard hero badge and footer, the login footer, etc.
export const RUNLY_EDITION_NAME = 'Jaguar'

export const ATLAS_GITHUB_REPO = 'raulbellosom/runly-erp'
export const ATLAS_DESKTOP_RELEASE_ASSET_NAME = 'Runly-ERP-Setup.exe'
export const ATLAS_DESKTOP_DOWNLOAD_URL = `https://github.com/${ATLAS_GITHUB_REPO}/releases/latest/download/${ATLAS_DESKTOP_RELEASE_ASSET_NAME}`

export const ATLAS_SERVER_STORE_FILE = 'store.json'
export const ATLAS_SERVER_URL_KEY = 'serverUrl'
export const ATLAS_PUBLIC_DESKTOP_CONFIG_PATH = '/public/website/desktop/config'
