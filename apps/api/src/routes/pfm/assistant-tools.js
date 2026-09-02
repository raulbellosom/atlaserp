// apps/api/src/routes/pfm/assistant-tools.js
//
// Tool surface for the PFM assistant. All tools are read-only except
// `propose_movement`, which validates a movement WITHOUT writing it and hands
// back a structured proposal for the client to confirm through the normal
// POST /pfm/wallets/:id/movements endpoint.
//
// Runners receive (args, ctx) where ctx = { companyId, actorId } from the
// authenticated request — never from the model.
import { toLocalIso, toLocalMonth } from "@atlas/core";
import { createMovementSchema } from "./validators.js";

const MONTH_RE = /^\d{4}-\d{2}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function monthOrUndefined(v) {
  return MONTH_RE.test(String(v ?? "")) ? v : undefined;
}

export const TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "get_overview",
      description:
        "Resumen financiero del usuario para un mes: saldo total, disponible, deuda de tarjetas, inversiones, gasto e ingreso del mes, gasto del mes anterior y gasto por categoria.",
      parameters: {
        type: "object",
        properties: {
          month: { type: "string", description: "Mes YYYY-MM. Por defecto el mes en curso." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_wallets",
      description: "Lista las carteras del usuario con su saldo actual, tipo y moneda.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_movements",
      description:
        "Movimientos de UNA cartera (requiere walletId, obtenlo primero con list_wallets). Filtros opcionales por mes, categoria, estado y texto.",
      parameters: {
        type: "object",
        properties: {
          walletId: { type: "string" },
          month: { type: "string", description: "YYYY-MM" },
          categoryId: { type: "string" },
          status: { type: "string", enum: ["PENDING", "POSTED", "SKIPPED"] },
          search: { type: "string" },
          limit: { type: "number", description: "Maximo 50." },
        },
        required: ["walletId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_budgets",
      description: "Presupuestos del usuario con lo gastado y el porcentaje del mes.",
      parameters: {
        type: "object",
        properties: { month: { type: "string", description: "YYYY-MM" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_upcoming",
      description: "Cargos y movimientos pendientes en los proximos N dias (default 14, max 60).",
      parameters: {
        type: "object",
        properties: { days: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_categories",
      description: "Categorias de gasto o ingreso disponibles para el usuario.",
      parameters: {
        type: "object",
        properties: { kind: { type: "string", enum: ["EXPENSE", "INCOME"] } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_movement",
      description:
        "Propone registrar un gasto o ingreso. NO lo registra: el usuario lo confirma despues. Usalo cuando el usuario pida apuntar/registrar un movimiento.",
      parameters: {
        type: "object",
        properties: {
          walletId: { type: "string" },
          direction: { type: "string", enum: ["EXPENSE", "INCOME"] },
          amount: { type: "number" },
          occurredOn: { type: "string", description: "YYYY-MM-DD. Por defecto hoy." },
          categoryId: { type: "string" },
          merchant: { type: "string" },
          note: { type: "string" },
        },
        required: ["walletId", "direction", "amount"],
      },
    },
  },
];

export function buildToolRunners({ summary, wallets, movements, budgets, categories }) {
  async function walletName(ctx, id) {
    const r = await wallets.listWallets(ctx);
    return (r.data ?? []).find((w) => w.id === id)?.name ?? null;
  }
  async function categoryName(ctx, id) {
    if (!id) return null;
    const r = await categories.listCategories(ctx);
    return (r.data ?? []).find((c) => c.id === id)?.name ?? null;
  }

  return {
    get_overview: async (args, ctx) => {
      const month = MONTH_RE.test(String(args?.month ?? "")) ? args.month : toLocalMonth();
      return summary.getOverview({ ...ctx, month });
    },

    list_wallets: async (_args, ctx) => {
      const r = await wallets.listWallets(ctx);
      return (r.data ?? []).map((w) => ({
        id: w.id,
        name: w.name,
        kind: w.kind,
        currency: w.currency,
        currentBalance: w.currentBalance,
        creditLimit: w.creditLimit ?? null,
      }));
    },

    list_movements: async (args, ctx) => {
      if (!args?.walletId) {
        return { error: "Falta walletId. Usa list_wallets para elegir una cartera." };
      }
      const r = await movements.listMovements({
        ...ctx,
        walletId: args.walletId,
        query: {
          month: monthOrUndefined(args.month),
          categoryId: args.categoryId || undefined,
          status: args.status || undefined,
          search: args.search || undefined,
          limit: Math.min(50, Number(args.limit) || 50),
        },
      });
      return (r.data ?? []).map((m) => ({
        occurredOn: m.occurredOn,
        amount: m.amount,
        direction: m.direction,
        merchant: m.merchant,
        categoryId: m.categoryId,
        status: m.status,
      }));
    },

    list_budgets: async (args, ctx) =>
      budgets.listBudgets({ ...ctx, month: monthOrUndefined(args?.month) }),

    list_upcoming: async (args, ctx) =>
      summary.getUpcoming({ ...ctx, days: Math.min(60, Number(args?.days) || 14) }),

    list_categories: async (args, ctx) => {
      const kind = args?.kind === "EXPENSE" || args?.kind === "INCOME" ? args.kind : undefined;
      const r = await categories.listCategories({ ...ctx, kind });
      return (r.data ?? []).map((c) => ({ id: c.id, name: c.name, kind: c.kind }));
    },

    propose_movement: async (args, ctx) => {
      const parsed = createMovementSchema.safeParse({
        direction: args?.direction,
        amount: Number(args?.amount),
        occurredOn: DAY_RE.test(String(args?.occurredOn ?? "")) ? args.occurredOn : toLocalIso(),
        categoryId: args?.categoryId ?? null,
        merchant: args?.merchant ?? null,
        note: args?.note ?? null,
        status: "POSTED",
      });
      if (!parsed.success) {
        return { error: "Datos del movimiento invalidos (revisa monto, tipo y fecha)." };
      }
      if (
        !args?.walletId ||
        !(await wallets.canWriteWallet({ ...ctx, walletId: args.walletId }))
      ) {
        return { error: "No tienes acceso de escritura a esa cartera." };
      }
      return {
        __proposedAction: {
          type: "create_movement",
          walletId: args.walletId,
          walletName: await walletName(ctx, args.walletId),
          direction: parsed.data.direction,
          amount: parsed.data.amount,
          occurredOn: parsed.data.occurredOn,
          categoryId: parsed.data.categoryId ?? null,
          categoryName: await categoryName(ctx, parsed.data.categoryId),
          merchant: parsed.data.merchant ?? null,
          note: parsed.data.note ?? null,
        },
      };
    },
  };
}
