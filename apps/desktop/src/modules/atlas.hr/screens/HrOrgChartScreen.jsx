import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, ComboboxField, EmptyState, Skeleton } from "@atlas/ui";
import { Maximize2, Minimize2, RefreshCw, UsersRound } from "lucide-react";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

function buildEmployeeOptions(employees = []) {
  return [
    { value: "__all__", label: "Toda la organización" },
    ...employees.map((row) => ({
      value: row.id,
      label: `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim(),
    })),
  ];
}

function OrgNode({ node, onOpenDetail, depth = 0 }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={() => onOpenDetail(node.id)}
        className="w-56 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 text-left shadow-sm transition hover:border-[hsl(var(--primary))]/50"
      >
        <p className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">{node.name}</p>
        <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{node.jobTitle || "Sin puesto"}</p>
        <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{node.department || "Sin departamento"}</p>
      </button>

      {Array.isArray(node.children) && node.children.length > 0 && (
        <div className="relative">
          <div className="mx-auto mb-2 h-4 w-px bg-[hsl(var(--border))]" />
          <div className="flex flex-wrap justify-center gap-6">
            {node.children.map((child) => (
              <div key={child.id} className="relative pt-4">
                <div className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 bg-[hsl(var(--border))]" />
                <OrgNode node={child} onOpenDetail={onOpenDetail} depth={depth + 1} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HrOrgChartScreen() {
  const { session } = useAuth();
  const token = session?.access_token;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const rootEmployeeId = params.get("root") || "__all__";

  const employeesQuery = useQuery({
    queryKey: ["hr-employees-org-options"],
    queryFn: () => atlas.hr.listEmployees(token, { limit: 500, enabled: true }),
    enabled: Boolean(token),
  });

  const orgQuery = useQuery({
    queryKey: ["hr-org-chart", rootEmployeeId],
    queryFn: () =>
      atlas.hr.getOrgChart(token, {
        enabled: true,
        rootEmployeeId: rootEmployeeId === "__all__" ? undefined : rootEmployeeId,
      }),
    enabled: Boolean(token),
  });

  const employeeOptions = useMemo(
    () => buildEmployeeOptions(employeesQuery.data?.data ?? []),
    [employeesQuery.data?.data],
  );

  const roots = orgQuery.data?.data?.roots ?? [];

  function openDetail(id) {
    navigate(`/app/m/atlas.hr/hr/employees/${id}`);
  }

  function updateRoot(value) {
    const next = new URLSearchParams(params);
    if (!value || value === "__all__") {
      next.delete("root");
    } else {
      next.set("root", value);
    }
    setParams(next, { replace: true });
  }

  function handleWheel(event) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    setScale((prev) => Math.min(2.2, Math.max(0.5, Number((prev + delta).toFixed(2)))));
  }

  function handlePointerDown(event) {
    setDragging(true);
    setDragStart({ x: event.clientX - offset.x, y: event.clientY - offset.y });
  }

  function handlePointerMove(event) {
    if (!dragging) return;
    setOffset({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y });
  }

  function handlePointerUp() {
    setDragging(false);
  }

  function resetView() {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }

  return (
    <div className="p-4 md:p-6 space-y-4 min-h-dvh">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-72 max-w-xl flex-1">
          <ComboboxField
            label="Árbol desde"
            value={rootEmployeeId}
            options={employeeOptions}
            onChange={updateRoot}
            placeholder="Seleccionar raíz..."
            searchPlaceholder="Buscar colaborador..."
          />
        </div>
        <div className="ml-auto flex items-center gap-2 pt-6">
          <Button type="button" variant="outline" onClick={() => setScale((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(2))))}>
            <Minimize2 className="mr-2 h-4 w-4" />
            Alejar
          </Button>
          <Button type="button" variant="outline" onClick={() => setScale((prev) => Math.min(2.2, Number((prev + 0.1).toFixed(2))))}>
            <Maximize2 className="mr-2 h-4 w-4" />
            Acercar
          </Button>
          <Button type="button" variant="outline" onClick={resetView}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        {orgQuery.isLoading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : roots.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={UsersRound}
              title="Sin estructura jerárquica"
              description="Agrega colaboradores y supervisor para visualizar el organigrama."
            />
          </div>
        ) : (
          <div
            className="h-[70dvh] overflow-hidden"
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            <div
              className="h-full w-full cursor-grab active:cursor-grabbing overflow-auto"
              style={{ touchAction: "none" }}
            >
              <div
                className="min-h-full min-w-full p-8"
                style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: "center top" }}
              >
                <div className="flex flex-wrap items-start justify-center gap-10">
                  {roots.map((root) => (
                    <OrgNode key={root.id} node={root} onOpenDetail={openDetail} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

