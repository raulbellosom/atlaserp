import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@atlas/ui";
import { atlas } from "../lib/atlas";

const STORAGE_KEY = "atlas-active-company";

function getStoredCompanyId() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeCompanyId(id) {
  try {
    localStorage.setItem(STORAGE_KEY, String(id));
  } catch {}
}

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

export function CompanySwitcher({ token }) {
  const { data, isLoading } = useQuery({
    queryKey: ["memberships-me", token],
    queryFn: () => atlas.memberships.me(token),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
  });

  // Normalize: API may return { data: [...] } or a plain array
  const memberships = Array.isArray(data) ? data : (data?.data ?? []);
  const companies = memberships
    .map((m) => m.company ?? m)
    .filter((c) => c && c.name);

  const [activeId, setActiveId] = useState(getStoredCompanyId);
  const activeCompany =
    companies.find((c) => String(c.id) === activeId) ?? companies[0];

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
            onClick={() => {
              setActiveId(String(company.id));
              storeCompanyId(company.id);
            }}
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
