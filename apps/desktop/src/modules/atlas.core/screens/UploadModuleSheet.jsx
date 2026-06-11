import { useState, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Button,
  Input,
  Label,
} from "@atlas/ui";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { atlas } from "../../../lib/atlas";
import { useAuth } from "../../../auth/AuthProvider";

// Derives a candidate module key from a ZIP filename.
// "custom.musicfy.zip" → "custom.musicfy"
// "custom.musicfy-v2.1.zip" → "custom.musicfy" (strips version suffix after key)
function guessKeyFromFilename(filename) {
  const base = filename.replace(/\.zip$/i, "");
  const match = base.match(/^([a-z][a-z0-9]*\.[a-z][a-z0-9._-]*)/);
  return match ? match[1] : base;
}

export function UploadModuleSheet({ open, onOpenChange, onSuccess }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [moduleKey, setModuleKey] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  function handleFileChange(e) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    if (selected) {
      setModuleKey(guessKeyFromFilename(selected.name));
    }
  }

  function handleClose(open) {
    if (!open) {
      setFile(null);
      setModuleKey("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    onOpenChange(open);
  }

  async function handleUpload() {
    if (!file || !moduleKey.trim() || !token) return;

    const key = moduleKey.trim();
    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    const toastId = toast.loading(`Subiendo ${key}...`);

    try {
      const result = await atlas.modules.uploadModuleZip(key, formData, token);
      if (result?.error) {
        toast.error(result.error, {
          id: toastId,
          description: result.details ? JSON.stringify(result.details) : undefined,
        });
        return;
      }
      toast.success(`Módulo ${key} subido correctamente`, {
        id: toastId,
        description: `${result?.data?.fileCount ?? "?"} archivos extraídos. Sincronizando catálogo...`,
      });
      handleClose(false);
      onSuccess?.();
    } catch (err) {
      toast.error("Error al subir el módulo", {
        id: toastId,
        description: err?.message ?? "Error desconocido",
      });
    } finally {
      setIsUploading(false);
    }
  }

  const canSubmit = Boolean(file && moduleKey.trim() && token && !isUploading);

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Subir módulo</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Sube un archivo ZIP con el código de tu módulo custom. El módulo se
            extraerá al servidor y quedará disponible para instalar desde el
            catálogo.
          </p>

          <div className="space-y-2">
            <Label htmlFor="module-zip-file">Archivo ZIP</Label>
            <input
              ref={fileInputRef}
              id="module-zip-file"
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              disabled={isUploading}
              className="block w-full text-sm text-[hsl(var(--foreground))] file:mr-3 file:rounded-md file:border file:border-[hsl(var(--border))] file:bg-[hsl(var(--muted))] file:px-3 file:py-1.5 file:text-xs file:font-medium file:cursor-pointer cursor-pointer"
            />
            {file && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="module-key">Clave del módulo</Label>
            <Input
              id="module-key"
              value={moduleKey}
              onChange={(e) => setModuleKey(e.target.value)}
              placeholder="custom.mi-modulo"
              disabled={isUploading}
            />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Debe coincidir con el campo <code>key</code> en{" "}
              <code>module.manifest.js</code>.
            </p>
          </div>

          <Button
            className="w-full bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
            disabled={!canSubmit}
            onClick={handleUpload}
          >
            <Upload className="h-4 w-4" />
            {isUploading ? "Subiendo..." : "Subir módulo"}
          </Button>

          <p className="text-xs text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))] rounded-lg px-3 py-2">
            El ZIP se extrae directamente en el servidor. Solo sube módulos de
            fuentes de confianza.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
