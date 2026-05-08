import { Badge } from "@atlas/ui";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@atlas/ui";
import { cn } from "@atlas/ui";
import { ChevronUp, ChevronDown, MoreHorizontal, User } from "lucide-react";

const STATUS_VARIANT = {
  active: "success",
  vacation: "secondary",
  inactive: "outline",
  terminated: "destructive",
};

const STATUS_LABEL = {
  active: "Activo",
  vacation: "Vacaciones",
  inactive: "Inactivo",
  terminated: "Baja",
};

const EMPLOYMENT_LABEL = {
  full_time: "T. completo",
  part_time: "Medio tiempo",
  contractor: "Contratista",
  intern: "Practicante",
};

const STATUS_AVATAR = {
  active: {
    bg: "bg-emerald-500/20 dark:bg-emerald-400/20 ring-1 ring-emerald-500/50 dark:ring-emerald-400/30",
    text: "text-emerald-900 dark:text-emerald-300",
  },
  vacation: {
    bg: "bg-amber-500/20   dark:bg-amber-400/20   ring-1 ring-amber-500/50   dark:ring-amber-400/30",
    text: "text-amber-900   dark:text-amber-300",
  },
  inactive: {
    bg: "bg-slate-500/15   dark:bg-slate-400/20   ring-1 ring-slate-500/40   dark:ring-slate-400/30",
    text: "text-slate-700   dark:text-slate-300",
  },
  terminated: {
    bg: "bg-red-500/20     dark:bg-red-400/20     ring-1 ring-red-500/50     dark:ring-red-400/30",
    text: "text-red-900     dark:text-red-300",
  },
};

function EmployeeAvatar({ employee }) {
  const initials =
    `${employee.firstName?.[0] ?? ""}${employee.lastName?.[0] ?? ""}`.toUpperCase();
  const colors = STATUS_AVATAR[employee.status] ?? STATUS_AVATAR.inactive;
  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
        colors.bg,
        colors.text,
      )}
    >
      {initials || <User className="h-4 w-4" />}
    </div>
  );
}

function SortIndicator({ active, dir }) {
  if (!active) return null;
  return dir === "asc" ? (
    <ChevronUp className="ml-1 h-3 w-3" />
  ) : (
    <ChevronDown className="ml-1 h-3 w-3" />
  );
}

function fmtDateShort(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("es-MX", { dateStyle: "medium" });
}

const COLUMNS = [
  { key: "name", label: "Colaborador", sortKey: "name" },
  { key: "employeeCode", label: "Código", width: "w-24" },
  { key: "jobTitle", label: "Puesto", width: "min-w-[140px]" },
  { key: "department", label: "Departamento", width: "min-w-[120px]" },
  { key: "status", label: "Estado", width: "w-28" },
  { key: "employmentType", label: "Tipo", width: "w-28" },
  {
    key: "hireDate",
    label: "Ingreso",
    width: "w-28",
    sortKey: "hireDate",
  },
];

export function HrTableView({ employees, sort, onCycleSort, onNavigate }) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[hsl(var(--muted))]/40 border-b border-[hsl(var(--border))]">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide",
                    col.width,
                    col.sortKey &&
                      "cursor-pointer select-none hover:text-[hsl(var(--foreground))] transition-colors",
                  )}
                  onClick={
                    col.sortKey ? () => onCycleSort(col.sortKey) : undefined
                  }
                >
                  <span className="inline-flex items-center">
                    {col.label}
                    {col.sortKey && (
                      <SortIndicator
                        active={sort.by === col.sortKey}
                        dir={sort.dir}
                      />
                    )}
                  </span>
                </th>
              ))}
              <th className="w-10 px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMNS.length + 1}
                  className="px-4 py-12 text-center text-sm text-[hsl(var(--muted-foreground))]"
                >
                  Sin resultados para los filtros aplicados.
                </td>
              </tr>
            )}
            {employees.map((employee) => (
              <tr
                key={employee.id}
                className="border-b border-[hsl(var(--border))] last:border-0 transition-colors hover:bg-[hsl(var(--muted))]/20 cursor-pointer"
                onClick={() => onNavigate(employee.id)}
              >
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <EmployeeAvatar employee={employee} />
                    <div>
                      <p className="font-medium text-[hsl(var(--foreground))]">
                        {employee.firstName} {employee.lastName}
                      </p>
                      {employee.workEmail && (
                        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-45">
                          {employee.workEmail}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-[hsl(var(--muted-foreground))]">
                  {employee.employeeCode || "-"}
                </td>
                <td className="px-3 py-3 text-[hsl(var(--foreground))]">
                  {employee.jobTitle || "-"}
                </td>
                <td className="px-3 py-3 text-[hsl(var(--muted-foreground))]">
                  {employee.department || "-"}
                </td>
                <td className="px-3 py-3">
                  <Badge
                    variant={STATUS_VARIANT[employee.status] ?? "outline"}
                    className="text-xs"
                  >
                    {STATUS_LABEL[employee.status] ?? employee.status}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  {employee.employmentType ? (
                    <Badge variant="outline" className="text-xs">
                      {EMPLOYMENT_LABEL[employee.employmentType] ??
                        employee.employmentType}
                    </Badge>
                  ) : (
                    <span className="text-[hsl(var(--muted-foreground))]">
                      -
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-[hsl(var(--muted-foreground))]">
                  {fmtDateShort(employee.hireDate)}
                </td>
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Acciones"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onNavigate(employee.id)}>
                        Ver expediente
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
