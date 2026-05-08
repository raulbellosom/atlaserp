const GROUPS = {
  core: "Core",
  modules: "Modulos",
  identity: "Identidad",
  roles: "Roles",
  permissions: "Permisos",
  profile: "Perfil",
  files: "Archivos",
  company: "Empresa",
  contacts: "Contactos",
  finance: "Finanzas",
  hr: "Recursos Humanos",
  audit: "Bitacora",
};

export const PERMISSION_CATALOG = {
  "core.access": {
    displayNameEs: "Acceder a core",
    descriptionEs: "Permite entrar a las vistas principales del modulo core.",
    groupKey: "core",
    order: 1,
  },
  "core.read": {
    displayNameEs: "Ver configuracion del sistema",
    descriptionEs: "Permite consultar informacion general de Core.",
    groupKey: "core",
    order: 10,
  },
  "core.manage": {
    displayNameEs: "Administrar configuracion del sistema",
    descriptionEs: "Permite actualizar ajustes clave de Core.",
    groupKey: "core",
    order: 20,
  },
  "core.modules.read": {
    displayNameEs: "Ver modulos de core",
    descriptionEs: "Permite consultar el catalogo de modulos desde core.",
    groupKey: "core",
    order: 30,
  },
  "core.modules.create": {
    displayNameEs: "Instalar modulos desde core",
    descriptionEs: "Permite instalar modulos dentro del runtime de core.",
    groupKey: "core",
    order: 40,
  },
  "core.modules.update": {
    displayNameEs: "Actualizar estado de modulos de core",
    descriptionEs: "Permite habilitar o deshabilitar modulos administrados por core.",
    groupKey: "core",
    order: 50,
  },
  "core.modules.delete": {
    displayNameEs: "Desinstalar modulos desde core",
    descriptionEs: "Permite desinstalar modulos desde el catalogo de core.",
    groupKey: "core",
    order: 60,
  },
  "core.instance.read": {
    displayNameEs: "Ver configuracion de instancia",
    descriptionEs: "Permite consultar la configuracion de la instancia del sistema.",
    groupKey: "core",
    order: 70,
  },
  "core.instance.create": {
    displayNameEs: "Crear configuracion de instancia",
    descriptionEs: "Permite crear datos de configuracion para la instancia.",
    groupKey: "core",
    order: 80,
  },
  "core.instance.update": {
    displayNameEs: "Editar configuracion de instancia",
    descriptionEs: "Permite actualizar la configuracion activa de la instancia.",
    groupKey: "core",
    order: 90,
  },
  "core.instance.delete": {
    displayNameEs: "Eliminar configuracion de instancia",
    descriptionEs: "Permite eliminar configuracion registrada de la instancia.",
    groupKey: "core",
    order: 100,
  },
  "modules.install": {
    displayNameEs: "Instalar modulos",
    descriptionEs: "Permite instalar modulos en el catalogo.",
    groupKey: "modules",
    order: 10,
  },
  "modules.read": {
    displayNameEs: "Ver catalogo de modulos",
    descriptionEs: "Permite consultar el catalogo administrativo de modulos.",
    groupKey: "modules",
    order: 5,
  },
  "modules.uninstall": {
    displayNameEs: "Desinstalar modulos",
    descriptionEs: "Permite desinstalar modulos instalados.",
    groupKey: "modules",
    order: 20,
  },
  "modules.disable": {
    displayNameEs: "Deshabilitar modulos",
    descriptionEs: "Permite activar o desactivar modulos del sistema.",
    groupKey: "modules",
    order: 30,
  },
  "audit.read": {
    displayNameEs: "Ver bitacora",
    descriptionEs: "Permite revisar eventos y cambios del sistema.",
    groupKey: "audit",
    order: 10,
  },
  "identity.access": {
    displayNameEs: "Acceder a identidad",
    descriptionEs: "Permite entrar a las vistas principales del modulo de identidad.",
    groupKey: "identity",
    order: 1,
  },
  "identity.read": {
    displayNameEs: "Ver identidad",
    descriptionEs: "Permite consultar usuarios y relaciones de identidad.",
    groupKey: "identity",
    order: 10,
  },
  "identity.manage": {
    displayNameEs: "Administrar identidad",
    descriptionEs: "Permite gestionar configuraciones del modulo de identidad.",
    groupKey: "identity",
    order: 20,
  },
  "identity.users.read": {
    displayNameEs: "Ver usuarios de identidad",
    descriptionEs: "Permite consultar usuarios dentro del modulo de identidad.",
    groupKey: "identity",
    order: 30,
  },
  "identity.users.create": {
    displayNameEs: "Crear usuarios de identidad",
    descriptionEs: "Permite registrar nuevos usuarios en identidad.",
    groupKey: "identity",
    order: 40,
  },
  "identity.users.update": {
    displayNameEs: "Editar usuarios de identidad",
    descriptionEs: "Permite actualizar informacion de usuarios en identidad.",
    groupKey: "identity",
    order: 50,
  },
  "identity.users.delete": {
    displayNameEs: "Eliminar usuarios de identidad",
    descriptionEs: "Permite eliminar usuarios dentro de identidad.",
    groupKey: "identity",
    order: 60,
  },
  "identity.roles.read": {
    displayNameEs: "Ver roles de identidad",
    descriptionEs: "Permite consultar roles administrados por identidad.",
    groupKey: "identity",
    order: 70,
  },
  "identity.roles.create": {
    displayNameEs: "Crear roles de identidad",
    descriptionEs: "Permite crear roles nuevos en identidad.",
    groupKey: "identity",
    order: 80,
  },
  "identity.roles.update": {
    displayNameEs: "Editar roles de identidad",
    descriptionEs: "Permite modificar roles existentes en identidad.",
    groupKey: "identity",
    order: 90,
  },
  "identity.roles.delete": {
    displayNameEs: "Eliminar roles de identidad",
    descriptionEs: "Permite eliminar roles en identidad.",
    groupKey: "identity",
    order: 100,
  },
  "identity.permissions.read": {
    displayNameEs: "Ver permisos de identidad",
    descriptionEs: "Permite consultar permisos administrados por identidad.",
    groupKey: "identity",
    order: 110,
  },
  "identity.permissions.create": {
    displayNameEs: "Crear permisos de identidad",
    descriptionEs: "Permite crear permisos dentro del modulo de identidad.",
    groupKey: "identity",
    order: 120,
  },
  "identity.permissions.update": {
    displayNameEs: "Editar permisos de identidad",
    descriptionEs: "Permite modificar permisos existentes de identidad.",
    groupKey: "identity",
    order: 130,
  },
  "identity.permissions.delete": {
    displayNameEs: "Eliminar permisos de identidad",
    descriptionEs: "Permite eliminar permisos en identidad.",
    groupKey: "identity",
    order: 140,
  },
  "roles.read": {
    displayNameEs: "Ver roles",
    descriptionEs: "Permite consultar roles disponibles.",
    groupKey: "roles",
    order: 10,
  },
  "roles.manage": {
    displayNameEs: "Administrar roles",
    descriptionEs: "Permite crear, editar y activar/desactivar roles.",
    groupKey: "roles",
    order: 20,
  },
  "permissions.read": {
    displayNameEs: "Ver permisos",
    descriptionEs: "Permite consultar el catalogo de permisos.",
    groupKey: "permissions",
    order: 10,
  },
  "permissions.manage": {
    displayNameEs: "Administrar permisos",
    descriptionEs: "Permite asignar o revocar permisos por rol.",
    groupKey: "permissions",
    order: 20,
  },
  "profile.self.read": {
    displayNameEs: "Ver perfil propio",
    descriptionEs: "Permite consultar la informacion de su propio perfil.",
    groupKey: "profile",
    order: 10,
  },
  "profile.self.update": {
    displayNameEs: "Editar perfil propio",
    descriptionEs: "Permite actualizar informacion personal de su perfil.",
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
  "files.read": {
    displayNameEs: "Ver archivos",
    descriptionEs: "Permite consultar archivos disponibles.",
    groupKey: "files",
    order: 10,
  },
  "files.upload": {
    displayNameEs: "Subir archivos",
    descriptionEs: "Permite cargar nuevos archivos.",
    groupKey: "files",
    order: 20,
  },
  "files.delete": {
    displayNameEs: "Eliminar archivos",
    descriptionEs: "Permite eliminar archivos existentes.",
    groupKey: "files",
    order: 30,
  },
  "files.manage": {
    displayNameEs: "Administrar archivos",
    descriptionEs: "Permite modificar la gestion general de archivos.",
    groupKey: "files",
    order: 40,
  },
  "company.read": {
    displayNameEs: "Ver empresa",
    descriptionEs: "Permite consultar perfil, direccion y marca visual de la empresa.",
    groupKey: "company",
    order: 10,
  },
  "company.manage": {
    displayNameEs: "Administrar empresa",
    descriptionEs: "Permite editar perfil, direccion, logo y colores de la empresa.",
    groupKey: "company",
    order: 20,
  },
  "company.access": {
    displayNameEs: "Acceder a empresa",
    descriptionEs: "Permite entrar a las vistas del modulo de empresa.",
    groupKey: "company",
    order: 30,
  },
  "company.profile.read": {
    displayNameEs: "Ver perfil de empresa",
    descriptionEs: "Permite consultar los datos del perfil de la empresa.",
    groupKey: "company",
    order: 40,
  },
  "company.profile.create": {
    displayNameEs: "Crear perfil de empresa",
    descriptionEs: "Permite crear informacion de perfil de empresa.",
    groupKey: "company",
    order: 50,
  },
  "company.profile.update": {
    displayNameEs: "Editar perfil de empresa",
    descriptionEs: "Permite actualizar informacion del perfil de empresa.",
    groupKey: "company",
    order: 60,
  },
  "company.profile.delete": {
    displayNameEs: "Eliminar perfil de empresa",
    descriptionEs: "Permite eliminar informacion del perfil de empresa.",
    groupKey: "company",
    order: 70,
  },
  "company.address.read": {
    displayNameEs: "Ver direccion de empresa",
    descriptionEs: "Permite consultar la direccion registrada de la empresa.",
    groupKey: "company",
    order: 80,
  },
  "company.address.create": {
    displayNameEs: "Crear direccion de empresa",
    descriptionEs: "Permite crear datos de direccion para la empresa.",
    groupKey: "company",
    order: 90,
  },
  "company.address.update": {
    displayNameEs: "Editar direccion de empresa",
    descriptionEs: "Permite actualizar la direccion de la empresa.",
    groupKey: "company",
    order: 100,
  },
  "company.address.delete": {
    displayNameEs: "Eliminar direccion de empresa",
    descriptionEs: "Permite eliminar la direccion registrada de la empresa.",
    groupKey: "company",
    order: 110,
  },
  "company.branding.read": {
    displayNameEs: "Ver marca visual de empresa",
    descriptionEs: "Permite consultar logo, colores y activos visuales de la empresa.",
    groupKey: "company",
    order: 120,
  },
  "company.branding.create": {
    displayNameEs: "Crear marca visual de empresa",
    descriptionEs: "Permite crear configuracion de marca visual para la empresa.",
    groupKey: "company",
    order: 130,
  },
  "company.branding.update": {
    displayNameEs: "Editar marca visual de empresa",
    descriptionEs: "Permite actualizar logo, colores y estilo visual de la empresa.",
    groupKey: "company",
    order: 140,
  },
  "company.branding.delete": {
    displayNameEs: "Eliminar marca visual de empresa",
    descriptionEs: "Permite eliminar configuracion de marca visual de la empresa.",
    groupKey: "company",
    order: 150,
  },
  "contacts.read": {
    displayNameEs: "Ver contactos",
    descriptionEs: "Permite consultar clientes, proveedores y contactos.",
    groupKey: "contacts",
    order: 10,
  },
  "contacts.create": {
    displayNameEs: "Crear contactos",
    descriptionEs: "Permite registrar nuevos contactos.",
    groupKey: "contacts",
    order: 20,
  },
  "contacts.update": {
    displayNameEs: "Editar contactos",
    descriptionEs: "Permite actualizar datos de contactos existentes.",
    groupKey: "contacts",
    order: 30,
  },
  "contacts.delete": {
    displayNameEs: "Eliminar contactos",
    descriptionEs: "Permite eliminar contactos.",
    groupKey: "contacts",
    order: 40,
  },
  "finance.read": {
    displayNameEs: "Ver finanzas",
    descriptionEs: "Permite consultar informacion financiera.",
    groupKey: "finance",
    order: 10,
  },
  "finance.create": {
    displayNameEs: "Registrar movimientos financieros",
    descriptionEs: "Permite crear registros de finanzas.",
    groupKey: "finance",
    order: 20,
  },
  "finance.update": {
    displayNameEs: "Editar movimientos financieros",
    descriptionEs: "Permite actualizar registros financieros.",
    groupKey: "finance",
    order: 30,
  },
  "finance.delete": {
    displayNameEs: "Eliminar movimientos financieros",
    descriptionEs: "Permite eliminar registros financieros.",
    groupKey: "finance",
    order: 40,
  },
  "hr.read": {
    displayNameEs: "Ver RH",
    descriptionEs: "Permite consultar colaboradores y su expediente.",
    groupKey: "hr",
    order: 10,
  },
  "hr.create": {
    displayNameEs: "Crear RH",
    descriptionEs: "Permite registrar nuevos colaboradores.",
    groupKey: "hr",
    order: 20,
  },
  "hr.update": {
    displayNameEs: "Editar RH",
    descriptionEs: "Permite actualizar informacion de colaboradores.",
    groupKey: "hr",
    order: 30,
  },
  "hr.delete": {
    displayNameEs: "Deshabilitar RH",
    descriptionEs: "Permite deshabilitar colaboradores.",
    groupKey: "hr",
    order: 40,
  },
};

function inferGroupKey(permissionKey) {
  return String(permissionKey ?? "").split(".")[0] || "core";
}

export function getPermissionPresentation(permissionKey) {
  const item = PERMISSION_CATALOG[permissionKey];
  const groupKey = item?.groupKey ?? inferGroupKey(permissionKey);
  const groupLabel = GROUPS[groupKey] ?? "General";
  return {
    key: permissionKey,
    name: item?.displayNameEs ?? permissionKey,
    description: item?.descriptionEs ?? "Permiso del sistema.",
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
