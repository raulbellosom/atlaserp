const GROUPS = {
  core: "Core",
  modules: "Modulos",
  identity: "Identidad",
  roles: "Roles",
  permissions: "Permisos",
  files: "Archivos",
  company: "Empresa",
  contacts: "Contactos",
  finance: "Finanzas",
  hr: "Recursos Humanos",
  audit: "Bitacora",
};

export const PERMISSION_CATALOG = {
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
  "modules.install": {
    displayNameEs: "Instalar modulos",
    descriptionEs: "Permite instalar modulos en el catalogo.",
    groupKey: "modules",
    order: 10,
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
