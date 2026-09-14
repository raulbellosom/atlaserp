#!/usr/bin/env node
import path from 'node:path'
import { exportRme3Devkit } from './lib/rme3-devkit.js'

function parseOutDir(argv) {
  const outFlagIndex = argv.findIndex((entry) => entry === '--out')
  if (outFlagIndex === -1 || !argv[outFlagIndex + 1]) {
    throw new Error('Usage: node scripts/export-rme3-devkit.mjs --out <targetDir>')
  }
  return path.resolve(process.cwd(), argv[outFlagIndex + 1])
}

async function main() {
  const outDir = parseOutDir(process.argv.slice(2))
  const result = await exportRme3Devkit({ outDir })
  console.log(`RME3 devkit exported to ${result.outDir}`)
  for (const file of result.files) {
    console.log(`  [OK] ${file}`)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
