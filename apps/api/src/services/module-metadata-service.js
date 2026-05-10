function toObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object`)
  }
  return value
}

function toRequiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value.trim()
}

function toNamespacedModelName(moduleKey, modelKeyOrName) {
  const key = toRequiredString(modelKeyOrName, 'model key')
  if (key.includes('.')) return key
  return `${moduleKey}.${key}`
}

function deriveRelationPayload(field) {
  if (field.relation && typeof field.relation === 'object' && !Array.isArray(field.relation)) {
    return field.relation
  }
  if (field.relatedModel) {
    return { relatedModel: field.relatedModel }
  }
  return null
}

export function createModuleMetadataService({ prisma }) {
  if (!prisma) {
    throw new Error('createModuleMetadataService: prisma is required')
  }

  async function upsertField({ modelId, field, order, tx = prisma }) {
    const safeModelId = toRequiredString(modelId, 'modelId')
    const safeField = toObject(field, 'field')
    const name = toRequiredString(safeField.name, 'field.name')
    const label = typeof safeField.label === 'string' && safeField.label.trim() ? safeField.label.trim() : name
    const type = toRequiredString(safeField.type, 'field.type')
    const safeOrder = Number.isInteger(order) && order >= 0 ? order : 0

    return tx.atlasField.upsert({
      where: {
        modelId_name: {
          modelId: safeModelId,
          name,
        },
      },
      update: {
        label,
        type,
        required: Boolean(safeField.required),
        readonly: Boolean(safeField.readonly),
        defaultValue:
          safeField.defaultValue !== undefined
            ? safeField.defaultValue
            : safeField.default !== undefined
              ? safeField.default
              : null,
        options: safeField.options ?? null,
        relation: deriveRelationPayload(safeField),
        validation: safeField.validation ?? null,
        order: safeOrder,
      },
      create: {
        modelId: safeModelId,
        name,
        label,
        type,
        required: Boolean(safeField.required),
        readonly: Boolean(safeField.readonly),
        defaultValue:
          safeField.defaultValue !== undefined
            ? safeField.defaultValue
            : safeField.default !== undefined
              ? safeField.default
              : null,
        options: safeField.options ?? null,
        relation: deriveRelationPayload(safeField),
        validation: safeField.validation ?? null,
        order: safeOrder,
      },
    })
  }

  async function upsertModel({ moduleKey, model, tx = prisma }) {
    const safeModuleKey = toRequiredString(moduleKey, 'moduleKey')
    const safeModel = toObject(model, 'model')
    const modelKey = toRequiredString(safeModel.key, 'model.key')
    const tableName = toRequiredString(safeModel.tableName, 'model.tableName')
    const name = toNamespacedModelName(safeModuleKey, modelKey)
    const label = typeof safeModel.label === 'string' && safeModel.label.trim() ? safeModel.label.trim() : modelKey
    const pluralLabel =
      typeof safeModel.pluralLabel === 'string' && safeModel.pluralLabel.trim()
        ? safeModel.pluralLabel.trim()
        : null

    const existingByTable = await tx.atlasModel.findUnique({
      where: { tableName },
      select: { id: true, name: true },
    })

    if (existingByTable && existingByTable.name !== name) {
      throw new Error(
        `AtlasModel tableName collision: "${tableName}" already belongs to "${existingByTable.name}", cannot remap to "${name}"`
      )
    }

    const upserted = await tx.atlasModel.upsert({
      where: { name },
      update: {
        moduleKey: safeModuleKey,
        tableName,
        label,
        pluralLabel,
        companyScoped: safeModel.companyScoped !== undefined ? Boolean(safeModel.companyScoped) : true,
        schema: safeModel,
        enabled: safeModel.enabled !== undefined ? Boolean(safeModel.enabled) : true,
      },
      create: {
        moduleKey: safeModuleKey,
        name,
        tableName,
        label,
        pluralLabel,
        companyScoped: safeModel.companyScoped !== undefined ? Boolean(safeModel.companyScoped) : true,
        schema: safeModel,
        enabled: safeModel.enabled !== undefined ? Boolean(safeModel.enabled) : true,
      },
      include: {
        fields: true,
        views: true,
      },
    })

    if (Array.isArray(safeModel.fields)) {
      for (let i = 0; i < safeModel.fields.length; i += 1) {
        await upsertField({
          modelId: upserted.id,
          field: safeModel.fields[i],
          order: i,
          tx,
        })
      }
    }

    return tx.atlasModel.findUnique({
      where: { id: upserted.id },
      include: { fields: true, views: true },
    })
  }

  async function upsertView({ moduleKey, view, tx = prisma }) {
    const safeModuleKey = toRequiredString(moduleKey, 'moduleKey')
    const safeView = toObject(view, 'view')
    const key = toRequiredString(safeView.key, 'view.key')
    const type = toRequiredString(safeView.type ?? safeView.kind, 'view.type')
    const title = typeof safeView.title === 'string' && safeView.title.trim() ? safeView.title.trim() : null

    const rawModelName =
      typeof safeView.modelName === 'string' && safeView.modelName.trim()
        ? safeView.modelName
        : typeof safeView.schema?.entity === 'string' && safeView.schema.entity.trim()
          ? safeView.schema.entity
          : null

    const modelName = rawModelName ? toNamespacedModelName(safeModuleKey, rawModelName) : null

    return tx.atlasView.upsert({
      where: { key },
      update: {
        moduleKey: safeModuleKey,
        modelName,
        type,
        title,
        schema: safeView.schema ?? {},
        enabled: safeView.enabled !== undefined ? Boolean(safeView.enabled) : true,
      },
      create: {
        moduleKey: safeModuleKey,
        key,
        modelName,
        type,
        title,
        schema: safeView.schema ?? {},
        enabled: safeView.enabled !== undefined ? Boolean(safeView.enabled) : true,
      },
    })
  }

  async function syncModuleMetadata({ manifest, models = [], views = [] }) {
    const safeManifest = toObject(manifest, 'manifest')
    const moduleKey = toRequiredString(safeManifest.key, 'manifest.key')
    const safeModels = Array.isArray(models) ? models : []
    const safeViews = Array.isArray(views) ? views : []

    return prisma.$transaction(async (tx) => {
      const persistedModels = []
      for (const model of safeModels) {
        const persisted = await upsertModel({ moduleKey, model, tx })
        persistedModels.push(persisted)
      }

      const persistedViews = []
      for (const view of safeViews) {
        const persisted = await upsertView({ moduleKey, view, tx })
        persistedViews.push(persisted)
      }

      return {
        moduleKey,
        models: persistedModels,
        views: persistedViews,
      }
    })
  }

  async function listModels({ moduleKey }) {
    const safeModuleKey = toRequiredString(moduleKey, 'moduleKey')
    return prisma.atlasModel.findMany({
      where: { moduleKey: safeModuleKey },
      orderBy: { name: 'asc' },
      include: {
        fields: { orderBy: { order: 'asc' } },
        views: { orderBy: { key: 'asc' } },
      },
    })
  }

  async function getModelByName(name) {
    const safeName = toRequiredString(name, 'name')
    return prisma.atlasModel.findUnique({
      where: { name: safeName },
      include: {
        fields: { orderBy: { order: 'asc' } },
        views: { orderBy: { key: 'asc' } },
      },
    })
  }

  async function listViews({ moduleKey }) {
    const safeModuleKey = toRequiredString(moduleKey, 'moduleKey')
    return prisma.atlasView.findMany({
      where: { moduleKey: safeModuleKey },
      orderBy: { key: 'asc' },
    })
  }

  async function getViewByKey(key) {
    const safeKey = toRequiredString(key, 'key')
    return prisma.atlasView.findUnique({
      where: { key: safeKey },
    })
  }

  return {
    syncModuleMetadata,
    upsertModel,
    upsertField,
    upsertView,
    listModels,
    getModelByName,
    listViews,
    getViewByKey,
  }
}
