#!/usr/bin/env node
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

execSync('node scripts/build-brand-assets.mjs', {
  cwd: root,
  stdio: 'inherit',
})
