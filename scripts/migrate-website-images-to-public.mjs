/**
 * One-time migration: copy images with moduleKey 'atlas.files' from atlas-files
 * (private) to atlas-website (public), then update fileAsset records in the DB.
 *
 * Run: node scripts/migrate-website-images-to-public.mjs
 * Add --dry-run to preview without making changes.
 */

import 'dotenv/config'
import pkg from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { createClient } from '@supabase/supabase-js'

const { PrismaClient } = pkg
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const DRY_RUN = process.argv.includes('--dry-run')
const SOURCE_BUCKET = 'atlas-files'
const TARGET_BUCKET = 'atlas-website'

async function main() {
  const files = await prisma.fileAsset.findMany({
    where: {
      bucket: SOURCE_BUCKET,
      mimeType: { startsWith: 'image/' },
      moduleKey: 'atlas.files',
      enabled: true,
    },
    select: { id: true, objectKey: true, mimeType: true, originalName: true, sizeBytes: true },
  })

  if (files.length === 0) {
    console.log('No images to migrate.')
    return
  }

  console.log(`Found ${files.length} image(s) to migrate${DRY_RUN ? ' [DRY RUN]' : ''}:\n`)
  for (const f of files) {
    console.log(`  ${f.originalName} (${(f.sizeBytes / 1024).toFixed(1)} KB)`)
    console.log(`    ${SOURCE_BUCKET}/${f.objectKey}`)
    console.log(`    → ${TARGET_BUCKET}/${f.objectKey}`)
  }

  if (DRY_RUN) {
    console.log('\nDry run complete. Run without --dry-run to apply.')
    return
  }

  console.log('\nMigrating...')
  let ok = 0
  let failed = 0

  for (const file of files) {
    try {
      // Download from source bucket
      const { data: blob, error: dlError } = await supabase.storage
        .from(SOURCE_BUCKET)
        .download(file.objectKey)
      if (dlError || !blob) throw new Error(dlError?.message ?? 'download failed')

      const buffer = Buffer.from(await blob.arrayBuffer())

      // Upload to target bucket (upsert in case of partial previous run)
      const { error: upError } = await supabase.storage
        .from(TARGET_BUCKET)
        .upload(file.objectKey, buffer, { contentType: file.mimeType, upsert: true })
      if (upError) throw new Error(upError.message)

      // Update DB record
      await prisma.fileAsset.update({
        where: { id: file.id },
        data: {
          bucket: TARGET_BUCKET,
          visibility: 'PUBLIC',
          moduleKey: 'atlas.website',
        },
      })

      const { data: urlData } = supabase.storage.from(TARGET_BUCKET).getPublicUrl(file.objectKey)
      console.log(`  ✓ ${file.originalName}`)
      console.log(`    ${urlData.publicUrl}`)
      ok++
    } catch (err) {
      console.error(`  ✗ ${file.originalName}: ${err.message}`)
      failed++
    }
  }

  console.log(`\nDone: ${ok} migrated, ${failed} failed.`)
  if (ok > 0) {
    console.log('\nNote: original files in atlas-files were NOT deleted.')
    console.log('You can remove them manually from Supabase Studio once verified.')
  }
}

main().finally(() => prisma.$disconnect())
