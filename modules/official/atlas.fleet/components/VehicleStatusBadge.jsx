// Registry key: atlas.fleet:VehicleStatusBadge
// Props: { status: 'active' | 'inactive' | 'maintenance' | 'retired' | 'pending' | 'disabled' }
// Registered via ComponentRegistry.register in the Route Loader (Phase 4+).

const STATUS_CONFIG = {
  active: { label: "Activo", bg: "bg-green-100", text: "text-green-800" },
  inactive: { label: "Inactivo", bg: "bg-gray-100", text: "text-gray-700" },
  maintenance: {
    label: "En mantenimiento",
    bg: "bg-yellow-100",
    text: "text-yellow-800",
  },
  retired: { label: "Retirado", bg: "bg-red-100", text: "text-red-700" },
  pending: { label: "Pendiente", bg: "bg-blue-100", text: "text-blue-700" },
  disabled: { label: "Desactivado", bg: "bg-gray-100", text: "text-gray-500" },
};

export default function VehicleStatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    bg: "bg-gray-100",
    text: "text-gray-600",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  );
}
