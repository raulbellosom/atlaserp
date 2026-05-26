import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  CurrencyField,
  DateTimeField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectField,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  TextField,
} from "@atlas/ui";
import {
  ArrowRightLeft,
  CalendarDays,
  Coins,
  FileText,
  HandCoins,
  Hash,
  Minus,
  Notebook,
  Plus,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { atlas } from "../../../lib/atlas";
import {
  SOURCE_TYPE_OPTIONS,
  computeLineTotals,
  defaultEntryForm,
  formatMoney,
  normalizeCurrencyCode,
  parseApiError,
  resolveCurrencyOptions,
  toNumber,
} from "../lib/finance-utils";

export function EntrySheet({
  open,
  onOpenChange,
  token,
  accounts,
  initialForm,
}) {
  const queryClient = useQueryClient();
  const [entryForm, setEntryForm] = useState(defaultEntryForm);

  function handleOpen(isOpen) {
    if (createEntryMutation.isPending) return;
    if (isOpen && initialForm) {
      setEntryForm(initialForm);
    } else if (!isOpen) {
      setEntryForm(defaultEntryForm());
    }
    onOpenChange(isOpen);
  }

  const lineTotals = useMemo(
    () => computeLineTotals(entryForm.lines),
    [entryForm.lines],
  );
  const entryBalanced =
    Math.abs(lineTotals.debit - lineTotals.credit) < 0.000001;
  const activeAccounts = useMemo(
    () => (accounts ?? []).filter((a) => a.enabled),
    [accounts],
  );
  const contactsQuery = useQuery({
    queryKey: ["finance-contacts-options"],
    queryFn: () => atlas.contacts.list(token, { limit: 200 }),
    enabled: Boolean(token) && open,
    staleTime: 5 * 60 * 1000,
  });
  const contacts = contactsQuery.data?.data ?? [];

  const createEntryMutation = useMutation({
    mutationFn: (payload) => atlas.finance.createEntry(payload, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-entries"] });
      queryClient.invalidateQueries({ queryKey: ["finance-balances"] });
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] });
      onOpenChange(false);
      setEntryForm(defaultEntryForm());
      toast.success("Póliza creada");
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo crear la póliza."));
    },
  });

  function updateLine(index, patch) {
    setEntryForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) =>
        i === index ? { ...line, ...patch } : line,
      ),
    }));
  }

  function addLine() {
    setEntryForm((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        { accountId: "", contactId: "", debit: "", credit: "", note: "" },
      ],
    }));
  }

  function removeLine(index) {
    setEntryForm((prev) => {
      if (prev.lines.length <= 2) return prev;
      return { ...prev, lines: prev.lines.filter((_, i) => i !== index) };
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    const concept = entryForm.concept.trim();
    if (!concept) {
      toast.error("El concepto es obligatorio.");
      return;
    }
    const lines = entryForm.lines.map((line) => ({
      accountId: line.accountId,
      contactId: line.contactId?.trim() || undefined,
      debit: toNumber(line.debit),
      credit: toNumber(line.credit),
      note: line.note?.trim() || undefined,
      currency: entryForm.currency,
    }));
    if (lines.some((line) => !line.accountId)) {
      toast.error("Todas las líneas deben tener cuenta.");
      return;
    }
    if (!entryBalanced) {
      toast.error("La póliza debe estar balanceada (débitos = créditos).");
      return;
    }
    const payload = {
      occurredAt: entryForm.occurredAt
        ? new Date(entryForm.occurredAt).toISOString()
        : undefined,
      concept,
      reference: entryForm.reference.trim() || undefined,
      currency: entryForm.currency,
      sourceType: entryForm.sourceType,
      lines,
    };
    createEntryMutation.mutate(payload);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent className="sm:max-w-6xl w-[min(96vw,1200px)]">
        <SheetHeader>
          <SheetTitle>Nueva póliza</SheetTitle>
        </SheetHeader>
        <form
          id="finance-entry-form"
          className="space-y-4 py-4"
          onSubmit={handleSubmit}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TextField
              label="Concepto"
              icon={Notebook}
              value={entryForm.concept}
              onChange={(e) =>
                setEntryForm((p) => ({ ...p, concept: e.target.value }))
              }
              placeholder="Pago de proveedor"
              required
            />
            <TextField
              label="Referencia"
              icon={Hash}
              value={entryForm.reference}
              onChange={(e) =>
                setEntryForm((p) => ({ ...p, reference: e.target.value }))
              }
              placeholder="FAC-1044"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <DateTimeField
              label="Fecha"
              icon={CalendarDays}
              value={entryForm.occurredAt}
              onChange={(e) =>
                setEntryForm((p) => ({ ...p, occurredAt: e.target.value }))
              }
            />
            <SelectField
              label="Moneda"
              icon={Coins}
              value={entryForm.currency}
              onValueChange={(v) =>
                setEntryForm((p) => ({
                  ...p,
                  currency: normalizeCurrencyCode(v),
                }))
              }
              options={resolveCurrencyOptions(entryForm.currency)}
              required
            />
            <SelectField
              label="Origen"
              icon={ArrowRightLeft}
              value={entryForm.sourceType}
              onValueChange={(v) =>
                setEntryForm((p) => ({ ...p, sourceType: v }))
              }
              options={SOURCE_TYPE_OPTIONS}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Líneas de póliza</h4>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addLine}
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar linea
              </Button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
              <table className="min-w-full text-sm">
                <thead className="bg-[hsl(var(--muted))/0.35]">
                  <tr>
                    <th className="px-2 py-2.5 text-left font-medium">
                      Cuenta
                    </th>
                    <th className="px-2 py-2.5 text-left font-medium">
                      Contacto
                    </th>
                    <th className="px-2 py-2.5 text-left font-medium">
                      Debito
                    </th>
                    <th className="px-2 py-2.5 text-left font-medium">
                      Credito
                    </th>
                    <th className="px-2 py-2.5 text-left font-medium">Nota</th>
                    <th className="px-2 py-2.5 text-left font-medium">
                      Accion
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entryForm.lines.map((line, index) => (
                    <tr
                      key={`line-${index}`}
                      className="border-t border-[hsl(var(--border))]"
                    >
                      <td className="px-2 py-2.5 min-w-56">
                        <div className="relative">
                          <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                          <Select
                            value={line.accountId}
                            onValueChange={(v) =>
                              updateLine(index, { accountId: v })
                            }
                          >
                            <SelectTrigger className="h-10 pl-9">
                              <SelectValue placeholder="Selecciona cuenta" />
                            </SelectTrigger>
                            <SelectContent>
                              {activeAccounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.code} - {account.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 min-w-56">
                        <div className="relative">
                          <HandCoins className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                          <Select
                            value={line.contactId || "__none__"}
                            onValueChange={(v) =>
                              updateLine(index, {
                                contactId: v === "__none__" ? "" : v,
                              })
                            }
                          >
                            <SelectTrigger className="h-10 pl-9">
                              <SelectValue placeholder="Sin contacto" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">
                                Sin contacto
                              </SelectItem>
                              {contacts.map((contact) => (
                                <SelectItem key={contact.id} value={contact.id}>
                                  {contact.name}
                                  {contact.type ? ` (${contact.type})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 min-w-40">
                        <CurrencyField
                          icon={Plus}
                          value={line.debit}
                          onChange={(v) => updateLine(index, { debit: v })}
                          currency={entryForm.currency || "MXN"}
                          allowNegative={false}
                          allowDecimal
                          fractionDigits={2}
                          className="h-10"
                        />
                      </td>
                      <td className="px-2 py-2.5 min-w-40">
                        <CurrencyField
                          icon={Minus}
                          value={line.credit}
                          onChange={(v) => updateLine(index, { credit: v })}
                          currency={entryForm.currency || "MXN"}
                          allowNegative={false}
                          allowDecimal
                          fractionDigits={2}
                          className="h-10"
                        />
                      </td>
                      <td className="px-2 py-2.5 min-w-48">
                        <div className="relative">
                          <FileText className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                          <Input
                            value={line.note}
                            onChange={(e) =>
                              updateLine(index, { note: e.target.value })
                            }
                            className="h-10 pl-9"
                            placeholder="Detalle opcional"
                          />
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeLine(index)}
                          disabled={entryForm.lines.length <= 2}
                        >
                          Quitar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="glass">
                Debito: {formatMoney(lineTotals.debit)}
              </Badge>
              <Badge variant="glass">
                Credito: {formatMoney(lineTotals.credit)}
              </Badge>
              <Badge variant={entryBalanced ? "success" : "destructive"}>
                {entryBalanced ? "Balanceada" : "No balanceada"}
              </Badge>
            </div>
          </div>
        </form>
        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="finance-entry-form"
            loading={createEntryMutation.isPending}
            disabled={!entryBalanced || activeAccounts.length < 2}
          >
            Guardar póliza
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
