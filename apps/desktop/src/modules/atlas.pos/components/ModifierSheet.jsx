import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle, Button, SelectField, TextareaField } from "@atlas/ui";

const SHARED_SEAT = "__shared__";

// Bottom sheet: pick modifier groups/options, quantity, seat and note before
// adding a product line to the comanda. Mirrors LineEditSheet's mobile sheet
// conventions (Sheet side="bottom").
export default function ModifierSheet({
  open,
  onOpenChange,
  product,
  groups = [],
  guests = [],
  activeSeatId = null,
  onSubmit,
  submitting = false,
}) {
  const [selected, setSelected] = useState(new Map());
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [seatId, setSeatId] = useState(activeSeatId ?? SHARED_SEAT);

  useEffect(() => {
    if (!open) return;
    setSelected(new Map());
    setQuantity(1);
    setNote("");
    setSeatId(activeSeatId ?? SHARED_SEAT);
  }, [open, product?.id, activeSeatId]);

  const basePrice = parseFloat(product?.price ?? product?.base_price ?? 0);

  const selectedOptions = useMemo(() => {
    const list = [];
    for (const group of groups) {
      const ids = selected.get(group.id);
      if (!ids) continue;
      for (const option of group.options ?? []) {
        if (ids.has(option.id)) list.push(option);
      }
    }
    return list;
  }, [selected, groups]);

  const total = useMemo(() => {
    const deltas = selectedOptions.reduce((s, o) => s + parseFloat(o.priceDelta ?? 0), 0);
    return (basePrice + deltas) * quantity;
  }, [basePrice, selectedOptions, quantity]);

  function toggleOption(group, option) {
    setSelected((prev) => {
      const next = new Map(prev);
      const current = new Set(next.get(group.id) ?? []);
      const isSelected = current.has(option.id);
      const maxSelect = group.maxSelect ?? 1;
      if (maxSelect === 1) {
        if (isSelected) {
          if (group.required) return prev;
          current.clear();
        } else {
          current.clear();
          current.add(option.id);
        }
      } else if (isSelected) {
        current.delete(option.id);
      } else if (current.size >= maxSelect) {
        toast.info(`Máximo ${maxSelect} opciones en "${group.name}"`);
        return prev;
      } else {
        current.add(option.id);
      }
      next.set(group.id, current);
      return next;
    });
  }

  const unmetRequired = groups.some((group) => {
    if (!group.required) return false;
    const options = group.options ?? [];
    if (options.length === 0) return false;
    const count = selected.get(group.id)?.size ?? 0;
    return count < Math.max(1, group.minSelect ?? 1);
  });

  const canSubmit = !unmetRequired && !submitting;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      modifiers: selectedOptions.map((o) => ({ optionId: o.id })),
      quantity,
      note: note.trim() || null,
      guestSeatId: seatId === SHARED_SEAT ? null : seatId,
    });
  }

  if (!product) return null;

  const seatOptions = [
    { value: SHARED_SEAT, label: "Compartido" },
    ...guests.map((g) => ({ value: g.id, label: g.label })),
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" aria-describedby={undefined} className="pb-8 max-h-[85dvh] overflow-y-auto">
        <SheetTitle className="text-base mb-1">{product.name}</SheetTitle>
        <p className="-mt-1 mb-4 text-sm text-muted-foreground">${basePrice.toFixed(2)} base</p>

        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.id} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">
                  {group.name}
                  {group.required && <span className="ml-1 text-xs font-normal text-destructive">*</span>}
                </p>
                <p className="shrink-0 text-xs text-muted-foreground">
                  elige mín {Math.max(0, group.minSelect ?? 0)}, máx {group.maxSelect ?? 1}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                {(group.options ?? []).map((option) => {
                  const isSelected = selected.get(group.id)?.has(option.id) ?? false;
                  const delta = parseFloat(option.priceDelta ?? 0);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleOption(group, option)}
                      className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors touch-manipulation ${
                        isSelected ? "border-foreground bg-muted" : "border-border bg-background hover:bg-muted/50"
                      }`}
                    >
                      <span>{option.name}</span>
                      {delta > 0 && <span className="text-xs font-medium tabular-nums">+${delta.toFixed(2)}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Cantidad</p>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="Reducir"
              >
                <Minus size={18} />
              </Button>
              <span className="flex-1 text-center text-2xl font-bold tabular-nums select-none">{quantity}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQuantity((q) => q + 1)}
                aria-label="Aumentar"
              >
                <Plus size={18} />
              </Button>
            </div>
          </div>

          <SelectField label="Para" value={seatId} onChange={setSeatId} options={seatOptions} />

          <TextareaField
            label="Notas"
            placeholder="Ej: sin cebolla, extra salsa, término medio..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={2}
          />

          <Button className="h-12 w-full" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Agregando..." : `Agregar $${total.toFixed(2)}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
