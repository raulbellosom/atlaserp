// Atlas Fleet — vehicles, drivers, insurance, reports

// ─── Vehicles ────────────────────────────────────────────────────────────────

export const vehiclePage = {
  key: 'fleet.vehicle.page',
  kind: 'PAGE',
  schema: {
    path: '/app/m/atlas.fleet/vehicles',
    title: 'Vehiculos',
    layout: 'main',
    view: 'fleet.vehicle.table',
  },
}

export const vehicleTable = {
  key: 'fleet.vehicle.table',
  kind: 'TABLE',
  schema: {
    entity: 'vehicle',
    component: 'AtlasTable',
    apiPath: '/fleet/vehicles',
    primaryField: 'plate',
    searchable: true,
    searchPlaceholder: 'Buscar vehiculo...',
    columns: [
      { field: 'cover_image_file_asset_id', label: 'Imagen', sortable: false, component: 'atlas.fleet:VehicleImageCell' },
      { field: 'plate', label: 'Matricula', sortable: true, link: true },
      { field: 'vehicle_brand_name', label: 'Marca', sortable: false },
      { field: 'vehicle_model_name', label: 'Modelo', sortable: false },
      { field: 'vehicle_model_year', label: 'Anio', sortable: false, type: 'number' },
      { field: 'color', label: 'Color', sortable: false, type: 'color' },
      { field: 'status', label: 'Estado', sortable: true, component: 'atlas.fleet:VehicleStatusBadge' },
      { field: 'is_financed', label: 'Financiado', sortable: true, type: 'boolean' },
      { field: 'full_economic_number', label: 'No. Economico', sortable: false },
      { field: 'vehicle_type_name', label: 'Tipo', sortable: false },
      { field: 'driver_name', label: 'Conductor', sortable: false, hrefTemplate: '/app/m/atlas.fleet/drivers/:driver_id' },
      { field: 'insurance_status', label: 'Seguro', sortable: false, component: 'atlas.fleet:InsuranceBadgeCell' },
    ],
    actions: [{ label: 'Crear vehiculo', permission: 'fleet.vehicles.create', variant: 'primary' }],
    rowActions: [
      { label: 'Ver detalle', permission: 'fleet.vehicles.read' },
      { label: 'Editar', permission: 'fleet.vehicles.update' },
      { label: 'Desactivar', permission: 'fleet.vehicles.delete' },
    ],
    emptyState: { message: 'No hay vehiculos registrados.' },
  },
}

export const vehicleForm = {
  key: 'fleet.vehicle.form',
  kind: 'FORM',
  schema: {
    entity: 'vehicle',
    component: 'AtlasForm',
    apiPath: '/fleet/vehicles',
    sections: [
      {
        label: 'Identificacion del vehiculo',
        icon: 'Truck',
        collapsible: true,
        fields: [
          {
            field: 'plate',
            label: 'Matricula',
            type: 'text',
            required: true,
            hint: 'Placa oficial de circulacion (ej. ABC-1234)',
          },
          {
            field: 'vehicle_model_id',
            label: 'Modelo de vehiculo',
            type: 'relation',
            required: true,
            hint: 'Selecciona la marca, modelo y año del vehiculo',
            relation: {
              apiPath: '/fleet/catalogs/vehicle-models',
              labelField: ['brand_name', 'name', 'year'],
              labelSeparator: ' · ',
              pageSize: 50,
              preload: false,
              clearable: true,
              disabledField: 'enabled',
              dependsOn: ['vehicle_brand_id', 'vehicle_type_id'],
              queryParams: { brand_id: 'vehicle_brand_id', type_id: 'vehicle_type_id' },
              create: {
                enabled: true,
                label: 'Crear modelo de vehiculo',
                mode: 'modal',
                title: 'Crear modelo de vehiculo',
                apiPath: '/fleet/catalogs/vehicle-models',
                viewKey: 'fleet.catalog.vehicle_models.form',
                selectCreated: true,
                refreshOptions: true,
                permissionKey: 'fleet.catalogs.create',
              },
            },
          },
          {
            field: 'color',
            label: 'Color del vehiculo',
            type: 'color',
            hint: 'Color exterior principal del vehiculo',
          },
          {
            field: 'status',
            label: 'Estado operativo',
            type: 'select',
            required: true,
            hint: 'Estado actual del vehiculo dentro de la flota',
            options: ['active', 'maintenance', 'inactive', 'retired'],
          },
          {
            field: 'economic_individual_number',
            label: 'No. Economico individual',
            type: 'text',
            hint: 'Numero de unidad asignado internamente (ej. 042)',
          },
        ],
      },
      {
        label: 'Asignacion de conductor',
        icon: 'UserCheck',
        collapsible: true,
        fields: [
          {
            field: 'driver_id',
            label: 'Conductor asignado',
            type: 'relation',
            hint: 'Conductor principal responsable de esta unidad',
            relation: {
              apiPath: '/fleet/drivers',
              labelField: ['first_name', 'last_name'],
              labelSeparator: ' ',
              preload: false,
              clearable: true,
              disabledField: 'enabled',
            },
          },
        ],
      },
      {
        label: 'Financiamiento',
        icon: 'Landmark',
        collapsible: true,
        fields: [
          { field: 'is_financed', label: 'Vehiculo financiado', type: 'boolean', hint: 'Activa esta opcion si la unidad se adquirio mediante financiamiento' },
          { field: 'financing_institution', label: 'Financiera', type: 'text', hint: 'Nombre de la institucion financiera (opcional)' },
          { field: 'financing_contract_number', label: 'No. de contrato', type: 'text' },
          { field: 'financing_start_date', label: 'Fecha de inicio', type: 'date' },
          { field: 'financing_end_date', label: 'Fecha de termino', type: 'date' },
          { field: 'financing_monthly_payment', label: 'Mensualidad', type: 'currency' },
          { field: 'financing_notes', label: 'Notas de financiamiento', type: 'markdown' },
        ],
      },
      {
        label: 'Notas',
        icon: 'FileText',
        collapsible: true,
        fields: [
          { field: 'notes', label: 'Observaciones adicionales', type: 'markdown', hint: 'Informacion relevante sobre el vehiculo: condiciones especiales, historial, etc.' },
        ],
      },
      {
        id: 'attachments',
        type: 'attachments',
        label: 'Documentos del vehiculo',
        placement: 'aside',
        collapsible: true,
        attachments: {
          createMode: 'stage-until-parent-create',
          editMode: 'upload-immediately',
          listPath: '/fleet/vehicles/:id/documents',
          addPath: '/fleet/vehicles/:id/documents',
          removePath: '/fleet/vehicles/:id/documents/:docId',
          upload: { endpoint: '/files/upload', moduleKey: 'atlas.fleet', entityType: 'FleetVehicle' },
          signedUrl: { endpointTemplate: '/files/:fileId/signed-url' },
          fields: {
            id: 'id', fileAssetId: 'file_asset_id', documentType: 'document_type',
            label: 'label', createdAt: 'created_at', enabled: 'enabled',
            fileAsset: 'file_asset', fileName: 'originalName', mimeType: 'mimeType', sizeBytes: 'sizeBytes',
          },
          permissions: {
            read: 'fleet.vehicles.read', create: 'fleet.vehicles.update',
            remove: 'fleet.vehicles.update', fileUpload: 'files.assets.create', fileRead: 'files.assets.read',
          },
          limits: { maxFiles: 20, maxSizeMB: 10, allowMultiple: true },
        },
      },
    ],
    submitLabel: 'Guardar vehiculo',
    cancelLabel: 'Cancelar',
  },
}

export const vehicleDetail = {
  key: 'fleet.vehicle.detail',
  kind: 'DETAIL',
  schema: {
    entity: 'vehicle',
    component: 'AtlasDetail',
    apiPath: '/fleet/vehicles',
    sections: [
      {
        label: 'Identificacion del vehiculo',
        columns: 2,
        fields: [
          { field: 'plate', label: 'Matricula', icon: 'Hash' },
          { field: 'full_economic_number', label: 'Numero economico', icon: 'Hash' },
          { field: 'vehicle_brand_name', label: 'Marca', icon: 'Tag' },
          { field: 'vehicle_model_name', label: 'Modelo', icon: 'Truck' },
          { field: 'vehicle_model_year', label: 'Año', icon: 'CalendarDays' },
          { field: 'vehicle_type_name', label: 'Tipo de vehiculo', icon: 'Layers' },
        ],
      },
      {
        label: 'Estado y apariencia',
        columns: 2,
        fields: [
          { field: 'status', label: 'Estado operativo', icon: 'Activity' },
          { field: 'color', label: 'Color del vehiculo', type: 'color', icon: 'Palette' },
        ],
      },
      {
        label: 'Financiamiento',
        columns: 2,
        fields: [
          { field: 'is_financed', label: 'Vehiculo financiado', type: 'boolean', icon: 'Landmark' },
          { field: 'financing_institution', label: 'Financiera', icon: 'Building2' },
          { field: 'financing_contract_number', label: 'No. contrato', icon: 'Hash' },
          { field: 'financing_start_date', label: 'Inicio', type: 'date', icon: 'CalendarDays' },
          { field: 'financing_end_date', label: 'Termino', type: 'date', icon: 'CalendarDays' },
          { field: 'financing_monthly_payment', label: 'Mensualidad', type: 'currency', icon: 'Tag' },
          { field: 'financing_notes', label: 'Notas', type: 'markdown', icon: 'FileText' },
        ],
      },
      {
        id: 'assigned_driver',
        type: 'relation-card',
        label: 'Conductor asignado',
        relationCard: {
          idField: 'driver_id',
          titleField: 'driver_name',
          subtitleFields: ['driver_license_number', 'driver_phone'],
          fallbackTitle: 'Sin conductor asignado',
          hrefTemplate: '/app/m/atlas.fleet/drivers/:id',
          icon: 'UserCheck',
        },
      },
      {
        id: 'active_insurance',
        type: 'relation-card',
        label: 'Poliza de seguro activa',
        relationCard: {
          idField: 'active_insurance_policy',
          titleField: 'insurer_name',
          subtitleFields: ['policy_number', 'coverage_type', 'expiry_date'],
          fallbackTitle: 'Sin poliza de seguro activa',
          hrefTemplate: '/app/m/atlas.fleet/insurance',
          icon: 'ShieldCheck',
        },
      },
      {
        id: 'insurance_history',
        type: 'relation-list',
        label: 'Historial de polizas',
        relationList: {
          apiPath: '/fleet/vehicles/:id/insurance',
          columns: [
            { field: 'insurer_name', label: 'Aseguradora' },
            { field: 'policy_number', label: 'No. Poliza' },
            { field: 'coverage_type', label: 'Cobertura' },
            { field: 'start_date', label: 'Inicio', type: 'date' },
            { field: 'expiry_date', label: 'Fin', type: 'date' },
            { field: 'is_active', label: 'Activa', type: 'boolean' },
          ],
          emptyState: { message: 'Este vehiculo no tiene polizas registradas.' },
          permission: 'fleet.insurance.read',
        },
      },
      {
        label: 'Observaciones',
        fields: [{ field: 'notes', label: 'Notas', type: 'markdown', icon: 'FileText' }],
      },
      {
        id: 'documents',
        type: 'documents',
        label: 'Documentos del vehiculo',
        documents: {
          listPath: '/fleet/vehicles/:id/documents',
          addPath: '/fleet/vehicles/:id/documents',
          removePath: '/fleet/vehicles/:id/documents/:docId',
          upload: { endpoint: '/files/upload', moduleKey: 'atlas.fleet', entityType: 'FleetVehicle' },
          fields: {
            associationId: 'id', fileAssetId: 'file_asset_id', documentType: 'document_type',
            label: 'label', createdAt: 'created_at', enabled: 'enabled',
            fileAsset: 'file_asset', fileName: 'originalName', mimeType: 'mimeType', sizeBytes: 'sizeBytes',
          },
          signedUrl: { endpointTemplate: '/files/:fileId/signed-url' },
          permissions: {
            read: 'fleet.vehicles.read', create: 'fleet.vehicles.update',
            remove: 'fleet.vehicles.update', fileUpload: 'files.assets.create', fileRead: 'files.assets.read',
          },
        },
      },
    ],
    headerActions: [
      { key: 'download_pdf', label: 'Exportar PDF', method: 'GET', pathTemplate: '/fleet/vehicles/:id/pdf', download: true, downloadFileName: 'vehiculo.pdf', refreshAfter: false, variant: 'outline' },
    ],
    actions: [
      { label: 'Editar', permission: 'fleet.vehicles.update' },
      { label: 'Desactivar', permission: 'fleet.vehicles.delete' },
    ],
  },
}

// ─── Drivers ─────────────────────────────────────────────────────────────────

export const driverPage = {
  key: 'fleet.driver.page',
  kind: 'PAGE',
  schema: {
    path: '/app/m/atlas.fleet/drivers',
    title: 'Choferes',
    layout: 'main',
    view: 'fleet.driver.table',
  },
}

export const driverTable = {
  key: 'fleet.driver.table',
  kind: 'TABLE',
  schema: {
    entity: 'driver',
    component: 'AtlasTable',
    apiPath: '/fleet/drivers',
    primaryField: 'full_name',
    searchable: true,
    searchPlaceholder: 'Buscar chofer...',
    columns: [
      { field: 'photo_asset_id_resolved', label: 'Foto', sortable: false, component: 'atlas.fleet:DriverAvatarCell' },
      { field: 'full_name', label: 'Nombre completo', sortable: true, link: true },
      { field: 'phone', label: 'Telefono', sortable: false },
      { field: 'license_number', label: 'No. Licencia', sortable: true },
      { field: 'license_type', label: 'Tipo licencia', sortable: false },
      { field: 'license_expiry_date', label: 'Vencimiento', sortable: true, type: 'date' },
      { field: 'assigned_plate', label: 'Vehiculo', sortable: false, component: 'atlas.fleet:DriverAssignedVehicleCell' },
      { field: 'hr_employee_name', label: 'Colaborador RH', sortable: false },
      { field: 'status', label: 'Estado', sortable: true, component: 'atlas.fleet:DriverStatusBadge' },
    ],
    actions: [{ label: 'Crear chofer', permission: 'fleet.drivers.create', variant: 'primary' }],
    rowActions: [
      { label: 'Ver detalle', permission: 'fleet.drivers.read' },
      { label: 'Editar', permission: 'fleet.drivers.update' },
      { label: 'Desactivar', permission: 'fleet.drivers.delete' },
    ],
    emptyState: { message: 'No hay choferes registrados.' },
  },
}

export const driverForm = {
  key: 'fleet.driver.form',
  kind: 'FORM',
  schema: {
    entity: 'driver',
    component: 'AtlasForm',
    apiPath: '/fleet/drivers',
    sections: [
      {
        label: 'Datos del chofer',
        fields: [
          { field: 'first_name', label: 'Nombre', type: 'text', required: true },
          { field: 'last_name', label: 'Apellido', type: 'text', required: true },
          { field: 'phone', label: 'Telefono', type: 'phone', required: true },
          { field: 'email', label: 'Correo', type: 'email' },
          { field: 'license_number', label: 'No. de licencia', type: 'text', required: true },
          { field: 'license_type', label: 'Tipo de licencia', type: 'text', required: true },
          { field: 'license_expiry_date', label: 'Vencimiento lic.', type: 'date', required: true },
          {
            field: 'status', label: 'Estado', type: 'select',
            options: [
              { value: 'active', label: 'Activo' },
              { value: 'inactive', label: 'Inactivo' },
              { value: 'suspended', label: 'Suspendido' },
            ],
          },
          { field: 'notes', label: 'Notas', type: 'markdown' },
        ],
      },
      {
        id: 'attachments',
        type: 'attachments',
        label: 'Documentos del chofer',
        placement: 'aside',
        collapsible: true,
        attachments: {
          createMode: 'stage-until-parent-create',
          editMode: 'upload-immediately',
          listPath: '/fleet/drivers/:id/documents',
          addPath: '/fleet/drivers/:id/documents',
          removePath: '/fleet/drivers/:id/documents/:docId',
          upload: { endpoint: '/files/upload', moduleKey: 'atlas.fleet', entityType: 'FleetDriver' },
          signedUrl: { endpointTemplate: '/files/:fileId/signed-url' },
          fields: {
            id: 'id', fileAssetId: 'file_asset_id', documentType: 'document_type',
            label: 'label', createdAt: 'created_at', enabled: 'enabled',
            fileAsset: 'file_asset', fileName: 'originalName', mimeType: 'mimeType', sizeBytes: 'sizeBytes',
          },
          permissions: {
            read: 'fleet.drivers.read', create: 'fleet.drivers.update',
            remove: 'fleet.drivers.update', fileUpload: 'files.assets.create', fileRead: 'files.assets.read',
          },
          limits: { maxFiles: 20, maxSizeMB: 10, allowMultiple: true },
        },
      },
    ],
    submitLabel: 'Guardar chofer',
    cancelLabel: 'Cancelar',
  },
}

// ─── Insurance ───────────────────────────────────────────────────────────────

export const insurancePolicyPage = {
  key: 'fleet.insurance_policy.page',
  kind: 'PAGE',
  schema: {
    path: '/app/m/atlas.fleet/insurance',
    title: 'Polizas de seguro',
    layout: 'main',
    view: 'fleet.insurance_policy.table',
  },
}

export const insurancePolicyTable = {
  key: 'fleet.insurance_policy.table',
  kind: 'TABLE',
  schema: {
    entity: 'insurance_policy',
    component: 'AtlasTable',
    apiPath: '/fleet/insurance',
    primaryField: 'policy_number',
    searchable: false,
    columns: [
      { field: 'vehicle_plate', label: 'Matricula', sortable: false },
      { field: 'insurer_name', label: 'Aseguradora', sortable: true },
      { field: 'policy_number', label: 'No. Poliza', sortable: true, link: true },
      { field: 'coverage_type', label: 'Cobertura', sortable: false, component: 'atlas.fleet:CoverageTypeBadge' },
      { field: 'start_date', label: 'Inicio vigencia', sortable: true, type: 'date' },
      { field: 'expiry_date', label: 'Fin vigencia', sortable: true, type: 'date' },
      { field: 'is_active', label: 'Estado', sortable: false, type: 'boolean' },
    ],
    actions: [{ label: 'Nueva poliza', permission: 'fleet.insurance.create', variant: 'primary' }],
    rowActions: [
      { label: 'Ver detalle', permission: 'fleet.insurance.read' },
      { label: 'Editar', permission: 'fleet.insurance.update' },
      { label: 'Desactivar', permission: 'fleet.insurance.delete' },
    ],
    emptyState: { message: 'No hay polizas de seguro registradas.' },
  },
}

export const insurancePolicyForm = {
  key: 'fleet.insurance_policy.form',
  kind: 'FORM',
  schema: {
    entity: 'insurance_policy',
    component: 'AtlasForm',
    apiPath: '/fleet/insurance',
    sections: [
      {
        label: 'Datos de la poliza',
        icon: 'ShieldCheck',
        collapsible: true,
        fields: [
          {
            field: 'vehicle_id',
            label: 'Vehiculo',
            type: 'relation',
            required: true,
            relation: {
              apiPath: '/fleet/vehicles',
              labelField: 'plate',
              pageSize: 50,
              preload: false,
              clearable: false,
              disabledField: 'enabled',
            },
          },
          { field: 'insurer_name', label: 'Aseguradora', type: 'text', required: true, hint: 'Nombre de la compania aseguradora' },
          { field: 'policy_number', label: 'Numero de poliza', type: 'text', required: true, hint: 'Identificador unico de la poliza' },
          {
            field: 'coverage_type',
            label: 'Tipo de cobertura',
            type: 'select',
            options: ['basic', 'comprehensive', 'third_party', 'other'],
          },
        ],
      },
      {
        label: 'Vigencia y costos',
        icon: 'CalendarDays',
        collapsible: true,
        fields: [
          { field: 'start_date', label: 'Inicio de vigencia', type: 'date', required: true },
          { field: 'expiry_date', label: 'Fin de vigencia', type: 'date', required: true },
          { field: 'premium', label: 'Prima anual', type: 'currency' },
          { field: 'currency', label: 'Moneda', type: 'text', hint: 'Codigo de 3 letras (ej. MXN, USD)' },
        ],
      },
      {
        label: 'Notas y adjunto',
        icon: 'FileText',
        collapsible: true,
        fields: [
          { field: 'notes', label: 'Notas adicionales', type: 'markdown' },
          { field: 'document_asset_id', label: 'Certificado (PDF)', type: 'file' },
        ],
      },
    ],
    submitLabel: 'Guardar poliza',
    cancelLabel: 'Cancelar',
  },
}

export const insurancePolicyDetail = {
  key: 'fleet.insurance_policy.detail',
  kind: 'DETAIL',
  schema: {
    entity: 'insurance_policy',
    component: 'AtlasDetail',
    apiPath: '/fleet/insurance',
    sections: [
      {
        label: 'Datos de la poliza',
        columns: 2,
        fields: [
          { field: 'vehicle_plate', label: 'Vehiculo (matricula)', icon: 'Truck' },
          { field: 'insurer_name', label: 'Aseguradora', icon: 'ShieldCheck' },
          { field: 'policy_number', label: 'Numero de poliza', icon: 'Hash' },
          { field: 'coverage_type', label: 'Tipo de cobertura', icon: 'Shield' },
          { field: 'is_active', label: 'Estado', type: 'boolean', icon: 'Activity' },
        ],
      },
      {
        label: 'Vigencia y costos',
        columns: 2,
        fields: [
          { field: 'start_date', label: 'Inicio de vigencia', type: 'date', icon: 'CalendarDays' },
          { field: 'expiry_date', label: 'Fin de vigencia', type: 'date', icon: 'CalendarDays' },
          { field: 'premium', label: 'Prima anual', type: 'currency', icon: 'DollarSign' },
          { field: 'currency', label: 'Moneda', icon: 'Tag' },
        ],
      },
      {
        label: 'Notas',
        fields: [{ field: 'notes', label: 'Notas adicionales', type: 'markdown', icon: 'FileText' }],
      },
      {
        id: 'certificate',
        type: 'file-preview',
        label: 'Certificado de seguro',
        filePreview: {
          fileAssetIdField: 'document_asset_id',
          signedUrl: { endpointTemplate: '/files/:fileId/signed-url' },
          permissions: { read: 'fleet.insurance.read', fileRead: 'files.assets.read' },
        },
      },
    ],
    actions: [
      { label: 'Editar', permission: 'fleet.insurance.update' },
      { label: 'Desactivar', permission: 'fleet.insurance.delete' },
    ],
  },
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export const reportsPage = {
  key: 'fleet.reports.page',
  kind: 'PAGE',
  schema: {
    path: '/app/m/atlas.fleet/reports',
    title: 'Reportes de Flota',
    layout: 'main',
    view: 'fleet.reports.maintenance.table',
  },
}

// Maintenance

export const reportsMaintenancePage = {
  key: 'fleet.reports.maintenance.page',
  kind: 'PAGE',
  schema: {
    path: '/app/m/atlas.fleet/reports/maintenance',
    title: 'Reportes de Mantenimiento',
    layout: 'main',
    view: 'fleet.reports.maintenance.table',
    tabLabel: 'Mantenimiento',
    tabOrder: 1,
  },
}

export const reportsMaintenanceTable = {
  key: 'fleet.reports.maintenance.table',
  kind: 'TABLE',
  schema: {
    entity: 'report',
    component: 'AtlasTable',
    apiPath: '/fleet/reports/maintenance',
    primaryField: 'title',
    searchable: true,
    searchPlaceholder: 'Buscar reportes de mantenimiento...',
    columns: [
      { field: 'folio', label: 'Folio', sortable: true },
      { field: 'title', label: 'Titulo', sortable: true, link: true },
      { field: 'vehicle_plate', label: 'Vehiculo' },
      { field: 'status', label: 'Estado', sortable: true, component: 'atlas.fleet:ReportStatusBadge' },
      { field: 'report_date', label: 'Fecha', type: 'date', sortable: true },
      { field: 'total_cost', label: 'Total', type: 'currency', sortable: true },
    ],
    actions: [{ label: 'Nuevo reporte de mantenimiento', permission: 'fleet.reports.create', variant: 'primary' }],
    rowActions: [
      { label: 'Ver detalle', permission: 'fleet.reports.read' },
      { label: 'Editar', permission: 'fleet.reports.update' },
      { label: 'Desactivar', permission: 'fleet.reports.delete' },
    ],
  },
}

export const reportsMaintenanceForm = {
  key: 'fleet.reports.maintenance.form',
  kind: 'FORM',
  schema: {
    entity: 'report',
    component: 'AtlasForm',
    apiPath: '/fleet/reports/maintenance',
    formMode: 'page',
    title: 'Nuevo Reporte de Mantenimiento',
    submitLabel: 'Finalizar reporte',
    cancelLabel: 'Cancelar',
    sections: [
      {
        id: 'vehicle',
        label: 'Vehiculo',
        icon: 'Wrench',
        description: 'Selecciona el vehiculo al que se aplico el mantenimiento.',
        collapsible: true,
        defaultCollapsed: false,
        columns: 1,
        fields: [
          {
            field: 'vehicle_id',
            label: 'Seleccionar vehiculo',
            type: 'relation',
            required: true,
            relation: {
              apiPath: '/fleet/vehicles',
              labelField: ['plate', 'vehicle_model_name'],
              labelSeparator: ' · ',
              clearable: false,
              disabledField: 'enabled',
              searchParam: 'search',
              displayFields: {
                badge: 'full_economic_number',
                title: 'vehicle_model_name',
                subtitle: ['plate', 'vehicle_type_name', 'vehicle_brand_name'],
              },
            },
          },
        ],
      },
      {
        id: 'service_data',
        label: 'Datos del Mantenimiento',
        icon: 'CalendarDays',
        collapsible: true,
        defaultCollapsed: false,
        columns: 2,
        fields: [
          { field: 'title', label: 'Titulo del servicio', type: 'text', required: true },
          {
            field: 'maintenance_subtype',
            label: 'Tipo de mantenimiento',
            type: 'select',
            required: true,
            options: [
              { label: 'Preventivo', value: 'preventive' },
              { label: 'Correctivo', value: 'corrective' },
              { label: 'Inspeccion', value: 'inspection' },
              { label: 'Alineacion', value: 'alignment' },
              { label: 'Cambio de aceite', value: 'oil_change' },
              { label: 'Llantas', value: 'tire_service' },
              { label: 'Otro', value: 'other' },
            ],
          },
          { field: 'report_date', label: 'Fecha del servicio', type: 'date', required: true },
          { field: 'odometer_km', label: 'Kilometraje', type: 'number' },
        ],
      },
      {
        id: 'workshop',
        label: 'Informacion del Taller',
        icon: 'Building2',
        description: 'Datos del proveedor que realizo el trabajo.',
        collapsible: true,
        defaultCollapsed: false,
        columns: 2,
        fields: [
          { field: 'is_inhouse_workshop', label: 'Taller propio', type: 'boolean', default: true, hint: 'Si activas esta opcion, los datos del taller quedan como no requeridos.' },
          { field: 'workshop_name', label: 'Nombre del taller', type: 'text', visibleWhen: { field: 'is_inhouse_workshop', equals: false } },
          { field: 'workshop_phone', label: 'Telefono', type: 'phone', visibleWhen: { field: 'is_inhouse_workshop', equals: false } },
          { field: 'workshop_address', label: 'Direccion', type: 'text', visibleWhen: { field: 'is_inhouse_workshop', equals: false } },
          { field: 'invoice_number', label: 'No. de factura/ticket', type: 'text', visibleWhen: { field: 'is_inhouse_workshop', equals: false } },
        ],
      },
      { id: 'parts', type: 'parts-editor', label: 'Refacciones / Partes', icon: 'Package', description: 'Agrega piezas, cantidades y costo unitario.', collapsible: true, defaultCollapsed: false },
      {
        id: 'costs',
        label: 'Resumen de Costos',
        icon: 'BadgeDollarSign',
        collapsible: true,
        defaultCollapsed: false,
        columns: 3,
        fields: [
          { field: 'labor_cost', label: 'Mano de obra', type: 'currency' },
          { field: 'parts_cost', label: 'Costo de refacciones (calculado automaticamente)', type: 'currency', readonly: true },
          { field: 'total_cost', label: 'Costo final total (mano de obra + partes)', type: 'currency', readonly: true },
        ],
      },
      { id: 'notes', label: 'Observaciones', icon: 'FileText', collapsible: true, defaultCollapsed: false, columns: 1, fields: [{ field: 'notes', label: 'Descripcion / notas', type: 'markdown' }] },
      {
        id: 'next_service',
        label: 'Proximo Servicio',
        icon: 'CalendarClock',
        description: 'Indica fecha o kilometraje sugerido para el siguiente mantenimiento.',
        collapsible: true,
        defaultCollapsed: false,
        columns: 2,
        fields: [
          { field: 'next_service_date', label: 'Fecha sugerida', type: 'date' },
          { field: 'next_service_odometer', label: 'Kilometraje sugerido', type: 'number' },
        ],
      },
      {
        id: 'attachments',
        type: 'attachments',
        label: 'Archivos Adjuntos',
        icon: 'Paperclip',
        collapsible: true,
        defaultCollapsed: false,
        attachments: {
          createMode: 'stage-until-parent-create',
          editMode: 'upload-immediately',
          listPath: '/fleet/reports/:id/documents',
          addPath: '/fleet/reports/:id/documents',
          removePath: '/fleet/reports/:id/documents/:docId',
          upload: { endpoint: '/files/upload', moduleKey: 'atlas.fleet', entityType: 'FleetReport' },
          signedUrl: { endpointTemplate: '/files/:fileId/signed-url' },
          fields: {
            id: 'id', fileAssetId: 'file_asset_id', documentType: 'document_type',
            label: 'label', createdAt: 'created_at', enabled: 'enabled',
            fileAsset: 'file_asset', fileName: 'originalName', mimeType: 'mimeType', sizeBytes: 'sizeBytes',
          },
          permissions: {
            read: 'fleet.reports.read', create: 'fleet.reports.update',
            remove: 'fleet.reports.update', fileUpload: 'files.assets.create', fileRead: 'files.assets.read',
          },
          limits: { maxFiles: 20, maxSizeMB: 10, allowMultiple: true },
        },
      },
    ],
  },
}

export const reportsMaintenanceDetail = {
  key: 'fleet.reports.maintenance.detail',
  kind: 'DETAIL',
  schema: {
    entity: 'report',
    component: 'AtlasDetail',
    apiPath: '/fleet/reports/maintenance',
    sections: [
      {
        label: 'Informacion general',
        columns: 2,
        fields: [
          { field: 'folio', label: 'Folio', icon: 'Hash' },
          { field: 'title', label: 'Titulo', icon: 'ClipboardList' },
          { field: 'status', label: 'Estado', icon: 'Activity' },
          { field: 'report_type_label', label: 'Tipo', icon: 'Layers' },
          { field: 'report_date', label: 'Fecha', type: 'date', icon: 'CalendarDays' },
          { field: 'odometer_km', label: 'Kilometraje', icon: 'Hash', type: 'number' },
          { field: 'maintenance_subtype', label: 'Subtipo', icon: 'Wrench', type: 'select', options: [
            { label: 'Preventivo', value: 'preventive' }, { label: 'Correctivo', value: 'corrective' },
            { label: 'Inspeccion', value: 'inspection' }, { label: 'Alineacion', value: 'alignment' },
            { label: 'Cambio de aceite', value: 'oil_change' }, { label: 'Llantas', value: 'tire_service' },
            { label: 'Otro', value: 'other' },
          ]},
        ],
      },
      { id: 'related_vehicle', type: 'relation-card', label: 'Vehiculo', relationCard: { idField: 'vehicle_id', titleField: 'vehicle_plate', subtitleFields: ['vehicle_brand_name', 'vehicle_model_name'], fallbackTitle: 'Vehiculo no disponible', hrefTemplate: '/app/m/atlas.fleet/vehicles/:id', icon: 'Truck' } },
      {
        label: 'Taller y costos',
        columns: 2,
        fields: [
          { field: 'is_inhouse_workshop', label: 'Taller propio', type: 'boolean', icon: 'Building2' },
          { field: 'workshop_name', label: 'Taller', icon: 'Library' },
          { field: 'invoice_number', label: 'Factura/Ticket', icon: 'FileText' },
          { field: 'workshop_phone', label: 'Telefono', icon: 'Phone' },
          { field: 'workshop_address', label: 'Direccion', icon: 'Link2' },
          { field: 'labor_cost', label: 'Mano de obra', type: 'currency', icon: 'Tag' },
          { field: 'parts_cost', label: 'Refacciones', type: 'currency', icon: 'Tag' },
          { field: 'total_cost', label: 'Total', type: 'currency', icon: 'Tag' },
        ],
      },
      { id: 'parts', type: 'relation-list', label: 'Refacciones / Partes', relationList: { apiPath: '/fleet/reports/:id/parts', idField: 'id', titleField: 'name', subtitleFields: ['quantity', 'unit_cost', 'subtotal'], subtitleLabels: ['Cant.', 'P.U.', 'Subtotal'], subtitleTypes: ['integer', 'currency', 'currency'], icon: 'Wrench', emptyMessage: 'No hay refacciones registradas.' } },
      { label: 'Proximo servicio', columns: 2, fields: [{ field: 'next_service_date', label: 'Fecha sugerida', type: 'date', icon: 'CalendarDays' }, { field: 'next_service_odometer', label: 'Kilometraje sugerido', icon: 'Hash', type: 'number' }] },
      { label: 'Observaciones', fields: [{ field: 'notes', label: 'Notas', type: 'markdown', icon: 'FileText' }] },
      { id: 'documents', type: 'documents', label: 'Archivos adjuntos', documents: { listPath: '/fleet/reports/:id/documents', addPath: '/fleet/reports/:id/documents', removePath: '/fleet/reports/:id/documents/:docId', upload: { endpoint: '/files/upload', moduleKey: 'atlas.fleet', entityType: 'FleetReport' }, fields: { associationId: 'id', fileAssetId: 'file_asset_id', documentType: 'document_type', label: 'label', createdAt: 'created_at', enabled: 'enabled', fileAsset: 'file_asset', fileName: 'originalName', mimeType: 'mimeType', sizeBytes: 'sizeBytes' }, signedUrl: { endpointTemplate: '/files/:fileId/signed-url' }, permissions: { read: 'fleet.reports.read', create: 'fleet.reports.update', remove: 'fleet.reports.update', fileUpload: 'files.assets.create', fileRead: 'files.assets.read' } } },
    ],
    headerActions: [
      { key: 'download_pdf', label: 'Descargar PDF', method: 'GET', pathTemplate: '/fleet/reports/:id/pdf', download: true, downloadFileName: 'reporte-flota.pdf', refreshAfter: false, variant: 'outline', visibleWhen: { field: 'status', equals: 'finalized' } },
      { key: 'regenerate_pdf', label: 'Regenerar PDF', method: 'GET', pathTemplate: '/fleet/reports/:id/pdf', refreshAfter: false, variant: 'outline', visibleWhen: { field: 'status', equals: 'finalized' } },
      { key: 'finalize', label: 'Finalizar', method: 'POST', pathTemplate: '/fleet/reports/:id/finalize', visibleWhen: { field: 'status', equals: 'draft' }, variant: 'default' },
      { key: 'reopen', label: 'Reabrir', method: 'POST', pathTemplate: '/fleet/reports/:id/reopen', visibleWhen: { field: 'status', equals: 'finalized' }, variant: 'outline' },
    ],
    actions: [{ label: 'Editar', permission: 'fleet.reports.update' }],
  },
}

// Service

export const reportsServicePage = {
  key: 'fleet.reports.service.page',
  kind: 'PAGE',
  schema: {
    path: '/app/m/atlas.fleet/reports/service',
    title: 'Reportes de Servicio',
    layout: 'main',
    view: 'fleet.reports.service.table',
    tabLabel: 'Servicio',
    tabOrder: 2,
  },
}

export const reportsServiceTable = {
  key: 'fleet.reports.service.table',
  kind: 'TABLE',
  schema: {
    entity: 'report',
    component: 'AtlasTable',
    apiPath: '/fleet/reports/service',
    primaryField: 'title',
    searchable: true,
    searchPlaceholder: 'Buscar reportes de servicio...',
    columns: [
      { field: 'folio', label: 'Folio', sortable: true },
      { field: 'title', label: 'Titulo', sortable: true, link: true },
      { field: 'vehicle_plate', label: 'Vehiculo' },
      { field: 'status', label: 'Estado', sortable: true, component: 'atlas.fleet:ReportStatusBadge' },
      { field: 'report_date', label: 'Fecha', type: 'date', sortable: true },
      { field: 'total_cost', label: 'Total', type: 'currency', sortable: true },
    ],
    actions: [{ label: 'Nuevo reporte de servicio', permission: 'fleet.reports.create', variant: 'primary' }],
    rowActions: [
      { label: 'Ver detalle', permission: 'fleet.reports.read' },
      { label: 'Editar', permission: 'fleet.reports.update' },
      { label: 'Desactivar', permission: 'fleet.reports.delete' },
    ],
  },
}

export const reportsServiceForm = {
  key: 'fleet.reports.service.form',
  kind: 'FORM',
  schema: {
    entity: 'report',
    component: 'AtlasForm',
    apiPath: '/fleet/reports/service',
    formMode: 'page',
    title: 'Nuevo Reporte de Servicio',
    submitLabel: 'Finalizar reporte',
    cancelLabel: 'Cancelar',
    sections: [
      { id: 'vehicle', label: 'Vehiculo', icon: 'Wrench', description: 'Selecciona el vehiculo al que se le realizo el servicio.', collapsible: true, defaultCollapsed: false, columns: 1, fields: [{ field: 'vehicle_id', label: 'Seleccionar vehiculo', type: 'relation', required: true, relation: { apiPath: '/fleet/vehicles', labelField: ['plate', 'vehicle_model_name'], labelSeparator: ' · ', clearable: false, disabledField: 'enabled', searchParam: 'search', displayFields: { badge: 'full_economic_number', title: 'vehicle_model_name', subtitle: ['plate', 'vehicle_type_name', 'vehicle_brand_name'] } } }] },
      { id: 'service_data', label: 'Datos del Servicio', icon: 'CalendarDays', collapsible: true, defaultCollapsed: false, columns: 2, fields: [
        { field: 'title', label: 'Titulo del servicio', type: 'text', required: true },
        { field: 'service_subtype', label: 'Tipo de servicio', type: 'select', required: true, options: [{ label: 'General', value: 'general' }, { label: 'Diagnostico', value: 'diagnostic' }, { label: 'Limpieza', value: 'cleaning' }, { label: 'Electrico', value: 'electrical' }, { label: 'Otro', value: 'other' }] },
        { field: 'report_date', label: 'Fecha del servicio', type: 'date', required: true },
        { field: 'odometer_km', label: 'Kilometraje', type: 'number' },
      ]},
      { id: 'workshop', label: 'Informacion del Taller', icon: 'Building2', description: 'Datos del proveedor.', collapsible: true, defaultCollapsed: false, columns: 2, fields: [
        { field: 'is_inhouse_workshop', label: 'Taller propio', type: 'boolean', default: true },
        { field: 'workshop_name', label: 'Nombre del taller', type: 'text', visibleWhen: { field: 'is_inhouse_workshop', equals: false } },
        { field: 'workshop_phone', label: 'Telefono', type: 'phone', visibleWhen: { field: 'is_inhouse_workshop', equals: false } },
        { field: 'workshop_address', label: 'Direccion', type: 'text', visibleWhen: { field: 'is_inhouse_workshop', equals: false } },
        { field: 'invoice_number', label: 'No. de factura / ticket', type: 'text', visibleWhen: { field: 'is_inhouse_workshop', equals: false } },
      ]},
      { id: 'parts', type: 'parts-editor', label: 'Refacciones / Partes', icon: 'Package', collapsible: true, defaultCollapsed: false },
      { id: 'costs', label: 'Resumen de Costos', icon: 'BadgeDollarSign', collapsible: true, defaultCollapsed: false, columns: 3, fields: [{ field: 'labor_cost', label: 'Mano de obra', type: 'currency' }, { field: 'parts_cost', label: 'Costo de refacciones (calculado automaticamente)', type: 'currency', readonly: true }, { field: 'total_cost', label: 'Costo final total', type: 'currency', readonly: true }] },
      { id: 'notes', label: 'Observaciones', icon: 'FileText', collapsible: true, defaultCollapsed: false, columns: 1, fields: [{ field: 'notes', label: 'Descripcion / notas', type: 'markdown' }] },
      { id: 'attachments', type: 'attachments', label: 'Archivos Adjuntos', icon: 'Paperclip', collapsible: true, defaultCollapsed: false, attachments: { createMode: 'stage-until-parent-create', editMode: 'upload-immediately', listPath: '/fleet/reports/:id/documents', addPath: '/fleet/reports/:id/documents', removePath: '/fleet/reports/:id/documents/:docId', upload: { endpoint: '/files/upload', moduleKey: 'atlas.fleet', entityType: 'FleetReport' }, signedUrl: { endpointTemplate: '/files/:fileId/signed-url' }, fields: { id: 'id', fileAssetId: 'file_asset_id', documentType: 'document_type', label: 'label', createdAt: 'created_at', enabled: 'enabled', fileAsset: 'file_asset', fileName: 'originalName', mimeType: 'mimeType', sizeBytes: 'sizeBytes' }, permissions: { read: 'fleet.reports.read', create: 'fleet.reports.update', remove: 'fleet.reports.update', fileUpload: 'files.assets.create', fileRead: 'files.assets.read' }, limits: { maxFiles: 20, maxSizeMB: 10, allowMultiple: true } } },
    ],
  },
}

export const reportsServiceDetail = {
  key: 'fleet.reports.service.detail',
  kind: 'DETAIL',
  schema: {
    entity: 'report',
    component: 'AtlasDetail',
    apiPath: '/fleet/reports/service',
    sections: [
      { label: 'Informacion general', columns: 2, fields: [{ field: 'folio', label: 'Folio', icon: 'Hash' }, { field: 'title', label: 'Titulo', icon: 'ClipboardList' }, { field: 'status', label: 'Estado', icon: 'Activity' }, { field: 'report_type_label', label: 'Tipo', icon: 'Layers' }, { field: 'report_date', label: 'Fecha', type: 'date', icon: 'CalendarDays' }, { field: 'odometer_km', label: 'Kilometraje', icon: 'Hash', type: 'number' }, { field: 'service_subtype', label: 'Subtipo', icon: 'Wrench', type: 'select', options: [{ label: 'General', value: 'general' }, { label: 'Diagnostico', value: 'diagnostic' }, { label: 'Limpieza', value: 'cleaning' }, { label: 'Electrico', value: 'electrical' }, { label: 'Otro', value: 'other' }] }] },
      { id: 'related_vehicle', type: 'relation-card', label: 'Vehiculo', relationCard: { idField: 'vehicle_id', titleField: 'vehicle_plate', subtitleFields: ['vehicle_brand_name', 'vehicle_model_name'], fallbackTitle: 'Vehiculo no disponible', hrefTemplate: '/app/m/atlas.fleet/vehicles/:id', icon: 'Truck' } },
      { label: 'Taller y costos', columns: 2, fields: [{ field: 'is_inhouse_workshop', label: 'Taller propio', type: 'boolean', icon: 'Building2' }, { field: 'workshop_name', label: 'Taller', icon: 'Library' }, { field: 'invoice_number', label: 'Factura/Ticket', icon: 'FileText' }, { field: 'workshop_phone', label: 'Telefono', icon: 'Phone' }, { field: 'workshop_address', label: 'Direccion', icon: 'Link2' }, { field: 'labor_cost', label: 'Mano de obra', type: 'currency', icon: 'Tag' }, { field: 'parts_cost', label: 'Refacciones', type: 'currency', icon: 'Tag' }, { field: 'total_cost', label: 'Total', type: 'currency', icon: 'Tag' }] },
      { id: 'parts', type: 'relation-list', label: 'Refacciones / Partes', relationList: { apiPath: '/fleet/reports/:id/parts', idField: 'id', titleField: 'name', subtitleFields: ['quantity', 'unit_cost', 'subtotal'], subtitleLabels: ['Cant.', 'P.U.', 'Subtotal'], subtitleTypes: ['integer', 'currency', 'currency'], icon: 'Wrench', emptyMessage: 'No hay refacciones registradas.' } },
      { label: 'Observaciones', fields: [{ field: 'notes', label: 'Notas', type: 'markdown', icon: 'FileText' }] },
      { id: 'documents', type: 'documents', label: 'Archivos adjuntos', documents: { listPath: '/fleet/reports/:id/documents', addPath: '/fleet/reports/:id/documents', removePath: '/fleet/reports/:id/documents/:docId', upload: { endpoint: '/files/upload', moduleKey: 'atlas.fleet', entityType: 'FleetReport' }, fields: { associationId: 'id', fileAssetId: 'file_asset_id', documentType: 'document_type', label: 'label', createdAt: 'created_at', enabled: 'enabled', fileAsset: 'file_asset', fileName: 'originalName', mimeType: 'mimeType', sizeBytes: 'sizeBytes' }, signedUrl: { endpointTemplate: '/files/:fileId/signed-url' }, permissions: { read: 'fleet.reports.read', create: 'fleet.reports.update', remove: 'fleet.reports.update', fileUpload: 'files.assets.create', fileRead: 'files.assets.read' } } },
    ],
    headerActions: [
      { key: 'download_pdf', label: 'Descargar PDF', method: 'GET', pathTemplate: '/fleet/reports/:id/pdf', download: true, downloadFileName: 'reporte-flota.pdf', refreshAfter: false, variant: 'outline', visibleWhen: { field: 'status', equals: 'finalized' } },
      { key: 'regenerate_pdf', label: 'Regenerar PDF', method: 'GET', pathTemplate: '/fleet/reports/:id/pdf', refreshAfter: false, variant: 'outline', visibleWhen: { field: 'status', equals: 'finalized' } },
      { key: 'finalize', label: 'Finalizar', method: 'POST', pathTemplate: '/fleet/reports/:id/finalize', visibleWhen: { field: 'status', equals: 'draft' }, variant: 'default' },
      { key: 'reopen', label: 'Reabrir', method: 'POST', pathTemplate: '/fleet/reports/:id/reopen', visibleWhen: { field: 'status', equals: 'finalized' }, variant: 'outline' },
    ],
    actions: [{ label: 'Editar', permission: 'fleet.reports.update' }],
  },
}

// Repair

export const reportsRepairPage = {
  key: 'fleet.reports.repair.page',
  kind: 'PAGE',
  schema: {
    path: '/app/m/atlas.fleet/reports/repair',
    title: 'Reportes de Reparacion',
    layout: 'main',
    view: 'fleet.reports.repair.table',
    tabLabel: 'Reparacion',
    tabOrder: 3,
  },
}

export const reportsRepairTable = {
  key: 'fleet.reports.repair.table',
  kind: 'TABLE',
  schema: {
    entity: 'report',
    component: 'AtlasTable',
    apiPath: '/fleet/reports/repair',
    primaryField: 'title',
    searchable: true,
    searchPlaceholder: 'Buscar reportes de reparacion...',
    columns: [
      { field: 'folio', label: 'Folio', sortable: true },
      { field: 'title', label: 'Titulo', sortable: true, link: true },
      { field: 'vehicle_plate', label: 'Vehiculo' },
      { field: 'repair_priority', label: 'Prioridad' },
      { field: 'status', label: 'Estado', sortable: true, component: 'atlas.fleet:ReportStatusBadge' },
      { field: 'report_date', label: 'Fecha', type: 'date', sortable: true },
      { field: 'total_cost', label: 'Total', type: 'currency', sortable: true },
    ],
    actions: [{ label: 'Nuevo reporte de reparacion', permission: 'fleet.reports.create', variant: 'primary' }],
    rowActions: [
      { label: 'Ver detalle', permission: 'fleet.reports.read' },
      { label: 'Editar', permission: 'fleet.reports.update' },
      { label: 'Desactivar', permission: 'fleet.reports.delete' },
    ],
  },
}

export const reportsRepairForm = {
  key: 'fleet.reports.repair.form',
  kind: 'FORM',
  schema: {
    entity: 'report',
    component: 'AtlasForm',
    apiPath: '/fleet/reports/repair',
    formMode: 'page',
    title: 'Nuevo Reporte de Reparacion',
    submitLabel: 'Finalizar reparacion',
    cancelLabel: 'Cancelar',
    sections: [
      { id: 'vehicle', label: 'Vehiculo', icon: 'Wrench', description: 'Selecciona el vehiculo afectado por la reparacion.', collapsible: true, defaultCollapsed: false, columns: 1, fields: [{ field: 'vehicle_id', label: 'Seleccionar vehiculo', type: 'relation', required: true, relation: { apiPath: '/fleet/vehicles', labelField: ['plate', 'vehicle_model_name'], labelSeparator: ' · ', clearable: false, disabledField: 'enabled', searchParam: 'search', displayFields: { badge: 'full_economic_number', title: 'vehicle_model_name', subtitle: ['plate', 'vehicle_type_name', 'vehicle_brand_name'] } } }] },
      { id: 'repair_data', label: 'Datos de la Reparacion', icon: 'ShieldAlert', collapsible: true, defaultCollapsed: false, columns: 2, fields: [
        { field: 'title', label: 'Titulo / Descripcion del problema', type: 'text', required: true },
        { field: 'report_date', label: 'Fecha del reporte', type: 'date', required: true },
        { field: 'odometer_km', label: 'Kilometraje', type: 'number' },
        { field: 'repair_priority', label: 'Prioridad', type: 'select', required: true, options: [{ label: 'Baja', value: 'low' }, { label: 'Normal', value: 'normal' }, { label: 'Alta', value: 'high' }, { label: 'Urgente', value: 'urgent' }] },
        { field: 'repair_damage_type', label: 'Tipo de dano', type: 'select', required: true, options: [{ label: 'Mecanico', value: 'mechanical' }, { label: 'Electrico', value: 'electrical' }, { label: 'Carroceria', value: 'body' }, { label: 'Interior', value: 'interior' }, { label: 'Otro', value: 'other' }] },
        { field: 'repair_start_date', label: 'Fecha inicio reparacion', type: 'date', required: true },
        { field: 'repair_completion_date', label: 'Fecha finalizacion', type: 'date' },
      ]},
      { id: 'workshop', label: 'Informacion del Taller', icon: 'Building2', collapsible: true, defaultCollapsed: false, columns: 2, fields: [
        { field: 'is_inhouse_workshop', label: 'Taller propio', type: 'boolean', default: true },
        { field: 'workshop_name', label: 'Nombre del taller', type: 'text', visibleWhen: { field: 'is_inhouse_workshop', equals: false } },
        { field: 'workshop_phone', label: 'Telefono', type: 'phone', visibleWhen: { field: 'is_inhouse_workshop', equals: false } },
        { field: 'workshop_address', label: 'Direccion', type: 'text', visibleWhen: { field: 'is_inhouse_workshop', equals: false } },
        { field: 'invoice_number', label: 'No. de factura / ticket', type: 'text', visibleWhen: { field: 'is_inhouse_workshop', equals: false } },
      ]},
      { id: 'parts', type: 'parts-editor', label: 'Partes Reparadas / Reemplazadas', icon: 'Package', collapsible: true, defaultCollapsed: false },
      { id: 'costs', label: 'Costos', icon: 'BadgeDollarSign', collapsible: true, defaultCollapsed: false, columns: 2, fields: [{ field: 'repair_estimated_cost', label: 'Costo estimado', type: 'currency' }, { field: 'labor_cost', label: 'Mano de obra', type: 'currency' }, { field: 'parts_cost', label: 'Costo de partes (calculado automaticamente)', type: 'currency', readonly: true }, { field: 'total_cost', label: 'Costo final total', type: 'currency', readonly: true }] },
      { id: 'notes', label: 'Descripcion Detallada', icon: 'FileText', collapsible: true, defaultCollapsed: false, columns: 1, fields: [{ field: 'notes', label: 'Descripcion del problema y solucion', type: 'markdown' }] },
      { id: 'warranty', label: 'Garantia', icon: 'ShieldCheck', collapsible: true, defaultCollapsed: false, columns: 2, fields: [{ field: 'warranty_days', label: 'Dias de garantia', type: 'number' }, { field: 'warranty_notes', label: 'Condiciones de garantia', type: 'markdown' }] },
      { id: 'attachments', type: 'attachments', label: 'Archivos Adjuntos', icon: 'Paperclip', collapsible: true, defaultCollapsed: false, attachments: { createMode: 'stage-until-parent-create', editMode: 'upload-immediately', listPath: '/fleet/reports/:id/documents', addPath: '/fleet/reports/:id/documents', removePath: '/fleet/reports/:id/documents/:docId', upload: { endpoint: '/files/upload', moduleKey: 'atlas.fleet', entityType: 'FleetReport' }, signedUrl: { endpointTemplate: '/files/:fileId/signed-url' }, fields: { id: 'id', fileAssetId: 'file_asset_id', documentType: 'document_type', label: 'label', createdAt: 'created_at', enabled: 'enabled', fileAsset: 'file_asset', fileName: 'originalName', mimeType: 'mimeType', sizeBytes: 'sizeBytes' }, permissions: { read: 'fleet.reports.read', create: 'fleet.reports.update', remove: 'fleet.reports.update', fileUpload: 'files.assets.create', fileRead: 'files.assets.read' }, limits: { maxFiles: 20, maxSizeMB: 10, allowMultiple: true } } },
    ],
  },
}

export const reportsRepairDetail = {
  key: 'fleet.reports.repair.detail',
  kind: 'DETAIL',
  schema: {
    entity: 'report',
    component: 'AtlasDetail',
    apiPath: '/fleet/reports/repair',
    sections: [
      { label: 'Informacion general', columns: 2, fields: [{ field: 'folio', label: 'Folio', icon: 'Hash' }, { field: 'title', label: 'Titulo', icon: 'ClipboardList' }, { field: 'status', label: 'Estado', icon: 'Activity' }, { field: 'report_date', label: 'Fecha', type: 'date', icon: 'CalendarDays' }, { field: 'odometer_km', label: 'Kilometraje', icon: 'Hash', type: 'number' }, { field: 'is_inhouse_workshop', label: 'Taller propio', type: 'boolean', icon: 'Building2' }, { field: 'repair_priority', label: 'Prioridad', icon: 'Tag', type: 'select', options: [{ label: 'Baja', value: 'low' }, { label: 'Normal', value: 'normal' }, { label: 'Alta', value: 'high' }, { label: 'Urgente', value: 'urgent' }] }, { field: 'repair_damage_type', label: 'Tipo de dano', icon: 'Wrench', type: 'select', options: [{ label: 'Mecanico', value: 'mechanical' }, { label: 'Electrico', value: 'electrical' }, { label: 'Carroceria', value: 'body' }, { label: 'Interior', value: 'interior' }, { label: 'Otro', value: 'other' }] }, { field: 'repair_start_date', label: 'Inicio', type: 'date', icon: 'CalendarDays' }, { field: 'repair_completion_date', label: 'Fin', type: 'date', icon: 'CalendarDays' }] },
      { id: 'related_vehicle', type: 'relation-card', label: 'Vehiculo', relationCard: { idField: 'vehicle_id', titleField: 'vehicle_plate', subtitleFields: ['vehicle_brand_name', 'vehicle_model_name'], fallbackTitle: 'Vehiculo no disponible', hrefTemplate: '/app/m/atlas.fleet/vehicles/:id', icon: 'Truck' } },
      { label: 'Costos y garantia', columns: 2, fields: [{ field: 'repair_estimated_cost', label: 'Estimado', type: 'currency', icon: 'Tag' }, { field: 'labor_cost', label: 'Mano de obra', type: 'currency', icon: 'Tag' }, { field: 'parts_cost', label: 'Refacciones', type: 'currency', icon: 'Tag' }, { field: 'total_cost', label: 'Total', type: 'currency', icon: 'Tag' }, { field: 'warranty_days', label: 'Dias garantia', icon: 'Hash', type: 'number' }, { field: 'warranty_notes', label: 'Notas garantia', icon: 'FileText' }] },
      { id: 'parts', type: 'relation-list', label: 'Refacciones / Partes', relationList: { apiPath: '/fleet/reports/:id/parts', idField: 'id', titleField: 'name', subtitleFields: ['quantity', 'unit_cost', 'subtotal'], subtitleLabels: ['Cant.', 'P.U.', 'Subtotal'], subtitleTypes: ['integer', 'currency', 'currency'], icon: 'Wrench', emptyMessage: 'No hay refacciones registradas.' } },
      { label: 'Observaciones', fields: [{ field: 'notes', label: 'Notas', type: 'markdown', icon: 'FileText' }] },
      { id: 'documents', type: 'documents', label: 'Archivos adjuntos', documents: { listPath: '/fleet/reports/:id/documents', addPath: '/fleet/reports/:id/documents', removePath: '/fleet/reports/:id/documents/:docId', upload: { endpoint: '/files/upload', moduleKey: 'atlas.fleet', entityType: 'FleetReport' }, fields: { associationId: 'id', fileAssetId: 'file_asset_id', documentType: 'document_type', label: 'label', createdAt: 'created_at', enabled: 'enabled', fileAsset: 'file_asset', fileName: 'originalName', mimeType: 'mimeType', sizeBytes: 'sizeBytes' }, signedUrl: { endpointTemplate: '/files/:fileId/signed-url' }, permissions: { read: 'fleet.reports.read', create: 'fleet.reports.update', remove: 'fleet.reports.update', fileUpload: 'files.assets.create', fileRead: 'files.assets.read' } } },
    ],
    headerActions: [
      { key: 'download_pdf', label: 'Descargar PDF', method: 'GET', pathTemplate: '/fleet/reports/:id/pdf', download: true, downloadFileName: 'reporte-flota.pdf', refreshAfter: false, variant: 'outline', visibleWhen: { field: 'status', equals: 'finalized' } },
      { key: 'regenerate_pdf', label: 'Regenerar PDF', method: 'GET', pathTemplate: '/fleet/reports/:id/pdf', refreshAfter: false, variant: 'outline', visibleWhen: { field: 'status', equals: 'finalized' } },
      { key: 'finalize', label: 'Finalizar', method: 'POST', pathTemplate: '/fleet/reports/:id/finalize', visibleWhen: { field: 'status', equals: 'draft' }, variant: 'default' },
      { key: 'reopen', label: 'Reabrir', method: 'POST', pathTemplate: '/fleet/reports/:id/reopen', visibleWhen: { field: 'status', equals: 'finalized' }, variant: 'outline' },
    ],
    actions: [{ label: 'Editar', permission: 'fleet.reports.update' }],
  },
}

// Other

export const reportsOtherPage = {
  key: 'fleet.reports.other.page',
  kind: 'PAGE',
  schema: {
    path: '/app/m/atlas.fleet/reports/other',
    title: 'Otros Reportes',
    layout: 'main',
    view: 'fleet.reports.other.table',
    tabLabel: 'Otro',
    tabOrder: 4,
  },
}

export const reportsOtherTable = {
  key: 'fleet.reports.other.table',
  kind: 'TABLE',
  schema: {
    entity: 'report',
    component: 'AtlasTable',
    apiPath: '/fleet/reports/other',
    primaryField: 'title',
    searchable: true,
    searchPlaceholder: 'Buscar reportes de otro tipo...',
    columns: [
      { field: 'folio', label: 'Folio', sortable: true },
      { field: 'title', label: 'Titulo', sortable: true, link: true },
      { field: 'other_category_label', label: 'Categoria' },
      { field: 'vehicle_plate', label: 'Vehiculo' },
      { field: 'status', label: 'Estado', sortable: true, component: 'atlas.fleet:ReportStatusBadge' },
      { field: 'report_date', label: 'Fecha', type: 'date', sortable: true },
      { field: 'total_cost', label: 'Total', type: 'currency', sortable: true },
    ],
    actions: [{ label: 'Nuevo reporte', permission: 'fleet.reports.create', variant: 'primary' }],
    rowActions: [
      { label: 'Ver detalle', permission: 'fleet.reports.read' },
      { label: 'Editar', permission: 'fleet.reports.update' },
      { label: 'Desactivar', permission: 'fleet.reports.delete' },
    ],
  },
}

export const reportsOtherForm = {
  key: 'fleet.reports.other.form',
  kind: 'FORM',
  schema: {
    entity: 'report',
    component: 'AtlasForm',
    apiPath: '/fleet/reports/other',
    formMode: 'page',
    title: 'Nuevo Reporte - Otro',
    submitLabel: 'Finalizar reporte',
    cancelLabel: 'Cancelar',
    sections: [
      { id: 'vehicle', label: 'Vehiculo', icon: 'Wrench', collapsible: true, defaultCollapsed: false, columns: 1, fields: [{ field: 'vehicle_id', label: 'Seleccionar vehiculo', type: 'relation', required: true, relation: { apiPath: '/fleet/vehicles', labelField: ['plate', 'vehicle_model_name'], labelSeparator: ' · ', clearable: false, disabledField: 'enabled', searchParam: 'search', displayFields: { badge: 'full_economic_number', title: 'vehicle_model_name', subtitle: ['plate', 'vehicle_type_name', 'vehicle_brand_name'] } } }] },
      { id: 'other_data', label: 'Datos del Reporte', icon: 'ClipboardList', collapsible: true, defaultCollapsed: false, columns: 2, fields: [{ field: 'title', label: 'Titulo del reporte', type: 'text', required: true }, { field: 'other_category_label', label: 'Categoria personalizada', type: 'text', required: true }, { field: 'report_date', label: 'Fecha del reporte', type: 'date', required: true }, { field: 'odometer_km', label: 'Kilometraje', type: 'number' }] },
      { id: 'workshop', label: 'Informacion del Taller', icon: 'Building2', collapsible: true, defaultCollapsed: false, columns: 2, fields: [{ field: 'is_inhouse_workshop', label: 'Taller propio', type: 'boolean', default: true }, { field: 'workshop_name', label: 'Nombre del taller', type: 'text', visibleWhen: { field: 'is_inhouse_workshop', equals: false } }, { field: 'workshop_phone', label: 'Telefono', type: 'phone', visibleWhen: { field: 'is_inhouse_workshop', equals: false } }, { field: 'workshop_address', label: 'Direccion', type: 'text', visibleWhen: { field: 'is_inhouse_workshop', equals: false } }, { field: 'invoice_number', label: 'No. de factura / ticket', type: 'text', visibleWhen: { field: 'is_inhouse_workshop', equals: false } }] },
      { id: 'parts', type: 'parts-editor', label: 'Refacciones / Partes', icon: 'Package', collapsible: true, defaultCollapsed: false },
      { id: 'costs', label: 'Resumen de Costos', icon: 'BadgeDollarSign', collapsible: true, defaultCollapsed: false, columns: 3, fields: [{ field: 'labor_cost', label: 'Mano de obra', type: 'currency' }, { field: 'parts_cost', label: 'Costo de refacciones (calculado automaticamente)', type: 'currency', readonly: true }, { field: 'total_cost', label: 'Costo final total', type: 'currency', readonly: true }] },
      { id: 'notes', label: 'Observaciones', icon: 'FileText', collapsible: true, defaultCollapsed: false, columns: 1, fields: [{ field: 'notes', label: 'Descripcion / notas', type: 'markdown' }] },
      { id: 'attachments', type: 'attachments', label: 'Archivos Adjuntos', icon: 'Paperclip', collapsible: true, defaultCollapsed: false, attachments: { createMode: 'stage-until-parent-create', editMode: 'upload-immediately', listPath: '/fleet/reports/:id/documents', addPath: '/fleet/reports/:id/documents', removePath: '/fleet/reports/:id/documents/:docId', upload: { endpoint: '/files/upload', moduleKey: 'atlas.fleet', entityType: 'FleetReport' }, signedUrl: { endpointTemplate: '/files/:fileId/signed-url' }, fields: { id: 'id', fileAssetId: 'file_asset_id', documentType: 'document_type', label: 'label', createdAt: 'created_at', enabled: 'enabled', fileAsset: 'file_asset', fileName: 'originalName', mimeType: 'mimeType', sizeBytes: 'sizeBytes' }, permissions: { read: 'fleet.reports.read', create: 'fleet.reports.update', remove: 'fleet.reports.update', fileUpload: 'files.assets.create', fileRead: 'files.assets.read' }, limits: { maxFiles: 20, maxSizeMB: 10, allowMultiple: true } } },
    ],
  },
}

export const reportsOtherDetail = {
  key: 'fleet.reports.other.detail',
  kind: 'DETAIL',
  schema: {
    entity: 'report',
    component: 'AtlasDetail',
    apiPath: '/fleet/reports/other',
    sections: [
      { label: 'Informacion general', columns: 2, fields: [{ field: 'folio', label: 'Folio', icon: 'Hash' }, { field: 'title', label: 'Titulo', icon: 'ClipboardList' }, { field: 'status', label: 'Estado', icon: 'Activity' }, { field: 'other_category_label', label: 'Categoria', icon: 'Layers' }, { field: 'report_date', label: 'Fecha', type: 'date', icon: 'CalendarDays' }, { field: 'odometer_km', label: 'Kilometraje', icon: 'Hash', type: 'number' }] },
      { id: 'related_vehicle', type: 'relation-card', label: 'Vehiculo', relationCard: { idField: 'vehicle_id', titleField: 'vehicle_plate', subtitleFields: ['vehicle_brand_name', 'vehicle_model_name'], fallbackTitle: 'Vehiculo no disponible', hrefTemplate: '/app/m/atlas.fleet/vehicles/:id', icon: 'Truck' } },
      { label: 'Taller y costos', columns: 2, fields: [{ field: 'is_inhouse_workshop', label: 'Taller propio', type: 'boolean', icon: 'Building2' }, { field: 'workshop_name', label: 'Taller', icon: 'Library' }, { field: 'invoice_number', label: 'Factura/Ticket', icon: 'FileText' }, { field: 'workshop_phone', label: 'Telefono', icon: 'Phone' }, { field: 'workshop_address', label: 'Direccion', icon: 'Link2' }, { field: 'labor_cost', label: 'Mano de obra', type: 'currency', icon: 'Tag' }, { field: 'parts_cost', label: 'Refacciones', type: 'currency', icon: 'Tag' }, { field: 'total_cost', label: 'Total', type: 'currency', icon: 'Tag' }] },
      { id: 'parts', type: 'relation-list', label: 'Refacciones / Partes', relationList: { apiPath: '/fleet/reports/:id/parts', idField: 'id', titleField: 'name', subtitleFields: ['quantity', 'unit_cost', 'subtotal'], subtitleLabels: ['Cant.', 'P.U.', 'Subtotal'], subtitleTypes: ['integer', 'currency', 'currency'], icon: 'Wrench', emptyMessage: 'No hay refacciones registradas.' } },
      { label: 'Observaciones', fields: [{ field: 'notes', label: 'Notas', type: 'markdown', icon: 'FileText' }] },
      { id: 'documents', type: 'documents', label: 'Archivos adjuntos', documents: { listPath: '/fleet/reports/:id/documents', addPath: '/fleet/reports/:id/documents', removePath: '/fleet/reports/:id/documents/:docId', upload: { endpoint: '/files/upload', moduleKey: 'atlas.fleet', entityType: 'FleetReport' }, fields: { associationId: 'id', fileAssetId: 'file_asset_id', documentType: 'document_type', label: 'label', createdAt: 'created_at', enabled: 'enabled', fileAsset: 'file_asset', fileName: 'originalName', mimeType: 'mimeType', sizeBytes: 'sizeBytes' }, signedUrl: { endpointTemplate: '/files/:fileId/signed-url' }, permissions: { read: 'fleet.reports.read', create: 'fleet.reports.update', remove: 'fleet.reports.update', fileUpload: 'files.assets.create', fileRead: 'files.assets.read' } } },
    ],
    headerActions: [
      { key: 'download_pdf', label: 'Descargar PDF', method: 'GET', pathTemplate: '/fleet/reports/:id/pdf', download: true, downloadFileName: 'reporte-flota.pdf', refreshAfter: false, variant: 'outline', visibleWhen: { field: 'status', equals: 'finalized' } },
      { key: 'regenerate_pdf', label: 'Regenerar PDF', method: 'GET', pathTemplate: '/fleet/reports/:id/pdf', refreshAfter: false, variant: 'outline', visibleWhen: { field: 'status', equals: 'finalized' } },
      { key: 'finalize', label: 'Finalizar', method: 'POST', pathTemplate: '/fleet/reports/:id/finalize', visibleWhen: { field: 'status', equals: 'draft' }, variant: 'default' },
      { key: 'reopen', label: 'Reabrir', method: 'POST', pathTemplate: '/fleet/reports/:id/reopen', visibleWhen: { field: 'status', equals: 'finalized' }, variant: 'outline' },
    ],
    actions: [{ label: 'Editar', permission: 'fleet.reports.update' }],
  },
}
