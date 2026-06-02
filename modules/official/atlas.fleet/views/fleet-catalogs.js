// Atlas Fleet catalog views — vehicle types, brands, models

export const vehicleTypesTable = {
  key: 'fleet.catalogs.vehicle-types.table',
  kind: 'TABLE',
  schema: {
    entity: 'FleetVehicleType',
    apiPath: '/fleet/catalogs/vehicle-types',
    title: 'Tipos de vehiculo',
    columns: [
      { field: 'name',                  label: 'Nombre' },
      { field: 'economic_group_number', label: 'No. economico grupo' },
      { field: 'description',           label: 'Descripcion' },
    ],
    actions: [{ label: 'Agregar tipo' }],
  },
}

export const vehicleTypesForm = {
  key: 'fleet.catalogs.vehicle-types.form',
  kind: 'FORM',
  schema: {
    entity: 'FleetVehicleType',
    apiPath: '/fleet/catalogs/vehicle-types',
    sections: [
      {
        title: 'Tipo de vehiculo',
        fields: [
          { name: 'name',                  label: 'Nombre',                type: 'text', required: true },
          { name: 'description',           label: 'Descripcion',           type: 'textarea' },
          { name: 'economic_group_number', label: 'No. economico grupo',   type: 'text' },
        ],
      },
    ],
  },
}

export const vehicleBrandsTable = {
  key: 'fleet.catalogs.vehicle-brands.table',
  kind: 'TABLE',
  schema: {
    entity: 'FleetVehicleBrand',
    apiPath: '/fleet/catalogs/vehicle-brands',
    title: 'Marcas',
    columns: [
      { field: 'name', label: 'Nombre' },
    ],
    actions: [{ label: 'Agregar marca' }],
  },
}

export const vehicleBrandsForm = {
  key: 'fleet.catalogs.vehicle-brands.form',
  kind: 'FORM',
  schema: {
    entity: 'FleetVehicleBrand',
    apiPath: '/fleet/catalogs/vehicle-brands',
    sections: [
      {
        title: 'Marca',
        fields: [
          { name: 'name', label: 'Nombre', type: 'text', required: true },
        ],
      },
    ],
  },
}

export const vehicleModelsTable = {
  key: 'fleet.catalogs.vehicle-models.table',
  kind: 'TABLE',
  schema: {
    entity: 'FleetVehicleModel',
    apiPath: '/fleet/catalogs/vehicle-models',
    title: 'Modelos',
    columns: [
      { field: 'name',      label: 'Nombre' },
      { field: 'year',      label: 'Año',   type: 'number' },
    ],
    actions: [{ label: 'Agregar modelo' }],
  },
}

export const vehicleModelsForm = {
  key: 'fleet.catalogs.vehicle-models.form',
  kind: 'FORM',
  schema: {
    entity: 'FleetVehicleModel',
    apiPath: '/fleet/catalogs/vehicle-models',
    sections: [
      {
        title: 'Modelo',
        fields: [
          { name: 'name', label: 'Nombre', type: 'text',   required: true },
          { name: 'year', label: 'Año',    type: 'number', required: true },
        ],
      },
    ],
  },
}
