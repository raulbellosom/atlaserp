// apps/desktop/src/modules/atlas.pfm/components/CategoryDonut.jsx
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { EmptyState } from "@atlas/ui";
import { formatMoney } from "../lib/format";

export function CategoryDonut({ data, currency }) {
  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="Sin gastos este mes"
        description="Registra movimientos para ver el desglose."
      />
    );
  }
  return (
    <div className="h-64 w-full min-w-0" style={{ minHeight: 256 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={200} debounce={1}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="name"
            innerRadius="58%"
            outerRadius="88%"
            paddingAngle={2}
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
    </div>
  );
}
