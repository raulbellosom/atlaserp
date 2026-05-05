import { createModuleManifest, MODULE_KINDS } from "@atlas/core";

export const atlasCoreMap = createModuleManifest({
  key: "atlas.core",
  name: "Atlas Core",
  description:
    "Core runtime, registry, permissions, audit and system configuration.",
  version: "0.1.0",
  kind: MODULE_KINDS.CORE,
  core: true,
  uninstallable: false,
  icon: "Layers",
  color: "#0A7BFF",
  category: "sistema",
  summary: "Modulos, permisos, bitacora y configuracion del sistema",
  navigation: [
    { label: "Dashboard", path: "/", icon: "LayoutDashboard", layout: "main" },
    { label: "Modulos", path: "/modules", icon: "Puzzle", layout: "main" },
    {
      label: "Configuracion",
      path: "/settings",
      icon: "Settings",
      layout: "main",
    },
  ],
  permissions: [
    { key: "core.read", name: "Read Core" },
    { key: "core.manage", name: "Manage Core" },
    { key: "modules.install", name: "Install Modules" },
    { key: "modules.uninstall", name: "Uninstall Modules" },
    { key: "modules.disable", name: "Disable Modules" },
    { key: "audit.read", name: "Read Audit Logs" },
  ],
  blueprints: [
    {
      key: "atlas.module.entity",
      kind: "ENTITY",
      version: "0.1.0",
      schema: {
        entity: "AtlasModule",
        label: "Modulo",
        fields: [
          { name: "key", label: "Clave", type: "text", required: true },
          { name: "name", label: "Nombre", type: "text", required: true },
          { name: "version", label: "Version", type: "text", required: true },
          {
            name: "kind",
            label: "Tipo",
            type: "select",
            options: ["CORE", "FEATURE", "INTEGRATION", "WEBSITE"],
          },
          { name: "enabled", label: "Activo", type: "boolean" },
        ],
      },
    },
  ],
});

export const identityMap = createModuleManifest({
  key: "atlas.identity",
  name: "Identidad",
  description: "Profiles, companies, roles, permissions and memberships.",
  version: "0.1.0",
  kind: MODULE_KINDS.CORE,
  core: true,
  uninstallable: false,
  icon: "Users",
  color: "#21C7FF",
  category: "sistema",
  summary: "Usuarios, empresas, roles y membresias",
  dependencies: [{ key: "atlas.core" }],
  navigation: [
    {
      label: "Usuarios",
      path: "/identity/users",
      icon: "Users",
      layout: "main",
    },
    { label: "Roles", path: "/identity/roles", icon: "Shield", layout: "main" },
  ],
  permissions: [
    { key: "identity.read", name: "Read Identity" },
    { key: "identity.manage", name: "Manage Identity" },
    { key: "roles.read", name: "Read Roles" },
    { key: "roles.manage", name: "Manage Roles" },
    { key: "permissions.read", name: "Read Permissions" },
    { key: "permissions.manage", name: "Manage Permissions" },
  ],
});

export const filesMap = createModuleManifest({
  key: "atlas.files",
  name: "Archivos",
  description: "File metadata and storage integration.",
  version: "0.1.0",
  kind: MODULE_KINDS.CORE,
  core: true,
  uninstallable: false,
  icon: "FolderOpen",
  color: "#f59e0b",
  category: "sistema",
  summary: "Gestion de archivos y almacenamiento",
  dependencies: [{ key: "atlas.core" }],
  navigation: [
    {
      label: "Archivos",
      path: "/files",
      icon: "FolderOpen",
      layout: "main",
    },
  ],
  permissions: [
    { key: "files.read", name: "Read Files" },
    { key: "files.upload", name: "Upload Files" },
    { key: "files.delete", name: "Delete Files" },
    { key: "files.manage", name: "Manage Files" },
  ],
});

export const companyMap = createModuleManifest({
  key: "atlas.company",
  name: "Empresa",
  description:
    "Company profile, address, branding and visual identity management.",
  version: "0.1.0",
  kind: MODULE_KINDS.CORE,
  core: true,
  uninstallable: false,
  icon: "Building2",
  color: "#ec4899",
  category: "sistema",
  summary: "Perfil, direccion y marca visual de la empresa",
  dependencies: [{ key: "atlas.core" }, { key: "atlas.files" }],
  navigation: [
    {
      label: "Resumen",
      path: "/",
      icon: "LayoutDashboard",
      layout: "main",
    },
    {
      label: "Perfil",
      path: "/company",
      icon: "Building2",
      layout: "main",
    },
    {
      label: "Direccion",
      path: "/company/address",
      icon: "MapPin",
      layout: "main",
    },
    {
      label: "Marca visual",
      path: "/company/branding",
      icon: "Palette",
      layout: "main",
    },
  ],
  permissions: [
    { key: "company.read", name: "Read Company" },
    { key: "company.manage", name: "Manage Company" },
  ],
  exposes: {
    logoUrl: "string",
    primaryColor: "string",
    companyName: "string",
    contactEmail: "string",
    phone: "string",
  },
});

export const coreModules = [atlasCoreMap, identityMap, filesMap, companyMap];
