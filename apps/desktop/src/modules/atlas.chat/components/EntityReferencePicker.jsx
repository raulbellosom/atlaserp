import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverAnchor, PopoverContent, SelectField, ComboboxField } from "@atlas/ui";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

// Fixed 4-type set — values match the backend's `entityType` enum in
// chatSendMessageSchema (packages/validators/src/chat.js) byte-for-byte,
// since these strings round-trip to the API unchanged.
const ENTITY_TYPES = [
  { value: "contact", label: "Contacto" },
  { value: "file", label: "Archivo" },
  { value: "ledger_account", label: "Cuenta contable" },
  { value: "hr_employee", label: "Colaborador" },
];

// ComboboxField (packages/ui/src/components/FormFields.jsx) does NOT do
// server-side search-as-you-type: its `onSearchChange` fires exactly once,
// when first opened with an empty `options` array, and every keystroke after
// that only filters the already-loaded array client-side. So each entity
// type's list is fetched ONCE (a capped page) when that type is selected —
// not per keystroke — and ComboboxField's own client-side filter narrows it.
async function fetchOptions(entityType, token) {
  if (entityType === "contact") {
    // Dedicated lightweight picker endpoint (server clamps limit to 30).
    const res = await atlas.contacts.picker(token, { limit: 100 });
    return (res?.data ?? []).map((c) => ({ label: c.name, value: c.id }));
  }
  if (entityType === "file") {
    // Params first, token second — different arg order than the other three.
    const res = await atlas.files.list({ pageSize: 100 }, token);
    return (res?.data ?? []).map((f) => ({ label: f.originalName, value: f.id }));
  }
  if (entityType === "hr_employee") {
    // The SDK's listEmployees only forwards q/status/enabled/limit — NOT
    // pageSize (silently dropped) — so `limit` is used explicitly here
    // rather than relying on the server's own default `limit` fallback.
    const res = await atlas.hr.listEmployees(token, { limit: 100 });
    return (res?.data ?? []).map((e) => ({ label: `${e.firstName} ${e.lastName}`.trim(), value: e.id }));
  }
  if (entityType === "ledger_account") {
    // No server-side search/filter param exists on this endpoint — fetch the
    // full list once (typically small per company) and let ComboboxField's
    // own client-side filter narrow it.
    const res = await atlas.ledger.listAccounts(token, {});
    return (res?.data ?? []).map((a) => ({ label: a.bank ? `${a.name} · ${a.bank}` : a.name, value: a.id }));
  }
  return [];
}

export function EntityReferencePicker({ open, onOpenChange, onPick, children }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [entityType, setEntityType] = useState(null);

  const optionsQuery = useQuery({
    queryKey: ["chat-entity-ref-options", entityType, token],
    queryFn: () => fetchOptions(entityType, token),
    enabled: Boolean(entityType && token),
    staleTime: 30_000,
  });

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setEntityType(null);
      }}
    >
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent side="top" align="start" className="w-72 p-3 space-y-2">
        <SelectField
          label="Tipo"
          value={entityType ?? ""}
          onChange={(v) => setEntityType(v || null)}
          options={ENTITY_TYPES}
          placeholder="Selecciona un tipo..."
        />
        {entityType && (
          <ComboboxField
            label="Registro"
            options={optionsQuery.data ?? []}
            value={null}
            onChange={(recordId) => {
              const opt = (optionsQuery.data ?? []).find((o) => o.value === recordId);
              if (!opt) return;
              onPick({ entityType, recordId, label: opt.label });
              onOpenChange(false);
              setEntityType(null);
            }}
            placeholder="Buscar..."
            emptyText={optionsQuery.isLoading ? "Cargando..." : "Sin resultados"}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
