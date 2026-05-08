import {
  hrCatalogCreateSchema,
  hrCatalogEnabledSchema,
  hrCatalogUpdateSchema,
  hrEmployeeCreateSchema,
  hrEmployeeUpdateSchema,
} from "@atlas/validators";

class HrServiceError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = "HrServiceError";
    this.status = status;
  }
}

function normalizeLimit(limit, fallback = 100, max = 300) {
  const parsed = Number.parseInt(String(limit ?? fallback), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function nullableString(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeDate(value) {
  if (value === undefined) return undefined;
  const normalized = nullableString(value);
  if (!normalized) return null;
  return new Date(normalized);
}

function normalizeEmployeePayload(data) {
  return {
    ...data,
    firstName: data.firstName?.trim(),
    lastName: data.lastName?.trim(),
    employeeCode: nullableString(data.employeeCode),
    userProfileId: data.userProfileId ?? undefined,
    supervisorEmployeeId: data.supervisorEmployeeId ?? undefined,
    departmentId: data.departmentId ?? undefined,
    jobTitleId: data.jobTitleId ?? undefined,
    profileImageFileId: data.profileImageFileId ?? undefined,
    workEmail: nullableString(data.workEmail),
    personalEmail: nullableString(data.personalEmail),
    phone: nullableString(data.phone),
    emergencyContactName: nullableString(data.emergencyContactName),
    emergencyContactPhone: nullableString(data.emergencyContactPhone),
    jobTitle: nullableString(data.jobTitle),
    department: nullableString(data.department),
    managerName: nullableString(data.managerName),
    employmentType: nullableString(data.employmentType),
    workLocation: nullableString(data.workLocation),
    notesMarkdown: nullableString(data.notesMarkdown),
    hireDate: normalizeDate(data.hireDate),
    terminationDate: normalizeDate(data.terminationDate),
  };
}

function buildSearchWhere(search) {
  const query = String(search ?? "").trim();
  if (!query) return {};
  return {
    OR: [
      { firstName: { contains: query, mode: "insensitive" } },
      { lastName: { contains: query, mode: "insensitive" } },
      { employeeCode: { contains: query, mode: "insensitive" } },
      { workEmail: { contains: query, mode: "insensitive" } },
      { personalEmail: { contains: query, mode: "insensitive" } },
      { jobTitle: { contains: query, mode: "insensitive" } },
      { department: { contains: query, mode: "insensitive" } },
      { notesMarkdown: { contains: query, mode: "insensitive" } },
    ],
  };
}

function mapCatalogPayload(payload) {
  return {
    name: payload.name.trim(),
    description: nullableString(payload.description),
  };
}

export function createHrService({ prisma }) {
  async function getUserContext(authUserId) {
    const profile = await prisma.userProfile.findUnique({
      where: { authUserId },
      select: { id: true },
    });
    if (!profile) {
      throw new HrServiceError("Perfil de usuario no encontrado.", 404);
    }

    const membership = await prisma.membership.findFirst({
      where: { userId: profile.id, enabled: true },
      orderBy: { createdAt: "desc" },
      select: { companyId: true },
    });
    if (!membership?.companyId) {
      throw new HrServiceError("No tienes una empresa activa para RH.", 403);
    }

    return {
      actorId: profile.id,
      companyId: membership.companyId,
    };
  }

  async function assertEmployee({ id, companyId }) {
    const row = await prisma.hrEmployee.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!row) {
      throw new HrServiceError("Colaborador no encontrado.", 404);
    }
  }

  async function assertDepartment({ id, companyId }) {
    if (!id) return;
    const row = await prisma.hrDepartment.findFirst({
      where: { id, companyId },
      select: { id: true, enabled: true },
    });
    if (!row) {
      throw new HrServiceError("Departamento no encontrado.", 404);
    }
    if (!row.enabled) {
      throw new HrServiceError(
        "El departamento seleccionado est� deshabilitado.",
        400,
      );
    }
  }

  async function assertJobTitle({ id, companyId }) {
    if (!id) return;
    const row = await prisma.hrJobTitle.findFirst({
      where: { id, companyId },
      select: { id: true, enabled: true },
    });
    if (!row) {
      throw new HrServiceError("Puesto no encontrado.", 404);
    }
    if (!row.enabled) {
      throw new HrServiceError(
        "El puesto seleccionado est� deshabilitado.",
        400,
      );
    }
  }

  async function assertSupervisor({
    supervisorEmployeeId,
    companyId,
    currentEmployeeId = null,
  }) {
    if (!supervisorEmployeeId) return;
    if (currentEmployeeId && supervisorEmployeeId === currentEmployeeId) {
      throw new HrServiceError(
        "Un colaborador no puede ser su propio supervisor.",
        400,
      );
    }
    const row = await prisma.hrEmployee.findFirst({
      where: { id: supervisorEmployeeId, companyId, enabled: true },
      select: { id: true },
    });
    if (!row) {
      throw new HrServiceError(
        "Supervisor no encontrado en la empresa activa.",
        404,
      );
    }
  }

  async function assertProfileImage({ profileImageFileId, companyId }) {
    if (!profileImageFileId) return;
    const file = await prisma.fileAsset.findFirst({
      where: {
        id: profileImageFileId,
        enabled: true,
        OR: [
          { moduleKey: "atlas.hr", entityType: "HrEmployee" },
          {
            moduleKey: "atlas.company",
            entityType: "BrandingConfig",
            entityId: companyId,
          },
        ],
      },
      select: { id: true, mimeType: true },
    });
    if (!file) {
      throw new HrServiceError(
        "La imagen de perfil no es v�lida para RH.",
        400,
      );
    }
    if (!file.mimeType?.startsWith("image/")) {
      throw new HrServiceError(
        "La imagen de perfil debe ser un archivo de imagen.",
        400,
      );
    }
  }

  async function assertUserLinkEligibility({
    companyId,
    userProfileId,
    currentEmployeeId = null,
  }) {
    if (
      userProfileId === undefined ||
      userProfileId === null ||
      !String(userProfileId).trim()
    ) {
      return;
    }

    const membership = await prisma.membership.findFirst({
      where: { companyId, userId: userProfileId, enabled: true },
      select: { id: true },
    });
    if (!membership) {
      throw new HrServiceError(
        "La cuenta seleccionada no pertenece a la empresa activa.",
        400,
      );
    }

    const linked = await prisma.hrEmployee.findFirst({
      where: {
        userProfileId,
        ...(currentEmployeeId ? { id: { not: currentEmployeeId } } : {}),
      },
      select: { id: true },
    });
    if (linked) {
      throw new HrServiceError(
        "La cuenta de usuario ya est� vinculada a otro colaborador.",
        409,
      );
    }
  }

  async function assertNoHierarchyCycle({
    employeeId,
    supervisorEmployeeId,
    companyId,
  }) {
    if (!supervisorEmployeeId || !employeeId) return;
    let cursor = supervisorEmployeeId;
    const visited = new Set();
    while (cursor) {
      if (cursor === employeeId) {
        throw new HrServiceError(
          "La jerarqu�a propuesta genera un ciclo de supervisi�n.",
          409,
        );
      }
      if (visited.has(cursor)) {
        break;
      }
      visited.add(cursor);
      const next = await prisma.hrEmployee.findFirst({
        where: { id: cursor, companyId },
        select: { supervisorEmployeeId: true },
      });
      cursor = next?.supervisorEmployeeId ?? null;
    }
  }

  async function logAudit({
    actorId,
    entityId,
    action,
    before,
    after,
    metadata,
  }) {
    await prisma.auditLog.create({
      data: {
        actorId,
        moduleKey: "atlas.hr",
        entityType: "HrEmployee",
        entityId,
        action,
        before,
        after,
        metadata,
      },
    });
  }

  return {
    async listEmployees({ authUserId, search, status, enabled, limit }) {
      const { companyId } = await getUserContext(authUserId);
      const take = normalizeLimit(limit);
      return prisma.hrEmployee.findMany({
        where: {
          companyId,
          ...(enabled === undefined ? {} : { enabled: Boolean(enabled) }),
          ...(status ? { status } : {}),
          ...buildSearchWhere(search),
        },
        include: {
          supervisor: { select: { id: true, firstName: true, lastName: true } },
          departmentRef: { select: { id: true, name: true } },
          jobTitleRef: { select: { id: true, name: true } },
          userProfile: { select: { id: true, displayName: true, email: true } },
        },
        orderBy: [{ updatedAt: "desc" }],
        take,
      });
    },

    async getEmployee({ authUserId, id }) {
      const { companyId } = await getUserContext(authUserId);
      const row = await prisma.hrEmployee.findFirst({
        where: { id, companyId },
        include: {
          supervisor: { select: { id: true, firstName: true, lastName: true } },
          reportees: {
            where: { enabled: true },
            select: { id: true, firstName: true, lastName: true, status: true },
            orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
          },
          departmentRef: { select: { id: true, name: true } },
          jobTitleRef: { select: { id: true, name: true } },
          userProfile: { select: { id: true, displayName: true, email: true } },
        },
      });
      if (!row) {
        throw new HrServiceError("Colaborador no encontrado.", 404);
      }
      return row;
    },

    async createEmployee({ authUserId, payload }) {
      const { actorId, companyId } = await getUserContext(authUserId);
      const parsed = hrEmployeeCreateSchema.parse(payload);
      const normalized = normalizeEmployeePayload(parsed);

      await assertUserLinkEligibility({
        companyId,
        userProfileId: normalized.userProfileId ?? null,
      });
      await assertSupervisor({
        supervisorEmployeeId: normalized.supervisorEmployeeId,
        companyId,
      });
      await assertDepartment({ id: normalized.departmentId, companyId });
      await assertJobTitle({ id: normalized.jobTitleId, companyId });
      await assertProfileImage({
        profileImageFileId: normalized.profileImageFileId,
        companyId,
      });

      const created = await prisma.hrEmployee.create({
        data: {
          ...normalized,
          companyId,
        },
      });

      await logAudit({
        actorId,
        entityId: created.id,
        action: "hr.employee.create",
        before: null,
        after: created,
        metadata: { source: "api" },
      });
      return created;
    },

    async updateEmployee({ authUserId, id, payload }) {
      const { actorId, companyId } = await getUserContext(authUserId);
      await assertEmployee({ id, companyId });
      const before = await prisma.hrEmployee.findUnique({ where: { id } });
      const parsed = hrEmployeeUpdateSchema.parse(payload);
      const normalized = normalizeEmployeePayload(parsed);

      await assertUserLinkEligibility({
        companyId,
        userProfileId: normalized.userProfileId,
        currentEmployeeId: id,
      });
      await assertSupervisor({
        supervisorEmployeeId: normalized.supervisorEmployeeId,
        companyId,
        currentEmployeeId: id,
      });
      await assertNoHierarchyCycle({
        employeeId: id,
        supervisorEmployeeId: normalized.supervisorEmployeeId,
        companyId,
      });
      await assertDepartment({ id: normalized.departmentId, companyId });
      await assertJobTitle({ id: normalized.jobTitleId, companyId });
      await assertProfileImage({
        profileImageFileId: normalized.profileImageFileId,
        companyId,
      });

      const updated = await prisma.hrEmployee.update({
        where: { id },
        data: normalized,
      });
      await logAudit({
        actorId,
        entityId: id,
        action: "hr.employee.update",
        before,
        after: updated,
        metadata: { source: "api" },
      });
      return updated;
    },

    async setEmployeeEnabled({ authUserId, id, enabled }) {
      const { actorId, companyId } = await getUserContext(authUserId);
      await assertEmployee({ id, companyId });
      const before = await prisma.hrEmployee.findUnique({ where: { id } });
      const updated = await prisma.hrEmployee.update({
        where: { id },
        data: { enabled: Boolean(enabled) },
      });
      await logAudit({
        actorId,
        entityId: id,
        action: updated.enabled ? "hr.employee.enable" : "hr.employee.disable",
        before,
        after: updated,
        metadata: { source: "api" },
      });
      return updated;
    },

    async getEmployeeAudit({ authUserId, id, limit }) {
      const { companyId } = await getUserContext(authUserId);
      await assertEmployee({ id, companyId });
      const take = normalizeLimit(limit, 50, 200);
      return prisma.auditLog.findMany({
        where: {
          moduleKey: "atlas.hr",
          entityType: "HrEmployee",
          entityId: id,
        },
        include: {
          actor: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take,
      });
    },

    async listUserOptions({ authUserId, search, limit }) {
      const { companyId } = await getUserContext(authUserId);
      const take = normalizeLimit(limit, 40, 100);
      const query = String(search ?? "").trim();
      const memberships = await prisma.membership.findMany({
        where: {
          companyId,
          enabled: true,
          user: {
            enabled: true,
            ...(query
              ? {
                  OR: [
                    { displayName: { contains: query, mode: "insensitive" } },
                    { email: { contains: query, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
        },
        select: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
        take,
      });

      return memberships
        .map((m) => m.user)
        .filter(Boolean)
        .map((user) => ({
          id: user.id,
          label: user.displayName || user.email,
          email: user.email,
        }));
    },

    async listDepartments({ authUserId, search, enabled, limit }) {
      const { companyId } = await getUserContext(authUserId);
      const take = normalizeLimit(limit, 100, 300);
      const query = String(search ?? "").trim();
      return prisma.hrDepartment.findMany({
        where: {
          companyId,
          ...(enabled === undefined ? {} : { enabled: Boolean(enabled) }),
          ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
        },
        orderBy: [{ name: "asc" }],
        take,
      });
    },

    async createDepartment({ authUserId, payload }) {
      const { companyId } = await getUserContext(authUserId);
      const parsed = hrCatalogCreateSchema.parse(payload);
      const data = mapCatalogPayload(parsed);

      try {
        return await prisma.hrDepartment.create({
          data: {
            companyId,
            ...data,
          },
        });
      } catch (error) {
        if (error?.code === "P2002") {
          throw new HrServiceError(
            "Ya existe un departamento con ese nombre.",
            409,
          );
        }
        throw error;
      }
    },

    async updateDepartment({ authUserId, id, payload }) {
      const { companyId } = await getUserContext(authUserId);
      const parsed = hrCatalogUpdateSchema.parse(payload);
      const data = mapCatalogPayload(parsed);

      const current = await prisma.hrDepartment.findFirst({
        where: { id, companyId },
        select: { id: true },
      });
      if (!current) {
        throw new HrServiceError("Departamento no encontrado.", 404);
      }

      try {
        return await prisma.hrDepartment.update({
          where: { id },
          data,
        });
      } catch (error) {
        if (error?.code === "P2002") {
          throw new HrServiceError(
            "Ya existe un departamento con ese nombre.",
            409,
          );
        }
        throw error;
      }
    },

    async setDepartmentEnabled({ authUserId, id, enabled }) {
      const { companyId } = await getUserContext(authUserId);
      const parsed = hrCatalogEnabledSchema.parse({ enabled });
      const current = await prisma.hrDepartment.findFirst({
        where: { id, companyId },
        select: { id: true },
      });
      if (!current) {
        throw new HrServiceError("Departamento no encontrado.", 404);
      }
      return prisma.hrDepartment.update({
        where: { id },
        data: { enabled: parsed.enabled },
      });
    },

    async listJobTitles({ authUserId, search, enabled, limit }) {
      const { companyId } = await getUserContext(authUserId);
      const take = normalizeLimit(limit, 100, 300);
      const query = String(search ?? "").trim();
      return prisma.hrJobTitle.findMany({
        where: {
          companyId,
          ...(enabled === undefined ? {} : { enabled: Boolean(enabled) }),
          ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
        },
        orderBy: [{ name: "asc" }],
        take,
      });
    },

    async createJobTitle({ authUserId, payload }) {
      const { companyId } = await getUserContext(authUserId);
      const parsed = hrCatalogCreateSchema.parse(payload);
      const data = mapCatalogPayload(parsed);

      try {
        return await prisma.hrJobTitle.create({
          data: {
            companyId,
            ...data,
          },
        });
      } catch (error) {
        if (error?.code === "P2002") {
          throw new HrServiceError("Ya existe un puesto con ese nombre.", 409);
        }
        throw error;
      }
    },

    async updateJobTitle({ authUserId, id, payload }) {
      const { companyId } = await getUserContext(authUserId);
      const parsed = hrCatalogUpdateSchema.parse(payload);
      const data = mapCatalogPayload(parsed);

      const current = await prisma.hrJobTitle.findFirst({
        where: { id, companyId },
        select: { id: true },
      });
      if (!current) {
        throw new HrServiceError("Puesto no encontrado.", 404);
      }

      try {
        return await prisma.hrJobTitle.update({
          where: { id },
          data,
        });
      } catch (error) {
        if (error?.code === "P2002") {
          throw new HrServiceError("Ya existe un puesto con ese nombre.", 409);
        }
        throw error;
      }
    },

    async setJobTitleEnabled({ authUserId, id, enabled }) {
      const { companyId } = await getUserContext(authUserId);
      const parsed = hrCatalogEnabledSchema.parse({ enabled });
      const current = await prisma.hrJobTitle.findFirst({
        where: { id, companyId },
        select: { id: true },
      });
      if (!current) {
        throw new HrServiceError("Puesto no encontrado.", 404);
      }
      return prisma.hrJobTitle.update({
        where: { id },
        data: { enabled: parsed.enabled },
      });
    },

    async getOrgChart({ authUserId, rootEmployeeId = null, enabled = true }) {
      const { companyId } = await getUserContext(authUserId);
      const employees = await prisma.hrEmployee.findMany({
        where: {
          companyId,
          ...(enabled === undefined ? {} : { enabled: Boolean(enabled) }),
        },
        select: {
          id: true,
          employeeCode: true,
          userProfileId: true,
          firstName: true,
          lastName: true,
          status: true,
          supervisorEmployeeId: true,
          departmentId: true,
          jobTitleId: true,
          profileImageFileId: true,
          departmentRef: { select: { id: true, name: true } },
          jobTitleRef: { select: { id: true, name: true } },
          userProfile: {
            select: { id: true, displayName: true, avatarFileId: true },
          },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      });

      const childrenByParent = new Map();
      for (const employee of employees) {
        const key = employee.supervisorEmployeeId ?? "__root__";
        if (!childrenByParent.has(key)) {
          childrenByParent.set(key, []);
        }
        childrenByParent.get(key).push(employee);
      }

      const buildNode = (employee) => ({
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName}`.trim(),
        employeeCode: employee.employeeCode ?? null,
        userProfileId: employee.userProfileId ?? null,
        linkedUser: employee.userProfile
          ? {
              id: employee.userProfile.id,
              displayName: employee.userProfile.displayName,
              avatarFileId: employee.userProfile.avatarFileId ?? null,
            }
          : null,
        status: employee.status,
        department: employee.departmentRef?.name ?? null,
        jobTitle: employee.jobTitleRef?.name ?? null,
        profileImageFileId: employee.profileImageFileId ?? null,
        children: (childrenByParent.get(employee.id) ?? []).map(buildNode),
      });

      if (rootEmployeeId) {
        const root = employees.find(
          (employee) => employee.id === rootEmployeeId,
        );
        if (!root) {
          throw new HrServiceError(
            "Colaborador ra�z no encontrado para organigrama.",
            404,
          );
        }
        return {
          roots: [buildNode(root)],
          totalNodes: employees.length,
        };
      }

      const roots = (childrenByParent.get("__root__") ?? []).map(buildNode);
      return {
        roots,
        totalNodes: employees.length,
      };
    },
  };
}

export { HrServiceError };
