import {
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
} from "lucide-react";
import { getFileKind } from "../lib/file-kind";

function getKindIcon(kind) {
  if (kind === "image") return FileImage;
  if (kind === "pdf") return FileType2;
  if (kind === "sheet") return FileSpreadsheet;
  if (kind === "doc" || kind === "text") return FileText;
  return File;
}

export function FileVisual({ file, previewUrl, className = "", onClick = null }) {
  const kind = getFileKind(file?.mimeType);
  const Icon = getKindIcon(kind);

  if (kind === "image" && previewUrl) {
    return (
      <img
        src={previewUrl}
        alt={file?.originalName ?? "Archivo"}
        className={`${className || "h-10 w-10 rounded object-cover"} ${onClick ? "cursor-pointer" : ""}`}
        onClick={onClick}
      />
    );
  }

  return (
    <div
      className={`h-10 w-10 rounded bg-[hsl(var(--muted))] flex items-center justify-center ${className} ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick(event);
        }
      }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <Icon className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
    </div>
  );
}
