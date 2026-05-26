// Registers custom.fleet React components into a ComponentRegistry-compatible instance.
// Called at boot by apps/desktop/src/lib/moduleComponentRegistry.js.
// The registry object must expose: register(key, component)
//
// Uses dynamic imports so this file is safe to load in Node.js (API server).
// Components are only registered in browser environments where window exists.

/**
 * @param {{ register: (key: string, component: unknown) => void }} registry
 */
export async function register(registry) {
  if (typeof window === 'undefined') return

  const [
    { default: VehicleStatusBadge },
    { default: ReportStatusBadge },
    { default: DriverStatusBadge },
    { default: DriverAvatarCell },
    { default: DriverAssignedVehicleCell },
    { default: VehicleImageCell },
    { default: InsuranceBadgeCell },
  ] = await Promise.all([
    import('./VehicleStatusBadge.jsx'),
    import('./ReportStatusBadge.jsx'),
    import('./DriverStatusBadge.jsx'),
    import('./DriverAvatarCell.jsx'),
    import('./DriverAssignedVehicleCell.jsx'),
    import('./VehicleImageCell.jsx'),
    import('./InsuranceBadgeCell.jsx'),
  ])

  registry.register('custom.fleet:VehicleStatusBadge', VehicleStatusBadge)
  registry.register('custom.fleet:ReportStatusBadge', ReportStatusBadge)
  registry.register('custom.fleet:DriverStatusBadge', DriverStatusBadge)
  registry.register('custom.fleet:DriverAvatarCell', DriverAvatarCell)
  registry.register('custom.fleet:DriverAssignedVehicleCell', DriverAssignedVehicleCell)
  registry.register('custom.fleet:VehicleImageCell', VehicleImageCell)
  registry.register('custom.fleet:InsuranceBadgeCell', InsuranceBadgeCell)
}
