import { ActivityTimeline } from "@atlas/ui";
import { atlas } from "../../../lib/atlas";

/**
 * Embeddable activity panel for HR Employee detail.
 * Shows the activity stream filtered to this employee entity.
 */
export default function HrEmployeeActivityPanel({ employeeId, token }) {
  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
      <div className="px-4 py-3 border-b border-[hsl(var(--border))]">
        <h3 className="text-sm font-semibold">Actividad reciente</h3>
      </div>
      <ActivityTimeline
        sdk={atlas}
        token={token}
        entityType="HrEmployee"
        entityId={employeeId}
        limit={50}
        heightClass="max-h-[480px]"
        emptyMessage="Sin actividad registrada para este colaborador."
      />
    </div>
  );
}
