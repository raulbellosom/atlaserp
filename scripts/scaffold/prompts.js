import { createInterface } from 'node:readline'

const VALID_FIELD_TYPES = [
  'text', 'textarea', 'number', 'decimal', 'boolean',
  'select', 'multiselect', 'date', 'datetime', 'email',
  'phone', 'relation', 'file', 'json', 'markdown', 'color', 'richtext',
]

export async function runInteractivePrompts() {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const ask = (question) => new Promise((resolve) => rl.question(question, resolve))

  try {
    console.log('\nAME3 Module Scaffolder')
    console.log('======================\n')

    const key = await askRequired(ask, 'Module key (ej. custom.crm): ')
    const name = await askRequired(ask, 'Nombre para mostrar en UI (español): ')
    const version = await askWithDefault(ask, 'Version', '0.1.0')
    const description = (await ask('Descripcion (opcional): ')).trim()

    const entities = []
    let addEntity = true
    let entityIndex = 1

    while (addEntity) {
      console.log(`\n--- Entidad ${entityIndex} ---`)
      const entityName = await askRequired(ask, 'Nombre de entidad (snake_case): ')
      const label = await askRequired(ask, 'Etiqueta singular (español): ')
      const labelPluralDefault = label + 's'
      const labelPlural = await askWithDefault(ask, 'Etiqueta plural (español)', labelPluralDefault)
      const softDelete = await askYesNo(ask, 'Soft-delete? [Y/n]: ', true)
      const companyScoped = await askYesNo(ask, 'Scoped por empresa? [Y/n]: ', true)

      const fields = []
      let addField = true
      let fieldIndex = 1

      while (addField) {
        console.log(`\n  -- Campo ${fieldIndex} --`)
        const fieldName = await askRequired(ask, '  Nombre del campo (snake_case): ')
        const fieldType = await askFieldType(ask)
        const fieldLabel = await askRequired(ask, '  Etiqueta (español): ')
        const required = await askYesNo(ask, '  Requerido? [y/N]: ', false)

        const field = { name: fieldName, type: fieldType, label: fieldLabel }
        if (required) field.required = true

        if (fieldType === 'select' || fieldType === 'multiselect') {
          const opts = await askRequired(ask, '  Opciones (separadas por coma): ')
          field.options = opts.split(',').map((o) => o.trim()).filter(Boolean)
        }
        if (fieldType === 'relation') {
          field.relatedModel = await askRequired(ask, '  Modelo relacionado (ej. fleet.vehicle): ')
        }
        if (fieldType === 'text' || fieldType === 'textarea') {
          const ml = (await ask('  Longitud maxima (dejar vacio para omitir): ')).trim()
          if (ml && !Number.isNaN(Number(ml))) field.maxLength = Number(ml)
        }

        fields.push(field)
        fieldIndex++
        addField = await askYesNo(ask, '\n  Agregar otro campo? [Y/n]: ', true)
      }

      entities.push({ name: entityName, label, labelPlural, softDelete, companyScoped, fields })
      entityIndex++
      addEntity = await askYesNo(ask, '\nAgregar otra entidad? [Y/n]: ', true)
    }

    return { key, name, version: version || '0.1.0', description, entities }
  } finally {
    rl.close()
  }
}

async function askRequired(ask, question) {
  let value = ''
  while (!value.trim()) {
    value = (await ask(question)).trim()
    if (!value) console.log('  Este campo es requerido.')
  }
  return value
}

async function askWithDefault(ask, label, defaultValue) {
  const answer = (await ask(`${label} [${defaultValue}]: `)).trim()
  return answer || defaultValue
}

async function askYesNo(ask, question, defaultValue) {
  const answer = (await ask(question)).trim().toLowerCase()
  if (!answer) return defaultValue
  return answer === 'y' || answer === 'yes' || answer === 's' || answer === 'si'
}

async function askFieldType(ask) {
  const typeList = VALID_FIELD_TYPES.join('/')
  let type = ''
  while (!VALID_FIELD_TYPES.includes(type)) {
    type = (await ask(`  Tipo de campo (${typeList}): `)).trim().toLowerCase()
    if (!VALID_FIELD_TYPES.includes(type)) {
      console.log(`  Tipo invalido. Opciones: ${VALID_FIELD_TYPES.join(', ')}`)
    }
  }
  return type
}
