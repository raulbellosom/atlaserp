// apps/api/src/routes/catalog/catalog-product-service.js

export function createCatalogProductService({ prisma }) {

  async function listCategoriesTree({ companyId }) {
    const rows = await prisma.$queryRaw`
      SELECT id, name, slug, description, parent_id, cover_asset_id,
             position, enabled, created_at, updated_at
      FROM catalog_category
      WHERE company_id = ${companyId}::uuid AND enabled = true
      ORDER BY position ASC, name ASC
    `
    const roots = rows.filter(r => r.parent_id === null)
    return roots.map(r => ({
      ...r,
      children: rows.filter(c => String(c.parent_id) === String(r.id)),
    }))
  }

  async function listCategories({ companyId }) {
    return prisma.$queryRaw`
      SELECT id, name, slug, description, parent_id, cover_asset_id,
             position, enabled, created_at, updated_at
      FROM catalog_category
      WHERE company_id = ${companyId}::uuid AND enabled = true
      ORDER BY position ASC, name ASC
    `
  }

  async function listCategoriesPaginated({ companyId, search, sort, order, limit = 20, offset = 0 }) {
    const likeSearch = search ? `%${String(search).trim()}%` : null
    const safeLimit  = Math.min(Math.max(Number.parseInt(String(limit),  10) || 20, 1), 200)
    const safeOffset = Math.max(Number.parseInt(String(offset), 10) || 0, 0)
    const ALLOWED_SORT = ['name', 'slug', 'position', 'created_at']
    const safeSort  = ALLOWED_SORT.includes(sort) ? sort : 'position'
    const safeOrder = order === 'desc' ? 'DESC' : 'ASC'

    const rows = await prisma.$queryRawUnsafe(
      `SELECT c.id, c.name, c.slug, c.description, c.parent_id,
              c.position, c.enabled, c.created_at,
              p.name AS parent_name
       FROM catalog_category c
       LEFT JOIN catalog_category p ON p.id = c.parent_id
       WHERE c.company_id = $1::uuid AND c.enabled = true
         AND ($2::text IS NULL OR c.name ILIKE $2 OR c.slug ILIKE $2)
       ORDER BY c.${safeSort} ${safeOrder}
       LIMIT $3 OFFSET $4`,
      companyId, likeSearch, safeLimit, safeOffset,
    )

    const [{ total }] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS total
       FROM catalog_category c
       WHERE c.company_id = $1::uuid AND c.enabled = true
         AND ($2::text IS NULL OR c.name ILIKE $2 OR c.slug ILIKE $2)`,
      companyId, likeSearch,
    )

    return { data: rows, total }
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
      INSERT INTO catalog_category
        (company_id, name, slug, description, parent_id, cover_asset_id, position, created_at, updated_at)
      VALUES (
        ${companyId}::uuid,
        ${data.name},
        ${data.slug},
        ${data.description ?? null},
        ${data.parent_id ?? null}::uuid,
        ${data.cover_asset_id ?? null}::uuid,
        ${data.position ?? 0},
        now(),
        now()
      )
      RETURNING *
    `
    return rows[0]
  }

  async function updateCategory({ companyId, id, data }) {
    const map = {
      name:           data.name,
      slug:           data.slug,
      description:    data.description,
      parent_id:      data.parent_id,
      cover_asset_id: data.cover_asset_id,
      position:       data.position,
    }
    const entries = Object.entries(map).filter(([, v]) => v !== undefined)
    if (!entries.length) return getCategoryById({ companyId, id })
    const setParts = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ')
    const values   = entries.map(([, v]) => v)
    const sql = `UPDATE catalog_category SET ${setParts}, updated_at = now()
                 WHERE id = $1::uuid AND company_id = $${values.length + 2}::uuid
                 RETURNING *`
    const rows = await prisma.$queryRawUnsafe(sql, id, ...values, companyId)
    return rows[0] ?? null
  }

  async function deleteCategory({ companyId, id }) {
    await prisma.$queryRaw`
      UPDATE catalog_category SET enabled = false, updated_at = now()
      WHERE id = ${id}::uuid AND company_id = ${companyId}::uuid
    `
  }

  async function listProducts({ companyId, categoryId, type, published, search, limit = 50, offset = 0 }) {
    const safeLimit  = Math.min(Math.max(Number.parseInt(String(limit  ?? 50),  10) || 50,  1), 500)
    const safeOffset = Math.max(Number.parseInt(String(offset ?? 0),   10) || 0,  0)
    const likeSearch = search ? `%${String(search).trim()}%` : null
    const catId      = categoryId ?? null
    const prodType   = type ?? null
    const pubFilter  = published === undefined ? null : (published === 'true' || published === true)

    const rows = await prisma.$queryRawUnsafe(
      `SELECT p.id, p.name, p.slug, p.product_type, p.price, p.currency,
              p.stock, p.track_stock, p.cover_asset_id, p.published,
              p.created_at, c.name AS category_name
       FROM catalog_product p
       LEFT JOIN catalog_category c ON c.id = p.category_id
       WHERE p.company_id = $1::uuid
         AND p.enabled = true
         AND ($2::uuid IS NULL OR p.category_id = $2::uuid)
         AND ($3::text IS NULL OR p.product_type = $3)
         AND ($4::boolean IS NULL OR p.published = $4)
         AND ($5::text IS NULL OR p.name ILIKE $5)
       ORDER BY p.created_at DESC
       LIMIT $6 OFFSET $7`,
      companyId, catId, prodType, pubFilter, likeSearch, safeLimit, safeOffset,
    )

    const [{ total }] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS total
       FROM catalog_product p
       WHERE p.company_id = $1::uuid
         AND p.enabled = true
         AND ($2::uuid IS NULL OR p.category_id = $2::uuid)
         AND ($3::text IS NULL OR p.product_type = $3)
         AND ($4::boolean IS NULL OR p.published = $4)
         AND ($5::text IS NULL OR p.name ILIKE $5)`,
      companyId, catId, prodType, pubFilter, likeSearch,
    )

    return { data: rows, total }
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

  async function getFullProductById({ companyId, id }) {
    const rows = await prisma.$queryRaw`
      SELECT p.*, c.name AS category_name
      FROM catalog_product p
      LEFT JOIN catalog_category c ON c.id = p.category_id
      WHERE p.id = ${id}::uuid AND p.company_id = ${companyId}::uuid
      LIMIT 1
    `
    if (!rows[0]) return null
    const product = rows[0]

    if (product.product_type === 'VARIABLE') {
      const options = await prisma.$queryRaw`
        SELECT o.id, o.name, o.position
        FROM catalog_product_option o
        WHERE o.product_id = ${id}::uuid AND o.company_id = ${companyId}::uuid
        ORDER BY o.position ASC
      `
      const vals = await prisma.$queryRaw`
        SELECT v.id, v.option_id, v.value, v.position
        FROM catalog_product_option_value v
        JOIN catalog_product_option o ON o.id = v.option_id
        WHERE o.product_id = ${id}::uuid
        ORDER BY v.position ASC
      `
      product.options = options.map(o => ({
        ...o,
        values: vals.filter(v => String(v.option_id) === String(o.id)),
      }))
      product.variants = await prisma.$queryRaw`
        SELECT * FROM catalog_product_variant
        WHERE product_id = ${id}::uuid AND company_id = ${companyId}::uuid AND enabled = true
        ORDER BY created_at ASC
      `
    }

    return product
  }

  async function createProduct({ companyId, data }) {
    const rows = await prisma.$queryRaw`
      INSERT INTO catalog_product
        (company_id, category_id, product_type, name, slug, description,
         sku, barcode, price, compare_price, currency, weight,
         stock, track_stock, attributes, cover_asset_id, images,
         meta_title, meta_description, published)
      VALUES (
        ${companyId}::uuid,
        ${data.category_id ?? null}::uuid,
        ${data.product_type ?? 'SIMPLE'},
        ${data.name},
        ${data.slug},
        ${data.description ?? null},
        ${data.sku ?? null},
        ${data.barcode ?? null},
        ${data.price ?? 0},
        ${data.compare_price ?? null},
        ${data.currency ?? 'USD'},
        ${data.weight ?? null},
        ${data.stock ?? 0},
        ${data.track_stock ?? false},
        ${JSON.stringify(data.attributes ?? [])}::jsonb,
        ${data.cover_asset_id ?? null}::uuid,
        ${JSON.stringify(data.images ?? [])}::jsonb,
        ${data.meta_title ?? null},
        ${data.meta_description ?? null},
        ${data.published ?? false}
      )
      RETURNING *
    `
    return rows[0]
  }

  async function updateProduct({ companyId, id, data }) {
    const map = {
      category_id:      data.category_id,
      product_type:     data.product_type,
      name:             data.name,
      slug:             data.slug,
      description:      data.description,
      sku:              data.sku,
      barcode:          data.barcode,
      price:            data.price,
      compare_price:    data.compare_price,
      currency:         data.currency,
      weight:           data.weight,
      stock:            data.stock,
      track_stock:      data.track_stock,
      attributes:       data.attributes !== undefined ? JSON.stringify(data.attributes) : undefined,
      cover_asset_id:   data.cover_asset_id,
      images:           data.images !== undefined ? JSON.stringify(data.images) : undefined,
      meta_title:       data.meta_title,
      meta_description: data.meta_description,
      published:        data.published,
    }
    const entries = Object.entries(map).filter(([, v]) => v !== undefined)
    if (!entries.length) return getProductById({ companyId, id })
    const setParts = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ')
    const values   = entries.map(([, v]) => v)
    const sql = `UPDATE catalog_product SET ${setParts}, updated_at = now()
                 WHERE id = $1::uuid AND company_id = $${values.length + 2}::uuid AND enabled = true
                 RETURNING *`
    const rows = await prisma.$queryRawUnsafe(sql, id, ...values, companyId)
    return rows[0] ?? null
  }

  async function publishProduct({ companyId, id, published }) {
    const rows = await prisma.$queryRaw`
      UPDATE catalog_product SET published = ${published}, updated_at = now()
      WHERE id = ${id}::uuid AND company_id = ${companyId}::uuid AND enabled = true
      RETURNING *
    `
    return rows[0] ?? null
  }

  async function deleteProduct({ companyId, id }) {
    await prisma.$queryRaw`
      UPDATE catalog_product SET enabled = false, updated_at = now()
      WHERE id = ${id}::uuid AND company_id = ${companyId}::uuid
    `
  }

  return {
    listCategoriesTree,
    listCategories,
    listCategoriesPaginated,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
    listProducts,
    getProductById,
    getFullProductById,
    createProduct,
    updateProduct,
    publishProduct,
    deleteProduct,
  }
}
