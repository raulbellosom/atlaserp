// apps/desktop/src/modules/atlas.pfm/components/ReceiptThumb.jsx
import { Loader2, ReceiptText } from "lucide-react";
import { useReceiptImageUrl } from "../hooks/use-pfm-queries";

export function ReceiptThumb({ fileId, status, onClick }) {
  const { data: url } = useReceiptImageUrl(fileId);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex aspect-video w-full items-center justify-center bg-[hsl(var(--muted))]"
    >
      {url ? (
        <img src={url} alt="Ticket" className="h-full w-full object-cover" />
      ) : (
        <ReceiptText className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
      )}
      {status === "PROCESSING" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      )}
    </button>
  );
}
