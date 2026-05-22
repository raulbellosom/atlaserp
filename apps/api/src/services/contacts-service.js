import { contactCreateSchema } from "@atlas/validators";

class ContactsServiceError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = "ContactsServiceError";
    this.status = status;
  }
}

function buildSearchWhere(search) {
  const query = String(search ?? "").trim();
  if (!query) return {};
  return {
    OR: [
      { name: { contains: query, mode: "insensitive" } },
      { legalName: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { phone: { contains: query, mode: "insensitive" } },
      { taxId: { contains: query, mode: "insensitive" } },
      { notesMarkdown: { contains: query, mode: "insensitive" } },
    ],
  };
}

function normalizeLimit(limit, fallback = 50, max = 100) {
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

function normalizeContactPayload(data) {
  return {
    ...data,
    legalName: nullableString(data.legalName),
    email: nullableString(data.email),
    phone: nullableString(data.phone),
    taxId: nullableString(data.taxId),
    notesMarkdown: nullableString(data.notesMarkdown),
  };
}

export function createContactsService({ prisma }) {
  async function getCompanyContext(authUserId) {
    const profile = await prisma.userProfile.findUnique({
      where: { authUserId },
      select: { id: true },
    });

    if (!profile) {
      throw new ContactsServiceError("Perfil de usuario no encontrado.", 404);
    }

    const membership = await prisma.membership.findFirst({
      where: { userId: profile.id, enabled: true },
      orderBy: { createdAt: "desc" },
      select: { companyId: true },
    });

    if (!membership?.companyId) {
      throw new ContactsServiceError(
        "No tienes una empresa activa para gestionar contactos.",
        403,
      );
    }

    return membership.companyId;
  }

  async function assertContactOwnership({ id, companyId }) {
    const existing = await prisma.contact.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!existing) {
      throw new ContactsServiceError("Contacto no encontrado.", 404);
    }
  }

  return {
    async list({ authUserId, search, page, pageSize, sortBy, sortDir }) {
      const companyId = await getCompanyContext(authUserId);
      const parsedPage = Math.max(1, Number.parseInt(String(page ?? 1), 10) || 1);
      const parsedPageSize = Math.min(200, Math.max(1, Number.parseInt(String(pageSize ?? 20), 10) || 20));
      const where = {
        companyId,
        enabled: true,
        ...buildSearchWhere(search),
      };
      const SORT_FIELDS = { name: "name", type: "type", email: "email", phone: "phone", taxId: "taxId" };
      const dir = sortDir === "desc" ? "desc" : "asc";
      const orderBy = sortBy && SORT_FIELDS[sortBy]
        ? { [SORT_FIELDS[sortBy]]: dir }
        : { createdAt: "desc" };
      const [contacts, total] = await Promise.all([
        prisma.contact.findMany({
          where,
          orderBy,
          take: parsedPageSize,
          skip: (parsedPage - 1) * parsedPageSize,
        }),
        prisma.contact.count({ where }),
      ]);
      return { rows: contacts, total, page: parsedPage, pageSize: parsedPageSize };
    },

    async create({ authUserId, payload }) {
      const companyId = await getCompanyContext(authUserId);
      const data = contactCreateSchema.parse(payload);
      return prisma.contact.create({
        data: {
          ...normalizeContactPayload(data),
          companyId,
        },
      });
    },

    async update({ authUserId, id, payload }) {
      const companyId = await getCompanyContext(authUserId);
      await assertContactOwnership({ id, companyId });
      const data = contactCreateSchema.partial().parse(payload);
      return prisma.contact.update({
        where: { id },
        data: normalizeContactPayload(data),
      });
    },

    async setEnabled({ authUserId, id, enabled }) {
      const companyId = await getCompanyContext(authUserId);
      await assertContactOwnership({ id, companyId });
      return prisma.contact.update({
        where: { id },
        data: { enabled: Boolean(enabled) },
      });
    },

    async delete({ authUserId, id }) {
      const companyId = await getCompanyContext(authUserId);
      await assertContactOwnership({ id, companyId });
      await prisma.contact.delete({ where: { id } });
    },

    async picker({ authUserId, query, limit }) {
      const companyId = await getCompanyContext(authUserId);
      const take = normalizeLimit(limit, 12, 30);
      const contacts = await prisma.contact.findMany({
        where: {
          companyId,
          enabled: true,
          ...buildSearchWhere(query),
        },
        orderBy: [{ name: "asc" }, { createdAt: "desc" }],
        take,
        select: {
          id: true,
          type: true,
          name: true,
          legalName: true,
          email: true,
          phone: true,
          taxId: true,
        },
      });

      return contacts.map((contact) => ({
        id: contact.id,
        type: contact.type,
        name: contact.name,
        legalName: contact.legalName,
        email: contact.email,
        phone: contact.phone,
        taxId: contact.taxId,
      }));
    },
  };
}

export { ContactsServiceError };
