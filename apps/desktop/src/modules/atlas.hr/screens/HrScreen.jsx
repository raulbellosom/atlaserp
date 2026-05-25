import { useNavigate, useParams } from "react-router-dom";
import { AtlasTable, Button, PageHeader } from "@atlas/ui";
import { Plus } from "lucide-react";
import { useAuth } from "../../../auth/AuthProvider";

const API_BASE_URL = import.meta.env.VITE_ATLAS_API_URL || "http://localhost:4010";
import HrEmployeeDetail from "./HrEmployeeDetail";
import HrOrgChartScreen from "./HrOrgChartScreen";
import HrCatalogsScreen from "./HrCatalogsScreen";

const HR_EMPLOYEES_BLUEPRINT = {
  key: "hr.employees.table",
  schema: {
    apiPath: "/hr/employees",
    primaryField: "full_name",
    searchable: true,
    searchPlaceholder: "Buscar colaborador...",
    columns: [
      { field: "full_name", label: "Nombre", sortable: true, link: true },
      { field: "employee_code", label: "Codigo", sortable: false },
      { field: "job_title", label: "Puesto", sortable: false },
      { field: "department", label: "Departamento", sortable: false },
      { field: "status", label: "Estado", sortable: true },
      { field: "employment_type", label: "Tipo", sortable: false },
      { field: "hire_date", label: "Ingreso", sortable: true },
    ],
    filters: [
      {
        key: "status",
        label: "Estado",
        type: "select",
        options: [
          { value: "active", label: "Activo" },
          { value: "vacation", label: "Vacaciones" },
          { value: "inactive", label: "Inactivo" },
          { value: "terminated", label: "Baja" },
        ],
      },
    ],
    emptyState: { message: "No hay colaboradores registrados." },
  },
};

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HrScreen() {
  const { session, userProfile } = useAuth();
  const token = session?.access_token;
  const permissions = userProfile?.permissions ?? [];
  const hasPermission = (key) => Boolean(userProfile?.isAdmin || permissions.includes(key));
  const canReadEmployees = hasPermission("hr.employee.read");
  const canCreateEmployees = hasPermission("hr.employee.create");
  const { "*": wildcard } = useParams();
  const navigate = useNavigate();

  const employeeId = wildcard?.startsWith("hr/employees/")
    ? wildcard.replace("hr/employees/", "")
    : null;
  const isOrgChartRoute = wildcard === "hr/org-chart";
  const isCatalogsRoute = wildcard === "hr/catalogs";
  const isDetailRoute = Boolean(employeeId);

  if (isOrgChartRoute) return <HrOrgChartScreen />;
  if (isCatalogsRoute) return <HrCatalogsScreen />;
  if (isDetailRoute) {
    return (
      <div className="p-4 md:p-6 min-h-dvh">
        <HrEmployeeDetail employeeId={employeeId} />
      </div>
    );
  }

  if (!canReadEmployees) {
    return (
      <div className="p-4 md:p-6 space-y-6 min-h-dvh">
        <PageHeader
          eyebrow="Atlas HR"
          title="Colaboradores"
          description="Directorio y expedientes del equipo."
        />
        <p className="text-sm text-muted-foreground">No tienes permisos para ver los colaboradores.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 min-h-dvh">
      <PageHeader
        eyebrow="Atlas HR"
        title="Colaboradores"
        description="Directorio y expedientes del equipo."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/app/m/atlas.hr/hr/org-chart")}
            >
              Organigrama
            </Button>
            {canCreateEmployees && (
              <Button onClick={() => navigate("/app/m/atlas.hr/hr/employees/new")}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo colaborador
              </Button>
            )}
          </div>
        }
      />
      <AtlasTable
        blueprint={HR_EMPLOYEES_BLUEPRINT}
        token={token}
        apiBaseUrl={API_BASE_URL}
        onView={(row) => navigate(`/app/m/atlas.hr/hr/employees/${row.id}`)}
      />
    </div>
  );
}
