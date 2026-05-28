import { useCallback, useEffect, useMemo, useState } from "react";
import { FileViewer } from "@atlas/ui";

function getBaseUrl(apiBaseUrl) {
  return String(apiBaseUrl ?? "").trim().replace(/\/+$/, "");
}

async function resolveSignedUrl({ apiBaseUrl, token, fileAssetId }) {
  if (!fileAssetId) return null;
  const response = await fetch(`${getBaseUrl(apiBaseUrl)}/files/${encodeURIComponent(fileAssetId)}/signed-url`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) return null;
  const payload = await response.json();
  return payload?.data?.signedUrl ?? payload?.data?.url ?? null;
}

function mapViewerFiles(items) {
  return items.map((item) => ({
    id: item.id ?? item.file_asset_id,
    associationId: item.id ?? null,
    fileAssetId: item.file_asset_id ?? null,
    originalName:
      item?.file_asset?.originalName ??
      item?.label ??
      "Archivo",
    mimeType: item?.file_asset?.mimeType ?? "application/octet-stream",
    sizeBytes: item?.file_asset?.sizeBytes ?? null,
    signedUrl: null,
  }));
}

export default function VehicleImageCell({ value, row, token, apiBaseUrl }) {
  const [thumbUrl, setThumbUrl] = useState(null);
  const [thumbLoading, setThumbLoading] = useState(false);
  const [openViewer, setOpenViewer] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerFiles, setViewerFiles] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [signedUrlCache, setSignedUrlCache] = useState({});

  const vehicleId = String(row?.id ?? "").trim() || null;
  const coverImageAssetId = String(value ?? row?.cover_image_file_asset_id ?? "").trim() || null;
  const imageCount = Number(row?.image_count ?? 0);
  const docCount = Number(row?.doc_count ?? 0);
  const hasAnyImage = imageCount > 0 || Boolean(coverImageAssetId);
  const extraFilesCount = Math.max(0, docCount - 1);

  const getSignedUrl = useCallback(
    async (fileAssetId) => {
      if (!fileAssetId) return null;
      if (signedUrlCache[fileAssetId]) return signedUrlCache[fileAssetId];
      const url = await resolveSignedUrl({ apiBaseUrl, token, fileAssetId });
      if (!url) return null;
      setSignedUrlCache((prev) => ({ ...prev, [fileAssetId]: url }));
      return url;
    },
    [apiBaseUrl, signedUrlCache, token],
  );

  useEffect(() => {
    let cancelled = false;
    if (!coverImageAssetId || !apiBaseUrl) {
      setThumbUrl(null);
      return () => {
        cancelled = true;
      };
    }

    async function loadThumbnail() {
      setThumbLoading(true);
      try {
        const nextUrl = await getSignedUrl(coverImageAssetId);
        if (!cancelled) setThumbUrl(nextUrl);
      } finally {
        if (!cancelled) setThumbLoading(false);
      }
    }

    loadThumbnail();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, coverImageAssetId, getSignedUrl]);

  const openVehicleViewer = useCallback(async () => {
    if (!vehicleId || !apiBaseUrl || !hasAnyImage) return;
    setViewerLoading(true);
    try {
      const response = await fetch(`${getBaseUrl(apiBaseUrl)}/fleet/vehicles/${encodeURIComponent(vehicleId)}/documents`, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) return;
      const payload = await response.json();
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      const files = mapViewerFiles(rows);
      const effectiveFiles = files;
      if (effectiveFiles.length === 0) return;

      let nextIndex = 0;
      if (coverImageAssetId) {
        const indexFromCover = effectiveFiles.findIndex((file) => file.fileAssetId === coverImageAssetId);
        if (indexFromCover >= 0) {
          nextIndex = indexFromCover;
        } else {
          const fallbackImageIndex = effectiveFiles.findIndex((file) =>
            String(file?.mimeType ?? "").toLowerCase().startsWith("image/"),
          );
          if (fallbackImageIndex >= 0) nextIndex = fallbackImageIndex;
        }
      } else {
        const firstImageIndex = effectiveFiles.findIndex((file) =>
          String(file?.mimeType ?? "").toLowerCase().startsWith("image/"),
        );
        if (firstImageIndex >= 0) nextIndex = firstImageIndex;
      }

      setViewerFiles(effectiveFiles);
      setActiveIndex(nextIndex);
      setOpenViewer(true);
    } finally {
      setViewerLoading(false);
    }
  }, [apiBaseUrl, coverImageAssetId, hasAnyImage, token, vehicleId]);

  const currentViewerFile = useMemo(() => {
    if (!Array.isArray(viewerFiles) || viewerFiles.length === 0) return null;
    return viewerFiles[activeIndex] ?? viewerFiles[0];
  }, [activeIndex, viewerFiles]);

  if (!hasAnyImage) {
    return <span className="text-[hsl(var(--muted-foreground))]">—</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={openVehicleViewer}
        disabled={viewerLoading}
        className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--ring))] hover:text-[hsl(var(--foreground))]"
        title="Abrir imagenes del vehiculo"
        aria-label="Abrir imagenes del vehiculo"
      >
        {thumbLoading || viewerLoading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : thumbUrl ? (
          <img src={thumbUrl} alt={row?.plate ? `Imagen de ${row.plate}` : "Imagen de vehiculo"} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs font-semibold">IMG</span>
        )}
        {extraFilesCount > 0 ? (
          <span className="absolute -right-1 -top-1 rounded-full bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
            +{extraFilesCount}
          </span>
        ) : null}
      </button>

      <FileViewer
        open={openViewer}
        onClose={() => setOpenViewer(false)}
        file={currentViewerFile}
        files={viewerFiles}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        onResolveFile={async (file) => getSignedUrl(file?.fileAssetId)}
        title="Imagen del vehiculo"
      />
    </>
  );
}
