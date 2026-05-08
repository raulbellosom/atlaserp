import { useEffect, useMemo, useState } from "react";
import { Card, SearchInput, Switch } from "@atlas/ui";
import { ChevronDown, ChevronRight } from "lucide-react";

const MODULE_LABELS = {
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

const FEATURE_LABELS = {
  general: "General",
  modules: "Modulos",
  instance: "Configuracion",
  users: "Usuarios",
  roles: "Roles",
  permissions: "Permisos",
  self: "Perfil propio",
  profile: "Perfil",
  avatar: "Avatar",
  password: "Contrasena",
  assets: "Archivos",
  contacts: "Contactos",
  ar: "CxC",
  ap: "CxP",
  accounts: "Cuentas",
  entries: "Polizas",
  applications: "Aplicaciones",
  tax_rates: "Impuestos",
  fx_rates: "Tipo de cambio",
  dashboard: "Resumen",
  aging: "Aging",
  documents: "Documentos",
  employee: "Colaboradores",
  department: "Departamentos",
  job_title: "Puestos",
  org_chart: "Organigrama",
  address: "Direccion",
  branding: "Marca visual",
};

const ACTION_LABELS = {
  read: "Ver",
  create: "Crear",
  update: "Editar",
  delete: "Eliminar",
  access: "Acceder",
  install: "Instalar",
  uninstall: "Desinstalar",
  disable: "Deshabilitar",
  manage: "Administrar",
  reverse: "Revertir",
  send: "Enviar",
};

function parsePermissionKey(key) {
  const parts = String(key ?? "")
    .split(".")
    .filter(Boolean);
  if (parts.length >= 3) {
    return {
      moduleKey: parts[0],
      featureKey: parts.slice(1, -1).join("."),
      actionKey: parts.at(-1),
    };
  }
  if (parts.length === 2) {
    return { moduleKey: parts[0], featureKey: "general", actionKey: parts[1] };
  }
  if (parts.length === 1) {
    return { moduleKey: "general", featureKey: "general", actionKey: parts[0] };
  }
  return { moduleKey: "general", featureKey: "general", actionKey: "sin-clave" };
}

function formatSegmentLabel(value) {
  if (!value || value === "general") return "General";
  return value
    .split(/[._-]/g)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function getModuleLabel(key) {
  return MODULE_LABELS[key] ?? formatSegmentLabel(key);
}
function getFeatureLabel(key) {
  return FEATURE_LABELS[key] ?? formatSegmentLabel(key);
}
function getActionLabel(key) {
  return ACTION_LABELS[key] ?? formatSegmentLabel(key);
}

// ── Styled Switch with visible active color ────────────────────────────────────
// Use important modifier to override the base indigo-500 from the component

function PermSwitch({ checked, disabled, onCheckedChange, size = "sm" }) {
  return (
    <Switch
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      className={
        size === "lg"
          ? "h-6 w-11 data-[state=checked]:bg-emerald-500! shrink-0"
          : "data-[state=checked]:bg-emerald-500! shrink-0"
      }
    />
  );
}

// ── Bulk toggle with partial-state counter ─────────────────────────────────────

function BulkSwitch({ selectedCount, totalCount, disabled, onToggle }) {
  const allChecked = totalCount > 0 && selectedCount === totalCount;
  const partial = selectedCount > 0 && selectedCount < totalCount;

  return (
    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
      {partial && (
        <span className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          {selectedCount}/{totalCount}
        </span>
      )}
      <PermSwitch
        checked={allChecked}
        disabled={disabled}
        onCheckedChange={(checked) => onToggle(checked)}
        size="sm"
      />
    </div>
  );
}

// ── Individual permission row ──────────────────────────────────────────────────

function PermissionRow({ checked, disabled, label, description, onChange }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[hsl(var(--border))]/60 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{label}</p>
        {description && (
          <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <PermSwitch
        checked={checked}
        disabled={disabled}
        onCheckedChange={() => onChange()}
        size="sm"
      />
    </div>
  );
}

// ── Filter pill group ──────────────────────────────────────────────────────────

const FILTERS = [
  { value: "all", label: "Todos" },
  { value: "assigned", label: "Asignados" },
  { value: "unassigned", label: "Sin asignar" },
];

function FilterPills({ value, onChange }) {
  return (
    <div className="flex items-center rounded-xl border border-[hsl(var(--border))] overflow-hidden text-xs font-medium shrink-0">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          type="button"
          onClick={() => onChange(f.value)}
          className={[
            "px-3 py-2 transition-colors whitespace-nowrap",
            value === f.value
              ? "bg-[--brand-primary] text-[--brand-primary-foreground]"
              : "hover:bg-[hsl(var(--muted))]/60 text-[hsl(var(--muted-foreground))]",
          ].join(" ")}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

// ── Main tree ──────────────────────────────────────────────────────────────────

export default function PermissionFeatureTree({
  allPermissions,
  pendingKeys,
  onTogglePermission,
  onBulkToggle,
  disabled,
}) {
  const collator = useMemo(
    () => new Intl.Collator("es", { sensitivity: "base", numeric: true }),
    [],
  );

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  // Tracks which modules the user has manually opened (default: derived from assignments)
  const [openedModules, setOpenedModules] = useState(new Set());
  const [initialized, setInitialized] = useState(false);

  // Build full module tree from all permissions
  const modules = useMemo(() => {
    const moduleMap = new Map();

    for (const permission of allPermissions) {
      if (!permission?.key) continue;
      const parsed = parsePermissionKey(permission.key);

      if (!moduleMap.has(parsed.moduleKey)) {
        moduleMap.set(parsed.moduleKey, {
          key: parsed.moduleKey,
          label: getModuleLabel(parsed.moduleKey),
          features: new Map(),
        });
      }

      const moduleItem = moduleMap.get(parsed.moduleKey);
      if (!moduleItem.features.has(parsed.featureKey)) {
        moduleItem.features.set(parsed.featureKey, {
          key: parsed.featureKey,
          label: getFeatureLabel(parsed.featureKey),
          items: [],
        });
      }

      moduleItem.features.get(parsed.featureKey).items.push({
        ...permission,
        actionKey: parsed.actionKey,
      });
    }

    return [...moduleMap.values()]
      .map((mod) => ({
        ...mod,
        features: [...mod.features.values()]
          .map((feat) => ({
            ...feat,
            items: [...feat.items].sort((a, b) => {
              const diff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
              return diff !== 0 ? diff : collator.compare(a.key, b.key);
            }),
          }))
          .sort((a, b) => collator.compare(a.label, b.label)),
      }))
      .sort((a, b) => collator.compare(a.label, b.label));
  }, [allPermissions, collator]);

  // Initialize opened modules: expand those that have at least one assigned permission
  useEffect(() => {
    if (initialized || !pendingKeys || modules.length === 0) return;
    const open = new Set();
    for (const mod of modules) {
      const keys = mod.features.flatMap((f) => f.items.map((i) => i.key));
      if (keys.some((k) => pendingKeys.has(k))) open.add(mod.key);
    }
    setOpenedModules(open);
    setInitialized(true);
  }, [initialized, pendingKeys, modules]);

  // Flat list of all module keys for selection stats
  const allModuleKeys = useMemo(
    () =>
      modules.reduce((acc, mod) => {
        mod.features.forEach((f) => f.items.forEach((i) => acc.push(i.key)));
        return acc;
      }, []),
    [modules],
  );

  // Filtered module tree based on search + filter
  const filteredModules = useMemo(() => {
    const q = search.trim().toLowerCase();

    return modules
      .map((mod) => ({
        ...mod,
        features: mod.features
          .map((feat) => ({
            ...feat,
            items: feat.items.filter((item) => {
              if (q) {
                const label = getActionLabel(item.actionKey).toLowerCase();
                const desc = (item.description || item.name || item.key).toLowerCase();
                if (
                  !label.includes(q) &&
                  !desc.includes(q) &&
                  !item.key.toLowerCase().includes(q)
                )
                  return false;
              }
              if (filter === "assigned") return pendingKeys.has(item.key);
              if (filter === "unassigned") return !pendingKeys.has(item.key);
              return true;
            }),
          }))
          .filter((feat) => feat.items.length > 0),
      }))
      .filter((mod) => mod.features.length > 0);
  }, [modules, search, filter, pendingKeys]);

  function isModuleOpen(moduleKey, hasFilteredContent) {
    // Auto-expand when searching or filtering — so results are always visible
    if ((search.trim() || filter !== "all") && hasFilteredContent) return true;
    return openedModules.has(moduleKey);
  }

  function toggleModule(key) {
    setOpenedModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const totalPerms = allModuleKeys.length;
  const totalAssigned = allModuleKeys.filter((k) => pendingKeys.has(k)).length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
          placeholder="Buscar permiso..."
          className="flex-1 min-w-0 sm:max-w-xs"
        />
        <FilterPills value={filter} onChange={setFilter} />
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
        <span>
          <span className="tabular-nums font-semibold text-[hsl(var(--foreground))]">
            {totalAssigned}
          </span>{" "}
          de{" "}
          <span className="tabular-nums font-semibold text-[hsl(var(--foreground))]">
            {totalPerms}
          </span>{" "}
          permisos asignados
        </span>
        {(search || filter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFilter("all");
            }}
            className="hover:underline cursor-pointer text-[--brand-primary]"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Empty state */}
      {filteredModules.length === 0 && (
        <div className="rounded-2xl border border-[hsl(var(--border))] px-4 py-10 text-center">
          <p className="text-sm font-medium text-[hsl(var(--foreground))]">
            Sin resultados
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            No hay permisos que coincidan con los filtros aplicados.
          </p>
        </div>
      )}

      {/* Module cards */}
      {filteredModules.map((moduleItem) => {
        // Use original (non-filtered) keys for bulk toggle actions
        const originalModule = modules.find((m) => m.key === moduleItem.key);
        const allModKeys =
          originalModule?.features.flatMap((f) => f.items.map((i) => i.key)) ?? [];
        const moduleSelected = allModKeys.filter((k) => pendingKeys.has(k)).length;
        const isOpen = isModuleOpen(moduleItem.key, moduleItem.features.length > 0);

        return (
          <Card key={moduleItem.key} className="p-0 overflow-hidden">
            {/* Collapsible module header */}
            <button
              type="button"
              onClick={() => toggleModule(moduleItem.key)}
              className="w-full px-4 py-3 glass-subtle border-b border-[hsl(var(--border))] flex items-center gap-3 hover:bg-[hsl(var(--muted))]/30 transition-colors text-left"
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
              )}

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[hsl(var(--foreground))]">
                  {moduleItem.label}
                </p>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 tabular-nums">
                  {moduleSelected}/{allModKeys.length} asignados
                </p>
              </div>

              {/* Bulk switch — stopPropagation so it doesn't toggle collapse */}
              <BulkSwitch
                selectedCount={moduleSelected}
                totalCount={allModKeys.length}
                disabled={disabled}
                onToggle={(checked) => onBulkToggle(allModKeys, checked)}
              />
            </button>

            {/* Feature groups (visible when open) */}
            {isOpen && (
              <div>
                {moduleItem.features.map((featureItem) => {
                  const originalFeature = originalModule?.features.find(
                    (f) => f.key === featureItem.key,
                  );
                  const allFeatKeys =
                    originalFeature?.items.map((i) => i.key) ??
                    featureItem.items.map((i) => i.key);
                  const featureSelected = allFeatKeys.filter((k) =>
                    pendingKeys.has(k),
                  ).length;

                  return (
                    <div
                      key={`${moduleItem.key}.${featureItem.key}`}
                      className="border-b border-[hsl(var(--border))] last:border-b-0"
                    >
                      {/* Feature header */}
                      <div className="px-4 py-2.5 bg-[hsl(var(--muted))]/20 border-b border-[hsl(var(--border))]/60 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                          {featureItem.label}
                        </p>
                        <BulkSwitch
                          selectedCount={featureSelected}
                          totalCount={allFeatKeys.length}
                          disabled={disabled}
                          onToggle={(checked) =>
                            onBulkToggle(allFeatKeys, checked)
                          }
                        />
                      </div>

                      {/* Permission rows — 2 cols on md+ */}
                      <div className="grid grid-cols-1 md:grid-cols-2">
                        {featureItem.items.map((item) => (
                          <PermissionRow
                            key={item.key}
                            checked={pendingKeys.has(item.key)}
                            disabled={disabled}
                            label={getActionLabel(item.actionKey)}
                            description={
                              item.description || item.name || item.key
                            }
                            onChange={() => onTogglePermission(item.key)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
