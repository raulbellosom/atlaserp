export class FieldServiceError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'FieldServiceError'
    this.status = status
  }
}

const VALID_KINDS = ['TEXT', 'NUMBER', 'DATE', 'SELECT']

export function createFieldsService({ prisma }) {
  // ── Project fields ──────────────────────────────────────────────────────────

  async function listFields(projectId) {
    return prisma.projectField.findMany({
      where: { projectId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    })
  }

  async function createField(projectId, { name, kind, options, position }) {
    if (!name?.trim()) throw new FieldServiceError('El nombre del campo es requerido.', 400)
    if (!VALID_KINDS.includes(kind)) {
      throw new FieldServiceError(`Tipo de campo invalido. Valores permitidos: ${VALID_KINDS.join(', ')}.`, 400)
    }
    if (kind === 'SELECT' && (!Array.isArray(options) || options.length === 0)) {
      throw new FieldServiceError('Los campos SELECT requieren al menos una opcion.', 400)
    }
    const existing = await prisma.projectField.count({ where: { projectId } })
    return prisma.projectField.create({
      data: {
        projectId,
        name: name.trim(),
        kind,
        options: kind === 'SELECT' ? options : null,
        position: position ?? existing,
      },
    })
  }

  async function updateField(fieldId, projectId, { name, options, position }) {
    const field = await prisma.projectField.findFirst({ where: { id: fieldId, projectId } })
    if (!field) throw new FieldServiceError('Campo no encontrado.', 404)
    return prisma.projectField.update({
      where: { id: fieldId },
      data: {
        ...(name?.trim() ? { name: name.trim() } : {}),
        ...(options !== undefined ? { options } : {}),
        ...(position !== undefined ? { position } : {}),
      },
    })
  }

  async function deleteField(fieldId, projectId) {
    const field = await prisma.projectField.findFirst({ where: { id: fieldId, projectId } })
    if (!field) throw new FieldServiceError('Campo no encontrado.', 404)
    await prisma.taskFieldValue.deleteMany({ where: { fieldId } })
    await prisma.projectField.delete({ where: { id: fieldId } })
    return field
  }

  // ── Task field values ───────────────────────────────────────────────────────

  async function getFieldValues(taskId, projectId) {
    const fields = await prisma.projectField.findMany({
      where: { projectId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    })
    const values = await prisma.taskFieldValue.findMany({ where: { taskId } })
    const valueMap = new Map(values.map((v) => [v.fieldId, v.value]))
    return fields.map((f) => ({ field: f, value: valueMap.get(f.id) ?? null }))
  }

  async function upsertFieldValues(taskId, projectId, entries) {
    // entries: [{ fieldId, value }]
    const fieldIds = entries.map((e) => e.fieldId)
    const owned = await prisma.projectField.findMany({
      where: { id: { in: fieldIds }, projectId },
      select: { id: true },
    })
    const ownedSet = new Set(owned.map((f) => f.id))
    const validEntries = entries.filter((e) => ownedSet.has(e.fieldId))

    await Promise.all(
      validEntries.map(({ fieldId, value }) =>
        value === null || value === ''
          ? prisma.taskFieldValue.deleteMany({ where: { taskId, fieldId } })
          : prisma.taskFieldValue.upsert({
              where: { taskId_fieldId: { taskId, fieldId } },
              create: { taskId, fieldId, value: String(value) },
              update: { value: String(value) },
            })
      )
    )
    return getFieldValues(taskId, projectId)
  }

  return { listFields, createField, updateField, deleteField, getFieldValues, upsertFieldValues }
}
