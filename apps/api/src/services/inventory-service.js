// inventory-service.js — business logic layer for atlas.inventory module

export class InventoryServiceError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'InventoryServiceError';
    this.status = status;
  }
}

function parseMentionIds(body) {
  const ids = [];
  let match;
  const re = /@\[([a-f0-9-]{36}):[^\]]+\]/g;
  while ((match = re.exec(body)) !== null) {
    ids.push(match[1]);
  }
  return [...new Set(ids)];
}

function normalizeLimit(limit, fallback = 50, max = 200) {
  const parsed = Number.parseInt(String(limit ?? fallback), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function normalizePage(page) {
  const parsed = Number.parseInt(String(page ?? 1), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

export function createInventoryService({ prisma }) {
  // ── Items ──────────────────────────────────────────────────────────────────

  async function listItems({
    companyId,
    search,
    categoryId,
    brandId,
    locationId,
    status,
    assignedToId,
    page = 1,
    limit = 50,
  }) {
    const take = normalizeLimit(limit);
    const skip = (normalizePage(page) - 1) * take;

    const where = { companyId, enabled: true };

    if (search) {
      const q = String(search).trim();
      if (q) {
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { assetTag: { contains: q, mode: 'insensitive' } },
          { serialNumber: { contains: q, mode: 'insensitive' } },
        ];
      }
    }
    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;
    if (locationId) where.locationId = locationId;
    if (status) where.status = status;
    if (assignedToId) where.assignedToId = assignedToId;

    const [data, total] = await Promise.all([
      prisma.invItem.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, icon: true, color: true } },
          brand: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.invItem.count({ where }),
    ]);

    return { data, total, page: normalizePage(page), limit: take };
  }

  async function getItem(id, companyId) {
    const item = await prisma.invItem.findFirst({
      where: { id, companyId, enabled: true },
      include: {
        category: true,
        brand: true,
        location: true,
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true, userProfileId: true },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        customValues: {
          include: {
            field: { select: { id: true, label: true, fieldKey: true, fieldType: true, options: true } },
          },
        },
        files: {
          include: {
            fileAsset: { select: { id: true, fileName: true, mimeType: true, fileSize: true } },
          },
        },
      },
    });
    if (!item) throw new InventoryServiceError('Item not found', 404);
    return item;
  }

  async function createItem(data, companyId, creatorId) {
    let assetTag = data.assetTag;
    if (!assetTag) {
      const year = new Date().getFullYear();
      const count = await prisma.invItem.count({ where: { companyId } });
      assetTag = `INV-${year}-${String(count + 1).padStart(4, '0')}`;
    }

    const {
      name,
      description,
      categoryId,
      brandId,
      locationId,
      serialNumber,
      model,
      partNumber,
      status,
      purchaseDate,
      purchasePrice,
      vendorName,
      invoiceNumber,
      warrantyExpiry,
      warrantyNotes,
      licenseKey,
      licenseExpiry,
      licenseSeats,
      notes,
      customValues,
    } = data;

    let itemData = {
      companyId,
      assetTag,
      name,
      status: status ?? 'available',
      createdById: creatorId,
    };
    if (description !== undefined) itemData.description = description;
    if (categoryId !== undefined) itemData.categoryId = categoryId;
    if (brandId !== undefined) itemData.brandId = brandId;
    if (locationId !== undefined) itemData.locationId = locationId;
    if (serialNumber !== undefined) itemData.serialNumber = serialNumber;
    if (model !== undefined) itemData.model = model;
    if (partNumber !== undefined) itemData.partNumber = partNumber;
    if (purchaseDate !== undefined) itemData.purchaseDate = purchaseDate ? new Date(purchaseDate) : null;
    if (purchasePrice !== undefined) itemData.purchasePrice = purchasePrice;
    if (vendorName !== undefined) itemData.vendorName = vendorName;
    if (invoiceNumber !== undefined) itemData.invoiceNumber = invoiceNumber;
    if (warrantyExpiry !== undefined) itemData.warrantyExpiry = warrantyExpiry ? new Date(warrantyExpiry) : null;
    if (warrantyNotes !== undefined) itemData.warrantyNotes = warrantyNotes;
    if (licenseKey !== undefined) itemData.licenseKey = licenseKey;
    if (licenseExpiry !== undefined) itemData.licenseExpiry = licenseExpiry ? new Date(licenseExpiry) : null;
    if (licenseSeats !== undefined) itemData.licenseSeats = licenseSeats;
    if (notes !== undefined) itemData.notes = notes;

    if (customValues && Array.isArray(customValues) && customValues.length > 0) {
      let created;
      let tagAttempt = 0;
      while (!created) {
        try {
          created = await prisma.$transaction(async (tx) => {
            const item = await tx.invItem.create({ data: itemData });
            for (const cv of customValues) {
              await tx.invCustomFieldValue.create({
                data: { itemId: item.id, fieldId: cv.fieldId, value: cv.value ?? null },
              });
            }
            return tx.invItem.findFirst({
              where: { id: item.id },
              include: {
                category: { select: { id: true, name: true, icon: true, color: true } },
                brand: { select: { id: true, name: true } },
                location: { select: { id: true, name: true } },
                customValues: { include: { field: { select: { id: true, label: true, fieldKey: true, fieldType: true, options: true } } } },
              },
            });
          });
        } catch (err) {
          if (err.code === 'P2002' && err.meta?.target?.includes('asset_tag') && tagAttempt < 5) {
            tagAttempt++;
            const year = new Date().getFullYear();
            const count = await prisma.invItem.count({ where: { companyId } });
            itemData = { ...itemData, assetTag: `INV-${year}-${String(count + tagAttempt).padStart(4, '0')}` };
          } else {
            throw err;
          }
        }
      }
      return created;
    }

    let created;
    let tagAttempt = 0;
    while (!created) {
      try {
        created = await prisma.invItem.create({
          data: itemData,
          include: {
            category: { select: { id: true, name: true, icon: true, color: true } },
            brand: { select: { id: true, name: true } },
            location: { select: { id: true, name: true } },
          },
        });
      } catch (err) {
        if (err.code === 'P2002' && err.meta?.target?.includes('asset_tag') && tagAttempt < 5) {
          tagAttempt++;
          const year = new Date().getFullYear();
          const count = await prisma.invItem.count({ where: { companyId } });
          itemData = { ...itemData, assetTag: `INV-${year}-${String(count + tagAttempt).padStart(4, '0')}` };
        } else {
          throw err;
        }
      }
    }
    return created;
  }

  async function updateItem(id, data, companyId) {
    const existing = await prisma.invItem.findFirst({ where: { id, companyId, enabled: true } });
    if (!existing) throw new InventoryServiceError('Item not found', 404);

    const {
      name,
      assetTag,
      description,
      categoryId,
      brandId,
      locationId,
      serialNumber,
      model,
      partNumber,
      status,
      purchaseDate,
      purchasePrice,
      vendorName,
      invoiceNumber,
      warrantyExpiry,
      warrantyNotes,
      licenseKey,
      licenseExpiry,
      licenseSeats,
      notes,
      customValues,
    } = data;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (assetTag !== undefined) updateData.assetTag = assetTag;
    if (description !== undefined) updateData.description = description;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (brandId !== undefined) updateData.brandId = brandId;
    if (locationId !== undefined) updateData.locationId = locationId;
    if (serialNumber !== undefined) updateData.serialNumber = serialNumber;
    if (model !== undefined) updateData.model = model;
    if (partNumber !== undefined) updateData.partNumber = partNumber;
    if (status !== undefined) updateData.status = status;
    if (purchaseDate !== undefined) updateData.purchaseDate = purchaseDate ? new Date(purchaseDate) : null;
    if (purchasePrice !== undefined) updateData.purchasePrice = purchasePrice;
    if (vendorName !== undefined) updateData.vendorName = vendorName;
    if (invoiceNumber !== undefined) updateData.invoiceNumber = invoiceNumber;
    if (warrantyExpiry !== undefined) updateData.warrantyExpiry = warrantyExpiry ? new Date(warrantyExpiry) : null;
    if (warrantyNotes !== undefined) updateData.warrantyNotes = warrantyNotes;
    if (licenseKey !== undefined) updateData.licenseKey = licenseKey;
    if (licenseExpiry !== undefined) updateData.licenseExpiry = licenseExpiry ? new Date(licenseExpiry) : null;
    if (licenseSeats !== undefined) updateData.licenseSeats = licenseSeats;
    if (notes !== undefined) updateData.notes = notes;

    if (customValues && Array.isArray(customValues) && customValues.length > 0) {
      return prisma.$transaction(async (tx) => {
        await tx.invItem.update({ where: { id }, data: updateData });
        for (const cv of customValues) {
          await tx.invCustomFieldValue.upsert({
            where: { itemId_fieldId: { itemId: id, fieldId: cv.fieldId } },
            update: { value: cv.value ?? null },
            create: { itemId: id, fieldId: cv.fieldId, value: cv.value ?? null },
          });
        }
        return tx.invItem.findFirst({
          where: { id },
          include: {
            category: { select: { id: true, name: true, icon: true, color: true } },
            brand: { select: { id: true, name: true } },
            location: { select: { id: true, name: true } },
            customValues: { include: { field: { select: { id: true, label: true, fieldKey: true, fieldType: true, options: true } } } },
          },
        });
      });
    }

    return prisma.invItem.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        brand: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
    });
  }

  async function deleteItem(id, companyId) {
    const existing = await prisma.invItem.findFirst({ where: { id, companyId, enabled: true } });
    if (!existing) throw new InventoryServiceError('Item not found', 404);
    return prisma.invItem.update({ where: { id }, data: { enabled: false } });
  }

  // ── Assignments ────────────────────────────────────────────────────────────

  async function assignItem(itemId, employeeId, assignedById, notes, companyId) {
    const item = await prisma.invItem.findFirst({ where: { id: itemId, companyId, enabled: true } });
    if (!item) throw new InventoryServiceError('Item not found', 404);
    if (item.status === 'assigned') throw new InventoryServiceError('Item is already assigned', 409);

    return prisma.$transaction(async (tx) => {
      const assignment = await tx.invAssignment.create({
        data: { itemId, employeeId, assignedById, notes: notes ?? null },
      });
      const updatedItem = await tx.invItem.update({
        where: { id: itemId },
        data: { status: 'assigned', assignedToId: employeeId, assignedAt: new Date() },
        include: {
          category: { select: { id: true, name: true, icon: true, color: true } },
          brand: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        },
      });
      return { item: updatedItem, assignment };
    });
  }

  async function returnItem(itemId, assignedById, notes, companyId) {
    const item = await prisma.invItem.findFirst({ where: { id: itemId, companyId, enabled: true } });
    if (!item) throw new InventoryServiceError('Item not found', 404);
    if (item.status !== 'assigned') throw new InventoryServiceError('Item is not currently assigned', 409);

    return prisma.$transaction(async (tx) => {
      const activeAssignment = await tx.invAssignment.findFirst({
        where: { itemId, returnedAt: null },
        orderBy: { assignedAt: 'desc' },
      });

      if (activeAssignment) {
        await tx.invAssignment.update({
          where: { id: activeAssignment.id },
          data: { returnedAt: new Date(), ...(notes !== undefined ? { notes } : {}) },
        });
      }

      return tx.invItem.update({
        where: { id: itemId },
        data: { status: 'available', assignedToId: null, assignedAt: null },
        include: {
          category: { select: { id: true, name: true, icon: true, color: true } },
          brand: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
        },
      });
    });
  }

  async function getAssignmentHistory(itemId, companyId) {
    const item = await prisma.invItem.findFirst({ where: { id: itemId, companyId, enabled: true } });
    if (!item) throw new InventoryServiceError('Item not found', 404);

    return prisma.invAssignment.findMany({
      where: { itemId },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        assignedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async function listAllAssignments({
    companyId,
    employeeId,
    itemId,
    active,
    page = 1,
    limit = 50,
  }) {
    const take = normalizeLimit(limit);
    const skip = (normalizePage(page) - 1) * take;

    const where = {
      item: { companyId, enabled: true },
    };
    if (employeeId) where.employeeId = employeeId;
    if (itemId) where.itemId = itemId;
    if (active === true || active === 'true') where.returnedAt = null;

    const [data, total] = await Promise.all([
      prisma.invAssignment.findMany({
        where,
        include: {
          item: {
            select: {
              id: true,
              name: true,
              assetTag: true,
              category: { select: { id: true, name: true, icon: true, color: true } },
            },
          },
          employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
          assignedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { assignedAt: 'desc' },
        skip,
        take,
      }),
      prisma.invAssignment.count({ where }),
    ]);

    return { data, total, page: normalizePage(page), limit: take };
  }

  async function getItemsByEmployee(employeeId, companyId) {
    return prisma.invItem.findMany({
      where: { assignedToId: employeeId, companyId, enabled: true, status: 'assigned' },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  // ── Catalog — Categories ───────────────────────────────────────────────────

  async function listCategories(companyId) {
    return prisma.invCategory.findMany({
      where: { companyId, enabled: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async function createCategory(data, companyId) {
    const { name, description, icon, color, parentId, sortOrder } = data;
    const createData = { companyId, name };
    if (description !== undefined) createData.description = description;
    if (icon !== undefined) createData.icon = icon;
    if (color !== undefined) createData.color = color;
    if (parentId !== undefined) createData.parentId = parentId;
    if (sortOrder !== undefined) createData.sortOrder = sortOrder;
    return prisma.invCategory.create({ data: createData });
  }

  async function updateCategory(id, data, companyId) {
    const existing = await prisma.invCategory.findFirst({ where: { id, companyId, enabled: true } });
    if (!existing) throw new InventoryServiceError('Category not found', 404);
    const { name, description, icon, color, parentId, sortOrder } = data;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (parentId !== undefined) updateData.parentId = parentId;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    return prisma.invCategory.update({ where: { id }, data: updateData });
  }

  async function deleteCategory(id, companyId) {
    const existing = await prisma.invCategory.findFirst({ where: { id, companyId, enabled: true } });
    if (!existing) throw new InventoryServiceError('Category not found', 404);
    return prisma.invCategory.update({ where: { id }, data: { enabled: false } });
  }

  // ── Catalog — Brands ───────────────────────────────────────────────────────

  async function listBrands(companyId) {
    return prisma.invBrand.findMany({
      where: { companyId, enabled: true },
      orderBy: { name: 'asc' },
    });
  }

  async function createBrand(data, companyId) {
    const { name, description, website } = data;
    const createData = { companyId, name };
    if (description !== undefined) createData.description = description;
    if (website !== undefined) createData.website = website;
    return prisma.invBrand.create({ data: createData });
  }

  async function updateBrand(id, data, companyId) {
    const existing = await prisma.invBrand.findFirst({ where: { id, companyId, enabled: true } });
    if (!existing) throw new InventoryServiceError('Brand not found', 404);
    const { name, description, website } = data;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (website !== undefined) updateData.website = website;
    return prisma.invBrand.update({ where: { id }, data: updateData });
  }

  async function deleteBrand(id, companyId) {
    const brand = await prisma.invBrand.findFirst({ where: { id, companyId, enabled: true } });
    if (!brand) throw new InventoryServiceError('Brand not found', 404);
    return prisma.invBrand.update({ where: { id }, data: { enabled: false } });
  }

  // ── Catalog — Locations ────────────────────────────────────────────────────

  async function listLocations(companyId) {
    return prisma.invLocation.findMany({
      where: { companyId, enabled: true },
      orderBy: { name: 'asc' },
    });
  }

  async function createLocation(data, companyId) {
    const { name, description, address } = data;
    const createData = { companyId, name };
    if (description !== undefined) createData.description = description;
    if (address !== undefined) createData.address = address;
    return prisma.invLocation.create({ data: createData });
  }

  async function updateLocation(id, data, companyId) {
    const existing = await prisma.invLocation.findFirst({ where: { id, companyId, enabled: true } });
    if (!existing) throw new InventoryServiceError('Location not found', 404);
    const { name, description, address } = data;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (address !== undefined) updateData.address = address;
    return prisma.invLocation.update({ where: { id }, data: updateData });
  }

  async function deleteLocation(id, companyId) {
    const location = await prisma.invLocation.findFirst({ where: { id, companyId, enabled: true } });
    if (!location) throw new InventoryServiceError('Location not found', 404);
    return prisma.invLocation.update({ where: { id }, data: { enabled: false } });
  }

  // ── Custom Fields ──────────────────────────────────────────────────────────

  async function listCustomFields(companyId, categoryId) {
    const where = { companyId, enabled: true };
    if (categoryId) {
      where.OR = [{ categoryId }, { categoryId: null }];
    } else {
      where.categoryId = null;
    }
    return prisma.invCustomField.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  async function createCustomField(data, companyId) {
    const { label, fieldKey, fieldType, categoryId, options, required, sortOrder } = data;
    const createData = { companyId, label, fieldKey, fieldType };
    if (categoryId !== undefined) createData.categoryId = categoryId;
    if (options !== undefined) createData.options = options;
    if (required !== undefined) createData.required = required;
    if (sortOrder !== undefined) createData.sortOrder = sortOrder;
    return prisma.invCustomField.create({ data: createData });
  }

  async function updateCustomField(id, data, companyId) {
    const existing = await prisma.invCustomField.findFirst({ where: { id, companyId, enabled: true } });
    if (!existing) throw new InventoryServiceError('Custom field not found', 404);
    const { label, fieldKey, fieldType, categoryId, options, required, sortOrder } = data;
    const updateData = {};
    if (label !== undefined) updateData.label = label;
    if (fieldKey !== undefined) updateData.fieldKey = fieldKey;
    if (fieldType !== undefined) updateData.fieldType = fieldType;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (options !== undefined) updateData.options = options;
    if (required !== undefined) updateData.required = required;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    return prisma.invCustomField.update({ where: { id }, data: updateData });
  }

  async function deleteCustomField(id, companyId) {
    const existing = await prisma.invCustomField.findFirst({ where: { id, companyId, enabled: true } });
    if (!existing) throw new InventoryServiceError('Custom field not found', 404);
    return prisma.invCustomField.update({ where: { id }, data: { enabled: false } });
  }

  // ── Comments ───────────────────────────────────────────────────────────────

  async function listComments(itemId, companyId) {
    const item = await prisma.invItem.findFirst({ where: { id: itemId, companyId, enabled: true } });
    if (!item) throw new InventoryServiceError('Item not found', 404);

    return prisma.invComment.findMany({
      where: { itemId },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } },
        mentions: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        reactions: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async function createComment(itemId, authorId, body, companyId) {
    const item = await prisma.invItem.findFirst({ where: { id: itemId, companyId, enabled: true } });
    if (!item) throw new InventoryServiceError('Item not found', 404);

    if (!body?.trim()) throw new InventoryServiceError('El comentario no puede estar vacio.', 400);
    if (body.trim().length > 5000) throw new InventoryServiceError('El comentario no puede tener mas de 5000 caracteres.', 400);

    const trimmedBody = body.trim();
    const mentionIds = parseMentionIds(trimmedBody);

    return prisma.$transaction(async (tx) => {
      const comment = await tx.invComment.create({
        data: { itemId, authorId, body: trimmedBody },
        include: {
          author: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } },
        },
      });

      for (const userId of mentionIds) {
        try {
          await tx.invMention.create({ data: { commentId: comment.id, userId } });
        } catch (err) {
          if (err.code !== 'P2003' && err.code !== 'P2002') throw err;
        }
      }

      return comment;
    });
  }

  async function updateComment(commentId, authorId, body) {
    if (!body?.trim()) throw new InventoryServiceError('El comentario no puede estar vacio.', 400);
    if (body.trim().length > 5000) throw new InventoryServiceError('El comentario no puede tener mas de 5000 caracteres.', 400);

    const comment = await prisma.invComment.findFirst({ where: { id: commentId } });
    if (!comment) throw new InventoryServiceError('Comment not found', 404);
    if (comment.authorId !== authorId) throw new InventoryServiceError('Solo el autor puede editar este comentario.', 403);

    return prisma.invComment.update({
      where: { id: commentId },
      data: { body: body.trim(), editedAt: new Date() },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } },
      },
    });
  }

  async function deleteComment(commentId, requesterId, companyId) {
    const comment = await prisma.invComment.findFirst({
      where: { id: commentId },
      include: { item: { select: { id: true, companyId: true } } },
    });
    if (!comment) throw new InventoryServiceError('Comment not found', 404);
    if (comment.item?.companyId !== companyId) throw new InventoryServiceError('Comment not found', 404);
    if (comment.authorId !== requesterId) throw new InventoryServiceError('No tienes permiso para eliminar este comentario.', 403);

    await prisma.invComment.delete({ where: { id: commentId } });
  }

  async function toggleReaction(commentId, userId, emoji) {
    const existing = await prisma.invCommentReaction.findUnique({
      where: { commentId_userId_emoji: { commentId, userId, emoji } },
    });

    if (existing) {
      await prisma.invCommentReaction.delete({
        where: { commentId_userId_emoji: { commentId, userId, emoji } },
      });
      return { action: 'removed' };
    }

    await prisma.invCommentReaction.create({ data: { commentId, userId, emoji } });
    return { action: 'added' };
  }

  return {
    // Items
    listItems,
    getItem,
    createItem,
    updateItem,
    deleteItem,
    // Assignments
    assignItem,
    returnItem,
    getAssignmentHistory,
    listAllAssignments,
    getItemsByEmployee,
    // Categories
    listCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    // Brands
    listBrands,
    createBrand,
    updateBrand,
    deleteBrand,
    // Locations
    listLocations,
    createLocation,
    updateLocation,
    deleteLocation,
    // Custom Fields
    listCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    // Comments
    listComments,
    createComment,
    updateComment,
    deleteComment,
    toggleReaction,
  };
}
