import { Hono } from "hono";
import { createPosSettingsService } from "./pos-settings-service.js";
import { createPosSessionService } from "./pos-session-service.js";
import { createPosOrderService } from "./pos-order-service.js";
import { createPosFloorService } from "./pos-floor-service.js";
import { createPosKitchenService } from "./pos-kitchen-service.js";
import { createPosReservationService } from "./pos-reservation-service.js";
import { createPosWaiterShiftService } from "./pos-waiter-shift-service.js";
import { createPosModifierService } from "./pos-modifier-service.js";
import { getActorId, getCompanyId, PosServiceError } from "./service-helpers.js";
import {
  addOrderLineSchema,
  assignWaiterSchema,
  cancelOrderSchema,
  cashMovementSchema,
  closeSessionSchema,
  closeWaiterShiftSchema,
  createFloorSchema,
  createGuestSchema,
  createModifierGroupSchema,
  createModifierOptionSchema,
  createOrderSchema,
  createOutletSchema,
  createPaymentMethodSchema,
  createPaymentSchema,
  createStationSchema,
  createTableSchema,
  createTerminalSchema,
  kitchenStatusUpdateSchema,
  openSessionSchema,
  openWaiterShiftSchema,
  tableStatusUpdateSchema,
  saveLayoutSchema,
  updateFloorSchema,
  updateModifierGroupSchema,
  updateModifierOptionSchema,
  updateOrderLineSchema,
  updateOrderSchema,
  updateOutletSchema,
  updatePaymentMethodSchema,
  updateProductConfigSchema,
  updateSettingsSchema,
  updateStationSchema,
  updateTableSchema,
  updateTerminalSchema,
  createReservationSchema,
  updateReservationSchema,
  seatReservationSchema,
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

export function createPosRouter({ prisma, requirePermission, broadcaster = null }) {
  const app = new Hono();
  const settingsSvc = createPosSettingsService({ prisma });
  const sessionSvc = createPosSessionService({ prisma });
  const waiterShiftSvc = createPosWaiterShiftService({ prisma });
  const modifierSvc = createPosModifierService({ prisma });
  const orderSvc = createPosOrderService({ prisma, waiterShifts: waiterShiftSvc, modifiers: modifierSvc });
  const floorSvc = createPosFloorService({ prisma });
  const kitchenSvc = createPosKitchenService({ prisma });
  const reservationSvc = createPosReservationService({ prisma });

  function broadcastPosEvent(c, orderId, action) {
    const companyId = getCompanyId(c)
    if (!broadcaster || !companyId) return
    broadcaster.broadcastToCompany(companyId, 'pos.order.updated', {
      orderId: orderId ?? null,
      action,
    }).catch(() => {})
  }

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

  app.get("/pos/waiter-shifts", requirePermission("pos.caja.read"), async (c) => {
    try {
      return c.json({
        data: await waiterShiftSvc.listShifts({
          ...context(c),
          outletId: c.req.query("outletId") || undefined,
          status: c.req.query("status") || undefined,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudieron consultar los cortes de mesero.");
    }
  });

  app.get("/pos/waiter-shifts/current", requirePermission("pos.comandas.charge"), async (c) => {
    try {
      const ctx = context(c);
      return c.json({
        data: await waiterShiftSvc.getCurrentShift({
          companyId: ctx.companyId,
          outletId: c.req.query("outletId"),
          waiterId: ctx.actorId,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo consultar el corte actual.");
    }
  });

  app.post("/pos/waiter-shifts/open", requirePermission("pos.comandas.charge"), async (c) => {
    try {
      const ctx = context(c);
      const data = await parseBody(c, openWaiterShiftSchema);
      return c.json({
        data: await waiterShiftSvc.ensureOpenShift({
          companyId: ctx.companyId,
          outletId: data.outletId,
          waiterId: ctx.actorId,
        }),
      }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo abrir el corte de mesero.");
    }
  });

  app.post("/pos/waiter-shifts/:id/close", requirePermission("pos.caja.close"), async (c) => {
    try {
      const data = await parseBody(c, closeWaiterShiftSchema);
      return c.json({
        data: await waiterShiftSvc.closeShift({
          ...context(c),
          id: c.req.param("id"),
          data,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo cerrar el corte de mesero.");
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
      const result = await orderSvc.createOrder({ ...context(c), data })
      broadcastPosEvent(c, result?.id, 'created')
      return c.json({ data: result }, 201);
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
      const result = await orderSvc.updateOrder({ ...context(c), id: c.req.param("id"), data })
      broadcastPosEvent(c, c.req.param("id"), 'updated')
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar la orden POS.");
    }
  });

  app.patch("/pos/orders/:id/waiter", requirePermission("pos.orders.update"), async (c) => {
    try {
      const data = await parseBody(c, assignWaiterSchema);
      const order = await orderSvc.assignOrderWaiter({
        ...context(c),
        id: c.req.param("id"),
        waiterId: data.waiterId ?? null,
      });
      broadcastPosEvent(c, order.id, "waiter.assign");
      return c.json({ data: order });
    } catch (err) {
      return handleError(c, err, "No se pudo asignar el mesero a la orden.");
    }
  });

  app.get("/pos/orders/:id/seat-totals", requirePermission("pos.terminal.use"), async (c) => {
    try {
      const data = await orderSvc.getSeatTotals({ ...context(c), id: c.req.param("id") });
      return c.json({ data });
    } catch (err) {
      return handleError(c, err, "No se pudieron calcular los totales por comensal.");
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
      const result = await orderSvc.addOrderLine({ ...context(c), orderId: c.req.param("id"), data })
      broadcastPosEvent(c, c.req.param("id"), 'line_added')
      return c.json({ data: result }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo agregar la linea.");
    }
  });

  app.patch("/pos/orders/:id/lines/:lineId", requirePermission("pos.orders.update"), async (c) => {
    try {
      const data = await parseBody(c, updateOrderLineSchema);
      const result = await orderSvc.updateOrderLine({
        ...context(c),
        orderId: c.req.param("id"),
        lineId: c.req.param("lineId"),
        data,
      })
      broadcastPosEvent(c, c.req.param("id"), 'line_updated')
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar la linea.");
    }
  });

  app.delete("/pos/orders/:id/lines/:lineId", requirePermission("pos.orders.update"), async (c) => {
    try {
      const result = await orderSvc.deleteOrderLine({
        ...context(c),
        orderId: c.req.param("id"),
        lineId: c.req.param("lineId"),
      })
      broadcastPosEvent(c, c.req.param("id"), 'line_deleted')
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "No se pudo eliminar la linea.");
    }
  });

  app.post("/pos/orders/:id/send-to-kitchen", requirePermission("pos.orders.update"), async (c) => {
    try {
      const result = await kitchenSvc.sendOrderToKitchen({ ...context(c), orderId: c.req.param("id") })
      broadcastPosEvent(c, c.req.param("id"), 'sent_to_kitchen')
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err, "No se pudo enviar la orden a cocina.");
    }
  });

  app.post("/pos/orders/:id/payments", requirePermission("pos.payments.create"), async (c) => {
    try {
      const data = await parseBody(c, createPaymentSchema);
      const result = await orderSvc.addPayment({ ...context(c), orderId: c.req.param("id"), data })
      broadcastPosEvent(c, c.req.param("id"), 'payment_added')
      return c.json({ data: result }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo registrar el pago.");
    }
  });

  app.post("/pos/orders/:id/cancel", requirePermission("pos.orders.cancel"), async (c) => {
    try {
      const data = await parseBody(c, cancelOrderSchema);
      const result = await orderSvc.cancelOrder({ ...context(c), orderId: c.req.param("id"), reason: data.reason })
      broadcastPosEvent(c, c.req.param("id"), 'cancelled')
      return c.json({ data: result });
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
      return c.json({
        data: await floorSvc.getFloorWithLayout({
          ...context(c),
          id: c.req.param("id"),
          myTablesOnly: c.req.query("myTablesOnly") === "true",
        }),
      });
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

  app.patch("/pos/tables/:tableId/waiter", requirePermission("pos.terminal.use"), async (c) => {
    try {
      const data = await parseBody(c, assignWaiterSchema);
      const table = await floorSvc.updateTableWaiter({
        ...context(c),
        tableId: c.req.param("tableId"),
        waiterId: data.waiterId ?? null,
      });
      return c.json({ data: table });
    } catch (err) {
      return handleError(c, err, "No se pudo asignar el mesero a la mesa.");
    }
  });

  app.get("/pos/tables/active-map", requirePermission("pos.terminal.use"), async (c) => {
    try {
      return c.json({
        data: await floorSvc.getActiveMap({
          ...context(c),
          outletId: c.req.query("outletId"),
          myTablesOnly: c.req.query("myTablesOnly") === "true",
        }),
      });
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

  // ── Reservations ───────────────────────────────────────────────────────────
  app.get("/pos/reservations", requirePermission("pos.orders.read"), async (c) => {
    try {
      const { outletId, date, status } = c.req.query();
      return c.json({
        data: await reservationSvc.listReservations({ ...context(c), outletId, date, status }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudieron consultar las reservaciones.");
    }
  });

  app.post("/pos/reservations", requirePermission("pos.orders.create"), async (c) => {
    try {
      const data = await parseBody(c, createReservationSchema);
      return c.json({ data: await reservationSvc.createReservation({ ...context(c), data }) }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo crear la reservación.");
    }
  });

  app.get("/pos/reservations/:id", requirePermission("pos.orders.read"), async (c) => {
    try {
      return c.json({
        data: await reservationSvc.getReservation({ ...context(c), id: c.req.param("id") }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo consultar la reservación.");
    }
  });

  app.patch("/pos/reservations/:id", requirePermission("pos.orders.update"), async (c) => {
    try {
      const data = await parseBody(c, updateReservationSchema);
      return c.json({
        data: await reservationSvc.updateReservation({ ...context(c), id: c.req.param("id"), data }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar la reservación.");
    }
  });

  app.post("/pos/reservations/:id/seat", requirePermission("pos.orders.create"), async (c) => {
    try {
      const data = await parseBody(c, seatReservationSchema);
      return c.json({
        data: await reservationSvc.seatReservation({
          ...context(c),
          id: c.req.param("id"),
          sessionId: data.sessionId,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo sentar la reservación.");
    }
  });

  // ── Modifiers ──────────────────────────────────────────────────────────────
  app.get("/pos/modifier-groups", requirePermission("pos.orders.read"), async (c) => {
    try {
      const productIds = (c.req.query("productIds") ?? "").split(",").filter(Boolean);
      return c.json({ data: await modifierSvc.listByProducts({ ...context(c), productIds }) });
    } catch (err) {
      return handleError(c, err, "No se pudieron consultar los modificadores.");
    }
  });

  app.get("/pos/products/:productId/modifier-groups", requirePermission("pos.orders.read"), async (c) => {
    try {
      return c.json({
        data: await modifierSvc.listForProduct({
          ...context(c),
          productId: c.req.param("productId"),
          includeDisabled: c.req.query("includeDisabled") === "true",
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudieron consultar los modificadores.");
    }
  });

  app.post("/pos/products/:productId/modifier-groups", requirePermission("pos.admin.update"), async (c) => {
    try {
      const data = await parseBody(c, createModifierGroupSchema);
      return c.json({
        data: await modifierSvc.createGroup({ ...context(c), productId: c.req.param("productId"), data }),
      }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo crear el grupo de modificadores.");
    }
  });

  app.patch("/pos/modifier-groups/:id", requirePermission("pos.admin.update"), async (c) => {
    try {
      const data = await parseBody(c, updateModifierGroupSchema);
      return c.json({ data: await modifierSvc.updateGroup({ ...context(c), id: c.req.param("id"), data }) });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar el grupo de modificadores.");
    }
  });

  app.post("/pos/modifier-groups/:id/options", requirePermission("pos.admin.update"), async (c) => {
    try {
      const data = await parseBody(c, createModifierOptionSchema);
      return c.json({
        data: await modifierSvc.createOption({ ...context(c), groupId: c.req.param("id"), data }),
      }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo crear la opción de modificador.");
    }
  });

  app.patch("/pos/modifier-options/:id", requirePermission("pos.admin.update"), async (c) => {
    try {
      const data = await parseBody(c, updateModifierOptionSchema);
      return c.json({ data: await modifierSvc.updateOption({ ...context(c), id: c.req.param("id"), data }) });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar la opción de modificador.");
    }
  });

  // ── Product Config ─────────────────────────────────────────────────────────
  app.get("/pos/product-configs", requirePermission("pos.admin.read"), async (c) => {
    try {
      return c.json({ data: await kitchenSvc.listProductConfigs(context(c)) });
    } catch (err) {
      return handleError(c, err, "No se pudieron consultar las configuraciones de productos.");
    }
  });

  app.put("/pos/products/:productId/config", requirePermission("pos.admin.update"), async (c) => {
    try {
      const data = await parseBody(c, updateProductConfigSchema);
      return c.json({
        data: await kitchenSvc.updateProductConfig({ ...context(c), productId: c.req.param("productId"), data }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar la configuración del producto.");
    }
  });

  return app;
}
