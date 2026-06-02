// Atlas Fleet core views — vehicles, drivers, insurance, reports

export const vehiclesTable = {
  key: 'fleet.vehicles.table',
  kind: 'TABLE',
  schema: {
    entity: 'FleetVehicle',
    apiPath: '/fleet/vehicles',
    title: 'Vehiculos',
    columns: [
      { field: 'plate',               label: 'Placas' },
      { field: 'vehicle_brand_name',  label: 'Marca' },
      { field: 'model_name',          label: 'Modelo' },
      { field: 'year',                label: 'Año',      type: 'number' },
      { field: 'status',              label: 'Estado',   component: 'atlas.fleet:VehicleStatusBadge' },
      { field: 'driver_name',         label: 'Chofer' },
    ],
    actions: [{ label: 'Agregar vehiculo' }],
  },
}

export const vehiclesForm = {
  key: 'fleet.vehicles.form',
  kind: 'FORM',
  schema: {
    entity: 'FleetVehicle',
    apiPath: '/fleet/vehicles',
    sections: [
      {
        title: 'Datos del vehiculo',
        fields: [
          { name: 'plate',        label: 'Placas',        type: 'text',    required: true },
          { name: 'brand',        label: 'Marca',         type: 'text' },
          { name: 'model_name',   label: 'Modelo',        type: 'text' },
          { name: 'year',         label: 'Año',           type: 'number' },
          { name: 'color',        label: 'Color',         type: 'text' },
          {
            name: 'status', label: 'Estado', type: 'select',
            options: [
              { value: 'active',       label: 'Activo' },
              { value: 'maintenance',  label: 'Mantenimiento' },
              { value: 'inactive',     label: 'Inactivo' },
              { value: 'retired',      label: 'Retirado' },
            ],
          },
          { name: 'economic_group_number',      label: 'No. economico grupo',      type: 'text' },
          { name: 'economic_individual_number', label: 'No. economico individual', type: 'text' },
          { name: 'notes',        label: 'Notas',         type: 'textarea' },
        ],
      },
    ],
  },
}

export const driversTable = {
  key: 'fleet.drivers.table',
  kind: 'TABLE',
  schema: {
    entity: 'FleetDriver',
    apiPath: '/fleet/drivers',
    title: 'Choferes',
    columns: [
      { field: 'first_name',         label: 'Nombre' },
      { field: 'last_name',          label: 'Apellido' },
      { field: 'phone',              label: 'Telefono' },
      { field: 'license_number',     label: 'No. de licencia' },
      { field: 'license_expiry_date',label: 'Vence licencia', type: 'date' },
      { field: 'status',             label: 'Estado', component: 'atlas.fleet:DriverStatusBadge' },
    ],
    actions: [{ label: 'Agregar chofer' }],
  },
}

export const driversForm = {
  key: 'fleet.drivers.form',
  kind: 'FORM',
  schema: {
    entity: 'FleetDriver',
    apiPath: '/fleet/drivers',
    sections: [
      {
        title: 'Datos del chofer',
        fields: [
          { name: 'first_name',          label: 'Nombre',             type: 'text',    required: true },
          { name: 'last_name',           label: 'Apellido',           type: 'text',    required: true },
          { name: 'phone',               label: 'Telefono',           type: 'phone',   required: true },
          { name: 'email',               label: 'Correo',             type: 'email' },
          { name: 'license_number',      label: 'No. de licencia',    type: 'text',    required: true },
          { name: 'license_type',        label: 'Tipo de licencia',   type: 'text',    required: true },
          { name: 'license_expiry_date', label: 'Vencimiento lic.',   type: 'date',    required: true },
          {
            name: 'status', label: 'Estado', type: 'select',
            options: [
              { value: 'active',    label: 'Activo' },
              { value: 'inactive',  label: 'Inactivo' },
              { value: 'suspended', label: 'Suspendido' },
            ],
          },
          { name: 'notes', label: 'Notas', type: 'textarea' },
        ],
      },
    ],
  },
}

export const insuranceTable = {
  key: 'fleet.insurance.table',
  kind: 'TABLE',
  schema: {
    entity: 'FleetInsurancePolicy',
    apiPath: '/fleet/insurance',
    title: 'Polizas de seguro',
    columns: [
      { field: 'policy_number',  label: 'No. de poliza' },
      { field: 'insurer_name',   label: 'Aseguradora' },
      { field: 'coverage_type',  label: 'Cobertura', component: 'atlas.fleet:CoverageTypeBadge' },
      { field: 'start_date',     label: 'Inicio',     type: 'date' },
      { field: 'expiry_date',    label: 'Vencimiento',type: 'date' },
      { field: 'premium',        label: 'Prima',      type: 'currency' },
      { field: 'currency',       label: 'Moneda' },
    ],
    actions: [{ label: 'Agregar poliza' }],
  },
}

export const insuranceForm = {
  key: 'fleet.insurance.form',
  kind: 'FORM',
  schema: {
    entity: 'FleetInsurancePolicy',
    apiPath: '/fleet/insurance',
    sections: [
      {
        title: 'Datos de la poliza',
        fields: [
          { name: 'insurer_name',  label: 'Aseguradora',    type: 'text', required: true },
          { name: 'policy_number', label: 'No. de poliza',  type: 'text', required: true },
          {
            name: 'coverage_type', label: 'Tipo de cobertura', type: 'select',
            options: [
              { value: 'basic',         label: 'Basica' },
              { value: 'limited',       label: 'Limitada' },
              { value: 'comprehensive', label: 'Amplia' },
              { value: 'third_party',   label: 'Terceros' },
              { value: 'other',         label: 'Otro' },
            ],
          },
          { name: 'start_date',   label: 'Inicio de vigencia',  type: 'date', required: true },
          { name: 'expiry_date',  label: 'Vencimiento',         type: 'date', required: true },
          { name: 'premium',      label: 'Prima',               type: 'number' },
          { name: 'currency',     label: 'Moneda',              type: 'text' },
          { name: 'notes',        label: 'Notas',               type: 'textarea' },
        ],
      },
    ],
  },
}

export const reportsMaintenanceTable = {
  key: 'fleet.reports.maintenance.table',
  kind: 'TABLE',
  schema: {
    entity: 'FleetReportMaintenance',
    apiPath: '/fleet/reports/maintenance',
    title: 'Mantenimiento',
    columns: [
      { field: 'folio',        label: 'Folio' },
      { field: 'title',        label: 'Titulo' },
      { field: 'report_date',  label: 'Fecha',   type: 'date' },
      { field: 'status',       label: 'Estado',  component: 'atlas.fleet:ReportStatusBadge' },
      { field: 'total_cost',   label: 'Costo total', type: 'currency' },
    ],
    actions: [{ label: 'Nuevo reporte' }],
  },
}

export const reportsServiceTable = {
  key: 'fleet.reports.service.table',
  kind: 'TABLE',
  schema: {
    entity: 'FleetReportService',
    apiPath: '/fleet/reports/service',
    title: 'Servicio',
    columns: [
      { field: 'folio',        label: 'Folio' },
      { field: 'title',        label: 'Titulo' },
      { field: 'report_date',  label: 'Fecha',   type: 'date' },
      { field: 'status',       label: 'Estado',  component: 'atlas.fleet:ReportStatusBadge' },
      { field: 'total_cost',   label: 'Costo total', type: 'currency' },
    ],
    actions: [{ label: 'Nuevo reporte' }],
  },
}

export const reportsRepairTable = {
  key: 'fleet.reports.repair.table',
  kind: 'TABLE',
  schema: {
    entity: 'FleetReportRepair',
    apiPath: '/fleet/reports/repair',
    title: 'Reparacion',
    columns: [
      { field: 'folio',        label: 'Folio' },
      { field: 'title',        label: 'Titulo' },
      { field: 'report_date',  label: 'Fecha',   type: 'date' },
      { field: 'status',       label: 'Estado',  component: 'atlas.fleet:ReportStatusBadge' },
      { field: 'total_cost',   label: 'Costo total', type: 'currency' },
    ],
    actions: [{ label: 'Nuevo reporte' }],
  },
}
