// apps/api/src/routes/catalog/catalog-variant-service.js

export function createCatalogVariantService({ prisma }) {

  async function listOptions({ companyId, productId }) {
    const options = await prisma.$queryRaw`
      SELECT o.id, o.name, o.position
      FROM catalog_product_option o
      WHERE o.product_id = ${productId}::uuid AND o.company_id = ${companyId}::uuid
      ORDER BY o.position ASC, o.name ASC
    `
    const values = await prisma.$queryRaw`
      SELECT v.id, v.option_id, v.value, v.position
      FROM catalog_product_option_value v
      JOIN catalog_product_option o ON o.id = v.option_id
      WHERE o.product_id = ${productId}::uuid AND o.company_id = ${companyId}::uuid
      ORDER BY v.position ASC
    `
    return options.map(o => ({
      ...o,
      values: values.filter(v => String(v.option_id) === String(o.id)),
    }))
  }

  async function createOption({ companyId, productId, data }) {
    return prisma.$transaction(async (tx) => {
      const [option] = await tx.$queryRaw`
        INSERT INTO catalog_product_option (company_id, product_id, name, position)
        VALUES (${companyId}::uuid, ${productId}::uuid, ${data.name}, ${data.position ?? 0})
        RETURNING *
      `
      const vals = []
      for (const [i, val] of (data.values ?? []).entries()) {
        const [row] = await tx.$queryRaw`
          INSERT INTO catalog_product_option_value (company_id, option_id, value, position)
          VALUES (${companyId}::uuid, ${option.id}::uuid, ${val}, ${i})
          RETURNING *
        `
        vals.push(row)
      }
      return { ...option, values: vals }
    })
  }

  async function updateOption({ companyId, optionId, data }) {
    return prisma.$transaction(async (tx) => {
      if (data.name !== undefined || data.position !== undefined) {
        const map = { name: data.name, position: data.position }
        const entries = Object.entries(map).filter(([, v]) => v !== undefined)
        if (entries.length) {
          const setParts = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ')
          const values   = entries.map(([, v]) => v)
          const sql = `UPDATE catalog_product_option SET ${setParts}, updated_at = now()
                       WHERE id = $1::uuid AND company_id = $${values.length + 2}::uuid RETURNING *`
          await tx.$queryRawUnsafe(sql, optionId, ...values, companyId)
        }
      }
      if (data.values !== undefined) {
        await tx.$queryRaw`
          DELETE FROM catalog_product_option_value WHERE option_id = ${optionId}::uuid
        `
        for (const [i, val] of data.values.entries()) {
          await tx.$queryRaw`
            INSERT INTO catalog_product_option_value (company_id, option_id, value, position)
            VALUES (${companyId}::uuid, ${optionId}::uuid, ${val}, ${i})
          `
        }
      }
      const [updated] = await tx.$queryRaw`
        SELECT * FROM catalog_product_option WHERE id = ${optionId}::uuid LIMIT 1
      `
      if (!updated) return null
      const values = await tx.$queryRaw`
        SELECT * FROM catalog_product_option_value WHERE option_id = ${optionId}::uuid ORDER BY position ASC
      `
      return { ...updated, values }
    })
  }

  async function deleteOption({ companyId, optionId }) {
    await prisma.$queryRaw`
      DELETE FROM catalog_product_option
      WHERE id = ${optionId}::uuid AND company_id = ${companyId}::uuid
    `
  }

  async function listVariants({ companyId, productId }) {
    return prisma.$queryRaw`
      SELECT * FROM catalog_product_variant
      WHERE product_id = ${productId}::uuid AND company_id = ${companyId}::uuid AND enabled = true
      ORDER BY created_at ASC
    `
  }

  async function getVariantById({ companyId, variantId }) {
    const rows = await prisma.$queryRaw`
      SELECT * FROM catalog_product_variant
      WHERE id = ${variantId}::uuid AND company_id = ${companyId}::uuid
      LIMIT 1
    `
    return rows[0] ?? null
  }

  async function createVariant({ companyId, productId, data }) {
    const rows = await prisma.$queryRaw`
      INSERT INTO catalog_product_variant
        (company_id, product_id, option_values, sku, barcode, price, compare_price, stock, cover_asset_id)
      VALUES (
        ${companyId}::uuid,
        ${productId}::uuid,
        ${JSON.stringify(data.option_values ?? {})}::jsonb,
        ${data.sku ?? null},
        ${data.barcode ?? null},
        ${data.price ?? 0},
        ${data.compare_price ?? null},
        ${data.stock ?? 0},
        ${data.cover_asset_id ?? null}::uuid
      )
      RETURNING *
    `
    return rows[0]
  }

  async function updateVariant({ companyId, variantId, data }) {
    const map = {
      option_values:  data.option_values !== undefined ? JSON.stringify(data.option_values) : undefined,
      sku:            data.sku,
      barcode:        data.barcode,
      price:          data.price,
      compare_price:  data.compare_price,
      stock:          data.stock,
      cover_asset_id: data.cover_asset_id,
    }
    const entries = Object.entries(map).filter(([, v]) => v !== undefined)
    if (!entries.length) return getVariantById({ companyId, variantId })
    const setParts = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ')
    const values   = entries.map(([, v]) => v)
    const sql = `UPDATE catalog_product_variant SET ${setParts}, updated_at = now()
                 WHERE id = $1::uuid AND company_id = $${values.length + 2}::uuid AND enabled = true
                 RETURNING *`
    const rows = await prisma.$queryRawUnsafe(sql, variantId, ...values, companyId)
    return rows[0] ?? null
  }

  async function deleteVariant({ companyId, variantId }) {
    await prisma.$queryRaw`
      UPDATE catalog_product_variant SET enabled = false, updated_at = now()
      WHERE id = ${variantId}::uuid AND company_id = ${companyId}::uuid
    `
  }

  return {
    listOptions,
    createOption,
    updateOption,
    deleteOption,
    listVariants,
    getVariantById,
    createVariant,
    updateVariant,
    deleteVariant,
  }
}
