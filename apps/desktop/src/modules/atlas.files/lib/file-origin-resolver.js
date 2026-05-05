const MODULE_LABELS = {
  "atlas.core": "Atlas Core",
  "atlas.identity": "Identidad",
  "atlas.files": "Archivos",
  "atlas.company": "Empresa",
  "atlas.contacts": "Contactos",
  "atlas.finance": "Finanzas",
  "atlas.hr": "Recursos Humanos",
};

function getModuleLabel(moduleKey) {
  return MODULE_LABELS[moduleKey] ?? moduleKey ?? "Modulo desconocido";
}

export function resolveFileOrigin(file) {
  const detailPath = `/app/m/atlas.files/files/${file?.id ?? ""}`;
  const moduleKey = file?.moduleKey ?? "atlas.files";
  const sourceEntityId = file?.metadata?.sourceEntityId ?? null;

  if (moduleKey === "atlas.company") {
    return {
      label: "Logo de empresa",
      moduleLabel: getModuleLabel(moduleKey),
      detailPath,
      originPath: "/app/m/atlas.company/company/branding",
      originHint: "Logotipo y colores de marca",
    };
  }

  if (moduleKey === "atlas.contacts") {
    return {
      label: "Modulo de contactos",
      moduleLabel: getModuleLabel(moduleKey),
      detailPath,
      originPath: "/app/m/atlas.contacts/contacts",
      originHint: sourceEntityId
        ? `Relacionado con contacto ${sourceEntityId}`
        : "Relacionado con contactos",
    };
  }

  if (moduleKey === "atlas.files") {
    return {
      label: "Modulo de archivos",
      moduleLabel: getModuleLabel(moduleKey),
      detailPath,
      originPath: "/app/m/atlas.files/files",
      originHint: "Archivo cargado desde el explorador",
    };
  }

  if (moduleKey === "atlas.hr") {
    return {
      label: "Modulo de RH",
      moduleLabel: getModuleLabel(moduleKey),
      detailPath,
      originPath: sourceEntityId
        ? `/app/m/atlas.hr/hr/employees/${sourceEntityId}`
        : "/app/m/atlas.hr/hr/employees",
      originHint: sourceEntityId
        ? `Relacionado con colaborador ${sourceEntityId}`
        : "Relacionado con colaboradores",
    };
  }

  return {
    label: getModuleLabel(moduleKey),
    moduleLabel: getModuleLabel(moduleKey),
    detailPath,
    originPath: null,
    originHint: "Origen no navegable en esta version",
  };
}
