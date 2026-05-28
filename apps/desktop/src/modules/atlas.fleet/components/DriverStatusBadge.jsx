// Registry key: atlas.fleet:DriverStatusBadge
// Props: { status: 'active' | 'inactive' | 'suspended' }

const STATUS_CONFIG = {
  active:    { label: "Activo",     bg: "bg-green-100",  text: "text-green-800" },
  inactive:  { label: "Inactivo",   bg: "bg-gray-100",   text: "text-gray-700" },
  suspended: { label: "Suspendido", bg: "bg-red-100",    text: "text-red-700" },
};

export default function DriverStatusBadge({ status }) {
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
