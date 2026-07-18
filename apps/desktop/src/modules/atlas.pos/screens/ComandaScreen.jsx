import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { PageHeader } from "@atlas/ui";

// F2 placeholder: mobile comanda editor for a single table.
// Task 4 replaces this with the full orchestrator (seats, product grid, modifiers, kitchen/pay).
export default function ComandaScreen() {
  const { "*": wildcard } = useParams();
  const tableId = useMemo(() => (wildcard ?? "").split("/")[3] ?? null, [wildcard]);

  return (
    <div className="flex h-full flex-col bg-background">
      <PageHeader title="Comanda" description={tableId ? `Mesa ${tableId}` : undefined} />
    </div>
  );
}
