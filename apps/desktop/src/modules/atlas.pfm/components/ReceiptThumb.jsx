// apps/desktop/src/modules/atlas.pfm/components/ReceiptThumb.jsx
import { ReceiptText } from "lucide-react";
import { useReceiptImageUrl } from "../hooks/use-pfm-queries";

export function ReceiptThumb({ fileId }) {
  const { data: url } = useReceiptImageUrl(fileId);
  return (
    <div className="flex aspect-video items-center justify-center bg-[hsl(var(--muted))]">
      {url ? (
        <img src={url} alt="Ticket" className="h-full w-full object-cover" />
      ) : (
        <ReceiptText className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
      )}
    </div>
  );
}
