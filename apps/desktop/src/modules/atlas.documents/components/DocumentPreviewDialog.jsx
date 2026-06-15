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
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Vista previa del documento</DialogTitle>
        </DialogHeader>
        {loading ? <LoadingState label="Generando vista previa..." /> : null}
        {error ? <ErrorState description={error.message} /> : null}
        {!loading && !error && url ? (
          <iframe
            title="Vista previa PDF"
            src={url}
            className="h-[70vh] w-full rounded-md border"
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
