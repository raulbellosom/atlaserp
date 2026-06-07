import { createSmtpService } from "./smtp-service.js";
import { createWebPushService } from "./web-push-service.js";

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BATCH_SIZE = 25;

function asErrorMessage(err) {
  if (err instanceof Error) return err.message;
  return String(err);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeBaseUrl(value) {
  if (!value || typeof value !== "string") return null;
  const input = value.trim();
  if (!input) return null;
  try {
    const parsed = new URL(input);
    if (!/^https?:$/i.test(parsed.protocol)) return null;
    parsed.pathname = "/";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

async function resolveAppBaseUrl({ prisma }) {
  const envCandidates = [
    process.env.ATLAS_APP_URL,
    process.env.APP_URL,
    process.env.PUBLIC_APP_URL,
    process.env.WEB_APP_URL,
  ];
  for (const candidate of envCandidates) {
    const normalized = normalizeBaseUrl(candidate);
    if (normalized) return normalized;
  }

  if (prisma?.instanceConfig?.findMany) {
    try {
      const cfg = await prisma.instanceConfig.findMany({
        where: {
          key: {
            in: ["app.url", "app.public_url", "platform.public_url"],
          },
        },
        select: { key: true, value: true },
      });
      for (const row of cfg) {
        const normalized = normalizeBaseUrl(row?.value);
        if (normalized) return normalized;
      }
    } catch {
      // Ignore config lookup failures and continue with fallbacks.
    }
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:5173";
  }
  return null;
}

function toAbsoluteLink(link, appBaseUrl) {
  if (!link || typeof link !== "string") return null;
  const value = link.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (!appBaseUrl) return value;
  try {
    return new URL(value, `${appBaseUrl}/`).toString();
  } catch {
    return value;
  }
}

function formatDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function reminderLeadText(minutesBefore) {
  const minutes = Number(minutesBefore);
  if (!Number.isFinite(minutes)) return null;
  if (minutes === 0) return "A la hora del evento";
  if (minutes === 60) return "1 hora antes";
  return `${minutes} minutos antes`;
}

const EVENT_TYPE_LABELS = {
  "calendar.event.reminder": "Recordatorio de evento",
  "calendar.event.created": "Evento creado",
  "calendar.event.updated": "Evento actualizado",
  "calendar.event.deleted": "Evento eliminado",
  "general": "General",
};

const PRIORITY_LABELS = {
  critical: "Critica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const SOURCE_TYPE_LABELS = {
  CalendarEvent: "Evento de calendario",
  Contact: "Contacto",
  HrEmployee: "Empleado",
  FileAsset: "Archivo",
  Company: "Empresa",
  Invoice: "Factura",
  FinanceDocument: "Documento financiero",
};

function buildNotificationEmail({ notification, appBaseUrl }) {
  const title = notification?.title ?? "Notificacion de Atlas";
  const body = notification?.body ?? "";
  const link = toAbsoluteLink(notification?.link ?? null, appBaseUrl);
  const logoUrl = appBaseUrl
    ? toAbsoluteLink("/brand/atlas-logo-horizontal.png", appBaseUrl)
    : null;
  const createdAt = formatDateTime(notification?.createdAt);
  const eventStart = formatDateTime(notification?.metadata?.startAt);
  const reminderLead = reminderLeadText(notification?.metadata?.minutesBefore);
  const titleEsc = escapeHtml(title);
  const bodyEsc = escapeHtml(body);
  const rawEventType = notification?.eventType ?? "general";
  const eventTypeEsc = escapeHtml(EVENT_TYPE_LABELS[rawEventType] ?? rawEventType);
  const rawPriority = notification?.priority ?? "medium";
  const priorityEsc = escapeHtml(PRIORITY_LABELS[rawPriority] ?? rawPriority);

  const details = [
    createdAt ? `Generado: ${createdAt}` : null,
    eventStart ? `Evento: ${eventStart}` : null,
    reminderLead ? `Recordatorio: ${reminderLead}` : null,
    notification?.sourceType
      ? `Origen: ${SOURCE_TYPE_LABELS[notification.sourceType] ?? notification.sourceType}`
      : null,
  ].filter(Boolean);

  const html = `
<div style="background:#f3f4f6;padding:24px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#111827">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden">
    <tr>
      <td style="padding:20px 24px;border-bottom:1px solid #eef2ff;background:#f8fafc">
        ${logoUrl ? `<img src="${logoUrl}" alt="Atlas ERP" style="height:26px;display:block;margin-bottom:10px" />` : ""}
        <div style="font-size:12px;color:#6b7280;letter-spacing:.06em;text-transform:uppercase">Notificaciones Atlas</div>
        <h1 style="margin:6px 0 0 0;font-size:24px;line-height:1.25;color:#0f172a">${titleEsc}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 24px">
        ${body ? `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#334155">${bodyEsc}</p>` : ""}
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px 0;border:1px solid #e5e7eb;border-radius:10px">
          <tr><td style="padding:10px 12px;font-size:13px;color:#475569"><strong style="color:#111827">Tipo:</strong> ${eventTypeEsc}</td></tr>
          <tr><td style="padding:10px 12px;border-top:1px solid #e5e7eb;font-size:13px;color:#475569"><strong style="color:#111827">Prioridad:</strong> ${priorityEsc}</td></tr>
          ${
            details.length
              ? `<tr><td style="padding:10px 12px;border-top:1px solid #e5e7eb;font-size:13px;color:#475569">${details
                  .map((line) => `<div>${escapeHtml(line)}</div>`)
                  .join("")}</td></tr>`
              : ""
          }
        </table>
        ${
          link
            ? `<a href="${link}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:10px;font-size:14px;font-weight:600">Abrir notificacion</a>`
            : ""
        }
      </td>
    </tr>
    <tr>
      <td style="padding:14px 24px;border-top:1px solid #e5e7eb;background:#f8fafc;font-size:12px;color:#64748b">
        Este correo fue generado automaticamente por Atlas ERP.
      </td>
    </tr>
  </table>
</div>
  `.trim();

  const text = [
    `Atlas ERP`,
    "",
    title,
    body ? body : null,
    details.length ? details.join("\n") : null,
    link ? `Abrir: ${link}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject: title, html, text };
}

export function createNotificationDeliveryWorker({
  prisma,
  smtpService = null,
  webPushService = null,
  logger = console,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
}) {
  const smtp = smtpService ?? createSmtpService({ prisma });
  const webPush = webPushService ?? createWebPushService({ prisma });

  async function processPendingNotificationDeliveries({
    channel = "email",
    limit = DEFAULT_BATCH_SIZE,
  } = {}) {
    const appBaseUrl = await resolveAppBaseUrl({ prisma });
    const rows = await prisma.notificationDelivery.findMany({
      where: {
        channel,
        status: "queued",
        attempts: { lt: maxAttempts },
      },
      include: {
        notification: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: "asc" }],
      take: Math.min(Math.max(Number(limit) || DEFAULT_BATCH_SIZE, 1), 200),
    });

    let processed = 0;
    let sent = 0;
    let failed = 0;
    let retrying = 0;

    for (const delivery of rows) {
      processed += 1;
      const attempts = (delivery.attempts ?? 0) + 1;
      const recipientEmail = delivery.notification?.user?.email ?? null;

      try {
        if (channel === "email") {
          if (!recipientEmail) {
            throw new Error("Destinatario sin correo electronico.");
          }
          const mail = buildNotificationEmail({
            notification: delivery.notification,
            appBaseUrl,
          });
          await smtp.sendEmail({
            to: recipientEmail,
            subject: mail.subject,
            html: mail.html,
            text: mail.text,
          });
        } else if (channel === "web_push") {
          const subscriptions = await prisma.pushSubscription.findMany({
            where: {
              userId: delivery.notification?.userId,
              enabled: true,
            },
            select: {
              id: true,
              endpoint: true,
              p256dh: true,
              auth: true,
            },
          });
          if (!subscriptions.length) {
            throw new Error("Destinatario sin suscripciones push activas.");
          }

          const payload = webPush.buildPushPayload({
            notification: delivery.notification,
          });
          let successfulDeliveries = 0;
          const errors = [];
          for (const subscription of subscriptions) {
            const result = await webPush.sendToSubscription({
              subscription: {
                endpoint: subscription.endpoint,
                keys: {
                  p256dh: subscription.p256dh,
                  auth: subscription.auth,
                },
              },
              payload,
            });
            if (result.ok) {
              successfulDeliveries += 1;
              continue;
            }
            errors.push(result.error ?? "Envio fallido.");
            if (result.permanentFailure) {
              await prisma.pushSubscription.update({
                where: { id: subscription.id },
                data: { enabled: false },
              });
            }
          }
          if (successfulDeliveries === 0) {
            throw new Error(errors.join(" | "));
          }
        }

        await prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "sent",
            attempts,
            sentAt: new Date(),
            lastError: null,
          },
        });
        sent += 1;
      } catch (err) {
        const errorMessage = asErrorMessage(err);
        const exhausted = attempts >= maxAttempts;
        await prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: exhausted ? "failed" : "queued",
            attempts,
            lastError: errorMessage.slice(0, 1000),
          },
        });
        if (exhausted) failed += 1;
        else retrying += 1;
        logger?.warn?.(
          `[notification-delivery] ${delivery.id} ${exhausted ? "failed" : "retry"}: ${errorMessage}`,
        );
      }
    }

    return {
      channel,
      processed,
      sent,
      failed,
      retrying,
      maxAttempts,
    };
  }

  return {
    processPendingNotificationDeliveries,
  };
}
