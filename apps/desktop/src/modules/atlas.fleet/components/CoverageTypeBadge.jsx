// Registry key: atlas.fleet:CoverageTypeBadge
// Props: { value: 'basic' | 'comprehensive' | 'third_party' | 'other' | string }

const COVERAGE_CONFIG = {
  basic: { label: "Básica", bg: "bg-blue-100", text: "text-blue-800" },
  comprehensive: {
    label: "Integral",
    bg: "bg-green-100",
    text: "text-green-800",
  },
  third_party: {
    label: "Terceros",
    bg: "bg-purple-100",
    text: "text-purple-800",
  },
  other: { label: "Otro", bg: "bg-gray-100", text: "text-gray-600" },
};

export default function CoverageTypeBadge({ value }) {
  if (!value) return <span className="text-gray-400 text-xs">—</span>;

  const cfg = COVERAGE_CONFIG[value] ?? {
    label: value,
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
