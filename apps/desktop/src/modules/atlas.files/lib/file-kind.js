export function getFileKind(mimeType = "") {
  const value = String(mimeType || "").toLowerCase();
  if (value.startsWith("image/")) return "image";
  if (value.startsWith("video/")) return "video";
  if (value.startsWith("audio/")) return "audio";
  if (value === "application/pdf") return "pdf";
  if (value.includes("spreadsheet") || value.includes("excel") || value.includes("csv")) {
    return "sheet";
  }
  if (value.includes("word") || value.includes("document")) return "doc";
  if (value.startsWith("text/") || value.includes("json")) return "text";
  return "generic";
}

export function formatBytes(bytes = 0) {
  const size = Math.max(0, Number(bytes || 0));
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value) {
  try {
    return new Date(value).toLocaleString("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(value ?? "—");
  }
}

export function getKindLabel(kind) {
  if (kind === "image") return "Imagen";
  if (kind === "video") return "Video";
  if (kind === "audio") return "Audio";
  if (kind === "pdf") return "PDF";
  if (kind === "sheet") return "Hoja de calculo";
  if (kind === "doc") return "Documento";
  if (kind === "text") return "Texto";
  return "Archivo";
}
