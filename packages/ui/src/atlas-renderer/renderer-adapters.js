const ACCENT_MAP = {
  vehiculo: "vehículo", vehiculos: "vehículos",
  matricula: "matrícula", matriculas: "matrículas",
  anio: "año", anios: "años",
  gestion: "gestión", gestiones: "gestiones",
  administracion: "administración", administraciones: "administraciones",
  asignacion: "asignación", asignaciones: "asignaciones",
  creacion: "creación", actualizacion: "actualización", eliminacion: "eliminación",
  autorizacion: "autorización", autorizaciones: "autorizaciones",
  aprobacion: "aprobación", aprobaciones: "aprobaciones",
  notificacion: "notificación", notificaciones: "notificaciones",
  configuracion: "configuración", informacion: "información",
  comunicacion: "comunicación", conexion: "conexión", sesion: "sesión",
  seleccion: "selección", edicion: "edición",
  accion: "acción", acciones: "acciones",
  aplicacion: "aplicación", operacion: "operación", operaciones: "operaciones",
  funcion: "función", funciones: "funciones",
  relacion: "relación", relaciones: "relaciones",
  condicion: "condición", condiciones: "condiciones",
  situacion: "situación", direccion: "dirección", direcciones: "direcciones",
  revision: "revisión",
  modulo: "módulo", modulos: "módulos",
  numero: "número", numeros: "números",
  codigo: "código", codigos: "códigos",
  telefono: "teléfono", telefonos: "teléfonos",
  categoria: "categoría", categorias: "categorías",
  area: "área", areas: "áreas",
  periodo: "período", periodos: "períodos",
  titulo: "título", titulos: "títulos",
  credito: "crédito", creditos: "créditos",
  debito: "débito", debitos: "débitos",
  indice: "índice", indices: "índices",
  genero: "género", generos: "géneros",
  publico: "público", publicos: "públicos",
};

export function normalizeSpanishLabel(text) {
  if (!text || typeof text !== "string") return text;
  return text.replace(/\b[A-Za-z]+\b/g, (word) => {
    const lower = word.toLowerCase();
    const accented = ACCENT_MAP[lower];
    if (!accented) return word;
    if (word.length > 1 && word === word.toUpperCase()) return accented.toUpperCase();
    if (word.charAt(0) !== word.charAt(0).toLowerCase()) {
      return accented.charAt(0).toUpperCase() + accented.slice(1);
    }
    return accented;
  });
}

/**
 * Detects whether a form should render as a full page instead of a Sheet overlay.
 * Heuristic: > 6 visible (non-readonly) fields, or > 2 sections.
 */
export function shouldUsePageMode(schema, fields) {
  const sections = Array.isArray(schema?.sections) ? schema.sections : [];
  if (sections.length > 2) return true;

  const allFields = Array.isArray(fields) ? fields : [];
  const visibleFields = allFields.filter((f) => f && !f.readonly && (f.name ?? f.key ?? f.field));
  if (visibleFields.length > 6) return true;

  return false;
}

/**
 * Converts the normalized filter array used by AtlasTable to the FilterBar-compatible
 * format. Only select-type filters with at least one option are included.
 */
export function normalizeToFilterBarFilters(normalizedFilters) {
  return normalizedFilters
    .filter((f) => f.type === "select" && Array.isArray(f.options) && f.options.length > 0)
    .map((f) => ({
      key: f.key,
      label: f.label,
      options: f.options.map((o) => {
        if (o && typeof o === "object") {
          const value = o.value ?? o.key ?? o.id ?? "";
          return { value: String(value), label: String(o.label ?? o.name ?? value) };
        }
        return { value: String(o), label: String(o) };
      }),
    }));
}
