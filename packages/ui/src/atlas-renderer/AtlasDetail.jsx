import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  BookOpen,
  CalendarDays,
  Car,
  ClipboardList,
  FileText,
  Hash,
  IdCard,
  Layers,
  Library,
  Link2,
  Loader2,
  Mail,
  Palette,
  Phone,
  Tag,
  Truck,
  UserCheck,
  Wrench,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../components/Alert.jsx";
import { Button } from "../components/Button.jsx";
import { AttachmentsPanel } from "../components/AttachmentsPanel.jsx";
import { normalizeSpanishLabel } from "./renderer-adapters.js";
import { resolveColorHex } from "./atlas-form-utils.js";
import { CostsSummaryPanel } from "./CostsSummaryPanel.jsx";

const STATUS_LABELS = {
  active: "Activo",
  inactive: "Inactivo",
  maintenance: "En mantenimiento",
  retired: "Retirado",
  pending: "Pendiente",
  disabled: "Desactivado",
  draft: "Borrador",
  finalized: "Finalizado",
};

const STATUS_COLORS = {
  active: "bg-green-500/15 text-green-700 dark:text-green-400",
  inactive: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
  maintenance: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  retired: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
  pending: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  disabled: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
  draft: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
  finalized: "bg-green-500/15 text-green-700 dark:text-green-400",
};

function formatDetailDate(value) {
  if (!value) return "—";
  const str = String(value);
  const datePart = str.includes("T") ? str.slice(0, 10) : str;
  const [year, month, day] = datePart.split("-");
  if (!year || !month || !day) return str;
  return `${day}/${month}/${year}`;
}

function formatDetailCurrency(value) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);
}

const ICON_MAP = {
  Activity,
  BookOpen,
  CalendarDays,
  Car,
  ClipboardList,
  FileText,
  Hash,
  IdCard,
  Layers,
  Library,
  Link2,
  Mail,
  Palette,
  Phone,
  Tag,
  Truck,
  UserCheck,
  Wrench,
};

const ICON_ALIAS_MAP = {
  badge: Hash,
  bookopen: BookOpen,
  clipboardlist: ClipboardList,
  library: Library,
  usercheck: UserCheck,
};

function normalizeField(fieldLike) {
  if (!fieldLike || typeof fieldLike !== "object") return null;
  const name = fieldLike.name ?? fieldLike.key ?? fieldLike.field ?? null;
  if (!name) return null;
  return {
    name: String(name),
    label: normalizeSpanishLabel(fieldLike.label ?? String(name)),
    type: fieldLike.type ?? "text",
    icon:
      typeof fieldLike.icon === "string" && fieldLike.icon.trim()
        ? fieldLike.icon.trim()
        : null,
  };
}

function normalizeSectionField(item) {
  if (typeof item === "string") {
    const key = String(item).trim();
    if (!key) return null;
    return {
      name: key,
      field: { name: key, label: key, type: "text", icon: null },
    };
  }
  const normalized = normalizeField(item);
  if (!normalized) return null;
  return { name: normalized.name, field: normalized };
}

function normalizeFieldMap(fields) {
  const map = new Map();
  for (const entry of Array.isArray(fields) ? fields : []) {
    const normalized = normalizeField(entry);
    if (!normalized) continue;
    map.set(normalized.name, normalized);
  }
  return map;
}

function normalizeRelationCardConfig(config, sectionTitle) {
  if (!config || typeof config !== "object") return null;
  const subtitleFields = (Array.isArray(config.subtitleFields)
    ? config.subtitleFields
    : []
  )
    .map((field) => (typeof field === "string" ? field.trim() : ""))
    .filter(Boolean);

  return {
    idField:
      typeof config.idField === "string" && config.idField.trim()
        ? config.idField.trim()
        : null,
    titleField:
      typeof config.titleField === "string" && config.titleField.trim()
        ? config.titleField.trim()
        : null,
    subtitleFields,
    fallbackTitle: normalizeSpanishLabel(
      config.fallbackTitle ?? `No hay ${sectionTitle?.toLowerCase() ?? "relación"}.`,
    ),
    hrefTemplate:
      typeof config.hrefTemplate === "string" && config.hrefTemplate.trim()
        ? config.hrefTemplate.trim()
        : null,
    icon:
      typeof config.icon === "string" && config.icon.trim()
        ? config.icon.trim()
        : null,
  };
}

function normalizeRelationListConfig(config) {
  if (!config || typeof config !== "object") return null;
  const subtitleFields = (Array.isArray(config.subtitleFields)
    ? config.subtitleFields
    : []
  )
    .map((field) => (typeof field === "string" ? field.trim() : ""))
    .filter(Boolean);

  return {
    apiPath:
      typeof config.apiPath === "string" && config.apiPath.trim()
        ? config.apiPath.trim()
        : null,
    idField:
      typeof config.idField === "string" && config.idField.trim()
        ? config.idField.trim()
        : "id",
    titleField:
      typeof config.titleField === "string" && config.titleField.trim()
        ? config.titleField.trim()
        : null,
    subtitleFields,
    hrefTemplate:
      typeof config.hrefTemplate === "string" && config.hrefTemplate.trim()
        ? config.hrefTemplate.trim()
        : null,
    icon:
      typeof config.icon === "string" && config.icon.trim()
        ? config.icon.trim()
        : null,
    emptyMessage: normalizeSpanishLabel(
      config.emptyMessage ?? "No hay registros relacionados.",
    ),
  };
}

function normalizeSections(schema, fieldMap) {
  const rawSections = Array.isArray(schema?.sections) ? schema.sections : [];
  return rawSections
    .map((entry, sectionIndex) => {
      if (!entry || typeof entry !== "object") return null;
      const sectionType =
        typeof entry.type === "string" && entry.type.trim()
          ? entry.type.trim().toLowerCase()
          : "fields";

      const sectionTitle = normalizeSpanishLabel(
        entry.title ?? entry.label ?? `Sección ${sectionIndex + 1}`,
      );

      const sectionIcon =
        typeof entry.icon === "string" && entry.icon.trim() ? entry.icon.trim() : null;

      if (sectionType === "documents" || sectionType === "attachments") {
        const attachmentsConfig =
          sectionType === "attachments"
            ? entry.attachments ?? null
            : entry.documents ?? null;
        return {
          id: entry.id ?? entry.key ?? `section-${sectionIndex}`,
          title: sectionTitle,
          type: "attachments",
          icon: sectionIcon,
          attachments: attachmentsConfig,
        };
      }

      if (sectionType === "relation-card") {
        return {
          id: entry.id ?? entry.key ?? `section-${sectionIndex}`,
          title: sectionTitle,
          type: "relation-card",
          icon: sectionIcon,
          relationCard: normalizeRelationCardConfig(entry.relationCard, sectionTitle),
        };
      }

      if (sectionType === "relation-list") {
        return {
          id: entry.id ?? entry.key ?? `section-${sectionIndex}`,
          title: sectionTitle,
          type: "relation-list",
          icon: sectionIcon,
          relationList: normalizeRelationListConfig(entry.relationList),
        };
      }

      const fieldDefs = (Array.isArray(entry.fields) ? entry.fields : [])
        .map((item) => normalizeSectionField(item))
        .filter(Boolean);

      const fieldNames = [];
      for (const fieldDef of fieldDefs) {
        const name = fieldDef.name;
        if (!fieldMap.has(name)) {
          fieldMap.set(name, fieldDef.field);
        } else {
          const existing = fieldMap.get(name);
          fieldMap.set(name, {
            ...existing,
            label: fieldDef.field.label ?? existing?.label ?? name,
            type: fieldDef.field.type ?? existing?.type ?? "text",
            icon: fieldDef.field.icon ?? existing?.icon ?? null,
          });
        }
        if (!fieldNames.includes(name)) fieldNames.push(name);
      }

      const cols = Number(entry.columns);
      const columns = cols === 1 ? 1 : cols === 2 ? 2 : "auto";

      return {
        id: entry.id ?? entry.key ?? `section-${sectionIndex}`,
        title: sectionTitle,
        type: "fields",
        columns,
        icon: sectionIcon,
        fields: fieldNames,
      };
    })
    .filter(Boolean);
}

function renderValue(field, value) {
  if (value === undefined || value === null || value === "") return "—";
  if (field?.type === "boolean") return value ? "Sí" : "No";

  if (field?.type === "date" || field?.type === "datetime") {
    return formatDetailDate(value);
  }

  if (field?.type === "currency" || field?.type === "decimal") {
    return formatDetailCurrency(value);
  }

  if (field?.type === "select" && Array.isArray(field?.options)) {
    const str = String(value);
    const opt = field.options.find((o) => String(o.value) === str);
    if (opt?.label) return opt.label;
  }

  if (field?.type === "color") {
    const colorStr = String(value);
    const hex = resolveColorHex(colorStr);
    const displayName = colorStr.startsWith("#") ? (colorStr) : colorStr;
    return (
      <span className="inline-flex items-center gap-2">
        {hex && (
          <span
            className="inline-block h-4 w-4 rounded-full border border-[hsl(var(--border))] shadow-sm shrink-0"
            style={{ backgroundColor: hex }}
          />
        )}
        <span>{displayName}</span>
      </span>
    );
  }

  if (typeof value === "object") return JSON.stringify(value);
  const str = String(value);
  const lower = str.toLowerCase();
  const label = STATUS_LABELS[lower];
  if (label) {
    const chipClass =
      STATUS_COLORS[lower] ??
      "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]";
    return (
      <span
        className={`inline-block text-xs font-medium rounded-full px-2.5 py-0.5 ${chipClass}`}
      >
        {label}
      </span>
    );
  }
  return str;
}

function gridClass(columns) {
  if (columns === 1) return "grid gap-4";
  if (columns === 2) return "grid gap-4 md:grid-cols-2";
  return "grid gap-4 lg:grid-cols-2";
}

function joinUrl(baseUrl, apiPath) {
  const base = String(baseUrl ?? "").trim().replace(/\/+$/, "");
  const path = String(apiPath ?? "").trim();
  if (!path) return base;
  if (!path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}

function replacePathTokens(pathTemplate, tokenMap) {
  let path = String(pathTemplate ?? "");
  for (const [key, rawValue] of Object.entries(tokenMap ?? {})) {
    const safeValue = encodeURIComponent(String(rawValue ?? "").trim());
    path = path.replace(new RegExp(`:${key}\\b`, "g"), safeValue);
  }
  return path;
}

function parseJsonSafe(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractArrayPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && typeof payload.data === "object") {
    return extractArrayPayload(payload.data);
  }
  return [];
}

function getByPath(value, path) {
  if (!path || typeof path !== "string") return undefined;
  return path
    .split(".")
    .reduce((cursor, segment) =>
      cursor && typeof cursor === "object" ? cursor[segment] : undefined,
    value);
}

function normalizeIconName(name) {
  if (typeof name !== "string" || !name.trim()) return null;
  const raw = name.trim();
  if (ICON_MAP[raw]) return raw;
  const normalized = raw.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (ICON_ALIAS_MAP[normalized]) return normalized;
  const pascal = raw
    .split(/[^a-zA-Z0-9]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
  if (ICON_MAP[pascal]) return pascal;
  return null;
}

function resolveIcon(name) {
  const normalized = normalizeIconName(name);
  if (!normalized) return null;
  return ICON_MAP[normalized] ?? ICON_ALIAS_MAP[normalized] ?? null;
}

function normalizeTextValue(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function RelationCardSection({ section, data }) {
  const relationCard = section.relationCard;
  if (!relationCard?.idField) {
    return (
      <div className="rounded-xl border border-dashed border-[hsl(var(--border))] px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
        Configuración de relación no disponible.
      </div>
    );
  }

  const relatedId = getByPath(data, relationCard.idField);
  const hasRelatedId = Boolean(normalizeTextValue(relatedId));
  const rawTitle = relationCard.titleField
    ? getByPath(data, relationCard.titleField)
    : null;
  const cleanTitle = normalizeTextValue(rawTitle);

  const title = hasRelatedId
    ? cleanTitle || "Registro relacionado"
    : relationCard.fallbackTitle;

  const subtitles = relationCard.subtitleFields
    .map((fieldKey) => normalizeTextValue(getByPath(data, fieldKey)))
    .filter(Boolean);

  const href =
    hasRelatedId && relationCard.hrefTemplate
      ? replacePathTokens(relationCard.hrefTemplate, { id: relatedId })
      : null;

  const Icon = resolveIcon(relationCard.icon) ?? Link2;

  const content = (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 transition-colors hover:border-[hsl(var(--ring))]">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
          <Icon size={16} />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">
            {title}
          </p>
          {subtitles.length > 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
              {subtitles.join(" · ")}
            </p>
          ) : null}
          {href ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Ir al detalle relacionado
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (!href) return content;

  return (
    <a href={href} className="block">
      {content}
    </a>
  );
}

function RelationListSection({ section, data, apiBaseUrl, token }) {
  const relationList = section.relationList;
  const recordId = data?.id ?? null;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function fetchItems() {
      if (!recordId || !relationList?.apiPath) {
        setItems([]);
        setLoading(false);
        setError("");
        return;
      }

      setLoading(true);
      setError("");
      try {
        const endpointPath = replacePathTokens(relationList.apiPath, { id: recordId });
        const response = await fetch(joinUrl(apiBaseUrl, endpointPath), {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const text = await response.text();
        const payload = parseJsonSafe(text);

        if (!response.ok) {
          throw new Error("No se pudieron cargar los registros relacionados.");
        }

        const rows = extractArrayPayload(payload);
        if (!isCancelled) setItems(rows);
      } catch {
        if (!isCancelled) {
          setItems([]);
          setError("No se pudieron cargar los registros relacionados.");
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    fetchItems();

    return () => {
      isCancelled = true;
    };
  }, [apiBaseUrl, token, recordId, relationList?.apiPath]);

  const Icon = resolveIcon(relationList?.icon) ?? Link2;

  if (!relationList?.apiPath) {
    return (
      <div className="rounded-xl border border-dashed border-[hsl(var(--border))] px-4 py-3 text-sm text-[hsl(var(--muted-foreground))]">
        Configuración de lista relacionada no disponible.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
        <Loader2 size={16} className="animate-spin" />
        Cargando relaciones...
      </div>
    );
  }

  if (error) {
    return (
      <div className="inline-flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
        <AlertCircle size={16} />
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        {relationList.emptyMessage || "No hay registros relacionados."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const itemId = getByPath(item, relationList.idField);
        const rawTitle = relationList.titleField
          ? getByPath(item, relationList.titleField)
          : null;
        const title = normalizeTextValue(rawTitle) || "Registro relacionado";
        const subtitles = relationList.subtitleFields
          .map((fieldKey) => normalizeTextValue(getByPath(item, fieldKey)))
          .filter(Boolean);
        const href =
          relationList.hrefTemplate && normalizeTextValue(itemId)
            ? replacePathTokens(relationList.hrefTemplate, { id: itemId })
            : null;

        const content = (
          <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 transition-colors hover:border-[hsl(var(--ring))]">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                <Icon size={16} />
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">
                  {title}
                </p>
                {subtitles.length > 0 ? (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                    {subtitles.join(" · ")}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        );

        if (!href) return <div key={`${section.id}-${index}`}>{content}</div>;

        return (
          <a key={`${section.id}-${index}`} href={href} className="block">
            {content}
          </a>
        );
      })}
    </div>
  );
}

function FieldLabel({ field }) {
  const Icon = resolveIcon(field?.icon) ?? null;

  if (!Icon) {
    return <>{field.label}</>;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={13} />
      {field.label}
    </span>
  );
}

export function AtlasDetail({
  blueprint,
  fields,
  data,
  onEdit,
  onBack,
  token,
  apiBaseUrl,
}) {
  const schema = blueprint?.schema ?? {};
  const fieldMap = useMemo(() => normalizeFieldMap(fields), [fields]);
  const sections = useMemo(
    () => normalizeSections(schema, fieldMap),
    [schema, fieldMap],
  );

  if (!data || typeof data !== "object") {
    return (
      <Alert variant="warning">
        <AlertTitle>Sin información</AlertTitle>
        <AlertDescription>No hay datos para mostrar en el detalle.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {(onBack || onEdit) && (
        <div className="flex items-center justify-end gap-2">
          {onBack && (
            <Button type="button" variant="outline" onClick={() => onBack?.()}>
              Volver
            </Button>
          )}
          {onEdit && (
            <Button type="button" onClick={() => onEdit?.(data)}>
              Editar
            </Button>
          )}
        </div>
      )}

      {sections.length === 0 && (
        <Alert variant="warning">
          <AlertTitle>Detalle sin secciones</AlertTitle>
          <AlertDescription>
            Esta vista no tiene <code>schema.sections</code> configurado.
          </AlertDescription>
        </Alert>
      )}

      {sections.map((section) => (
        <div
          key={section.id}
          className="space-y-4"
        >
          {section.title ? (
            <div className="pb-3 border-b border-[hsl(var(--border))] flex items-center gap-2">
              {(() => {
                const SectionIcon = section.icon ? LucideIcons[section.icon] : null;
                return SectionIcon ? (
                  <SectionIcon className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                ) : null;
              })()}
              <h4 className="text-sm font-semibold text-[hsl(var(--foreground))]">
                {section.title}
              </h4>
            </div>
          ) : null}

          {section.type === "attachments" ? (
            <AttachmentsPanel
              apiBaseUrl={apiBaseUrl}
              token={token}
              recordId={data?.id ?? null}
              config={section.attachments ?? {}}
              context="detail"
            />
          ) : null}

          {section.type === "relation-card" ? (
            <RelationCardSection section={section} data={data} />
          ) : null}

          {section.type === "relation-list" ? (
            <RelationListSection
              section={section}
              data={data}
              apiBaseUrl={apiBaseUrl}
              token={token}
            />
          ) : null}

          {section.type === "fields" ? (
            <div className="space-y-4">
              <dl className={gridClass(section.columns)}>
                {section.fields.map((fieldName) => {
                  const field = fieldMap.get(fieldName);
                  if (!field) return null;
                  const value = data[field.name];
                  return (
                    <div key={field.name} className="space-y-1">
                      <dt className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                        <FieldLabel field={field} />
                      </dt>
                      <dd className="text-sm text-[hsl(var(--foreground))]">
                        {renderValue(field, value)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              {section.fields.includes("labor_cost") &&
                section.fields.includes("parts_cost") &&
                section.fields.includes("total_cost") ? (
                <CostsSummaryPanel
                  laborCost={data.labor_cost ?? 0}
                  partsCost={data.parts_cost ?? 0}
                  totalCost={data.total_cost ?? 0}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
