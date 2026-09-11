import { Building2, ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@atlas/ui";
import { useActiveCompany } from "../company/ActiveCompanyProvider";

function CompanyLogo({ company, size = 20 }) {
  const initials = (company?.name ?? "E")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  if (company?.logoUrl) {
    return (
      <img
        src={company.logoUrl}
        alt={company.name}
        style={{ width: size, height: size }}
        className="rounded object-cover shrink-0"
      />
    );
  }

  return (
    <span
      style={{
        width: size,
        height: size,
        fontSize: size * 0.45,
        backgroundColor: company?.primaryColor ?? "hsl(var(--border))",
      }}
      className="rounded flex items-center justify-center font-bold text-white shrink-0 leading-none select-none"
    >
      {initials}
    </span>
  );
}

export function CompanySwitcher() {
  const { companies, activeCompany, isLoading, setActiveCompany } = useActiveCompany();

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[hsl(var(--muted))] text-xs text-[hsl(var(--muted-foreground))] select-none animate-pulse">
        <span className="w-5 h-5 rounded bg-[hsl(var(--border))] shrink-0" />
        <span className="w-16 h-2.5 rounded bg-[hsl(var(--border))]" />
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium select-none text-[hsl(var(--muted-foreground))] grayscale hover:grayscale-0 hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-all duration-150">
        <Building2 size={16} className="shrink-0" />
        <span className="max-w-30 truncate">Mi empresa</span>
      </div>
    );
  }

  if (companies.length === 1) {
    return (
      <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[hsl(var(--muted))] text-xs font-medium text-[hsl(var(--foreground))] select-none">
        <CompanyLogo company={activeCompany} size={20} />
        <span className="max-w-30 truncate">
          {activeCompany?.name ?? "Mi empresa"}
        </span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[hsl(var(--muted))] hover:bg-[hsl(var(--border))] text-xs font-medium text-[hsl(var(--foreground))] transition-colors duration-150 cursor-pointer outline-none">
          <CompanyLogo company={activeCompany} size={20} />
          <span className="max-w-30 truncate">
            {activeCompany?.name ?? "Empresa"}
          </span>
          <ChevronDown
            size={12}
            className="text-[hsl(var(--muted-foreground))] shrink-0"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>Cambiar empresa</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {companies.map((company) => (
          <DropdownMenuItem
            key={company.id}
            onClick={() => setActiveCompany(company.id)}
            className="gap-2 cursor-pointer"
          >
            <CompanyLogo company={company} size={18} />
            <span className="flex-1 truncate">{company.name}</span>
            {String(company.id) === String(activeCompany?.id) && (
              <Check size={13} className="shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
