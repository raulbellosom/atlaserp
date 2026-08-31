// apps/desktop/src/modules/atlas.pfm/components/CategoryDonut.jsx
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { EmptyState } from "@atlas/ui";
import { formatMoney } from "../lib/format";

export function CategoryDonut({ data, currency, centerLabel, centerValue }) {
  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="Sin gastos este mes"
        description="Registra movimientos para ver el desglose."
      />
    );
  }
  return (
    <div className="relative h-64 w-full min-w-0" style={{ minHeight: 256 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200} debounce={1}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="name"
            innerRadius="62%"
            outerRadius="90%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((entry) => (
              <Cell
                key={entry.categoryId ?? entry.name}
                fill={entry.color || "hsl(var(--muted-foreground))"}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [formatMoney(value, currency), name]}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
              color: "hsl(var(--popover-foreground))",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {(centerLabel || centerValue != null) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {centerLabel && (
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
              {centerLabel}
            </span>
          )}
          {centerValue != null && (
            <span className="mt-0.5 text-lg font-bold tabular-nums text-[hsl(var(--foreground))]">
              {formatMoney(centerValue, currency)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
