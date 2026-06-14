export const LEAD_STATUS_OPTIONS = [
  { value: "new", label: "Nuevo" },
  { value: "follow_up", label: "En seguimiento" },
  { value: "qualified", label: "Calificado" },
  { value: "discarded", label: "Descartado" },
  { value: "converted", label: "Convertido" },
];

export const LEAD_PRIORITY_OPTIONS = [
  { value: "low", label: "Baja" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Alta" },
];

const STATUS_LABELS = Object.fromEntries(
  LEAD_STATUS_OPTIONS.map((option) => [option.value, option.label]),
);
const PRIORITY_LABELS = Object.fromEntries(
  LEAD_PRIORITY_OPTIONS.map((option) => [option.value, option.label]),
);

const ACTIVITY_LABELS = {
  submission: "Formulario enviado",
  status_changed: "Estado actualizado",
  priority_changed: "Prioridad actualizada",
  assigned: "Responsable actualizado",
  note: "Nota agregada",
  converted: "Lead convertido",
  reopened: "Lead reabierto",
  disabled: "Lead deshabilitado",
  enabled: "Lead habilitado",
  file_removed: "Archivo retirado",
};

export function getLeadStatusLabel(status) {
  return STATUS_LABELS[status] ?? status ?? "Sin estado";
}

export function getLeadPriorityLabel(priority) {
  return PRIORITY_LABELS[priority] ?? priority ?? "Sin prioridad";
}

export function getLeadStatusVariant(status) {
  if (status === "qualified" || status === "converted") return "success";
  if (status === "discarded") return "destructive";
  if (status === "follow_up") return "warning";
  return "secondary";
}

export function getLeadPriorityVariant(priority) {
  if (priority === "high") return "destructive";
  if (priority === "low") return "outline";
  return "secondary";
}

export function getAllowedLeadStatuses(status) {
  const allowed = {
    new: ["new", "follow_up", "qualified", "discarded"],
    follow_up: ["follow_up", "qualified", "discarded"],
    qualified: ["qualified", "follow_up", "discarded"],
    discarded: ["discarded", "follow_up"],
    converted: ["converted"],
  };
  return LEAD_STATUS_OPTIONS.filter((option) =>
    (allowed[status] ?? [status]).includes(option.value),
  );
}

export function getGrowthLeadId(wildcard) {
  const segments = String(wildcard ?? "").split("/").filter(Boolean);
  return segments[0] === "leads" ? segments[1] ?? null : null;
}

export function describeLeadActivity(activity) {
  const payload = activity?.payload ?? {};
  if (activity?.activityType === "note") return payload.note ?? "Nota";
  if (activity?.activityType === "status_changed") {
    return `${getLeadStatusLabel(payload.from)} a ${getLeadStatusLabel(payload.to)}`;
  }
  if (activity?.activityType === "priority_changed") {
    return `${getLeadPriorityLabel(payload.from)} a ${getLeadPriorityLabel(payload.to)}`;
  }
  if (activity?.activityType === "converted") {
    return "Se vinculó con un contacto de Atlas.";
  }
  if (activity?.activityType === "reopened") {
    return "El lead volvió a seguimiento.";
  }
  if (activity?.activityType === "file_removed") {
    return payload.originalName ?? "Archivo retirado";
  }
  return ACTIVITY_LABELS[activity?.activityType] ?? "Actividad registrada";
}

export function getLeadActivityLabel(activityType) {
  return ACTIVITY_LABELS[activityType] ?? "Actividad";
}
