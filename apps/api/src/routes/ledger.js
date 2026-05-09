import { Hono } from "hono";
import { Readable } from "stream";
import {
  createLedgerAccountSchema,
  updateLedgerAccountSchema,
  createLedgerMovementSchema,
  cancelLedgerMovementSchema,
  ledgerMovementQuerySchema,
} from "@atlas/validators";
import { createLedgerService, LedgerServiceError } from "../services/ledger-service.js";
import { buildExcelBuffer, buildPdfStream } from "../services/ledger-export-service.js";

function createLedgerRouter({ prisma, authMiddleware, requirePermission }) {
  const app = new Hono();
  const svc = createLedgerService({ prisma });

  function handleError(c, err, fallback) {
    if (err instanceof LedgerServiceError) return c.json({ error: err.message }, err.status);
    console.error("[ledger]", err);
    return c.json({ error: fallback }, 500);
  }

  function parseQuery(c) {
    const raw = c.req.query();
    return ledgerMovementQuerySchema.parse(raw);
  }

  // ---------- Accounts ----------

  app.get("/accounts", authMiddleware, requirePermission("ledger.accounts.read"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const { enabled, search } = c.req.query();
      const data = await svc.listAccounts({
        authUserId,
        enabled: enabled !== undefined ? enabled === "true" : true,
        search,
      });
      return c.json({ data });
    } catch (err) {
      return handleError(c, err, "No se pudieron cargar las cuentas.");
    }
  });

  app.post("/accounts", authMiddleware, requirePermission("ledger.accounts.create"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const parsed = createLedgerAccountSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: parsed.error.errors[0]?.message ?? "Datos invalidos." }, 400);
      const data = await svc.createAccount({ authUserId, payload: parsed.data });
      return c.json({ data }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo crear la cuenta.");
    }
  });

  app.get("/accounts/:id", authMiddleware, requirePermission("ledger.accounts.read"), async (c) => {
    try {
      const data = await svc.getAccount({ authUserId: c.get("authUserId"), id: c.req.param("id") });
      return c.json({ data });
    } catch (err) {
      return handleError(c, err, "No se pudo cargar la cuenta.");
    }
  });

  app.put("/accounts/:id", authMiddleware, requirePermission("ledger.accounts.update"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const parsed = updateLedgerAccountSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: parsed.error.errors[0]?.message ?? "Datos invalidos." }, 400);
      const data = await svc.updateAccount({ authUserId, id: c.req.param("id"), payload: parsed.data });
      return c.json({ data });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar la cuenta.");
    }
  });

  app.patch("/accounts/:id/enabled", authMiddleware, requirePermission("ledger.accounts.delete"), async (c) => {
    try {
      const { enabled } = await c.req.json();
      if (typeof enabled !== "boolean") return c.json({ error: "El campo enabled es obligatorio." }, 400);
      const data = await svc.setAccountEnabled({ authUserId: c.get("authUserId"), id: c.req.param("id"), enabled });
      return c.json({ data });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar el estado de la cuenta.");
    }
  });

  // ---------- Movements (per account) ----------

  app.get("/accounts/:id/movements", authMiddleware, requirePermission("ledger.movements.read"), async (c) => {
    try {
      const filters = parseQuery(c);
      const data = await svc.listAccountMovements({
        authUserId: c.get("authUserId"),
        accountId: c.req.param("id"),
        filters,
      });
      return c.json({ data });
    } catch (err) {
      return handleError(c, err, "No se pudieron cargar los movimientos.");
    }
  });

  app.post("/accounts/:id/movements", authMiddleware, requirePermission("ledger.movements.create"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const parsed = createLedgerMovementSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: parsed.error.errors[0]?.message ?? "Datos invalidos." }, 400);
      const data = await svc.createMovement({
        authUserId,
        accountId: c.req.param("id"),
        payload: parsed.data,
      });
      return c.json({ data }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo registrar el movimiento.");
    }
  });

  // ---------- Export (per account) ----------

  app.get("/accounts/:id/export/excel", authMiddleware, requirePermission("ledger.reports.export"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const filters = parseQuery(c);
      const result = await svc.getMovementsForExport({ authUserId, accountId: c.req.param("id"), filters });
      const companyProfile = await prisma.company.findFirst({
        where: { memberships: { some: {} } },
        select: { name: true },
      });
      const buffer = await buildExcelBuffer({
        ...result,
        companyName: companyProfile?.name,
        dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : null,
        dateTo: filters.dateTo ? new Date(filters.dateTo) : null,
      });
      const filename = `cuenta-${result.account?.name ?? "movimientos"}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      c.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      c.header("Content-Disposition", `attachment; filename="${filename}"`);
      c.header("X-Atlas-Export-Count", String(result.movements.length));
      return c.body(buffer);
    } catch (err) {
      return handleError(c, err, "No se pudo generar el archivo Excel.");
    }
  });

  app.get("/accounts/:id/export/pdf", authMiddleware, requirePermission("ledger.reports.export"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const filters = parseQuery(c);
      const result = await svc.getMovementsForExport({ authUserId, accountId: c.req.param("id"), filters });
      const companyProfile = await prisma.company.findFirst({ select: { name: true } });
      const pdfStream = buildPdfStream({
        ...result,
        companyName: companyProfile?.name,
        dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : null,
        dateTo: filters.dateTo ? new Date(filters.dateTo) : null,
      });
      const filename = `cuenta-${result.account?.name ?? "movimientos"}-${new Date().toISOString().slice(0, 10)}.pdf`;
      c.header("Content-Type", "application/pdf");
      c.header("Content-Disposition", `attachment; filename="${filename}"`);
      c.header("X-Atlas-Export-Count", String(result.movements.length));
      return c.body(Readable.toWeb(pdfStream));
    } catch (err) {
      return handleError(c, err, "No se pudo generar el PDF.");
    }
  });

  // ---------- Movements (global) ----------

  app.get("/movements", authMiddleware, requirePermission("ledger.movements.read"), async (c) => {
    try {
      const filters = parseQuery(c);
      const data = await svc.listAllMovements({ authUserId: c.get("authUserId"), filters });
      return c.json({ data });
    } catch (err) {
      return handleError(c, err, "No se pudieron cargar los movimientos.");
    }
  });

  app.post("/movements/:id/cancel", authMiddleware, requirePermission("ledger.movements.cancel"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const parsed = cancelLedgerMovementSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: parsed.error.errors[0]?.message ?? "Motivo invalido." }, 400);
      const data = await svc.cancelMovement({
        authUserId,
        movementId: c.req.param("id"),
        reason: parsed.data.reason,
      });
      return c.json({ data });
    } catch (err) {
      return handleError(c, err, "No se pudo cancelar el movimiento.");
    }
  });

  // ---------- Export (global) ----------

  app.get("/movements/export/excel", authMiddleware, requirePermission("ledger.reports.export"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const filters = parseQuery(c);
      const result = await svc.getMovementsForExport({ authUserId, accountId: null, filters });
      const companyProfile = await prisma.company.findFirst({ select: { name: true } });
      const buffer = await buildExcelBuffer({
        ...result,
        companyName: companyProfile?.name,
        dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : null,
        dateTo: filters.dateTo ? new Date(filters.dateTo) : null,
      });
      const filename = `movimientos-${new Date().toISOString().slice(0, 10)}.xlsx`;
      c.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      c.header("Content-Disposition", `attachment; filename="${filename}"`);
      c.header("X-Atlas-Export-Count", String(result.movements.length));
      return c.body(buffer);
    } catch (err) {
      return handleError(c, err, "No se pudo generar el archivo Excel.");
    }
  });

  app.get("/movements/export/pdf", authMiddleware, requirePermission("ledger.reports.export"), async (c) => {
    try {
      const authUserId = c.get("authUserId");
      const filters = parseQuery(c);
      const result = await svc.getMovementsForExport({ authUserId, accountId: null, filters });
      const companyProfile = await prisma.company.findFirst({ select: { name: true } });
      const pdfStream = buildPdfStream({
        ...result,
        companyName: companyProfile?.name,
        dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : null,
        dateTo: filters.dateTo ? new Date(filters.dateTo) : null,
      });
      const filename = `movimientos-${new Date().toISOString().slice(0, 10)}.pdf`;
      c.header("Content-Type", "application/pdf");
      c.header("Content-Disposition", `attachment; filename="${filename}"`);
      c.header("X-Atlas-Export-Count", String(result.movements.length));
      return c.body(Readable.toWeb(pdfStream));
    } catch (err) {
      return handleError(c, err, "No se pudo generar el PDF.");
    }
  });

  // ---------- Summary / Reports ----------

  app.get("/summary", authMiddleware, requirePermission("ledger.accounts.read"), async (c) => {
    try {
      const data = await svc.getSummary({ authUserId: c.get("authUserId") });
      return c.json({ data });
    } catch (err) {
      return handleError(c, err, "No se pudo cargar el resumen.");
    }
  });

  app.get("/reports/summary", authMiddleware, requirePermission("ledger.reports.read"), async (c) => {
    try {
      const filters = parseQuery(c);
      const data = await svc.getReportSummary({ authUserId: c.get("authUserId"), filters });
      return c.json({ data });
    } catch (err) {
      return handleError(c, err, "No se pudo cargar el resumen del reporte.");
    }
  });

  return app;
}

export { createLedgerRouter };
