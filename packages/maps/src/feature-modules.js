import { createModuleManifest } from "@atlas/core";

export const contactsMap = createModuleManifest({
  key: "atlas.contacts",
  name: "Contactos",
  description: "Clientes, proveedores, personas y empresas.",
  version: "0.1.0",
  icon: "ContactRound",
  color: "#0ea5e9",
  category: "operaciones",
  summary: "Clientes, proveedores, personas y empresas",
  dependencies: [{ key: "atlas.core" }, { key: "atlas.identity" }],
  navigation: [
    { label: "Contactos", path: "/contacts", icon: "Contact", layout: "main" },
  ],
  permissions: [
    { key: "contacts.read", name: "Read Contacts" },
    { key: "contacts.create", name: "Create Contacts" },
    { key: "contacts.update", name: "Update Contacts" },
    { key: "contacts.delete", name: "Delete Contacts" },
  ],
  exposes: {
    contactPicker: true,
    getContactById: true,
  },
  blueprints: [
    {
      key: "contacts.contact.entity",
      kind: "ENTITY",
      version: "0.1.0",
      schema: {
        entity: "Contact",
        label: "Contacto",
        fields: [
          {
            name: "type",
            label: "Tipo",
            type: "select",
            options: ["customer", "supplier", "person", "company"],
            required: true,
          },
          { name: "name", label: "Nombre", type: "text", required: true },
          { name: "legalName", label: "Nombre legal", type: "text" },
          { name: "email", label: "Correo", type: "email" },
          { name: "phone", label: "Telefono", type: "phone" },
          { name: "taxId", label: "RFC / Tax ID", type: "text" },
          {
            name: "notesMarkdown",
            label: "Observaciones",
            type: "markdown",
            maxLength: 5000,
          },
        ],
        table: { columns: ["type", "name", "email", "phone", "taxId"] },
      },
    },
  ],
});

export const financeMap = createModuleManifest({
  key: "atlas.finance",
  name: "Finanzas",
  description: "Cuentas, movimientos, ingresos, egresos y conciliacion basica.",
  version: "0.1.0",
  icon: "Landmark",
  color: "#10b981",
  category: "contabilidad",
  summary: "Cuentas, movimientos, ingresos y egresos",
  dependencies: [
    { key: "atlas.core" },
    { key: "atlas.contacts", optional: true },
  ],
  navigation: [
    { label: "Resumen", path: "/finance", icon: "Wallet", layout: "main" },
    { label: "CxC", path: "/finance/ar", icon: "HandCoins", layout: "main" },
    { label: "CxP", path: "/finance/ap", icon: "Receipt", layout: "main" },
    {
      label: "Aging",
      path: "/finance/aging",
      icon: "CalendarDays",
      layout: "main",
    },
    {
      label: "Aplicaciones",
      path: "/finance/applications",
      icon: "ArrowRightLeft",
      layout: "main",
    },
    {
      label: "Cuentas",
      path: "/finance/accounts",
      icon: "ListTree",
      layout: "main",
    },
    {
      label: "Polizas",
      path: "/finance/entries",
      icon: "NotebookPen",
      layout: "main",
    },
    {
      label: "Impuestos",
      path: "/finance/taxes",
      icon: "FileText",
      layout: "main",
    },
    {
      label: "Tipo de cambio",
      path: "/finance/fx-rates",
      icon: "TrendingUp",
      layout: "main",
    },
  ],
  permissions: [
    { key: "finance.read", name: "Read Finance" },
    { key: "finance.create", name: "Create Finance Records" },
    { key: "finance.update", name: "Update Finance Records" },
    { key: "finance.delete", name: "Delete Finance Records" },
  ],
});

export const featureModules = [contactsMap, financeMap];
