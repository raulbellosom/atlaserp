// apps/desktop/src/modules/atlas.pfm/components/SpendTrendBar.jsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatMoney, formatMonthLabel } from "../lib/format";

export function SpendTrendBar({ data, currency }) {
  const rows = (data ?? []).map((d) => ({ ...d, label: formatMonthLabel(d.month) }));
  return (
    <div className="h-56 w-full min-w-0" style={{ minHeight: 224 }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={180} debounce={1}>
        <BarChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            formatter={(value, name) => [
              formatMoney(value, currency),
              name === "expense" ? "Gasto" : "Ingreso",
            ]}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
              color: "hsl(var(--popover-foreground))",
            }}
          />
          <Bar dataKey="expense" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
