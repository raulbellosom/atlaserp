import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

import { generateManifest } from './templates/manifest.js'
import { generateModel } from './templates/model.js'
import { generateTableView, generateFormView, generateDetailView, generatePageView } from './templates/views.js'
import { generateServiceHelpers } from './templates/service-helpers.js'
import { generateService } from './templates/service.js'
import { generateRoutes } from './templates/routes.js'
import { generateEntityValidators } from './templates/validators.js'
import { generateApiIndex } from './templates/api-index.js'
import { generateValidatorsIndex } from './templates/validators-index.js'
import { moduleSlug } from './templates/helpers.js'

export function writeModule(config, repoRoot) {
  const slug = moduleSlug(config.key)
  const outDir = resolve(repoRoot, 'modules', 'custom', config.key)
  const written = []

  function write(relPath, content) {
    const abs = resolve(outDir, relPath)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content, 'utf8')
    written.push(relPath)
  }

  // module.manifest.js
  write('module.manifest.js', generateManifest(config))

  // service-helpers.js (shared across all entity services)
  write('api/service-helpers.js', generateServiceHelpers(config))

  // api/index.js
  write('api/index.js', generateApiIndex(config))

  // validators/index.js
  write('validators/index.js', generateValidatorsIndex(config))

  for (const entity of config.entities) {
    // models
    write(`models/${entity.name}.model.js`, generateModel(config, entity))

    // views
    write(`views/${entity.name}.table.js`, generateTableView(config, entity))
    write(`views/${entity.name}.form.js`, generateFormView(config, entity))
    write(`views/${entity.name}.detail.js`, generateDetailView(config, entity))
    write(`views/${entity.name}.page.js`, generatePageView(config, entity))

    // api routes + service
    write(`api/${entity.name}-routes.js`, generateRoutes(config, entity))
    write(`api/${entity.name}-service.js`, generateService(config, entity))

    // validators
    write(`validators/${entity.name}.validators.js`, generateEntityValidators(entity))
  }

  return { outDir, written }
}

export function applyDefaults(config) {
  const result = {
    ...config,
    version: config.version || '0.1.0',
    description: config.description || '',
    icon: config.icon,
    color: config.color,
    pwa: config.pwa ? { ...config.pwa } : null,
    entities: (config.entities || []).map((e) => ({
      ...e,
      softDelete: e.softDelete !== false,
      companyScoped: e.companyScoped !== false,
      labelPlural: e.labelPlural || e.label + 's',
      fields: (e.fields || []).map((f) => ({ ...f })),
    })),
  }
  return result
}
