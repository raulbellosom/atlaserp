const STATUS_CONFIG = {
  draft: { label: "Borrador", bg: "bg-amber-100", text: "text-amber-800" },
  finalized: { label: "Finalizado", bg: "bg-green-100", text: "text-green-800" },
};

export default function ReportStatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    bg: "bg-gray-100",
    text: "text-gray-700",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  );
}

