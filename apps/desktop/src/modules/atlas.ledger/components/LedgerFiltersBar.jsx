import { DatePickerField, SelectField, TextField } from "@atlas/ui";
import { Search } from "lucide-react";

const DIRECTION_FILTER_OPTIONS = [
  { value: "ALL", label: "Todos los tipos" },
  { value: "INCOME", label: "Abonos" },
  { value: "EXPENSE", label: "Cargos" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "ALL", label: "Todos los estados" },
  { value: "ACTIVE", label: "Activos" },
  { value: "CANCELLED", label: "Cancelados" },
];

export function LedgerFiltersBar({ filters, onChange }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <DatePickerField
        label="Desde"
        value={filters.dateFrom}
        onChange={(v) => onChange({ dateFrom: v })}
        placeholder="Sin límite"
      />
      <DatePickerField
        label="Hasta"
        value={filters.dateTo}
        onChange={(v) => onChange({ dateTo: v })}
        placeholder="Sin límite"
      />
      <SelectField
        label="Tipo"
        value={filters.direction ?? "ALL"}
        onValueChange={(v) => onChange({ direction: v === "ALL" ? undefined : v })}
        options={DIRECTION_FILTER_OPTIONS}
      />
      <SelectField
        label="Estado"
        value={filters.status ?? "ALL"}
        onValueChange={(v) => onChange({ status: v === "ALL" ? undefined : v })}
        options={STATUS_FILTER_OPTIONS}
      />
      <div className="col-span-2 sm:col-span-1">
        <TextField
          label="Buscar"
          icon={Search}
          value={filters.search ?? ""}
          onChange={(e) => onChange({ search: e.target.value || undefined })}
          placeholder="Concepto, referencia..."
        />
      </div>
    </div>
  );
}
