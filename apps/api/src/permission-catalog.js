const GROUPS = {
  core: "Core",
  platform: "Plataforma",
  identity: "Identidad",
  profile: "Perfil",
  files: "Archivos",
  company: "Empresa",
  contacts: "Contactos",
  fleet: "Flota",
  hr: "Recursos Humanos",
  ledger: "Libro de cuentas",
  website: "Sitio web",
  audit: "Bitacora",
  activity: "Actividad",
  notifications: "Notificaciones",
  projects: "Proyectos",
};

const MODULE_LABELS = {
  core: "Core",
  identity: "Identidad",
  profile: "Perfil",
  files: "Archivos",
  company: "Empresa",
  contacts: "Contactos",
  fleet: "Flota",
  hr: "Recursos Humanos",
  ledger: "Libro de cuentas",
  website: "Sitio web",
  audit: "Bitacora",
  activity: "Actividad",
  notifications: "Notificaciones",
  projects: "Proyectos",
};

const FEATURE_LABELS = {
  general: "General",
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
  employee: "Colaboradores",
  department: "Departamentos",
  job_title: "Puestos",
  org_chart: "Organigrama",
  vehicles: "Vehiculos",
  reports: "Reportes",
  drivers: "Choferes",
  catalogs: "Catalogos",
  insurance: "Seguros",
  accounts: "Cuentas",
  transactions: "Movimientos",
  categories: "Categorias",
  types: "Tipos de movimiento",
  notifications: "Notificaciones",
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
  import: "Importar",
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

  "activity.access": {
    displayNameEs: "Acceder a actividad",
    descriptionEs: "Permite entrar al modulo de actividad.",
    groupKey: "activity",
    order: 10,
  },
  "activity.read": {
    displayNameEs: "Ver actividad",
    descriptionEs: "Permite consultar el feed de actividad de la empresa.",
    groupKey: "activity",
    order: 20,
  },
  "activity.publish": {
    displayNameEs: "Publicar actividad",
    descriptionEs: "Permite registrar eventos en el feed de actividad.",
    groupKey: "activity",
    order: 30,
  },
  "activity.manage": {
    displayNameEs: "Administrar actividad",
    descriptionEs: "Permite eliminar o purgar registros del feed de actividad.",
    groupKey: "activity",
    order: 40,
  },

  "notifications.access": {
    displayNameEs: "Acceder a notificaciones",
    descriptionEs: "Permite entrar al modulo de notificaciones.",
    groupKey: "notifications",
    order: 10,
  },
  "notifications.read": {
    displayNameEs: "Ver notificaciones",
    descriptionEs: "Permite consultar y marcar notificaciones personales.",
    groupKey: "notifications",
    order: 20,
  },
  "notifications.publish": {
    displayNameEs: "Publicar notificaciones",
    descriptionEs:
      "Permite emitir notificaciones para usuarios de la empresa activa.",
    groupKey: "notifications",
    order: 30,
  },
  "notifications.manage": {
    displayNameEs: "Administrar notificaciones",
    descriptionEs:
      "Permite gestionar operaciones administrativas de notificaciones.",
    groupKey: "notifications",
    order: 40,
  },

  "platform.erp.access": {
    displayNameEs: "Acceder al ERP",
    descriptionEs:
      "Permite iniciar sesion y usar la aplicacion Atlas ERP. Sin este permiso el usuario solo puede acceder al sitio web publico.",
    groupKey: "platform",
    order: 1,
  },
  "platform.settings.manage": {
    displayNameEs: "Administrar configuracion de plataforma",
    descriptionEs:
      "Permite gestionar configuracion de SMTP y otros ajustes de plataforma.",
    groupKey: "platform",
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

  "fleet.access": {
    displayNameEs: "Acceder a flota",
    descriptionEs: "Permite entrar al modulo de flota.",
    groupKey: "fleet",
    order: 10,
  },
  "fleet.vehicles.read": {
    displayNameEs: "Ver vehiculos",
    descriptionEs: "Permite consultar el listado de vehiculos.",
    groupKey: "fleet",
    order: 20,
  },
  "fleet.vehicles.create": {
    displayNameEs: "Crear vehiculos",
    descriptionEs: "Permite registrar nuevos vehiculos.",
    groupKey: "fleet",
    order: 21,
  },
  "fleet.vehicles.update": {
    displayNameEs: "Editar vehiculos",
    descriptionEs: "Permite actualizar datos de vehiculos.",
    groupKey: "fleet",
    order: 22,
  },
  "fleet.vehicles.delete": {
    displayNameEs: "Desactivar vehiculos",
    descriptionEs: "Permite desactivar vehiculos.",
    groupKey: "fleet",
    order: 23,
  },
  "fleet.reports.read": {
    displayNameEs: "Ver reportes de flota",
    descriptionEs: "Permite consultar reportes de mantenimiento y servicio.",
    groupKey: "fleet",
    order: 30,
  },
  "fleet.reports.create": {
    displayNameEs: "Crear reportes de flota",
    descriptionEs: "Permite registrar reportes de flota.",
    groupKey: "fleet",
    order: 31,
  },
  "fleet.reports.update": {
    displayNameEs: "Editar reportes de flota",
    descriptionEs: "Permite actualizar reportes de flota.",
    groupKey: "fleet",
    order: 32,
  },
  "fleet.reports.delete": {
    displayNameEs: "Eliminar reportes de flota",
    descriptionEs: "Permite eliminar reportes de flota.",
    groupKey: "fleet",
    order: 33,
  },
  "fleet.drivers.read": {
    displayNameEs: "Ver choferes",
    descriptionEs: "Permite consultar choferes.",
    groupKey: "fleet",
    order: 40,
  },
  "fleet.drivers.create": {
    displayNameEs: "Crear choferes",
    descriptionEs: "Permite registrar choferes.",
    groupKey: "fleet",
    order: 41,
  },
  "fleet.drivers.update": {
    displayNameEs: "Editar choferes",
    descriptionEs: "Permite actualizar choferes.",
    groupKey: "fleet",
    order: 42,
  },
  "fleet.drivers.delete": {
    displayNameEs: "Desactivar choferes",
    descriptionEs: "Permite desactivar choferes.",
    groupKey: "fleet",
    order: 43,
  },
  "fleet.catalogs.read": {
    displayNameEs: "Ver catalogos de flota",
    descriptionEs: "Permite consultar catalogos de tipos, marcas y modelos.",
    groupKey: "fleet",
    order: 50,
  },
  "fleet.catalogs.create": {
    displayNameEs: "Crear catalogos de flota",
    descriptionEs: "Permite crear elementos de catalogos de flota.",
    groupKey: "fleet",
    order: 51,
  },
  "fleet.catalogs.update": {
    displayNameEs: "Editar catalogos de flota",
    descriptionEs: "Permite actualizar elementos de catalogos de flota.",
    groupKey: "fleet",
    order: 52,
  },
  "fleet.catalogs.delete": {
    displayNameEs: "Desactivar catalogos de flota",
    descriptionEs: "Permite desactivar elementos de catalogos de flota.",
    groupKey: "fleet",
    order: 53,
  },
  "fleet.insurance.read": {
    displayNameEs: "Ver polizas de seguro",
    descriptionEs: "Permite consultar polizas de seguro de las unidades.",
    groupKey: "fleet",
    order: 60,
  },
  "fleet.insurance.create": {
    displayNameEs: "Crear polizas de seguro",
    descriptionEs: "Permite registrar polizas de seguro.",
    groupKey: "fleet",
    order: 61,
  },
  "fleet.insurance.update": {
    displayNameEs: "Editar polizas de seguro",
    descriptionEs: "Permite actualizar polizas de seguro.",
    groupKey: "fleet",
    order: 62,
  },
  "fleet.insurance.delete": {
    displayNameEs: "Desactivar polizas de seguro",
    descriptionEs: "Permite desactivar polizas de seguro.",
    groupKey: "fleet",
    order: 63,
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

  "ledger.accounts.read": {
    displayNameEs: "Ver cuentas",
    descriptionEs: "Permite consultar cuentas del libro de cuentas.",
    groupKey: "ledger",
    order: 10,
  },
  "ledger.accounts.create": {
    displayNameEs: "Crear cuentas",
    descriptionEs: "Permite crear cuentas en el libro de cuentas.",
    groupKey: "ledger",
    order: 11,
  },
  "ledger.accounts.update": {
    displayNameEs: "Editar cuentas",
    descriptionEs: "Permite actualizar cuentas del libro de cuentas.",
    groupKey: "ledger",
    order: 12,
  },
  "ledger.accounts.delete": {
    displayNameEs: "Desactivar cuentas",
    descriptionEs: "Permite desactivar cuentas del libro de cuentas.",
    groupKey: "ledger",
    order: 13,
  },
  "ledger.transactions.read": {
    displayNameEs: "Ver movimientos",
    descriptionEs: "Permite consultar movimientos por cuenta.",
    groupKey: "ledger",
    order: 20,
  },
  "ledger.transactions.create": {
    displayNameEs: "Crear movimientos",
    descriptionEs: "Permite registrar movimientos en una cuenta.",
    groupKey: "ledger",
    order: 21,
  },
  "ledger.transactions.update": {
    displayNameEs: "Editar movimientos",
    descriptionEs: "Permite actualizar movimientos registrados.",
    groupKey: "ledger",
    order: 22,
  },
  "ledger.transactions.delete": {
    displayNameEs: "Desactivar movimientos",
    descriptionEs: "Permite desactivar movimientos registrados.",
    groupKey: "ledger",
    order: 23,
  },
  "ledger.export": {
    displayNameEs: "Exportar movimientos",
    descriptionEs: "Permite exportar movimientos del libro de cuentas.",
    groupKey: "ledger",
    order: 30,
  },
  "ledger.import": {
    displayNameEs: "Importar movimientos",
    descriptionEs: "Permite importar movimientos al libro de cuentas.",
    groupKey: "ledger",
    order: 31,
  },
  "ledger.categories.manage": {
    displayNameEs: "Administrar categorias",
    descriptionEs: "Permite gestionar categorias de movimientos.",
    groupKey: "ledger",
    order: 40,
  },
  "ledger.types.manage": {
    displayNameEs: "Administrar tipos de movimiento",
    descriptionEs: "Permite gestionar tipos de movimiento.",
    groupKey: "ledger",
    order: 41,
  },
  "ledger.groups.read": {
    displayNameEs: "Ver grupos",
    descriptionEs: "Permite ver grupos y sus cuentas en el libro de cuentas.",
    groupKey: "ledger",
    order: 50,
  },
  "ledger.groups.write": {
    displayNameEs: "Gestionar grupos",
    descriptionEs: "Permite crear y administrar grupos en el libro de cuentas.",
    groupKey: "ledger",
    order: 51,
  },
  "ledger.members.write": {
    displayNameEs: "Gestionar colaboradores",
    descriptionEs: "Permite invitar y remover colaboradores de cuentas y grupos.",
    groupKey: "ledger",
    order: 52,
  },

  // atlas.website
  "website.access": {
    displayNameEs: "Acceso al Sitio web",
    descriptionEs: "Permite acceder al modulo de sitio web.",
    groupKey: "website",
    order: 1,
  },
  "website.site.read": {
    displayNameEs: "Ver configuracion del sitio",
    descriptionEs: "Permite ver la configuracion del sitio web.",
    groupKey: "website",
    order: 2,
  },
  "website.site.update": {
    displayNameEs: "Editar configuracion del sitio",
    descriptionEs: "Permite editar la configuracion del sitio web.",
    groupKey: "website",
    order: 3,
  },
  "website.pages.read": {
    displayNameEs: "Ver paginas",
    descriptionEs: "Permite ver las paginas del sitio web.",
    groupKey: "website",
    order: 4,
  },
  "website.pages.create": {
    displayNameEs: "Crear paginas",
    descriptionEs: "Permite crear nuevas paginas en el sitio web.",
    groupKey: "website",
    order: 5,
  },
  "website.pages.update": {
    displayNameEs: "Editar paginas",
    descriptionEs: "Permite editar el contenido de las paginas.",
    groupKey: "website",
    order: 6,
  },
  "website.pages.publish": {
    displayNameEs: "Publicar paginas",
    descriptionEs:
      "Permite publicar paginas para que sean visibles publicamente.",
    groupKey: "website",
    order: 7,
  },
  "website.pages.delete": {
    displayNameEs: "Eliminar paginas",
    descriptionEs: "Permite eliminar paginas del sitio web.",
    groupKey: "website",
    order: 8,
  },
  "website.theme.read": {
    displayNameEs: "Ver temas",
    descriptionEs: "Permite ver los temas del sitio web.",
    groupKey: "website",
    order: 9,
  },
  "website.theme.update": {
    displayNameEs: "Editar temas",
    descriptionEs: "Permite editar el tema del sitio web.",
    groupKey: "website",
    order: 10,
  },
  "website.menus.read": {
    displayNameEs: "Ver menus",
    descriptionEs: "Permite ver los menus de navegacion.",
    groupKey: "website",
    order: 11,
  },
  "website.menus.update": {
    displayNameEs: "Editar menus",
    descriptionEs: "Permite editar los menus de navegacion.",
    groupKey: "website",
    order: 12,
  },
  "website.dist.upload": {
    displayNameEs: "Subir build del sitio",
    descriptionEs: "Permite subir y eliminar el dist/ compilado del sitio publico.",
    groupKey: "website",
    order: 13,
  },

  "projects.access": {
    displayNameEs: "Acceder a Proyectos",
    descriptionEs: "Permite ver el modulo de proyectos en la navegacion.",
    groupKey: "projects",
    order: 10,
  },
  "projects.project.read": {
    displayNameEs: "Ver proyectos",
    descriptionEs: "Permite leer proyectos donde el usuario es miembro.",
    groupKey: "projects",
    order: 20,
  },
  "projects.project.create": {
    displayNameEs: "Crear proyectos",
    descriptionEs: "Permite crear nuevos proyectos.",
    groupKey: "projects",
    order: 30,
  },
  "projects.project.update": {
    displayNameEs: "Editar proyectos",
    descriptionEs: "Permite editar datos y columnas del proyecto.",
    groupKey: "projects",
    order: 40,
  },
  "projects.project.delete": {
    displayNameEs: "Archivar proyectos",
    descriptionEs: "Permite archivar o eliminar proyectos.",
    groupKey: "projects",
    order: 50,
  },
  "projects.task.read": {
    displayNameEs: "Ver tareas",
    descriptionEs: "Permite leer tareas dentro de un proyecto.",
    groupKey: "projects",
    order: 60,
  },
  "projects.task.create": {
    displayNameEs: "Crear tareas",
    descriptionEs: "Permite crear nuevas tareas en un proyecto.",
    groupKey: "projects",
    order: 70,
  },
  "projects.task.update": {
    displayNameEs: "Editar tareas",
    descriptionEs: "Permite editar tareas existentes.",
    groupKey: "projects",
    order: 80,
  },
  "projects.task.delete": {
    displayNameEs: "Eliminar tareas",
    descriptionEs: "Permite eliminar tareas y sus subtareas.",
    groupKey: "projects",
    order: 90,
  },
  "projects.member.manage": {
    displayNameEs: "Gestionar miembros",
    descriptionEs: "Permite agregar o remover miembros del proyecto.",
    groupKey: "projects",
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
    description:
      item?.descriptionEs ?? inferred?.description ?? "Permiso del sistema.",
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
