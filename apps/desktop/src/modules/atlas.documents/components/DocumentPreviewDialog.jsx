import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  ErrorState,
  LoadingState,
} from "@atlas/ui";

export function DocumentPreviewDialog({ open, onOpenChange, blob, loading, error }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return undefined;
    }
    const nextUrl = URL.createObjectURL(blob);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [blob]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] w-[96vw] p-0 gap-0 md:max-h-[96dvh] overflow-hidden">
        <DialogHeader className="px-5 py-3 border-b shrink-0">
          <DialogTitle className="text-sm">Vista previa del documento</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <LoadingState label="Generando vista previa..." />
          </div>
        ) : null}
        {error ? (
          <div className="flex items-center justify-center h-64 p-6">
            <ErrorState description={error.message} />
          </div>
        ) : null}
        {!loading && !error && url ? (
          <iframe
            title="Vista previa PDF"
            src={url}
            className="w-full block"
            style={{ height: "calc(96dvh - 53px)" }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
