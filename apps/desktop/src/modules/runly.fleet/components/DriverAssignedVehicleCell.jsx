export default function DriverAssignedVehicleCell({ value, row }) {
  const assignedPlate = String(value ?? row?.assigned_plate ?? "").trim();
  const extraCount = Number(row?.assigned_vehicle_extra_count ?? 0);
  const hasPlate = assignedPlate.length > 0;

  if (!hasPlate) {
    return <span className="text-[hsl(var(--muted-foreground))]">—</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="truncate">{assignedPlate}</span>
      {extraCount > 0 ? (
        <span className="inline-flex items-center rounded-full bg-[hsl(var(--muted))] px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">
          +{extraCount}
        </span>
      ) : null}
    </span>
  );
}

