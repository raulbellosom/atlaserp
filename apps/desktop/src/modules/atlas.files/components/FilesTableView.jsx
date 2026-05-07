import { useEffect, useRef, useState } from "react";
import {
  ActionMenu,
  Badge,
  Button,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@atlas/ui";
import {
  Download,
  Eye,
  ExternalLink,
  FileCheck2,
  FileX2,
  Link2,
  Pencil,
  Trash2,
} from "lucide-react";
import { FileVisual } from "./FileVisual";
import { formatBytes, formatDate } from "../lib/file-kind";

export function FilesTableView({
  files,
  selectedSet,
  onToggleSelect,
  onPreview,
  onDownload,
  onCopyLink,
  onRename,
  onOpenRenameModal,
  onDetail,
  onToggleEnabled,
  onDelete,
  isAdmin,
  previewMap,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [savingId, setSavingId] = useState(null);
  const inputRefs = useRef({});
  const clickTimerRef = useRef(null);

  useEffect(() => {
    if (!editingId) return;
    const exists = files.some((item) => item.id === editingId);
    if (!exists) {
      setEditingId(null);
      setEditingName("");
    }
  }, [files, editingId]);

  // Focus + select all text AFTER React re-renders the input as non-readOnly
  useEffect(() => {
    if (!editingId) return;
    const input = inputRefs.current[editingId];
    if (input) {
      input.focus();
      input.select();
    }
  }, [editingId]);

  function beginInlineRename(file) {
    if (!isAdmin || savingId) return;
    setEditingId(file.id);
    setEditingName(file.originalName || "");
  }

  async function commitInlineRename(file) {
    const nextName = String(editingName || "").trim();
    if (!nextName || nextName === file.originalName) {
      setEditingId(null);
      setEditingName("");
      return;
    }
    try {
      setSavingId(file.id);
      await onRename(file, nextName);
      setEditingId(null);
      setEditingName("");
    } finally {
      setSavingId(null);
    }
  }

  function handleNameClick(file) {
    if (editingId === file.id) return; // already editing, let input handle it
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      onPreview(file);
    }, 220);
  }

  function handleNameDoubleClick(file) {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    beginInlineRename(file);
  }

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-[hsl(var(--muted))]/40 hover:bg-[hsl(var(--muted))]/40">
            <TableHead className="w-10" />
            <TableHead className="min-w-[180px]">Archivo</TableHead>
            <TableHead className="w-20">Tamaño</TableHead>
            <TableHead className="w-28">Módulo</TableHead>
            <TableHead className="w-24">Entidad</TableHead>
            <TableHead className="w-32">Subido</TableHead>
            <TableHead className="w-24">Estado</TableHead>
            <TableHead className="w-40">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <TableRow key={file.id}>
              <TableCell>
                <Checkbox
                  checked={selectedSet.has(file.id)}
                  onCheckedChange={() => onToggleSelect(file.id)}
                />
              </TableCell>
              <TableCell className="min-w-[180px]">
                <div className="flex items-center gap-3 min-w-0 w-full">
                  <FileVisual
                    file={file}
                    previewUrl={previewMap.get(file.id)}
                    className="h-10 w-10 rounded-md object-cover bg-[hsl(var(--muted))]"
                    onClick={() => onPreview(file)}
                  />
                  <div className="min-w-0 flex-1 w-full">
                    <input
                      ref={(el) => {
                        inputRefs.current[file.id] = el;
                      }}
                      readOnly={editingId !== file.id}
                      value={
                        editingId === file.id ? editingName : file.originalName
                      }
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() =>
                        editingId === file.id && commitInlineRename(file)
                      }
                      disabled={savingId === file.id}
                      onClick={() =>
                        editingId !== file.id && handleNameClick(file)
                      }
                      onDoubleClick={() => handleNameDoubleClick(file)}
                      onKeyDown={(e) => {
                        if (editingId !== file.id) return;
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitInlineRename(file);
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          setEditingId(null);
                          setEditingName("");
                        }
                      }}
                      title={
                        isAdmin
                          ? "Clic para vista previa · doble clic para renombrar"
                          : file.originalName
                      }
                      className={[
                        "block w-full min-w-0 bg-transparent p-0 m-0",
                        "text-base sm:text-sm font-medium leading-tight truncate",
                        "border-0 outline-none ring-0 shadow-none",
                        "focus:outline-none focus:ring-0",
                        editingId === file.id
                          ? "cursor-text text-[hsl(var(--foreground))]"
                          : "cursor-pointer select-none",
                      ].join(" ")}
                    />
                    <p className="text-xs text-[hsl(var(--muted-foreground))] truncate">
                      {file.mimeType}
                    </p>
                    {savingId === file.id && (
                      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                        Guardando...
                      </p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm">
                {formatBytes(file.sizeBytes)}
              </TableCell>
              <TableCell className="text-xs font-mono text-[hsl(var(--muted-foreground))]">
                {file.moduleKey || "atlas.files"}
              </TableCell>
              <TableCell className="text-xs text-[hsl(var(--muted-foreground))]">
                {file.entityType || "—"}
              </TableCell>
              <TableCell className="text-xs text-[hsl(var(--muted-foreground))]">
                {formatDate(file.createdAt)}
              </TableCell>
              <TableCell>
                {file.enabled ? (
                  <Badge variant="success">Activo</Badge>
                ) : (
                  <Badge variant="secondary">Deshabilitado</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onPreview(file)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Ver
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDownload(file)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Descargar
                  </Button>
                  <ActionMenu
                    label="Más acciones"
                    items={[
                      {
                        label: "Copiar enlace",
                        icon: Link2,
                        onClick: () => onCopyLink(file),
                      },
                      {
                        label: "Detalle",
                        icon: ExternalLink,
                        onClick: () => onDetail(file),
                      },
                      isAdmin
                        ? {
                            label: "Renombrar",
                            icon: Pencil,
                            onClick: () => onOpenRenameModal(file),
                          }
                        : null,
                      isAdmin
                        ? {
                            label: file.enabled ? "Deshabilitar" : "Habilitar",
                            icon: file.enabled ? FileX2 : FileCheck2,
                            onClick: () => onToggleEnabled(file),
                          }
                        : null,
                      isAdmin
                        ? {
                            label: "Eliminar",
                            icon: Trash2,
                            variant: "destructive",
                            onClick: () => onDelete(file),
                          }
                        : null,
                    ].filter(Boolean)}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
