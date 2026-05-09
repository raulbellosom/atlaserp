const GROUPS = {
  core: "Core",
  identity: "Identidad",
  profile: "Perfil",
  files: "Archivos",
  company: "Empresa",
  contacts: "Contactos",
  finance: "Finanzas",
  hr: "Recursos Humanos",
  ledger: "Libro Auxiliar",
  audit: "Bitacora",
};

const MODULE_LABELS = {
  core: "Core",
  identity: "Identidad",
  profile: "Perfil",
  files: "Archivos",
  company: "Empresa",
  contacts: "Contactos",
  finance: "Finanzas",
  hr: "Recursos Humanos",
  ledger: "Libro Auxiliar",
  audit: "Bitacora",
};

const FEATURE_LABELS = {
  general: "General",
  accounts: "Cuentas del libro auxiliar",
  movements: "Movimientos",
  reports: "Reportes y exportacion",
  modules: "Modulos",
  instance: "Configuracion de instancia",
  users: "Usuarios",
  roles: "Roles",
  permissions: "Permisos",
  self: "Perfil propio",
  avatar: "Avatar",
  password: "Contrasena",
  assets: "Archivos",
  profile: "Perfil de empresa",
  address: "Direccion de empresa",
  branding: "Marca visual",
  contacts: "Contactos",
  ar: "Cuentas por cobrar",
  ap: "Cuentas por pagar",
  accounts: "Cuentas contables",
  entries: "Polizas",
  applications: "Aplicaciones de pago",
  tax_rates: "Impuestos",
  fx_rates: "Tipo de cambio",
  dashboard: "Resumen financiero",
  aging: "Aging",
  documents: "Documentos financieros",
  reminder: "Recordatorios",
  employee: "Colaboradores",
  department: "Departamentos",
  job_title: "Puestos",
  org_chart: "Organigrama",
};

const ACTION_LABELS = {
  read: "Ver",
  create: "Crear",
  update: "Editar",
  delete: "Eliminar",
  access: "Acceder",
  send: "Enviar",
  manage: "Administrar",
  reverse: "Revertir",
  cancel: "Cancelar",
  export: "Exportar",
};

export const PERMISSION_CATALOG = {
  "core.access": {
    displayNameEs: "Acceder a core",
    descriptionEs: "Permite entrar al modulo de core.",
    groupKey: "core",
    order: 10,
  },
  "core.read": {
    displayNameEs: "Ver configuracion general de core",
    descriptionEs: "Permite consultar informacion general del sistema.",
    groupKey: "core",
    order: 20,
  },
  "core.manage": {
    displayNameEs: "Administrar configuracion general de core",
    descriptionEs: "Permite gestionar ajustes generales del sistema.",
    groupKey: "core",
    order: 30,
  },
  "core.modules.read": {
    displayNameEs: "Ver catalogo de modulos de core",
    descriptionEs: "Permite consultar el catalogo administrativo de modulos.",
    groupKey: "core",
    order: 40,
  },
  "core.modules.create": {
    displayNameEs: "Instalar modulos desde core",
    descriptionEs: "Permite instalar modulos desde el catalogo administrativo.",
    groupKey: "core",
    order: 50,
  },
  "core.modules.update": {
    displayNameEs: "Actualizar estado de modulos de core",
    descriptionEs: "Permite habilitar o deshabilitar modulos existentes.",
    groupKey: "core",
    order: 60,
  },
  "core.modules.delete": {
    displayNameEs: "Desinstalar modulos desde core",
    descriptionEs: "Permite desinstalar modulos instalados.",
    groupKey: "core",
    order: 70,
  },
  "core.instance.read": {
    displayNameEs: "Ver configuracion de instancia",
    descriptionEs: "Permite consultar la configuracion de la instancia.",
    groupKey: "core",
    order: 80,
  },
  "core.instance.create": {
    displayNameEs: "Crear configuracion de instancia",
    descriptionEs: "Permite crear datos de configuracion de instancia.",
    groupKey: "core",
    order: 90,
  },
  "core.instance.update": {
    displayNameEs: "Editar configuracion de instancia",
    descriptionEs: "Permite actualizar la configuracion de instancia.",
    groupKey: "core",
    order: 100,
  },
  "core.instance.delete": {
    displayNameEs: "Eliminar configuracion de instancia",
    descriptionEs: "Permite eliminar configuracion de instancia registrada.",
    groupKey: "core",
    order: 110,
  },
  "audit.read": {
    displayNameEs: "Ver bitacora",
    descriptionEs: "Permite consultar eventos y cambios del sistema.",
    groupKey: "audit",
    order: 10,
  },

  "identity.access": {
    displayNameEs: "Acceder a identidad",
    descriptionEs: "Permite entrar al modulo de identidad.",
    groupKey: "identity",
    order: 10,
  },
  "identity.users.read": {
    displayNameEs: "Ver usuarios",
    descriptionEs: "Permite consultar usuarios de la instancia.",
    groupKey: "identity",
    order: 20,
  },
  "identity.users.create": {
    displayNameEs: "Crear usuarios",
    descriptionEs: "Permite registrar nuevos usuarios.",
    groupKey: "identity",
    order: 30,
  },
  "identity.users.update": {
    displayNameEs: "Editar usuarios",
    descriptionEs: "Permite actualizar datos y estado de usuarios.",
    groupKey: "identity",
    order: 40,
  },
  "identity.users.delete": {
    displayNameEs: "Eliminar usuarios",
    descriptionEs: "Permite eliminar usuarios.",
    groupKey: "identity",
    order: 50,
  },
  "identity.roles.read": {
    displayNameEs: "Ver roles",
    descriptionEs: "Permite consultar roles de la instancia.",
    groupKey: "identity",
    order: 60,
  },
  "identity.roles.create": {
    displayNameEs: "Crear roles",
    descriptionEs: "Permite crear roles nuevos.",
    groupKey: "identity",
    order: 70,
  },
  "identity.roles.update": {
    displayNameEs: "Editar roles",
    descriptionEs: "Permite actualizar datos y estado de roles.",
    groupKey: "identity",
    order: 80,
  },
  "identity.roles.delete": {
    displayNameEs: "Eliminar roles",
    descriptionEs: "Permite eliminar roles.",
    groupKey: "identity",
    order: 90,
  },
  "identity.permissions.read": {
    displayNameEs: "Ver permisos",
    descriptionEs: "Permite consultar el catalogo de permisos.",
    groupKey: "identity",
    order: 100,
  },
  "identity.permissions.create": {
    displayNameEs: "Crear permisos",
    descriptionEs: "Permite crear permisos.",
    groupKey: "identity",
    order: 110,
  },
  "identity.permissions.update": {
    displayNameEs: "Editar permisos",
    descriptionEs: "Permite actualizar permisos.",
    groupKey: "identity",
    order: 120,
  },
  "identity.permissions.delete": {
    displayNameEs: "Eliminar permisos",
    descriptionEs: "Permite eliminar permisos.",
    groupKey: "identity",
    order: 130,
  },
  "profile.self.read": {
    displayNameEs: "Ver perfil propio",
    descriptionEs: "Permite consultar su propio perfil.",
    groupKey: "profile",
    order: 10,
  },
  "profile.self.update": {
    displayNameEs: "Editar perfil propio",
    descriptionEs: "Permite actualizar su propio perfil.",
    groupKey: "profile",
    order: 20,
  },
  "profile.avatar.update": {
    displayNameEs: "Actualizar avatar propio",
    descriptionEs: "Permite cambiar su foto de perfil.",
    groupKey: "profile",
    order: 30,
  },
  "profile.password.update": {
    displayNameEs: "Actualizar contrasena propia",
    descriptionEs: "Permite cambiar su contrasena.",
    groupKey: "profile",
    order: 40,
  },

  "files.access": {
    displayNameEs: "Acceder a archivos",
    descriptionEs: "Permite entrar al modulo de archivos.",
    groupKey: "files",
    order: 10,
  },
  "files.assets.read": {
    displayNameEs: "Ver archivos",
    descriptionEs: "Permite consultar archivos y metadatos.",
    groupKey: "files",
    order: 20,
  },
  "files.assets.create": {
    displayNameEs: "Crear archivos",
    descriptionEs: "Permite subir y registrar archivos.",
    groupKey: "files",
    order: 30,
  },
  "files.assets.update": {
    displayNameEs: "Editar archivos",
    descriptionEs: "Permite renombrar o actualizar estado de archivos.",
    groupKey: "files",
    order: 40,
  },
  "files.assets.delete": {
    displayNameEs: "Eliminar archivos",
    descriptionEs: "Permite eliminar archivos.",
    groupKey: "files",
    order: 50,
  },

  "company.access": {
    displayNameEs: "Acceder a empresa",
    descriptionEs: "Permite entrar al modulo de empresa.",
    groupKey: "company",
    order: 10,
  },
  "company.profile.read": {
    displayNameEs: "Ver perfil de empresa",
    descriptionEs: "Permite consultar el perfil de la empresa.",
    groupKey: "company",
    order: 20,
  },
  "company.profile.create": {
    displayNameEs: "Crear perfil de empresa",
    descriptionEs: "Permite crear informacion de perfil de empresa.",
    groupKey: "company",
    order: 30,
  },
  "company.profile.update": {
    displayNameEs: "Editar perfil de empresa",
    descriptionEs: "Permite actualizar el perfil de empresa.",
    groupKey: "company",
    order: 40,
  },
  "company.profile.delete": {
    displayNameEs: "Eliminar perfil de empresa",
    descriptionEs: "Permite eliminar el perfil de empresa.",
    groupKey: "company",
    order: 50,
  },
  "company.address.read": {
    displayNameEs: "Ver direccion de empresa",
    descriptionEs: "Permite consultar la direccion de la empresa.",
    groupKey: "company",
    order: 60,
  },
  "company.address.create": {
    displayNameEs: "Crear direccion de empresa",
    descriptionEs: "Permite crear datos de direccion de empresa.",
    groupKey: "company",
    order: 70,
  },
  "company.address.update": {
    displayNameEs: "Editar direccion de empresa",
    descriptionEs: "Permite actualizar la direccion de empresa.",
    groupKey: "company",
    order: 80,
  },
  "company.address.delete": {
    displayNameEs: "Eliminar direccion de empresa",
    descriptionEs: "Permite eliminar la direccion de empresa.",
    groupKey: "company",
    order: 90,
  },
  "company.branding.read": {
    displayNameEs: "Ver marca visual de empresa",
    descriptionEs: "Permite consultar logo y colores de la empresa.",
    groupKey: "company",
    order: 100,
  },
  "company.branding.create": {
    displayNameEs: "Crear marca visual de empresa",
    descriptionEs: "Permite crear configuracion de marca visual.",
    groupKey: "company",
    order: 110,
  },
  "company.branding.update": {
    displayNameEs: "Editar marca visual de empresa",
    descriptionEs: "Permite actualizar logo y colores de la empresa.",
    groupKey: "company",
    order: 120,
  },
  "company.branding.delete": {
    displayNameEs: "Eliminar marca visual de empresa",
    descriptionEs: "Permite eliminar configuracion de marca visual.",
    groupKey: "company",
    order: 130,
  },

  "contacts.access": {
    displayNameEs: "Acceder a contactos",
    descriptionEs: "Permite entrar al modulo de contactos.",
    groupKey: "contacts",
    order: 10,
  },
  "contacts.contacts.read": {
    displayNameEs: "Ver contactos",
    descriptionEs: "Permite consultar contactos.",
    groupKey: "contacts",
    order: 20,
  },
  "contacts.contacts.create": {
    displayNameEs: "Crear contactos",
    descriptionEs: "Permite registrar nuevos contactos.",
    groupKey: "contacts",
    order: 30,
  },
  "contacts.contacts.update": {
    displayNameEs: "Editar contactos",
    descriptionEs: "Permite actualizar datos de contactos.",
    groupKey: "contacts",
    order: 40,
  },
  "contacts.contacts.delete": {
    displayNameEs: "Eliminar contactos",
    descriptionEs: "Permite eliminar contactos.",
    groupKey: "contacts",
    order: 50,
  },

  "finance.access": {
    displayNameEs: "Acceder a finanzas",
    descriptionEs: "Permite entrar al modulo de finanzas.",
    groupKey: "finance",
    order: 10,
  },
  "finance.ar.read": {
    displayNameEs: "Ver cuentas por cobrar",
    descriptionEs: "Permite consultar cuentas por cobrar.",
    groupKey: "finance",
    order: 20,
  },
  "finance.ar.create": {
    displayNameEs: "Crear cuentas por cobrar",
    descriptionEs: "Permite crear documentos de cuentas por cobrar.",
    groupKey: "finance",
    order: 21,
  },
  "finance.ar.update": {
    displayNameEs: "Editar cuentas por cobrar",
    descriptionEs: "Permite actualizar documentos de cuentas por cobrar.",
    groupKey: "finance",
    order: 22,
  },
  "finance.ar.delete": {
    displayNameEs: "Eliminar cuentas por cobrar",
    descriptionEs: "Permite eliminar documentos de cuentas por cobrar.",
    groupKey: "finance",
    order: 23,
  },
  "finance.ap.read": {
    displayNameEs: "Ver cuentas por pagar",
    descriptionEs: "Permite consultar cuentas por pagar.",
    groupKey: "finance",
    order: 30,
  },
  "finance.ap.create": {
    displayNameEs: "Crear cuentas por pagar",
    descriptionEs: "Permite crear documentos de cuentas por pagar.",
    groupKey: "finance",
    order: 31,
  },
  "finance.ap.update": {
    displayNameEs: "Editar cuentas por pagar",
    descriptionEs: "Permite actualizar documentos de cuentas por pagar.",
    groupKey: "finance",
    order: 32,
  },
  "finance.ap.delete": {
    displayNameEs: "Eliminar cuentas por pagar",
    descriptionEs: "Permite eliminar documentos de cuentas por pagar.",
    groupKey: "finance",
    order: 33,
  },
  "finance.accounts.read": {
    displayNameEs: "Ver cuentas contables",
    descriptionEs: "Permite consultar catalogo de cuentas contables.",
    groupKey: "finance",
    order: 40,
  },
  "finance.accounts.create": {
    displayNameEs: "Crear cuentas contables",
    descriptionEs: "Permite crear cuentas contables.",
    groupKey: "finance",
    order: 41,
  },
  "finance.accounts.update": {
    displayNameEs: "Editar cuentas contables",
    descriptionEs: "Permite actualizar cuentas contables.",
    groupKey: "finance",
    order: 42,
  },
  "finance.accounts.delete": {
    displayNameEs: "Eliminar cuentas contables",
    descriptionEs: "Permite eliminar cuentas contables.",
    groupKey: "finance",
    order: 43,
  },
  "finance.entries.read": {
    displayNameEs: "Ver polizas",
    descriptionEs: "Permite consultar polizas contables.",
    groupKey: "finance",
    order: 50,
  },
  "finance.entries.create": {
    displayNameEs: "Crear polizas",
    descriptionEs: "Permite registrar polizas contables.",
    groupKey: "finance",
    order: 51,
  },
  "finance.entries.update": {
    displayNameEs: "Editar polizas",
    descriptionEs: "Permite actualizar polizas contables.",
    groupKey: "finance",
    order: 52,
  },
  "finance.entries.delete": {
    displayNameEs: "Eliminar polizas",
    descriptionEs: "Permite eliminar polizas contables.",
    groupKey: "finance",
    order: 53,
  },
  "finance.documents.read": {
    displayNameEs: "Ver documentos financieros",
    descriptionEs: "Permite consultar documentos financieros.",
    groupKey: "finance",
    order: 60,
  },
  "finance.documents.create": {
    displayNameEs: "Crear documentos financieros",
    descriptionEs: "Permite registrar documentos financieros.",
    groupKey: "finance",
    order: 61,
  },
  "finance.documents.update": {
    displayNameEs: "Editar documentos financieros",
    descriptionEs: "Permite actualizar documentos financieros.",
    groupKey: "finance",
    order: 62,
  },
  "finance.documents.delete": {
    displayNameEs: "Eliminar documentos financieros",
    descriptionEs: "Permite eliminar documentos financieros.",
    groupKey: "finance",
    order: 63,
  },
  "finance.documents.reminder.send": {
    displayNameEs: "Enviar recordatorios de cobranza/pago",
    descriptionEs: "Permite enviar recordatorios para documentos financieros.",
    groupKey: "finance",
    order: 64,
  },
  "finance.applications.read": {
    displayNameEs: "Ver aplicaciones de pago",
    descriptionEs: "Permite consultar aplicaciones de pago.",
    groupKey: "finance",
    order: 70,
  },
  "finance.applications.create": {
    displayNameEs: "Crear aplicaciones de pago",
    descriptionEs: "Permite crear aplicaciones de pago.",
    groupKey: "finance",
    order: 71,
  },
  "finance.applications.update": {
    displayNameEs: "Editar aplicaciones de pago",
    descriptionEs: "Permite actualizar aplicaciones de pago.",
    groupKey: "finance",
    order: 72,
  },
  "finance.applications.delete": {
    displayNameEs: "Eliminar aplicaciones de pago",
    descriptionEs: "Permite eliminar aplicaciones de pago.",
    groupKey: "finance",
    order: 73,
  },
  "finance.applications.reverse": {
    displayNameEs: "Revertir aplicaciones de pago",
    descriptionEs: "Permite anular aplicaciones previamente registradas.",
    groupKey: "finance",
    order: 74,
  },
  "finance.tax_rates.read": {
    displayNameEs: "Ver impuestos",
    descriptionEs: "Permite consultar catalogo de impuestos.",
    groupKey: "finance",
    order: 80,
  },
  "finance.tax_rates.create": {
    displayNameEs: "Crear impuestos",
    descriptionEs: "Permite crear impuestos.",
    groupKey: "finance",
    order: 81,
  },
  "finance.tax_rates.update": {
    displayNameEs: "Editar impuestos",
    descriptionEs: "Permite actualizar impuestos.",
    groupKey: "finance",
    order: 82,
  },
  "finance.tax_rates.delete": {
    displayNameEs: "Eliminar impuestos",
    descriptionEs: "Permite eliminar impuestos.",
    groupKey: "finance",
    order: 83,
  },
  "finance.fx_rates.read": {
    displayNameEs: "Ver tipos de cambio",
    descriptionEs: "Permite consultar tipos de cambio.",
    groupKey: "finance",
    order: 90,
  },
  "finance.fx_rates.create": {
    displayNameEs: "Crear tipos de cambio",
    descriptionEs: "Permite registrar tipos de cambio.",
    groupKey: "finance",
    order: 91,
  },
  "finance.fx_rates.update": {
    displayNameEs: "Editar tipos de cambio",
    descriptionEs: "Permite actualizar tipos de cambio.",
    groupKey: "finance",
    order: 92,
  },
  "finance.fx_rates.delete": {
    displayNameEs: "Eliminar tipos de cambio",
    descriptionEs: "Permite eliminar tipos de cambio.",
    groupKey: "finance",
    order: 93,
  },
  "finance.dashboard.read": {
    displayNameEs: "Ver resumen financiero",
    descriptionEs: "Permite consultar dashboard financiero.",
    groupKey: "finance",
    order: 100,
  },
  "finance.dashboard.create": {
    displayNameEs: "Crear resumen financiero",
    descriptionEs: "Permite crear configuraciones de dashboard financiero.",
    groupKey: "finance",
    order: 101,
  },
  "finance.dashboard.update": {
    displayNameEs: "Editar resumen financiero",
    descriptionEs: "Permite actualizar configuraciones de dashboard financiero.",
    groupKey: "finance",
    order: 102,
  },
  "finance.dashboard.delete": {
    displayNameEs: "Eliminar resumen financiero",
    descriptionEs: "Permite eliminar configuraciones de dashboard financiero.",
    groupKey: "finance",
    order: 103,
  },
  "finance.aging.read": {
    displayNameEs: "Ver aging",
    descriptionEs: "Permite consultar reporte de aging.",
    groupKey: "finance",
    order: 110,
  },
  "finance.aging.create": {
    displayNameEs: "Crear aging",
    descriptionEs: "Permite crear configuraciones de aging.",
    groupKey: "finance",
    order: 111,
  },
  "finance.aging.update": {
    displayNameEs: "Editar aging",
    descriptionEs: "Permite actualizar configuraciones de aging.",
    groupKey: "finance",
    order: 112,
  },
  "finance.aging.delete": {
    displayNameEs: "Eliminar aging",
    descriptionEs: "Permite eliminar configuraciones de aging.",
    groupKey: "finance",
    order: 113,
  },

  "hr.access": {
    displayNameEs: "Acceder a recursos humanos",
    descriptionEs: "Permite entrar al modulo de recursos humanos.",
    groupKey: "hr",
    order: 10,
  },
  "hr.employee.read": {
    displayNameEs: "Ver colaboradores",
    descriptionEs: "Permite consultar colaboradores.",
    groupKey: "hr",
    order: 20,
  },
  "hr.employee.create": {
    displayNameEs: "Crear colaboradores",
    descriptionEs: "Permite registrar colaboradores.",
    groupKey: "hr",
    order: 21,
  },
  "hr.employee.update": {
    displayNameEs: "Editar colaboradores",
    descriptionEs: "Permite actualizar colaboradores.",
    groupKey: "hr",
    order: 22,
  },
  "hr.employee.delete": {
    displayNameEs: "Eliminar colaboradores",
    descriptionEs: "Permite desactivar o eliminar colaboradores.",
    groupKey: "hr",
    order: 23,
  },
  "hr.department.read": {
    displayNameEs: "Ver departamentos",
    descriptionEs: "Permite consultar departamentos.",
    groupKey: "hr",
    order: 30,
  },
  "hr.department.create": {
    displayNameEs: "Crear departamentos",
    descriptionEs: "Permite crear departamentos.",
    groupKey: "hr",
    order: 31,
  },
  "hr.department.update": {
    displayNameEs: "Editar departamentos",
    descriptionEs: "Permite actualizar departamentos.",
    groupKey: "hr",
    order: 32,
  },
  "hr.department.delete": {
    displayNameEs: "Eliminar departamentos",
    descriptionEs: "Permite eliminar departamentos.",
    groupKey: "hr",
    order: 33,
  },
  "hr.job_title.read": {
    displayNameEs: "Ver puestos",
    descriptionEs: "Permite consultar puestos.",
    groupKey: "hr",
    order: 40,
  },
  "hr.job_title.create": {
    displayNameEs: "Crear puestos",
    descriptionEs: "Permite crear puestos.",
    groupKey: "hr",
    order: 41,
  },
  "hr.job_title.update": {
    displayNameEs: "Editar puestos",
    descriptionEs: "Permite actualizar puestos.",
    groupKey: "hr",
    order: 42,
  },
  "hr.job_title.delete": {
    displayNameEs: "Eliminar puestos",
    descriptionEs: "Permite eliminar puestos.",
    groupKey: "hr",
    order: 43,
  },
  "hr.org_chart.read": {
    displayNameEs: "Ver organigrama",
    descriptionEs: "Permite consultar organigrama.",
    groupKey: "hr",
    order: 50,
  },
  "hr.org_chart.create": {
    displayNameEs: "Crear organigrama",
    descriptionEs: "Permite crear elementos del organigrama.",
    groupKey: "hr",
    order: 51,
  },
  "hr.org_chart.update": {
    displayNameEs: "Editar organigrama",
    descriptionEs: "Permite actualizar elementos del organigrama.",
    groupKey: "hr",
    order: 52,
  },
  "hr.org_chart.delete": {
    displayNameEs: "Eliminar organigrama",
    descriptionEs: "Permite eliminar elementos del organigrama.",
    groupKey: "hr",
    order: 53,
  },
  "ledger.access": {
    displayNameEs: "Acceder al libro auxiliar",
    descriptionEs: "Permite entrar al modulo de cuentas y movimientos.",
    groupKey: "ledger",
    order: 10,
  },
  "ledger.accounts.read": {
    displayNameEs: "Ver cuentas del libro auxiliar",
    descriptionEs: "Permite consultar el listado de cuentas y sus saldos.",
    groupKey: "ledger",
    order: 20,
  },
  "ledger.accounts.create": {
    displayNameEs: "Crear cuentas del libro auxiliar",
    descriptionEs: "Permite crear nuevas cuentas en el libro auxiliar.",
    groupKey: "ledger",
    order: 30,
  },
  "ledger.accounts.update": {
    displayNameEs: "Editar cuentas del libro auxiliar",
    descriptionEs: "Permite modificar nombre, tipo y descripcion de cuentas.",
    groupKey: "ledger",
    order: 40,
  },
  "ledger.accounts.delete": {
    displayNameEs: "Deshabilitar cuentas del libro auxiliar",
    descriptionEs: "Permite habilitar o deshabilitar cuentas del libro auxiliar.",
    groupKey: "ledger",
    order: 50,
  },
  "ledger.movements.read": {
    displayNameEs: "Ver movimientos del libro auxiliar",
    descriptionEs: "Permite consultar movimientos de cualquier cuenta.",
    groupKey: "ledger",
    order: 60,
  },
  "ledger.movements.create": {
    displayNameEs: "Crear movimientos del libro auxiliar",
    descriptionEs: "Permite registrar abonos y cargos en cuentas del libro auxiliar.",
    groupKey: "ledger",
    order: 70,
  },
  "ledger.movements.cancel": {
    displayNameEs: "Cancelar movimientos del libro auxiliar",
    descriptionEs: "Permite cancelar movimientos registrados con motivo de cancelacion.",
    groupKey: "ledger",
    order: 80,
  },
  "ledger.reports.read": {
    displayNameEs: "Ver reportes del libro auxiliar",
    descriptionEs: "Permite consultar el resumen y filtros de reportes del libro auxiliar.",
    groupKey: "ledger",
    order: 90,
  },
  "ledger.reports.export": {
    displayNameEs: "Exportar reportes del libro auxiliar",
    descriptionEs: "Permite exportar movimientos a Excel y PDF.",
    groupKey: "ledger",
    order: 100,
  },
};

function inferGroupKey(permissionKey) {
  return String(permissionKey ?? "").split(".")[0] || "core";
}

function toLabel(value) {
  return String(value ?? "")
    .split(/[._-]/g)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function inferGranularPresentation(permissionKey) {
  const segments = String(permissionKey ?? "")
    .split(".")
    .filter(Boolean);
  if (segments.length < 2) return null;

  const action = segments[segments.length - 1];
  const moduleKey = segments[0];
  const featureKey =
    segments.length >= 3 ? segments.slice(1, -1).join(".") : "general";

  const actionLabel = ACTION_LABELS[action] ?? `Ejecutar ${toLabel(action)}`;
  const featureLabel = FEATURE_LABELS[featureKey] ?? toLabel(featureKey);
  const moduleLabel = MODULE_LABELS[moduleKey] ?? toLabel(moduleKey);

  return {
    name: `${actionLabel} ${featureLabel}`.trim(),
    description: `Permite ${actionLabel.toLowerCase()} acciones de ${featureLabel} en ${moduleLabel}.`,
  };
}

export function getPermissionPresentation(permissionKey) {
  const item = PERMISSION_CATALOG[permissionKey];
  const groupKey = item?.groupKey ?? inferGroupKey(permissionKey);
  const groupLabel = GROUPS[groupKey] ?? "General";
  const inferred = item ? null : inferGranularPresentation(permissionKey);
  return {
    key: permissionKey,
    name: item?.displayNameEs ?? inferred?.name ?? permissionKey,
    description: item?.descriptionEs ?? inferred?.description ?? "Permiso del sistema.",
    groupKey,
    groupLabel,
    sortOrder: item?.order ?? 999,
  };
}

export function groupPermissionsForUi(permissions = []) {
  const normalized = permissions.map((permission) => {
    const presentation = getPermissionPresentation(permission.key);
    return {
      ...permission,
      name: presentation.name,
      description: presentation.description,
      groupKey: presentation.groupKey,
      groupLabel: presentation.groupLabel,
      sortOrder: presentation.sortOrder,
    };
  });

  const groups = new Map();
  for (const permission of normalized) {
    const groupKey = permission.groupKey;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        groupKey,
        groupLabel: permission.groupLabel,
        permissions: [],
      });
    }
    groups.get(groupKey).permissions.push(permission);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      permissions: group.permissions.sort(
        (a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key),
      ),
    }))
    .sort((a, b) => a.groupLabel.localeCompare(b.groupLabel));
}
