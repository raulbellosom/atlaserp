// Registry key: atlas.fleet:InsuranceBadgeCell
// Props (insurance list): { value: 'active' | 'expired' | 'disabled' } — from `status` column
// Props (vehicle list):   { insurance_status: 'active' | 'expired' | 'none' }

const STATUS_CONFIG = {
  active: { label: "Con poliza", bg: "bg-green-100", text: "text-green-800" },
  expired: { label: "Vencida", bg: "bg-yellow-100", text: "text-yellow-800" },
  none: { label: "Sin poliza", bg: "bg-gray-100", text: "text-gray-500" },
  disabled: { label: "Desactivada", bg: "bg-gray-100", text: "text-gray-500" },
};

export default function InsuranceBadgeCell({ value, insurance_status }) {
  const key = value ?? insurance_status;
  const cfg = STATUS_CONFIG[key] ?? {
    label: key ?? "—",
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
