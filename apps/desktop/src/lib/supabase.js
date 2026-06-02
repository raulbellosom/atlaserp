import { createClient } from '@supabase/supabase-js'

// Runtime config is injected by web-entrypoint.sh into /runtime-config.js
// (loaded via <script> in index.html before this module runs), so these
// values are always available at module load time in the container.
// Falls back to Vite build-time env for local dev.
const rc = (typeof window !== 'undefined' ? window.__ATLAS_RUNTIME_CONFIG__ : null) ?? {}

const url = rc.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL
const anonKey = rc.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase config. In dev: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env. In Docker: set SUPABASE_URL and SUPABASE_ANON_KEY env vars on the container.'
  )
}

export const supabase = createClient(url, anonKey)
