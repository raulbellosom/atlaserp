import { Hono } from "hono";
import { createPosSettingsService } from "./pos-settings-service.js";
import { createPosSessionService } from "./pos-session-service.js";
import { createPosOrderService } from "./pos-order-service.js";
import { createPosFloorService } from "./pos-floor-service.js";
import { createPosKitchenService } from "./pos-kitchen-service.js";
import { getActorId, getCompanyId, PosServiceError } from "./service-helpers.js";
import {
  addOrderLineSchema,
  cancelOrderSchema,
  cashMovementSchema,
  closeSessionSchema,
  createFloorSchema,
  createGuestSchema,
  createOrderSchema,
  createOutletSchema,
  createPaymentMethodSchema,
  createPaymentSchema,
  createStationSchema,
  createTableSchema,
  createTerminalSchema,
  kitchenStatusUpdateSchema,
  openSessionSchema,
  tableStatusUpdateSchema,
  saveLayoutSchema,
  updateFloorSchema,
  updateOrderLineSchema,
  updateOrderSchema,
  updateOutletSchema,
  updatePaymentMethodSchema,
  updateSettingsSchema,
  updateStationSchema,
  updateTableSchema,
  updateTerminalSchema,
} from "./validators.js";

function zodMessage(error) {
  return error?.issues?.[0]?.message ?? error?.errors?.[0]?.message ?? "Datos invalidos.";
}

async function parseBody(c, schema) {
  const body = await c.req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new PosServiceError(zodMessage(parsed.error), 400);
  return parsed.data;
}

function context(c) {
  return {
    companyId: getCompanyId(c),
    actorId: getActorId(c),
  };
}

function handleError(c, err, fallback) {
  if (err instanceof PosServiceError) return c.json({ error: err.message }, err.status);
  if (err?.name === "ZodError") return c.json({ error: zodMessage(err) }, 400);
  if (process.env.NODE_ENV !== "production") console.error("[atlas.pos]", err);
  return c.json({ error: fallback }, 500);
}

export function createPosRouter({ prisma, requirePermission }) {
  const app = new Hono();
  const settingsSvc = createPosSettingsService({ prisma });
  const sessionSvc = createPosSessionService({ prisma });
  const orderSvc = createPosOrderService({ prisma });
  const floorSvc = createPosFloorService({ prisma });
  const kitchenSvc = createPosKitchenService({ prisma });

  app.get("/pos/settings", requirePermission("pos.settings.manage"), async (c) => {
    try {
      return c.json({ data: await settingsSvc.getSettings(context(c)) });
    } catch (err) {
      return handleError(c, err, "No se pudo consultar la configuracion POS.");
    }
  });

  app.patch("/pos/settings", requirePermission("pos.settings.manage"), async (c) => {
    try {
      const data = await parseBody(c, updateSettingsSchema);
      return c.json({ data: await settingsSvc.updateSettings({ ...context(c), data }) });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar la configuracion POS.");
    }
  });

  app.get("/pos/outlets", requirePermission("pos.settings.manage"), async (c) => {
    try {
      return c.json({ data: await settingsSvc.listOutlets(context(c)) });
    } catch (err) {
      return handleError(c, err, "No se pudieron consultar las sucursales POS.");
    }
  });

  app.post("/pos/outlets", requirePermission("pos.settings.manage"), async (c) => {
    try {
      const data = await parseBody(c, createOutletSchema);
      return c.json({ data: await settingsSvc.createOutlet({ ...context(c), data }) }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo crear la sucursal POS.");
    }
  });

  app.patch("/pos/outlets/:id", requirePermission("pos.settings.manage"), async (c) => {
    try {
      const data = await parseBody(c, updateOutletSchema);
      return c.json({
        data: await settingsSvc.updateOutlet({ ...context(c), id: c.req.param("id"), data }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar la sucursal POS.");
    }
  });

  app.get("/pos/terminals", requirePermission("pos.settings.manage"), async (c) => {
    try {
      return c.json({ data: await settingsSvc.listTerminals(context(c)) });
    } catch (err) {
      return handleError(c, err, "No se pudieron consultar las terminales POS.");
    }
  });

  app.post("/pos/terminals", requirePermission("pos.settings.manage"), async (c) => {
    try {
      const data = await parseBody(c, createTerminalSchema);
      return c.json({ data: await settingsSvc.createTerminal({ ...context(c), data }) }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo crear la terminal POS.");
    }
  });

  app.patch("/pos/terminals/:id", requirePermission("pos.settings.manage"), async (c) => {
    try {
      const data = await parseBody(c, updateTerminalSchema);
      return c.json({
        data: await settingsSvc.updateTerminal({ ...context(c), id: c.req.param("id"), data }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar la terminal POS.");
    }
  });

  app.get("/pos/sessions", requirePermission("pos.sessions.read"), async (c) => {
    try {
      return c.json({
        data: await sessionSvc.listSessions({ ...context(c), status: c.req.query("status") }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudieron consultar las sesiones POS.");
    }
  });

  app.post("/pos/sessions/open", requirePermission("pos.sessions.manage"), async (c) => {
    try {
      const data = await parseBody(c, openSessionSchema);
      return c.json({ data: await sessionSvc.openSession({ ...context(c), data }) }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo abrir la sesion POS.");
    }
  });

  app.get("/pos/sessions/current", requirePermission("pos.sessions.read"), async (c) => {
    try {
      return c.json({
        data: await sessionSvc.getCurrentSession({ ...context(c), terminalId: c.req.query("terminalId") }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo consultar la sesion actual.");
    }
  });

  app.get("/pos/sessions/:id", requirePermission("pos.sessions.read"), async (c) => {
    try {
      return c.json({ data: await sessionSvc.getSessionById({ ...context(c), id: c.req.param("id") }) });
    } catch (err) {
      return handleError(c, err, "No se pudo consultar la sesion POS.");
    }
  });

  app.post("/pos/sessions/:id/cash-movements", requirePermission("pos.cash.manage"), async (c) => {
    try {
      const data = await parseBody(c, cashMovementSchema);
      return c.json({
        data: await sessionSvc.addCashMovement({ ...context(c), sessionId: c.req.param("id"), data }),
      }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo registrar el movimiento de efectivo.");
    }
  });

  app.post("/pos/sessions/:id/close", requirePermission("pos.sessions.manage"), async (c) => {
    try {
      const data = await parseBody(c, closeSessionSchema);
      return c.json({
        data: await sessionSvc.closeSession({ ...context(c), sessionId: c.req.param("id"), data }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo cerrar la sesion POS.");
    }
  });

  app.get("/pos/orders", requirePermission("pos.orders.read"), async (c) => {
    try {
      return c.json({ data: await orderSvc.listOrders({ ...context(c), filters: c.req.query() }) });
    } catch (err) {
      return handleError(c, err, "No se pudieron consultar las ordenes POS.");
    }
  });

  app.post("/pos/orders", requirePermission("pos.orders.create"), async (c) => {
    try {
      const data = await parseBody(c, createOrderSchema);
      return c.json({ data: await orderSvc.createOrder({ ...context(c), data }) }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo crear la orden POS.");
    }
  });

  app.get("/pos/orders/:id", requirePermission("pos.orders.read"), async (c) => {
    try {
      return c.json({ data: await orderSvc.getOrderById({ ...context(c), id: c.req.param("id") }) });
    } catch (err) {
      return handleError(c, err, "No se pudo consultar la orden POS.");
    }
  });

  app.patch("/pos/orders/:id", requirePermission("pos.orders.update"), async (c) => {
    try {
      const data = await parseBody(c, updateOrderSchema);
      return c.json({ data: await orderSvc.updateOrder({ ...context(c), id: c.req.param("id"), data }) });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar la orden POS.");
    }
  });

  app.post("/pos/orders/:id/guests", requirePermission("pos.orders.update"), async (c) => {
    try {
      const data = await parseBody(c, createGuestSchema);
      return c.json({ data: await orderSvc.addGuest({ ...context(c), orderId: c.req.param("id"), data }) }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo agregar el comensal.");
    }
  });

  app.post("/pos/orders/:id/lines", requirePermission("pos.orders.update"), async (c) => {
    try {
      const data = await parseBody(c, addOrderLineSchema);
      return c.json({ data: await orderSvc.addOrderLine({ ...context(c), orderId: c.req.param("id"), data }) }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo agregar la linea.");
    }
  });

  app.patch("/pos/orders/:id/lines/:lineId", requirePermission("pos.orders.update"), async (c) => {
    try {
      const data = await parseBody(c, updateOrderLineSchema);
      return c.json({
        data: await orderSvc.updateOrderLine({
          ...context(c),
          orderId: c.req.param("id"),
          lineId: c.req.param("lineId"),
          data,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar la linea.");
    }
  });

  app.delete("/pos/orders/:id/lines/:lineId", requirePermission("pos.orders.update"), async (c) => {
    try {
      return c.json({
        data: await orderSvc.deleteOrderLine({
          ...context(c),
          orderId: c.req.param("id"),
          lineId: c.req.param("lineId"),
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo eliminar la linea.");
    }
  });

  app.post("/pos/orders/:id/send-to-kitchen", requirePermission("pos.orders.update"), async (c) => {
    try {
      return c.json({ data: await kitchenSvc.sendOrderToKitchen({ ...context(c), orderId: c.req.param("id") }) });
    } catch (err) {
      return handleError(c, err, "No se pudo enviar la orden a cocina.");
    }
  });

  app.post("/pos/orders/:id/payments", requirePermission("pos.payments.create"), async (c) => {
    try {
      const data = await parseBody(c, createPaymentSchema);
      return c.json({ data: await orderSvc.addPayment({ ...context(c), orderId: c.req.param("id"), data }) }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo registrar el pago.");
    }
  });

  app.post("/pos/orders/:id/cancel", requirePermission("pos.orders.cancel"), async (c) => {
    try {
      const data = await parseBody(c, cancelOrderSchema);
      return c.json({ data: await orderSvc.cancelOrder({ ...context(c), orderId: c.req.param("id"), reason: data.reason }) });
    } catch (err) {
      return handleError(c, err, "No se pudo cancelar la orden.");
    }
  });

  app.post("/pos/orders/:id/receipts/reprint", requirePermission("pos.orders.read"), async (c) => {
    try {
      return c.json({ data: await orderSvc.reprintReceipt({ ...context(c), orderId: c.req.param("id") }) });
    } catch (err) {
      return handleError(c, err, "No se pudo reimprimir el recibo.");
    }
  });

  app.get("/pos/floors", requirePermission("pos.floor.read"), async (c) => {
    try {
      return c.json({ data: await floorSvc.listFloors({ ...context(c), outletId: c.req.query("outletId") }) });
    } catch (err) {
      return handleError(c, err, "No se pudieron consultar los planos POS.");
    }
  });

  app.post("/pos/floors", requirePermission("pos.floor.manage"), async (c) => {
    try {
      const data = await parseBody(c, createFloorSchema);
      return c.json({ data: await floorSvc.createFloor({ ...context(c), data }) }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo crear el plano POS.");
    }
  });

  app.get("/pos/floors/:id", requirePermission("pos.floor.read"), async (c) => {
    try {
      return c.json({ data: await floorSvc.getFloorWithLayout({ ...context(c), id: c.req.param("id") }) });
    } catch (err) {
      return handleError(c, err, "No se pudo consultar el plano POS.");
    }
  });

  app.patch("/pos/floors/:id", requirePermission("pos.floor.manage"), async (c) => {
    try {
      const data = await parseBody(c, updateFloorSchema);
      return c.json({ data: await floorSvc.updateFloor({ ...context(c), id: c.req.param("id"), data }) });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar el plano POS.");
    }
  });

  app.post("/pos/floors/:id/publish", requirePermission("pos.floor.manage"), async (c) => {
    try {
      return c.json({ data: await floorSvc.publishFloor({ ...context(c), id: c.req.param("id") }) });
    } catch (err) {
      return handleError(c, err, "No se pudo publicar el plano POS.");
    }
  });

  app.put("/pos/floors/:id/layout", requirePermission("pos.floor.manage"), async (c) => {
    try {
      const data = await parseBody(c, saveLayoutSchema);
      return c.json({ data: await floorSvc.saveLayout({ ...context(c), id: c.req.param("id"), elements: data.elements }) });
    } catch (err) {
      return handleError(c, err, "No se pudo guardar el layout del plano POS.");
    }
  });

  app.post("/pos/tables", requirePermission("pos.floor.manage"), async (c) => {
    try {
      const data = await parseBody(c, createTableSchema);
      return c.json({ data: await floorSvc.createTable({ ...context(c), data }) }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo crear la mesa POS.");
    }
  });

  app.patch("/pos/tables/:tableId", requirePermission("pos.floor.manage"), async (c) => {
    try {
      const data = await parseBody(c, updateTableSchema);
      return c.json({ data: await floorSvc.updateTable({ ...context(c), tableId: c.req.param("tableId"), data }) });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar la mesa POS.");
    }
  });

  app.patch("/pos/tables/:tableId/status", requirePermission("pos.terminal.use"), async (c) => {
    try {
      const data = await parseBody(c, tableStatusUpdateSchema);
      return c.json({
        data: await floorSvc.updateTableStatus({ ...context(c), tableId: c.req.param("tableId"), status: data.status }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar el estado de la mesa.");
    }
  });

  app.get("/pos/tables/active-map", requirePermission("pos.terminal.use"), async (c) => {
    try {
      return c.json({ data: await floorSvc.getActiveMap({ ...context(c), outletId: c.req.query("outletId") }) });
    } catch (err) {
      return handleError(c, err, "No se pudo consultar el mapa activo.");
    }
  });

  app.get("/pos/stations", requirePermission("pos.stations.read"), async (c) => {
    try {
      return c.json({ data: await kitchenSvc.listStations({ ...context(c), outletId: c.req.query("outletId") }) });
    } catch (err) {
      return handleError(c, err, "No se pudieron consultar las estaciones POS.");
    }
  });

  app.post("/pos/stations", requirePermission("pos.stations.manage"), async (c) => {
    try {
      const data = await parseBody(c, createStationSchema);
      return c.json({ data: await kitchenSvc.createStation({ ...context(c), data }) }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo crear la estacion POS.");
    }
  });

  app.patch("/pos/stations/:id", requirePermission("pos.stations.manage"), async (c) => {
    try {
      const data = await parseBody(c, updateStationSchema);
      return c.json({ data: await kitchenSvc.updateStation({ ...context(c), stationId: c.req.param("id"), data }) });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar la estacion POS.");
    }
  });

  app.get("/pos/stations/:id/tickets", requirePermission("pos.stations.read"), async (c) => {
    try {
      return c.json({
        data: await kitchenSvc.listTickets({ ...context(c), stationId: c.req.param("id"), status: c.req.query("status") }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudieron consultar los tickets.");
    }
  });

  app.patch("/pos/kitchen/tickets/:ticketId/status", requirePermission("pos.stations.manage"), async (c) => {
    try {
      const data = await parseBody(c, kitchenStatusUpdateSchema);
      return c.json({
        data: await kitchenSvc.updateTicketStatus({ ...context(c), ticketId: c.req.param("ticketId"), status: data.status }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar el ticket.");
    }
  });

  app.patch("/pos/kitchen/tickets/:ticketId/lines/:lineId/status", requirePermission("pos.stations.manage"), async (c) => {
    try {
      const data = await parseBody(c, kitchenStatusUpdateSchema);
      return c.json({
        data: await kitchenSvc.updateTicketLineStatus({
          ...context(c),
          ticketId: c.req.param("ticketId"),
          lineId: c.req.param("lineId"),
          status: data.status,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar la linea de ticket.");
    }
  });

  // ── Payment Methods ────────────────────────────────────────────────────────
  app.get("/pos/payment-methods", requirePermission("pos.terminal.use"), async (c) => {
    try {
      return c.json({ data: await settingsSvc.listPaymentMethods(context(c)) });
    } catch (err) {
      return handleError(c, err, "No se pudieron obtener los métodos de pago.");
    }
  });

  app.post("/pos/payment-methods", requirePermission("pos.settings.manage"), async (c) => {
    try {
      const data = await parseBody(c, createPaymentMethodSchema);
      return c.json({ data: await settingsSvc.createPaymentMethod({ ...context(c), data }) }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo crear el método de pago.");
    }
  });

  app.patch("/pos/payment-methods/:id", requirePermission("pos.settings.manage"), async (c) => {
    try {
      const data = await parseBody(c, updatePaymentMethodSchema);
      return c.json({ data: await settingsSvc.updatePaymentMethod({ ...context(c), id: c.req.param("id"), data }) });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar el método de pago.");
    }
  });

  return app;
}
