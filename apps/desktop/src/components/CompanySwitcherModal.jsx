import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@atlas/ui";
import { useActiveCompany } from "../company/ActiveCompanyProvider";
import { useAuth } from "../auth/AuthProvider";
import { CompanyLogo } from "./CompanySwitcher";
import { CreateCompanyDialog } from "./CreateCompanyDialog";

// Mobile counterpart to CompanySwitcher's inline topbar dropdown (which is
// hidden below the `md` breakpoint — see Topbar.jsx). Reached from
// UserMenu's mobile-only section instead, as a full-screen-friendly modal
// rather than a nested dropdown, which is awkward on touch.
export function CompanySwitcherModal({ onClose }) {
  const { companies, activeCompany, setActiveCompany } = useActiveCompany();
  const { userProfile } = useAuth();
  // Matches CompanySwitcher.jsx: any admin of the active company, not
  // system.admin alone — see that file's comment for why.
  const canCreateCompany = Boolean(userProfile?.isAdmin);
  const [createOpen, setCreateOpen] = useState(false);

  function handleSelect(companyId) {
    setActiveCompany(companyId);
    onClose();
  }

  return (
    <>
      <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Cambiar empresa</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {companies.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))] py-4 text-center">
                No perteneces a ninguna empresa todavía.
              </p>
            ) : (
              companies.map((company) => {
                const isActive = String(company.id) === String(activeCompany?.id);
                return (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => handleSelect(company.id)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors duration-150 cursor-pointer text-left"
                  >
                    <CompanyLogo company={company} size={22} />
                    <span className="flex-1 truncate text-sm font-medium text-[hsl(var(--foreground))]">
                      {company.name}
                    </span>
                    {isActive && <Check size={14} className="shrink-0 text-[hsl(var(--foreground))]" />}
                  </button>
                );
              })
            )}
          </div>
          {canCreateCompany && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors duration-150 cursor-pointer text-sm font-medium text-[hsl(var(--foreground))] border-t border-[hsl(var(--border))] mt-1 pt-3"
            >
              <Plus size={16} className="shrink-0" />
              Crear empresa
            </button>
          )}
        </DialogContent>
      </Dialog>
      {createOpen && (
        <CreateCompanyDialog
          onClose={() => {
            setCreateOpen(false);
            onClose();
          }}
        />
      )}
    </>
  );
}
