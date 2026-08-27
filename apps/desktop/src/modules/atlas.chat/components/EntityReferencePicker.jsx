import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverAnchor, PopoverContent, SelectField, ComboboxField, SearchInput } from "@atlas/ui";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { isImageMime } from "../lib/chatUtils";
import { FileTypeIcon } from "./ChatFilesGallery";

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
    // GET /files already returns mimeType per row, and for image/pdf files a
    // ready-to-use signedUrl (see files-service.js's batchEnrichFileAssets) —
    // no extra per-file fetch needed to show real thumbnails here.
    const res = await atlas.files.list({ pageSize: 100 }, token);
    return (res?.data ?? []).map((f) => ({
      label: f.originalName,
      value: f.id,
      mimeType: f.mimeType ?? null,
      thumbnailUrl: f.signedUrl ?? null,
    }));
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

// A real thumbnail grid for the "Archivo" type instead of a filename-only
// text dropdown — the point of attaching a file reference is usually to
// pick a specific photo/document by how it LOOKS, not by remembering its
// exact filename. Non-image files fall back to an icon + filename tile in
// the same grid rather than a separate list, so the picker stays one
// consistent surface regardless of what's in the folder.
function FilePickerGrid({ options, isLoading, onPick }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label?.toLowerCase().includes(q));
  }, [options, search]);

  return (
    <div className="space-y-2">
      <SearchInput
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onClear={() => setSearch("")}
        placeholder="Buscar archivo..."
      />
      {isLoading ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))] py-6 text-center">Cargando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))] py-6 text-center">Sin resultados</p>
      ) : (
        <div className="grid grid-cols-4 gap-1.5 max-h-72 overflow-y-auto pr-1">
          {filtered.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onPick(opt)}
              title={opt.label}
              className="aspect-square rounded-lg overflow-hidden bg-[hsl(var(--muted))] hover:opacity-80 transition-opacity"
            >
              {isImageMime(opt.mimeType) && opt.thumbnailUrl ? (
                <img
                  src={opt.thumbnailUrl}
                  alt={opt.label}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1">
                  <FileTypeIcon mimeType={opt.mimeType} />
                  <span className="text-[9px] text-[hsl(var(--muted-foreground))] truncate w-full text-center">
                    {opt.label}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function EntityReferencePicker({ open, onOpenChange, onPick, children }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [entityType, setEntityType] = useState(null);
  const isFileType = entityType === "file";

  const optionsQuery = useQuery({
    queryKey: ["chat-entity-ref-options", entityType, token],
    queryFn: () => fetchOptions(entityType, token),
    enabled: Boolean(entityType && token),
    staleTime: 30_000,
  });

  function handlePick(recordId, label) {
    onPick({ entityType, recordId, label });
    onOpenChange(false);
    setEntityType(null);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setEntityType(null);
      }}
    >
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent side="top" align="start" className={["p-3 space-y-2", isFileType ? "w-96" : "w-72"].join(" ")}>
        <SelectField
          label="Tipo"
          value={entityType ?? ""}
          onChange={(v) => setEntityType(v || null)}
          options={ENTITY_TYPES}
          placeholder="Selecciona un tipo..."
        />
        {entityType && isFileType && (
          <FilePickerGrid
            options={optionsQuery.data ?? []}
            isLoading={optionsQuery.isLoading}
            onPick={(opt) => handlePick(opt.value, opt.label)}
          />
        )}
        {entityType && !isFileType && (
          <ComboboxField
            label="Registro"
            options={optionsQuery.data ?? []}
            value={null}
            onChange={(recordId) => {
              const opt = (optionsQuery.data ?? []).find((o) => o.value === recordId);
              if (!opt) return;
              handlePick(recordId, opt.label);
            }}
            placeholder="Buscar..."
            emptyText={optionsQuery.isLoading ? "Cargando..." : "Sin resultados"}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
