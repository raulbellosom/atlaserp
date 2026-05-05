export const TYPE_OPTIONS = [
  { value: "customer", label: "Cliente" },
  { value: "supplier", label: "Proveedor" },
  { value: "person", label: "Persona" },
  { value: "company", label: "Empresa" },
];

export const TYPE_VARIANT = {
  customer: "success",
  supplier: "glass",
  person: "secondary",
  company: "outline",
};

export const TYPE_LABEL = {
  customer: "Cliente",
  supplier: "Proveedor",
  person: "Persona",
  company: "Empresa",
};

// Avatar color per type (bg + text)
export const TYPE_AVATAR_COLORS = {
  customer: {
    bg: "bg-emerald-500/15 dark:bg-emerald-400/20",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  supplier: {
    bg: "bg-blue-500/15 dark:bg-blue-400/20",
    text: "text-blue-700 dark:text-blue-300",
  },
  person: {
    bg: "bg-violet-500/15 dark:bg-violet-400/20",
    text: "text-violet-700 dark:text-violet-300",
  },
  company: {
    bg: "bg-amber-500/15 dark:bg-amber-400/20",
    text: "text-amber-700 dark:text-amber-300",
  },
};

export const CONTACTS_BLUEPRINT_FALLBACK = {
  key: "contacts.contact.entity",
  schema: {
    fields: [
      {
        name: "type",
        label: "Tipo de contacto",
        type: "select",
        required: true,
        options: TYPE_OPTIONS.map((o) => o.value),
      },
      { name: "name", label: "Nombre", type: "text", required: true },
      { name: "legalName", label: "Nombre legal", type: "text" },
      { name: "email", label: "Correo electronico", type: "email" },
      { name: "phone", label: "Telefono", type: "phone" },
      { name: "taxId", label: "RFC / Identificador fiscal", type: "text" },
      {
        name: "notesMarkdown",
        label: "Observaciones",
        type: "markdown",
        maxLength: 5000,
      },
    ],
  },
};
