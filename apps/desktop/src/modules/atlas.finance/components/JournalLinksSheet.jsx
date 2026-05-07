import { useState } from "react";
import {
  Button,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Skeleton,
} from "@atlas/ui";
import { toast } from "sonner";
import { atlas } from "../../../lib/atlas";
import { formatDate, parseApiError } from "../lib/finance-utils";

export function JournalLinksSheet({
  open,
  onOpenChange,
  sourceDocument,
  token,
}) {
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalLinks, setJournalLinks] = useState([]);

  async function handleOpen(isOpen) {
    if (isOpen && sourceDocument?.id) {
      setJournalLinks([]);
      setJournalLoading(true);
      try {
        const response = await atlas.finance.getDocumentJournalLinks(
          sourceDocument.id,
          token,
        );
        setJournalLinks(response?.data ?? []);
      } catch (error) {
        toast.error(
          parseApiError(error, "No se pudo cargar la trazabilidad contable."),
        );
        onOpenChange(false);
        return;
      } finally {
        setJournalLoading(false);
      }
    } else if (!isOpen) {
      setJournalLinks([]);
    }
    onOpenChange(isOpen);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent className="sm:max-w-3xl lg:max-w-4xl">
        <SheetHeader>
          <SheetTitle>
            Trazabilidad contable{" "}
            {sourceDocument?.reference ? `- ${sourceDocument.reference}` : ""}
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 py-4">
          {journalLoading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : journalLinks.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Este documento aún no tiene pólizas vinculadas.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
              <table className="min-w-full text-sm">
                <thead className="bg-[hsl(var(--muted))/0.35]">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Evento</th>
                    <th className="px-3 py-2 text-left font-medium">Póliza</th>
                    <th className="px-3 py-2 text-left font-medium">Fecha</th>
                    <th className="px-3 py-2 text-left font-medium">
                      Concepto
                    </th>
                    <th className="px-3 py-2 text-left font-medium">Líneas</th>
                  </tr>
                </thead>
                <tbody>
                  {journalLinks.map((link) => (
                    <tr
                      key={link.id}
                      className="border-t border-[hsl(var(--border))]"
                    >
                      <td className="px-3 py-2">{link.eventType}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {link.journalEntry?.entryNumber || "-"}
                      </td>
                      <td className="px-3 py-2">
                        {formatDate(link.journalEntry?.occurredAt)}
                      </td>
                      <td className="px-3 py-2">
                        {link.journalEntry?.concept || "-"}
                      </td>
                      <td className="px-3 py-2">
                        {(link.journalEntry?.lines ?? []).length}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <SheetFooter className="gap-2">
            <Button variant="outline" onClick={() => handleOpen(false)}>
              Cerrar
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
