import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  PageHeader,
  SelectField,
  Skeleton,
} from "@atlas/ui";
import { Percent, Plus, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { atlas } from "../../../lib/atlas";
import {
  SECTION_META,
  defaultTaxRateForm,
  parseApiError,
} from "../lib/finance-utils";

export function FinanceTaxes({ token }) {
  const queryClient = useQueryClient();
  const [taxRateForm, setTaxRateForm] = useState(defaultTaxRateForm());
  const [pendingTaxRateId, setPendingTaxRateId] = useState(null);

  const taxRatesQuery = useQuery({
    queryKey: ["finance-tax-rates"],
    queryFn: () => atlas.finance.listTaxRates(token, { limit: 200 }),
    enabled: Boolean(token),
  });

  const createTaxRateMutation = useMutation({
    mutationFn: (payload) => atlas.finance.createTaxRate(payload, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-tax-rates"] });
      setTaxRateForm(defaultTaxRateForm());
      toast.success("Tasa registrada");
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo crear la tasa fiscal."));
    },
  });

  const toggleTaxRateMutation = useMutation({
    mutationFn: ({ id, enabled }) =>
      atlas.finance.setTaxRateEnabled(id, enabled, token),
    onMutate: ({ id }) => setPendingTaxRateId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-tax-rates"] });
      toast.success("Estado actualizado");
    },
    onSettled: () => setPendingTaxRateId(null),
    onError: (error) => {
      toast.error(
        parseApiError(error, "No se pudo actualizar la tasa fiscal."),
      );
    },
  });

  const taxRates = taxRatesQuery.data?.data ?? [];
  const pageMeta = SECTION_META.taxes;

  function handleSubmitTaxRate(event) {
    event.preventDefault();
    if (!taxRateForm.name?.trim()) {
      toast.error("El nombre de la tasa es requerido.");
      return;
    }
    const rate = parseFloat(taxRateForm.rate);
    if (isNaN(rate) || rate < 0) {
      toast.error("Ingresa una tasa valida (>= 0).");
      return;
    }
    createTaxRateMutation.mutate({
      code: taxRateForm.code?.trim() || undefined,
      name: taxRateForm.name.trim(),
      taxType: taxRateForm.taxType || "TRANSFER",
      rate,
      direction: taxRateForm.direction || undefined,
      enabled: true,
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
              <CardTitle className="text-base">Nueva tasa fiscal</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitTaxRate}>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Clave
                    </label>
                    <Input
                      value={taxRateForm.code}
                      onChange={(e) =>
                        setTaxRateForm((f) => ({ ...f, code: e.target.value }))
                      }
                      placeholder="IVA16"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">
                      Nombre *
                    </label>
                    <Input
                      value={taxRateForm.name}
                      onChange={(e) =>
                        setTaxRateForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="IVA 16%"
                      required
                    />
                  </div>
                  <SelectField
                    label="Tipo"
                    value={taxRateForm.taxType}
                    onValueChange={(v) =>
                      setTaxRateForm((f) => ({ ...f, taxType: v }))
                    }
                    options={[
                      { value: "TRANSFER", label: "Traslado" },
                      { value: "WITHHOLDING", label: "Retencion" },
                    ]}
                  />
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Tasa %
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={taxRateForm.rate}
                      onChange={(e) =>
                        setTaxRateForm((f) => ({ ...f, rate: e.target.value }))
                      }
                      placeholder="16"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                  <SelectField
                    label="Direccion"
                    value={taxRateForm.direction || "all"}
                    onValueChange={(v) =>
                      setTaxRateForm((f) => ({
                        ...f,
                        direction: v === "all" ? "" : v,
                      }))
                    }
                    options={[
                      { value: "all", label: "Ambas" },
                      { value: "AR", label: "AR (CxC)" },
                      { value: "AP", label: "AP (CxP)" },
                    ]}
                  />
                </div>
                <Button type="submit" loading={createTaxRateMutation.isPending}>
                  <Plus className="h-4 w-4" />
                  Registrar tasa
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tasas registradas</CardTitle>
            </CardHeader>
            <CardContent>
              {taxRatesQuery.isLoading ? (
                <Skeleton className="h-40 w-full rounded-xl" />
              ) : taxRates.length === 0 ? (
                <EmptyState
                  title="Sin tasas fiscales"
                  description="Registra tasas de IVA, retenciones, etc."
                  icon={Percent}
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[hsl(var(--muted))/0.35]">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          Clave
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Nombre
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Tipo
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Tasa %
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Direccion
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
                      {taxRates.map((rate) => (
                        <tr
                          key={rate.id}
                          className="border-t border-[hsl(var(--border))]"
                        >
                          <td className="px-3 py-2 font-mono">
                            {rate.code || "-"}
                          </td>
                          <td className="px-3 py-2">{rate.name}</td>
                          <td className="px-3 py-2">
                            {rate.taxType === "WITHHOLDING"
                              ? "Retencion"
                              : "Traslado"}
                          </td>
                          <td className="px-3 py-2">
                            {parseFloat(rate.rate ?? 0).toFixed(2)}%
                          </td>
                          <td className="px-3 py-2">
                            {rate.direction || "Ambas"}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant={rate.enabled ? "success" : "secondary"}
                            >
                              {rate.enabled ? "Activa" : "Inactiva"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pendingTaxRateId === rate.id}
                              onClick={() =>
                                toggleTaxRateMutation.mutate({
                                  id: rate.id,
                                  enabled: !rate.enabled,
                                })
                              }
                            >
                              {rate.enabled ? (
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
