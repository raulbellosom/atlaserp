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
    {
      label: "Contactos",
      path: "/contacts",
      icon: "Contact",
      layout: "main",
      permissionKey: "contacts.read",
    },
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
  acl: {
    module: "contacts.read",
    actions: {
      "contacts.list": "contacts.read",
      "contacts.picker": "contacts.read",
      "contacts.create": "contacts.create",
      "contacts.update": "contacts.update",
      "contacts.enabled": "contacts.update",
      "contacts.delete": "contacts.delete",
    },
    models: {
      Contact: {
        read: "contacts.read",
        create: "contacts.create",
        update: "contacts.update",
        delete: "contacts.delete",
      },
    },
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
    {
      label: "Resumen",
      path: "/finance",
      icon: "Wallet",
      layout: "main",
      permissionKey: "finance.read",
    },
    {
      label: "CxC",
      path: "/finance/ar",
      icon: "HandCoins",
      layout: "main",
      permissionKey: "finance.read",
    },
    {
      label: "CxP",
      path: "/finance/ap",
      icon: "Receipt",
      layout: "main",
      permissionKey: "finance.read",
    },
    {
      label: "Aging",
      path: "/finance/aging",
      icon: "CalendarDays",
      layout: "main",
      permissionKey: "finance.read",
    },
    {
      label: "Aplicaciones",
      path: "/finance/applications",
      icon: "ArrowRightLeft",
      layout: "main",
      permissionKey: "finance.read",
    },
    {
      label: "Cuentas",
      path: "/finance/accounts",
      icon: "ListTree",
      layout: "main",
      permissionKey: "finance.read",
    },
    {
      label: "Polizas",
      path: "/finance/entries",
      icon: "NotebookPen",
      layout: "main",
      permissionKey: "finance.read",
    },
    {
      label: "Impuestos",
      path: "/finance/taxes",
      icon: "FileText",
      layout: "main",
      permissionKey: "finance.read",
    },
    {
      label: "Tipo de cambio",
      path: "/finance/fx-rates",
      icon: "TrendingUp",
      layout: "main",
      permissionKey: "finance.read",
    },
  ],
  permissions: [
    { key: "finance.read", name: "Read Finance" },
    { key: "finance.create", name: "Create Finance Records" },
    { key: "finance.update", name: "Update Finance Records" },
    { key: "finance.delete", name: "Delete Finance Records" },
  ],
  acl: {
    module: "finance.read",
    actions: {
      "finance.read": "finance.read",
      "finance.create": "finance.create",
      "finance.update": "finance.update",
      "finance.delete": "finance.delete",
    },
    models: {
      FinanceAccount: {
        read: "finance.read",
        create: "finance.create",
        update: "finance.update",
        delete: "finance.delete",
      },
      FinanceJournalEntry: {
        read: "finance.read",
        create: "finance.create",
        update: "finance.update",
        delete: "finance.delete",
      },
      FinanceDocument: {
        read: "finance.read",
        create: "finance.create",
        update: "finance.update",
        delete: "finance.delete",
      },
    },
  },
});

export const hrMap = createModuleManifest({
  key: "atlas.hr",
  name: "Recursos Humanos",
  description: "Colaboradores, notas internas y expedientes.",
  version: "0.1.0",
  icon: "UsersRound",
  color: "#2563eb",
  category: "operaciones",
  summary: "GestiÃ³n de personal y expediente",
  dependencies: [{ key: "atlas.core" }, { key: "atlas.files", optional: true }],
  navigation: [
    {
      label: "Colaboradores",
      path: "/hr/employees",
      icon: "Users",
      layout: "main",
      permissionKey: "hr.read",
    },
    {
      label: "Organigrama",
      path: "/hr/org-chart",
      icon: "Network",
      layout: "main",
      permissionKey: "hr.read",
    },
  ],
  permissions: [
    { key: "hr.read", name: "Read HR" },
    { key: "hr.create", name: "Create HR Records" },
    { key: "hr.update", name: "Update HR Records" },
    { key: "hr.delete", name: "Delete HR Records" },
  ],
  acl: {
    module: "hr.read",
    actions: {
      "hr.read": "hr.read",
      "hr.create": "hr.create",
      "hr.update": "hr.update",
      "hr.delete": "hr.delete",
    },
    models: {
      HrEmployee: {
        read: "hr.read",
        create: "hr.create",
        update: "hr.update",
        delete: "hr.delete",
      },
      HrDepartment: {
        read: "hr.read",
        create: "hr.create",
        update: "hr.update",
        delete: "hr.delete",
      },
      HrJobTitle: {
        read: "hr.read",
        create: "hr.create",
        update: "hr.update",
        delete: "hr.delete",
      },
    },
  },
  blueprints: [
    {
      key: "hr.employee.entity",
      kind: "ENTITY",
      version: "0.1.0",
      schema: {
        entity: "HrEmployee",
        label: "Colaborador",
        fields: [
          { name: "employeeCode", label: "Codigo", type: "text" },
          { name: "userProfileId", label: "Cuenta de usuario", type: "text" },
          { name: "firstName", label: "Nombre", type: "text", required: true },
          { name: "lastName", label: "Apellidos", type: "text", required: true },
          { name: "workEmail", label: "Correo laboral", type: "email" },
          { name: "personalEmail", label: "Correo personal", type: "email" },
          { name: "phone", label: "TelÃ©fono", type: "phone" },
          { name: "emergencyContactName", label: "Contacto de emergencia", type: "text" },
          { name: "emergencyContactPhone", label: "Telefono de emergencia", type: "phone" },
          { name: "jobTitle", label: "Puesto", type: "text" },
          { name: "department", label: "Departamento", type: "text" },
          { name: "managerName", label: "Supervisor", type: "text" },
          {
            name: "employmentType",
            label: "Tipo de empleo",
            type: "select",
            options: ["full_time", "part_time", "contractor", "intern"],
          },
          { name: "workLocation", label: "Ubicacion de trabajo", type: "text" },
          { name: "terminationDate", label: "Fecha de baja", type: "text" },
          {
            name: "status",
            label: "Estado",
            type: "select",
            options: ["active", "inactive", "vacation", "terminated"],
            required: true,
          },
          { name: "notesMarkdown", label: "Notas", type: "markdown" },
        ],
      },
    },
  ],
});

export const featureModules = [contactsMap, financeMap, hrMap];
