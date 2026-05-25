import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const req = createRequire(import.meta.url)
const dotenv = req('dotenv')
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') })

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
const apiUrl = process.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

async function getToken() {
  const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 20 })
  for (const user of data.users ?? []) {
    const { data: ld } = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email: user.email })
    if (!ld?.properties?.hashed_token) continue
    const { data: sd } = await supabaseAdmin.auth.verifyOtp({ token_hash: ld.properties.hashed_token, type: 'magiclink' })
    if (sd?.session?.access_token) return sd.session.access_token
  }
  throw new Error('No user found')
}

const token = await getToken()

// Check module status
const modRes = await fetch(`${apiUrl}/modules`, { headers: { Authorization: `Bearer ${token}` } })
const modules = await modRes.json()
const fleet = (modules?.data ?? []).find(m => m.key === 'custom.fleet')
if (fleet) {
  console.log(`Module status: ${fleet.status}, enabled: ${fleet.enabled}, version: ${fleet.version}`)
} else {
  console.log('custom.fleet not found in module list')
}

// Check blueprints
const bpRes = await fetch(`${apiUrl}/blueprints`, { headers: { Authorization: `Bearer ${token}` } })
const bpBody = await bpRes.json()
const fleetBps = (bpBody?.data ?? []).filter(bp => bp.moduleKey === 'custom.fleet')
console.log(`Blueprints for custom.fleet: ${fleetBps.length} (${fleetBps.map(b => b.name).join(', ')})`)

// Quick test of fleet endpoint (no companyId needed to check route is up)
const routeRes = await fetch(`${apiUrl}/fleet/vehicles`, { headers: { Authorization: `Bearer ${token}` } })
console.log(`GET /fleet/vehicles (no companyId): status ${routeRes.status} — expected 400`)
