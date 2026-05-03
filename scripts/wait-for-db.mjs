#!/usr/bin/env node
// Waits for PostgreSQL to accept connections before setup continues.
// Reads DATABASE_URL from .env automatically.
import { readFileSync } from 'fs'
import { createConnection } from 'net'

function loadEnv() {
  try {
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
      const [k, ...v] = line.split('=')
      if (k && v.length && !process.env[k.trim()]) {
        process.env[k.trim()] = v.join('=').trim()
      }
    }
  } catch { /* .env not required */ }
}

function parseHost(url) {
  try {
    const u = new URL(url)
    return { host: u.hostname, port: Number(u.port) || 5432 }
  } catch {
    return { host: 'localhost', port: 5432 }
  }
}

loadEnv()
const { host, port } = parseHost(process.env.DATABASE_URL ?? '')
const MAX_TRIES = 30
const INTERVAL_MS = 1000

console.log(`Waiting for PostgreSQL at ${host}:${port}...`)

let tries = 0
function attempt() {
  tries++
  const sock = createConnection({ host, port })
  sock.once('connect', () => {
    sock.destroy()
    console.log(`PostgreSQL is ready (attempt ${tries})`)
    process.exit(0)
  })
  sock.once('error', () => {
    sock.destroy()
    if (tries >= MAX_TRIES) {
      console.error(`PostgreSQL did not become ready after ${MAX_TRIES}s`)
      process.exit(1)
    }
    setTimeout(attempt, INTERVAL_MS)
  })
}

attempt()
