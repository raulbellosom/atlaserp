import { DocumentProviderError } from "../document-provider-registry.js";

const growthLeadSchema = {
  sourceType: "growth.lead",
  fields: [
    { path: "lead.id", label: "ID del lead", type: "string" },
    { path: "lead.status", label: "Estado", type: "string" },
    { path: "lead.priority", label: "Prioridad", type: "string" },
    { path: "lead.name", label: "Nombre", type: "string" },
    { path: "lead.email", label: "Correo", type: "string" },
    { path: "lead.phone", label: "Telefono", type: "string" },
    { path: "lead.companyName", label: "Empresa", type: "string" },
    { path: "lead.message", label: "Mensaje", type: "string" },
    { path: "lead.source", label: "Origen", type: "string" },
    { path: "lead.firstSubmissionAt", label: "Primer envio", type: "datetime" },
    { path: "lead.lastSubmissionAt", label: "Ultimo envio", type: "datetime" },
    { path: "lead.qualifiedAt", label: "Fecha de calificacion", type: "datetime" },
    { path: "lead.convertedAt", label: "Fecha de conversion", type: "datetime" },
    { path: "attribution.source", label: "Fuente", type: "string" },
    { path: "attribution.medium", label: "Medio", type: "string" },
    { path: "attribution.campaign", label: "Campana", type: "string" },
    { path: "contact.id", label: "ID del contacto", type: "string" },
    { path: "contact.name", label: "Contacto", type: "string" },
    { path: "contact.email", label: "Correo del contacto", type: "string" },
    { path: "contact.phone", label: "Telefono del contacto", type: "string" },
    { path: "summary.submissionCount", label: "Numero de envios", type: "number" },
  ],
  collections: [
    {
      path: "submissions",
      label: "Envios de formulario",
      fields: [
        { path: "id", label: "ID", type: "string" },
        { path: "formId", label: "ID del formulario", type: "string" },
        { path: "formName", label: "Formulario", type: "string" },
        { path: "submittedAt", label: "Fecha", type: "datetime" },
      ],
    },
  ],
};

const leadSelect = {
  id: true,
  companyId: true,
  status: true,
  priority: true,
  name: true,
  email: true,
  phone: true,
  companyName: true,
  message: true,
  source: true,
  attribution: true,
  contactId: true,
  firstSubmissionAt: true,
  lastSubmissionAt: true,
  qualifiedAt: true,
  convertedAt: true,
};

export function createGrowthLeadDocumentProvider({ prisma }) {
  return {
    sourceType: "growth.lead",
    permissionKey: "growth.leads.read",

    getSchema() {
      return growthLeadSchema;
    },

    async load({ companyId, sourceId }) {
      const lead = await prisma.growthLead.findFirst({
        where: {
          id: sourceId,
          companyId,
          enabled: true,
        },
        select: leadSelect,
      });
      if (!lead) {
        throw new DocumentProviderError(
          "Lead no encontrado.",
          404,
          "source_not_found",
        );
      }

      const contact = lead.contactId
        ? await prisma.contact.findFirst({
            where: {
              id: lead.contactId,
              companyId,
              enabled: true,
            },
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          })
        : null;

      const submissions = await prisma.websiteFormSubmission.findMany({
        where: {
          companyId,
          leadId: sourceId,
        },
        orderBy: { submittedAt: "asc" },
        select: {
          id: true,
          formId: true,
          submittedAt: true,
          form: {
            select: {
              name: true,
            },
          },
        },
      });

      const {
        attribution,
        contactId,
        companyId: ignoredCompanyId,
        ...safeLead
      } = lead;
      void contactId;
      void ignoredCompanyId;

      return {
        lead: safeLead,
        attribution:
          attribution && typeof attribution === "object" ? attribution : {},
        contact,
        summary: {
          submissionCount: submissions.length,
        },
        submissions: submissions.map((submission) => ({
          id: submission.id,
          formId: submission.formId,
          formName: submission.form?.name ?? null,
          submittedAt: submission.submittedAt,
        })),
      };
    },
  };
}
