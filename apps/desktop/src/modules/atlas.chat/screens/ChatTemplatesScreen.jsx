import { useState } from "react";
import {
  PageHeader, Button, EmptyState, Skeleton, Badge,
  Dialog, TextField, TextareaField, ConfirmDialog,
} from "@atlas/ui";
import { Plus, Pencil, Trash2, Hash } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

// ------------------------------------------------------------------
// Template form dialog (create + edit)
// ------------------------------------------------------------------

function TemplateFormDialog({ open, onClose, initial }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const isEdit = Boolean(initial?.id);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [tagsRaw, setTagsRaw] = useState((initial?.tags ?? []).join(", "));
  const [error, setError] = useState("");

  function resetForm() {
    setTitle(initial?.title ?? "");
    setBody(initial?.body ?? "");
    setTagsRaw((initial?.tags ?? []).join(", "));
    setError("");
  }

  const { mutate, isPending } = useMutation({
    mutationFn: (data) =>
      isEdit
        ? atlas.chat.updateTemplate(initial.id, data, token)
        : atlas.chat.createTemplate(data, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-templates"] });
      onClose();
    },
    onError: (err) => setError(err?.message ?? "Error al guardar la plantilla."),
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { setError("El titulo es obligatorio."); return; }
    if (!body.trim()) { setError("El cuerpo es obligatorio."); return; }
    const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
    mutate({ title: title.trim(), body: body.trim(), tags });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { if (!v) { resetForm(); onClose(); } }}
      title={isEdit ? "Editar plantilla" : "Nueva plantilla"}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <TextField
          label="Titulo"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej: Saludo inicial"
          required
        />
        <TextareaField
          label="Cuerpo del mensaje"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribe el texto de la plantilla..."
          rows={4}
          required
        />
        <TextField
          label="Etiquetas (separadas por coma)"
          value={tagsRaw}
          onChange={(e) => setTagsRaw(e.target.value)}
          placeholder="soporte, ventas, facturacion"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={() => { resetForm(); onClose(); }}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear plantilla"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ------------------------------------------------------------------
// Template row
// ------------------------------------------------------------------

function TemplateRow({ template, onEdit, onDelete }) {
  return (
    <div className="flex items-start gap-4 px-4 py-3 border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--muted)/0.4)] transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium">{template.title}</p>
          {(template.tags ?? []).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
              <Hash className="h-2.5 w-2.5 mr-0.5" />
              {tag}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 line-clamp-2">{template.body}</p>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
          Usado {template.usage_count ?? 0} {template.usage_count === 1 ? "vez" : "veces"}
        </p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(template)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={() => onDelete(template)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Main screen
// ------------------------------------------------------------------

export function ChatTemplatesScreen() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["chat-templates"],
    queryFn: () => atlas.chat.listTemplates(token),
    enabled: Boolean(token),
  });

  const { mutate: deleteTemplate, isPending: isDeleting } = useMutation({
    mutationFn: (id) => atlas.chat.deleteTemplate(id, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-templates"] });
      setDeleteTarget(null);
    },
  });

  const templates = data?.data ?? [];

  function handleEdit(template) {
    setEditTarget(template);
    setFormOpen(true);
  }

  function handleNew() {
    setEditTarget(null);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-6 pt-6 pb-4 flex items-start justify-between gap-4 border-b border-[hsl(var(--border))]">
        <PageHeader
          title="Plantillas de respuesta"
          description="Crea y gestiona respuestas rapidas para el chat externo."
        />
        <Button onClick={handleNew} className="shrink-0 mt-1">
          <Plus className="h-4 w-4 mr-1.5" />
          Nueva plantilla
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5 px-4 py-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-full max-w-sm" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && templates.length === 0 && (
          <EmptyState
            className="mt-16"
            title="Sin plantillas"
            description="Crea plantillas de respuesta para agilizar las conversaciones con visitantes."
            action={
              <Button onClick={handleNew}>
                <Plus className="h-4 w-4 mr-1.5" />
                Crear primera plantilla
              </Button>
            }
          />
        )}

        {templates.length > 0 && (
          <div className="border-t border-[hsl(var(--border))]">
            {templates.map((t) => (
              <TemplateRow
                key={t.id}
                template={t}
                onEdit={handleEdit}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit dialog */}
      <TemplateFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        initial={editTarget}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        title="Eliminar plantilla"
        description={`¿Eliminar la plantilla "${deleteTarget?.title}"? Esta accion no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={() => deleteTemplate(deleteTarget.id)}
        loading={isDeleting}
      />
    </div>
  );
}
