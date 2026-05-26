// Registry key: custom.fleet:InsuranceBadgeCell
// Props: { insurance_status: 'active' | 'expired' | 'none' }
// Registered via ComponentRegistry.register in the Route Loader (Phase 4+).

const STATUS_CONFIG = {
  active: { label: "Con poliza", bg: "bg-green-100", text: "text-green-800" },
  expired: { label: "Vencida", bg: "bg-yellow-100", text: "text-yellow-800" },
  none: { label: "Sin poliza", bg: "bg-gray-100", text: "text-gray-500" },
};

export default function InsuranceBadgeCell({ insurance_status }) {
  const cfg = STATUS_CONFIG[insurance_status] ?? {
    label: insurance_status,
    bg: "bg-gray-100",
    text: "text-gray-500",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  );
}
