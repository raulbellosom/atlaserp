// modules/official/atlas.catalog/api/catalog-service.js

export function createCatalogService({ prisma }) {

  // ── Categories ──────────────────────────────────────────────────

  async function listCategories({ companyId }) {
    return prisma.$queryRaw`
      SELECT id, name, slug, description, enabled, created_at, updated_at
      FROM catalog_category
      WHERE company_id = ${companyId}::uuid AND enabled = true
      ORDER BY name ASC
    `
  }

  async function getCategoryById({ companyId, id }) {
    const rows = await prisma.$queryRaw`
      SELECT * FROM catalog_category
      WHERE id = ${id}::uuid AND company_id = ${companyId}::uuid
      LIMIT 1
    `
    return rows[0] ?? null
  }

  async function createCategory({ companyId, data }) {
    const rows = await prisma.$queryRaw`
      INSERT INTO catalog_category (company_id, name, slug, description)
      VALUES (${companyId}::uuid, ${data.name}, ${data.slug}, ${data.description ?? null})
      RETURNING *
    `
    return rows[0]
  }

  async function updateCategory({ companyId, id, data }) {
    const sets = []
    const values = []
    if (data.name        !== undefined) { sets.push(`name = $${sets.length + 2}`)        ; values.push(data.name) }
    if (data.slug        !== undefined) { sets.push(`slug = $${sets.length + 2}`)        ; values.push(data.slug) }
    if (data.description !== undefined) { sets.push(`description = $${sets.length + 2}`); values.push(data.description) }
    if (!sets.length) return getCategoryById({ companyId, id })
    sets.push(`updated_at = now()`)
    const sql = `UPDATE catalog_category SET ${sets.join(', ')} WHERE id = $1::uuid AND company_id = $${values.length + 2}::uuid RETURNING *`
    const rows = await prisma.$queryRawUnsafe(sql, id, ...values, companyId)
    return rows[0] ?? null
  }

  async function deleteCategory({ companyId, id }) {
    await prisma.$queryRaw`
      UPDATE catalog_category SET enabled = false, updated_at = now()
      WHERE id = ${id}::uuid AND company_id = ${companyId}::uuid
    `
  }

  // ── Products ──────────────────────────────────────────────────

  async function listProducts({ companyId, categoryId, search, limit = 50, offset = 0 }) {
    // All dynamic filter values are passed as positional parameters — no string interpolation of user input.
    // $2::uuid IS NULL OR ... pattern allows optional filters without string building.
    const safeLimit  = Math.min(Math.max(Number.parseInt(String(limit  ?? 50),  10) || 50,  1), 500)
    const safeOffset = Math.max(Number.parseInt(String(offset ?? 0),   10) || 0,  0)
    const likeSearch = search ? `%${String(search).trim()}%` : null
    const catId      = categoryId ?? null

    return prisma.$queryRawUnsafe(
      `SELECT p.*, c.name AS category_name
       FROM catalog_product p
       LEFT JOIN catalog_category c ON c.id = p.category_id
       WHERE p.company_id = $1::uuid
         AND p.enabled = true
         AND ($2::uuid IS NULL OR p.category_id = $2::uuid)
         AND ($3::text IS NULL OR p.name ILIKE $3)
       ORDER BY p.created_at DESC
       LIMIT $4 OFFSET $5`,
      companyId,
      catId,
      likeSearch,
      safeLimit,
      safeOffset,
    )
  }

  async function getProductById({ companyId, id }) {
    const rows = await prisma.$queryRaw`
      SELECT p.*, c.name AS category_name
      FROM catalog_product p
      LEFT JOIN catalog_category c ON c.id = p.category_id
      WHERE p.id = ${id}::uuid AND p.company_id = ${companyId}::uuid
      LIMIT 1
    `
    return rows[0] ?? null
  }

  async function createProduct({ companyId, data }) {
    const rows = await prisma.$queryRaw`
      INSERT INTO catalog_product
        (company_id, category_id, name, slug, description, price, compare_price,
         currency, stock, track_stock, cover_asset_id, images, published)
      VALUES (
        ${companyId}::uuid,
        ${data.category_id ?? null}::uuid,
        ${data.name},
        ${data.slug},
        ${data.description ?? null},
        ${data.price},
        ${data.compare_price ?? null},
        ${data.currency ?? 'USD'},
        ${data.stock ?? 0},
        ${data.track_stock ?? false},
        ${data.cover_asset_id ?? null}::uuid,
        ${JSON.stringify(data.images ?? [])}::jsonb,
        ${data.published ?? false}
      )
      RETURNING *
    `
    return rows[0]
  }

  async function updateProduct({ companyId, id, data }) {
    const fields = {
      name:           data.name,
      slug:           data.slug,
      description:    data.description,
      price:          data.price,
      compare_price:  data.compare_price,
      currency:       data.currency,
      stock:          data.stock,
      track_stock:    data.track_stock,
      cover_asset_id: data.cover_asset_id,
      images:         data.images !== undefined ? JSON.stringify(data.images) : undefined,
      category_id:    data.category_id,
      published:      data.published,
    }
    const entries = Object.entries(fields).filter(([, v]) => v !== undefined)
    if (!entries.length) return getProductById({ companyId, id })
    const setParts = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ')
    const values   = entries.map(([, v]) => v)
    const sql      = `UPDATE catalog_product SET ${setParts}, updated_at = now() WHERE id = $1::uuid AND company_id = $${values.length + 2}::uuid AND enabled = true RETURNING *`
    const rows     = await prisma.$queryRawUnsafe(sql, id, ...values, companyId)
    return rows[0] ?? null
  }

  async function deleteProduct({ companyId, id }) {
    await prisma.$queryRaw`
      UPDATE catalog_product SET enabled = false, updated_at = now()
      WHERE id = ${id}::uuid AND company_id = ${companyId}::uuid
    `
  }

  async function listPublicProducts({ companyId, categoryId, limit = 20 }) {
    // All filter values passed as positional parameters — no string interpolation of user input.
    const safeLimit = Math.min(Math.max(Number.parseInt(String(limit ?? 20), 10) || 20, 1), 200)
    const catId     = categoryId ?? null

    return prisma.$queryRawUnsafe(
      `SELECT id, name, slug, description, price, compare_price, currency,
              stock, track_stock, cover_asset_id, images, category_id
       FROM catalog_product
       WHERE company_id = $1::uuid
         AND enabled = true
         AND published = true
         AND ($2::uuid IS NULL OR category_id = $2::uuid)
       ORDER BY created_at DESC
       LIMIT $3`,
      companyId,
      catId,
      safeLimit,
    )
  }

  return {
    listCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
    listProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    listPublicProducts,
  }
}
