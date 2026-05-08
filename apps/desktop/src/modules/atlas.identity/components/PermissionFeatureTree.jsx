import { useEffect, useMemo, useRef } from "react";
import { Card } from "@atlas/ui";

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
    return {
      moduleKey: parts[0],
      featureKey: "general",
      actionKey: parts[1],
    };
  }

  if (parts.length === 1) {
    return {
      moduleKey: "general",
      featureKey: "general",
      actionKey: parts[0],
    };
  }

  return {
    moduleKey: "general",
    featureKey: "general",
    actionKey: "sin-clave",
  };
}

function formatSegmentLabel(value) {
  if (!value) return "General";
  if (value === "general") return "General";
  return value
    .split(/[._-]/g)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function PermissionCheckbox({
  checked,
  indeterminate,
  disabled,
  label,
  description,
  onChange,
  className,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = Boolean(indeterminate && !checked);
    }
  }, [checked, indeterminate]);

  return (
    <label
      className={[
        "flex items-start gap-3 transition-colors",
        disabled ? "opacity-60" : "cursor-pointer hover:bg-[hsl(var(--muted))]/40",
        className ?? "",
      ].join(" ")}
    >
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-[hsl(var(--border))] accent-(--brand-primary) cursor-pointer disabled:cursor-default"
      />
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
    </label>
  );
}

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

  const modules = useMemo(() => {
    const moduleMap = new Map();

    for (const permission of allPermissions) {
      if (!permission?.key) continue;

      const parsed = parsePermissionKey(permission.key);
      const moduleLabel = formatSegmentLabel(parsed.moduleKey);
      const featureLabel = formatSegmentLabel(parsed.featureKey);

      if (!moduleMap.has(parsed.moduleKey)) {
        moduleMap.set(parsed.moduleKey, {
          key: parsed.moduleKey,
          label: moduleLabel,
          features: new Map(),
        });
      }

      const moduleItem = moduleMap.get(parsed.moduleKey);
      if (!moduleItem.features.has(parsed.featureKey)) {
        moduleItem.features.set(parsed.featureKey, {
          key: parsed.featureKey,
          label: featureLabel,
          items: [],
        });
      }

      moduleItem.features.get(parsed.featureKey).items.push({
        ...permission,
        actionKey: parsed.actionKey,
      });
    }

    const moduleList = [...moduleMap.values()]
      .map((moduleItem) => {
        const featureList = [...moduleItem.features.values()]
          .map((featureItem) => ({
            ...featureItem,
            items: [...featureItem.items].sort((a, b) => {
              const sortA = a.sortOrder ?? 0;
              const sortB = b.sortOrder ?? 0;
              if (sortA !== sortB) return sortA - sortB;
              return collator.compare(a.key, b.key);
            }),
          }))
          .sort((a, b) => collator.compare(a.label, b.label));

        return {
          ...moduleItem,
          features: featureList,
        };
      })
      .sort((a, b) => collator.compare(a.label, b.label));

    return moduleList;
  }, [allPermissions, collator]);

  function getSelectionState(keys) {
    if (!keys.length) return { checked: false, indeterminate: false };
    let selected = 0;
    for (const key of keys) {
      if (pendingKeys.has(key)) selected += 1;
    }
    return {
      checked: selected === keys.length,
      indeterminate: selected > 0 && selected < keys.length,
    };
  }

  return (
    <div className="space-y-4">
      {modules.map((moduleItem) => {
        const moduleKeys = moduleItem.features.flatMap((featureItem) =>
          featureItem.items.map((item) => item.key),
        );
        const moduleState = getSelectionState(moduleKeys);

        return (
          <Card key={moduleItem.key} className="p-0 overflow-hidden">
            <div className="px-4 py-3 bg-[hsl(var(--muted))]/40 border-b border-[hsl(var(--border))] flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
                  {moduleItem.label}
                </p>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-1">
                  {moduleKeys.length} permiso{moduleKeys.length !== 1 ? "s" : ""}
                </p>
              </div>
              <PermissionCheckbox
                checked={moduleState.checked}
                indeterminate={moduleState.indeterminate}
                disabled={disabled}
                label="Todo el modulo"
                className="px-0 py-0 hover:bg-transparent"
                onChange={(event) => onBulkToggle(moduleKeys, event.target.checked)}
              />
            </div>

            <div>
              {moduleItem.features.map((featureItem) => {
                const featureKeys = featureItem.items.map((item) => item.key);
                const featureState = getSelectionState(featureKeys);

                return (
                  <div
                    key={`${moduleItem.key}.${featureItem.key}`}
                    className="border-b border-[hsl(var(--border))] last:border-b-0"
                  >
                    <div className="px-4 py-2 bg-[hsl(var(--muted))]/20 border-b border-[hsl(var(--border))]">
                      <PermissionCheckbox
                        checked={featureState.checked}
                        indeterminate={featureState.indeterminate}
                        disabled={disabled}
                        label={`Funcion: ${featureItem.label}`}
                        description="Selecciona o deselecciona todos los permisos de esta funcion."
                        className="px-0 py-0 hover:bg-transparent"
                        onChange={(event) =>
                          onBulkToggle(featureKeys, event.target.checked)
                        }
                      />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
                      {featureItem.items.map((item) => {
                        const checked = pendingKeys.has(item.key);
                        const actionLabel = formatSegmentLabel(item.actionKey);
                        return (
                          <PermissionCheckbox
                            key={item.key}
                            checked={checked}
                            disabled={disabled}
                            label={actionLabel}
                            description={item.description || item.name || item.key}
                            className="px-4 py-3 border-b border-[hsl(var(--border))]"
                            onChange={() => onTogglePermission(item.key)}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
