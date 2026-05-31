// modules/official/atlas.catalog/api/catalog-stock-service.js

export function createCatalogStockService({ prisma }) {

  async function recordStockMovement({ companyId, productId, variantId, quantityDelta, reason, note, userId }) {
    return prisma.$transaction(async (tx) => {
      const [movement] = await tx.$queryRaw`
        INSERT INTO catalog_stock_movement
          (company_id, product_id, variant_id, quantity_delta, reason, note, user_id)
        VALUES (
          ${companyId}::uuid,
          ${productId}::uuid,
          ${variantId ?? null}::uuid,
          ${quantityDelta},
          ${reason ?? null},
          ${note ?? null},
          ${userId ?? null}::uuid
        )
        RETURNING *
      `

      if (variantId) {
        await tx.$queryRaw`
          UPDATE catalog_product_variant
          SET stock = stock + ${quantityDelta}, updated_at = now()
          WHERE id = ${variantId}::uuid AND company_id = ${companyId}::uuid
        `
      } else {
        await tx.$queryRaw`
          UPDATE catalog_product
          SET stock = stock + ${quantityDelta}, updated_at = now()
          WHERE id = ${productId}::uuid AND company_id = ${companyId}::uuid
        `
      }

      return movement
    })
  }

  async function listStockMovements({ companyId, productId, variantId, limit = 50, offset = 0 }) {
    const safeLimit  = Math.min(Math.max(Number.parseInt(String(limit  ?? 50),  10) || 50,  1), 200)
    const safeOffset = Math.max(Number.parseInt(String(offset ?? 0), 10) || 0, 0)
    const vid = variantId ?? null

    const rows = await prisma.$queryRawUnsafe(
      `SELECT m.*,
              p.name AS product_name,
              v.option_values AS variant_option_values
       FROM catalog_stock_movement m
       JOIN catalog_product p ON p.id = m.product_id
       LEFT JOIN catalog_product_variant v ON v.id = m.variant_id
       WHERE m.company_id = $1::uuid
         AND m.product_id = $2::uuid
         AND ($3::uuid IS NULL OR m.variant_id = $3::uuid)
       ORDER BY m.created_at DESC
       LIMIT $4 OFFSET $5`,
      companyId, productId, vid, safeLimit, safeOffset,
    )

    const [{ total }] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS total
       FROM catalog_stock_movement
       WHERE company_id = $1::uuid
         AND product_id = $2::uuid
         AND ($3::uuid IS NULL OR variant_id = $3::uuid)`,
      companyId, productId, vid,
    )

    return { data: rows, total }
  }

  return {
    recordStockMovement,
    listStockMovements,
  }
}
