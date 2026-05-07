import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DateField,
  EmptyState,
  Input,
  PageHeader,
  Skeleton,
} from "@atlas/ui";
import { ArrowLeftRight, Calendar, Plus, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { atlas } from "../../../lib/atlas";
import {
  SECTION_META,
  defaultFxForm,
  formatDate,
  normalizeCurrencyCode,
  parseApiError,
  resolveCurrencyOptions,
} from "../lib/finance-utils";

export function FinanceFxRates({ token }) {
  const queryClient = useQueryClient();
  const [fxForm, setFxForm] = useState(defaultFxForm());
  const [pendingFxId, setPendingFxId] = useState(null);

  const fxRatesQuery = useQuery({
    queryKey: ["finance-fx-rates"],
    queryFn: () => atlas.finance.listFxRates(token, { limit: 200 }),
    enabled: Boolean(token),
  });

  const accountsQuery = useQuery({
    queryKey: ["finance-accounts"],
    queryFn: () => atlas.finance.listAccounts(token, { limit: 200 }),
    enabled: Boolean(token),
  });

  const createFxRateMutation = useMutation({
    mutationFn: (payload) => atlas.finance.createFxRate(payload, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-fx-rates"] });
      setFxForm(defaultFxForm());
      toast.success("Tipo de cambio registrado");
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo crear el tipo de cambio."));
    },
  });

  const toggleFxRateMutation = useMutation({
    mutationFn: ({ id, enabled }) =>
      atlas.finance.setFxRateEnabled(id, enabled, token),
    onMutate: ({ id }) => setPendingFxId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-fx-rates"] });
      toast.success("Estado actualizado");
    },
    onSettled: () => setPendingFxId(null),
    onError: (error) => {
      toast.error(
        parseApiError(error, "No se pudo actualizar el tipo de cambio."),
      );
    },
  });

  const fxRates = fxRatesQuery.data?.data ?? [];
  const accounts = accountsQuery.data?.data ?? [];
  const currencyOptions = resolveCurrencyOptions(accounts);
  const pageMeta = SECTION_META.fxRates;

  function handleSubmitFxRate(event) {
    event.preventDefault();
    const base = normalizeCurrencyCode(fxForm.baseCurrency);
    const quote = normalizeCurrencyCode(fxForm.quoteCurrency);
    if (!base) {
      toast.error("Selecciona la moneda base.");
      return;
    }
    if (!quote) {
      toast.error("Selecciona la moneda cotizada.");
      return;
    }
    if (base === quote) {
      toast.error("La moneda base y cotizada deben ser diferentes.");
      return;
    }
    const rate = parseFloat(fxForm.rate);
    if (isNaN(rate) || rate <= 0) {
      toast.error("Ingresa una tasa de cambio valida (> 0).");
      return;
    }
    if (!fxForm.effectiveDate) {
      toast.error("Selecciona la fecha de vigencia.");
      return;
    }
    createFxRateMutation.mutate({
      baseCurrency: base,
      quoteCurrency: quote,
      rate,
      effectiveDate: fxForm.effectiveDate,
    });
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <PageHeader
          eyebrow="Atlas Finance"
          title={pageMeta.title}
          description={pageMeta.description}
        />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nuevo tipo de cambio</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitFxRate}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Moneda base *
                    </label>
                    <select
                      className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                      value={fxForm.baseCurrency}
                      onChange={(e) =>
                        setFxForm((f) => ({
                          ...f,
                          baseCurrency: e.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">-- Seleccionar --</option>
                      {currencyOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Moneda cotizada *
                    </label>
                    <select
                      className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
                      value={fxForm.quoteCurrency}
                      onChange={(e) =>
                        setFxForm((f) => ({
                          ...f,
                          quoteCurrency: e.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">-- Seleccionar --</option>
                      {currencyOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Tasa *
                    </label>
                    <Input
                      type="number"
                      min="0.000001"
                      step="0.000001"
                      value={fxForm.rate}
                      onChange={(e) =>
                        setFxForm((f) => ({ ...f, rate: e.target.value }))
                      }
                      placeholder="17.50"
                      required
                    />
                  </div>
                  <DateField
                    label="Vigencia *"
                    icon={Calendar}
                    value={fxForm.effectiveDate}
                    onChange={(e) =>
                      setFxForm((f) => ({
                        ...f,
                        effectiveDate: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <Button type="submit" loading={createFxRateMutation.isPending}>
                  <Plus className="h-4 w-4" />
                  Registrar tipo de cambio
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Tipos de cambio registrados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {fxRatesQuery.isLoading ? (
                <Skeleton className="h-40 w-full rounded-xl" />
              ) : fxRates.length === 0 ? (
                <EmptyState
                  title="Sin tipos de cambio"
                  description="Registra paridades entre monedas para documentos multi-divisa."
                  icon={ArrowLeftRight}
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[hsl(var(--muted))/0.35]">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          Base
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Cotizada
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Tasa
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Vigencia
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Estado
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {fxRates.map((fx) => (
                        <tr
                          key={fx.id}
                          className="border-t border-[hsl(var(--border))]"
                        >
                          <td className="px-3 py-2 font-mono">
                            {fx.baseCurrency}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {fx.quoteCurrency}
                          </td>
                          <td className="px-3 py-2">
                            {parseFloat(fx.rate).toFixed(6)}
                          </td>
                          <td className="px-3 py-2">
                            {formatDate(fx.effectiveDate)}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant={fx.enabled ? "success" : "secondary"}
                            >
                              {fx.enabled ? "Activo" : "Inactivo"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pendingFxId === fx.id}
                              onClick={() =>
                                toggleFxRateMutation.mutate({
                                  id: fx.id,
                                  enabled: !fx.enabled,
                                })
                              }
                            >
                              {fx.enabled ? (
                                <>
                                  <PowerOff className="h-3.5 w-3.5 mr-1" />
                                  Deshabilitar
                                </>
                              ) : (
                                <>
                                  <Power className="h-3.5 w-3.5 mr-1" />
                                  Habilitar
                                </>
                              )}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
