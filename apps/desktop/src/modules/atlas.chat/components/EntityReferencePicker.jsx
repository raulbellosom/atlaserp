import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Maximize2 } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent, SelectField, ComboboxField, SearchInput } from "@atlas/ui";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { isImageMime } from "../lib/chatUtils";
import { FileTypeIcon } from "./ChatFilesGallery";
import { useFileRefSignedUrl } from "../hooks/useFileRefSignedUrl";
import { EntityFileViewer } from "./EntityFileViewer";

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
    // Thumbnails are fetched lazily per-tile at the "card" variant (see
    // FilePickerTile below) rather than reusing the full-resolution signedUrl
    // this listing embeds — that URL is meant for direct downloads/link-outs,
    // not for rendering a grid of dozens of preview tiles at once.
    const res = await atlas.files.list({ pageSize: 100 }, token);
    return (res?.data ?? []).map((f) => ({
      label: f.originalName,
      value: f.id,
      mimeType: f.mimeType ?? null,
      sizeBytes: f.sizeBytes ?? null,
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

// One grid tile — its own component so each file gets its own lazy "card"
// (96x96) thumbnail query, fired only for image files and only once this
// tile actually renders. Loading dozens of full-resolution images up front
// (the previous approach) is exactly what this avoids.
function FilePickerTile({ opt, isSelected, atCap, onToggle, onPreview }) {
  const isImage = isImageMime(opt.mimeType);
  const { data: thumbUrl, isLoading } = useFileRefSignedUrl(opt.value, "card", isImage);
  const disabled = atCap && !isSelected;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onToggle(opt)}
        disabled={disabled}
        title={opt.label}
        className={[
          "aspect-square w-full rounded-lg overflow-hidden bg-[hsl(var(--muted))] transition-opacity",
          disabled ? "opacity-40 cursor-not-allowed" : "hover:opacity-80",
        ].join(" ")}
      >
        {isImage ? (
          isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin opacity-40" />
            </div>
          ) : thumbUrl ? (
            <img src={thumbUrl} alt={opt.label} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FileTypeIcon mimeType={opt.mimeType} />
            </div>
          )
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1">
            <FileTypeIcon mimeType={opt.mimeType} />
            <span className="text-[9px] text-[hsl(var(--muted-foreground))] truncate w-full text-center">
              {opt.label}
            </span>
          </div>
        )}
      </button>

      {/* Selection indicator — pointer-events-none so clicks pass through to
          the tile button underneath. White ring + drop shadow instead of a
          theme-token border: this sits on top of arbitrary photo content, so
          it needs to stay legible against any photo color in either theme
          (same reasoning as ChatFilesGallery.jsx's MediaSelectionCircle). */}
      <div
        className={[
          "absolute top-1.5 right-1.5 h-4 w-4 rounded-full flex items-center justify-center pointer-events-none transition-all duration-150",
          "shadow-[0_1px_4px_rgba(0,0,0,0.7)]",
          isSelected
            ? "bg-[hsl(var(--primary))] ring-2 ring-white scale-110"
            : "bg-black/30 ring-2 ring-white/90",
        ].join(" ")}
      >
        {isSelected && (
          <svg viewBox="0 0 10 8" className="w-2 h-1.5" fill="none">
            <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPreview(opt);
        }}
        title="Ver en grande"
        className="absolute bottom-1 left-1 h-5 w-5 rounded-full bg-[hsl(var(--background)/0.75)] flex items-center justify-center text-[hsl(var(--foreground))] hover:bg-[hsl(var(--background))] transition-colors"
      >
        <Maximize2 className="h-3 w-3" />
      </button>
    </div>
  );
}

// A real thumbnail grid for the "Archivo" type instead of a filename-only
// text dropdown — the point of attaching a file reference is usually to
// pick a specific photo/document by how it LOOKS, not by remembering its
// exact filename. Supports selecting several files at once (confirmed via
// the "Adjuntar (N)" button, capped at `maxSelect`) and a per-tile "ver en
// grande" preview through the same viewer used for already-sent references.
function FilePickerGrid({ options, isLoading, maxSelect, onConfirm }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [previewOpt, setPreviewOpt] = useState(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label?.toLowerCase().includes(q));
  }, [options, search]);

  const atCap = maxSelect != null && selected.length >= maxSelect;

  function toggle(opt) {
    setSelected((prev) => {
      const exists = prev.some((s) => s.value === opt.value);
      if (exists) return prev.filter((s) => s.value !== opt.value);
      if (maxSelect != null && prev.length >= maxSelect) return prev;
      return [...prev, opt];
    });
  }

  const previewFiles = previewOpt
    ? [{ id: previewOpt.value, mimeType: previewOpt.mimeType, originalName: previewOpt.label, sizeBytes: previewOpt.sizeBytes ?? null }]
    : [];

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
            <FilePickerTile
              key={opt.value}
              opt={opt}
              isSelected={selected.some((s) => s.value === opt.value)}
              atCap={atCap}
              onToggle={toggle}
              onPreview={setPreviewOpt}
            />
          ))}
        </div>
      )}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {selected.length > 0
            ? `${selected.length} seleccionado${selected.length === 1 ? "" : "s"}`
            : "Selecciona uno o varios"}
        </span>
        <button
          type="button"
          onClick={() => onConfirm(selected)}
          disabled={selected.length === 0}
          className="text-xs font-medium px-3 py-1.5 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          Adjuntar{selected.length > 0 ? ` (${selected.length})` : ""}
        </button>
      </div>
      <EntityFileViewer
        open={Boolean(previewOpt)}
        onOpenChange={(v) => {
          if (!v) setPreviewOpt(null);
        }}
        files={previewFiles}
        activeIndex={0}
      />
    </div>
  );
}

export function EntityReferencePicker({ open, onOpenChange, onPick, maxSelect, children }) {
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

  function close() {
    onOpenChange(false);
    setEntityType(null);
  }

  function handlePick(recordId, label) {
    onPick({ entityType, recordId, label });
    close();
  }

  function handleConfirmFiles(selectedOpts) {
    for (const opt of selectedOpts) onPick({ entityType, recordId: opt.value, label: opt.label });
    close();
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
            maxSelect={maxSelect}
            onConfirm={handleConfirmFiles}
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
