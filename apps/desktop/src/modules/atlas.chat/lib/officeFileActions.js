import { FilePenLine, ExternalLink } from "lucide-react";
import { getOfficeFormat } from "@atlas/core";

// True if `file` ({ fileName|title|originalName, mimeType }) is an Office format
// the WOPI editor can open.
export function isOfficeOpenable(file) {
  const probe = {
    originalName: file?.originalName ?? file?.fileName ?? file?.title ?? "",
    mimeType: file?.mimeType ?? "",
  };
  return Boolean(getOfficeFormat(probe));
}

// Menu entries for a file that IS a FileAsset (entity reference in chat, or the
// atlas.files viewer). `office` = useOfficeActions() context. `signedUrl` may be
// null (still resolving) — the "open in new tab" entry resolves it lazily via
// `onResolveUrl` when given.
export function buildFileAssetOfficeActions({ office, fileAssetId, file, signedUrl, onResolveUrl }) {
  const items = [];
  if (office?.enabled && fileAssetId && isOfficeOpenable(file)) {
    items.push({
      key: "office-open",
      label: office.canEdit ? "Abrir en editor de Office" : "Abrir en Office (solo lectura)",
      icon: FilePenLine,
      onSelect: () => office.open(fileAssetId),
    });
  }
  items.push({
    key: "office-open-tab",
    label: "Abrir en pestaña nueva",
    icon: ExternalLink,
    disabled: !signedUrl && !onResolveUrl,
    onSelect: async () => {
      const url = signedUrl ?? (onResolveUrl ? await onResolveUrl() : null);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    },
  });
  return items;
}
