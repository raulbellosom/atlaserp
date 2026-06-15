export class DocumentProviderError extends Error {
  constructor(message, status = 400, code = "document_provider_error") {
    super(message);
    this.name = "DocumentProviderError";
    this.status = status;
    this.code = code;
  }
}

function assertProvider(provider) {
  if (
    !provider ||
    typeof provider.sourceType !== "string" ||
    !provider.sourceType.trim() ||
    typeof provider.permissionKey !== "string" ||
    !provider.permissionKey.trim() ||
    typeof provider.getSchema !== "function" ||
    typeof provider.load !== "function"
  ) {
    throw new DocumentProviderError(
      "El proveedor de documentos no cumple el contrato requerido.",
      500,
      "invalid_provider",
    );
  }
}

export function createDocumentProviderRegistry() {
  const providers = new Map();

  function register(provider) {
    assertProvider(provider);
    const sourceType = provider.sourceType.trim();
    if (providers.has(sourceType)) {
      throw new DocumentProviderError(
        `El proveedor ${sourceType} ya esta registrado.`,
        409,
        "provider_already_registered",
      );
    }
    providers.set(sourceType, provider);
    return provider;
  }

  function resolve(sourceType) {
    const provider = providers.get(sourceType);
    if (!provider) {
      throw new DocumentProviderError(
        "Proveedor de documentos no encontrado.",
        404,
        "provider_not_found",
      );
    }
    return provider;
  }

  function assertPermission(provider, { permissionKeys = [], isAdmin = false }) {
    if (isAdmin || new Set(permissionKeys).has(provider.permissionKey)) return;
    throw new DocumentProviderError(
      "No tienes permiso para consultar el origen del documento.",
      403,
      "source_permission_denied",
    );
  }

  function getSchema({ sourceType, permissionKeys, isAdmin }) {
    const provider = resolve(sourceType);
    assertPermission(provider, { permissionKeys, isAdmin });
    return provider.getSchema();
  }

  async function load({
    sourceType,
    companyId,
    sourceId,
    actorId,
    permissionKeys,
    isAdmin,
  }) {
    const provider = resolve(sourceType);
    assertPermission(provider, { permissionKeys, isAdmin });
    return provider.load({ companyId, sourceId, actorId });
  }

  return {
    register,
    getSchema,
    load,
  };
}
