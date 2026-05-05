import { Badge } from "@atlas/ui";
import { cn } from "@atlas/ui";
import { Briefcase, Building2, Mail, Phone } from "lucide-react";

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
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  vacation: {
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
  },
  inactive: {
    bg: "bg-[hsl(var(--muted))]",
    text: "text-[hsl(var(--muted-foreground))]",
  },
  terminated: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
  },
};

function EmployeeAvatar({ employee, size = "md" }) {
  const initials =
    `${employee.firstName?.[0] ?? ""}${employee.lastName?.[0] ?? ""}`.toUpperCase();
  const colors = STATUS_AVATAR[employee.status] ?? STATUS_AVATAR.inactive;
  const sizeClass =
    size === "lg"
      ? "h-14 w-14 text-base rounded-2xl"
      : size === "xl"
        ? "h-10 w-10 text-sm rounded-xl"
        : "h-9 w-9 text-xs rounded-xl";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center font-bold",
        sizeClass,
        colors.bg,
        colors.text,
      )}
    >
      {initials || "?"}
    </div>
  );
}

// ── Card view (2-col → 3-col) ─────────────────────────────────────────────────

export function HrCardView({ employees, onNavigate }) {
  if (employees.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-[hsl(var(--muted-foreground))]">
        Sin resultados para los filtros aplicados.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {employees.map((employee) => (
        <button
          key={employee.id}
          type="button"
          onClick={() => onNavigate(employee.id)}
          className="glass group relative flex flex-col gap-3 rounded-2xl border border-[hsl(var(--border))] p-4 text-left transition-all duration-150 hover:border-[hsl(var(--border))]/60 hover:bg-[hsl(var(--muted))]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        >
          {/* header */}
          <div className="flex items-start gap-3">
            <EmployeeAvatar employee={employee} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-[hsl(var(--foreground))]">
                {employee.firstName} {employee.lastName}
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {employee.employeeCode || "Sin código"}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <Badge
                  variant={STATUS_VARIANT[employee.status] ?? "outline"}
                  className="text-xs"
                >
                  {STATUS_LABEL[employee.status] ?? employee.status}
                </Badge>
                {employee.employmentType && (
                  <Badge variant="outline" className="text-xs">
                    {EMPLOYMENT_LABEL[employee.employmentType] ??
                      employee.employmentType}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* details */}
          <div className="space-y-1.5 border-t border-[hsl(var(--border))]/50 pt-2.5">
            {employee.jobTitle && (
              <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                <Briefcase className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{employee.jobTitle}</span>
              </div>
            )}
            {employee.department && (
              <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{employee.department}</span>
              </div>
            )}
            {employee.workEmail && (
              <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{employee.workEmail}</span>
              </div>
            )}
            {employee.phone && (
              <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{employee.phone}</span>
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Grid view (4-col → 5-col, dense) ─────────────────────────────────────────

export function HrGridView({ employees, onNavigate }) {
  if (employees.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-[hsl(var(--muted-foreground))]">
        Sin resultados para los filtros aplicados.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
      {employees.map((employee) => (
        <button
          key={employee.id}
          type="button"
          onClick={() => onNavigate(employee.id)}
          className="glass group flex flex-col items-center gap-2 rounded-2xl border border-[hsl(var(--border))] p-3 text-center transition-all duration-150 hover:bg-[hsl(var(--muted))]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        >
          <EmployeeAvatar employee={employee} size="lg" />
          <div className="w-full min-w-0">
            <p className="truncate text-xs font-semibold text-[hsl(var(--foreground))]">
              {employee.firstName} {employee.lastName}
            </p>
            <p className="mt-0.5 truncate text-xs text-[hsl(var(--muted-foreground))]">
              {employee.jobTitle ||
                employee.department ||
                employee.employeeCode ||
                "-"}
            </p>
            <div className="mt-1 flex justify-center">
              <Badge
                variant={STATUS_VARIANT[employee.status] ?? "outline"}
                className="text-[10px] px-1.5 py-0"
              >
                {STATUS_LABEL[employee.status] ?? employee.status}
              </Badge>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
