export const MODULE_KINDS = {
  CORE: "CORE",
  FEATURE: "FEATURE",
  INTEGRATION: "INTEGRATION",
  WEBSITE: "WEBSITE",
};

export function createModuleManifest(manifest) {
  if (!manifest?.key) throw new Error("Module manifest requires key");
  if (!manifest?.name) throw new Error(`Module ${manifest.key} requires name`);
  if (!manifest?.version)
    throw new Error(`Module ${manifest.key} requires version`);
  return {
    kind: MODULE_KINDS.FEATURE,
    core: false,
    uninstallable: true,
    // Visual identity
    icon: "Box",
    color: null, // hex - null means use brand primary
    category: "general",
    summary: "",
    cover: null, // optional gradient/image string for launcher card
    // Navigation/layout
    layoutMode: "default", // default | no-sidebar | custom
    customSidebar: false,
    sections: [], // [{label, items: [nav items]}] - groups for sidebar
    dependencies: [],
    permissions: [],
    navigation: [],
    acl: {
      module: null,
      actions: {},
      models: {},
    },
    routes: [],
    blueprints: [],
    exposes: {},
    consumes: {},
    ...manifest,
  };
}
