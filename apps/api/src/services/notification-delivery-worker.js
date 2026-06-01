import { createSmtpService } from "./smtp-service.js";
import { createWebPushService } from "./web-push-service.js";

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BATCH_SIZE = 25;

function asErrorMessage(err) {
  if (err instanceof Error) return err.message;
  return String(err);
}

function buildNotificationEmail({ notification }) {
  const title = notification?.title ?? "Notificacion de Atlas";
  const body = notification?.body ?? "";
  const link = notification?.link ?? null;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2 style="margin:0 0 8px 0;">${title}</h2>
      ${body ? `<p style="margin:0 0 12px 0;">${body}</p>` : ""}
      ${link ? `<p style="margin:0;"><a href="${link}">Abrir notificacion</a></p>` : ""}
    </div>
  `;
  const text = [title, body, link ? `Abrir: ${link}` : ""]
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
