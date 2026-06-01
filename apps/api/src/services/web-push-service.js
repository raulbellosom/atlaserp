import { z } from "zod";
import webpush from "web-push";
import { decryptPassword, encryptPassword } from "./smtp-service.js";

const VAPID_CONFIG_KEYS = {
  subject: "notifications.webpush.vapid.subject",
  publicKey: "notifications.webpush.vapid.public_key",
  privateKey: "notifications.webpush.vapid.private_key",
};

const vapidSubjectSchema = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine(
    (value) => value.startsWith("mailto:") || /^https?:\/\//i.test(value),
    'El subject VAPID debe ser URL (https://...) o "mailto:".',
  );

const vapidConfigSchema = z.object({
  subject: vapidSubjectSchema,
  publicKey: z.string().trim().min(1).max(300),
  privateKey: z.string().trim().min(1).max(300),
});

function asErrorMessage(err) {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function isPermanentSubscriptionError(err) {
  const status = Number(err?.statusCode ?? err?.status ?? 0);
  if (status === 404 || status === 410) return true;
  return false;
}

export function buildPushPayload({ notification }) {
  const title = notification?.title ?? "Atlas Notifications";
  const body = notification?.body ?? "";
  const link = notification?.link ?? "/app/m/atlas.notifications";
  return {
    title,
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: {
      link,
      notificationId: notification?.id ?? null,
      eventType: notification?.eventType ?? null,
      priority: notification?.priority ?? "medium",
    },
    tag: notification?.id ?? undefined,
  };
}

export function createWebPushService({ prisma, webPushLib = webpush }) {
  async function getConfigRows() {
    return prisma.instanceConfig.findMany({
      where: {
        key: {
          in: [
            VAPID_CONFIG_KEYS.subject,
            VAPID_CONFIG_KEYS.publicKey,
            VAPID_CONFIG_KEYS.privateKey,
          ],
        },
      },
    });
  }

  async function getVapidConfig({ includePrivate = false } = {}) {
    const rows = await getConfigRows();
    const cfg = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    const encryptedPrivateKey = cfg[VAPID_CONFIG_KEYS.privateKey] ?? null;
    const privateKey = encryptedPrivateKey
      ? decryptPassword(encryptedPrivateKey)
      : null;
    const configured = Boolean(
      cfg[VAPID_CONFIG_KEYS.subject] &&
        cfg[VAPID_CONFIG_KEYS.publicKey] &&
        privateKey,
    );

    return {
      configured,
      subject: cfg[VAPID_CONFIG_KEYS.subject] ?? "",
      publicKey: cfg[VAPID_CONFIG_KEYS.publicKey] ?? "",
      ...(includePrivate ? { privateKey: privateKey ?? "" } : {}),
    };
  }

  async function saveVapidConfig(input) {
    const data = vapidConfigSchema.parse(input ?? {});
    const entries = [
      { key: VAPID_CONFIG_KEYS.subject, value: data.subject },
      { key: VAPID_CONFIG_KEYS.publicKey, value: data.publicKey },
      {
        key: VAPID_CONFIG_KEYS.privateKey,
        value: encryptPassword(data.privateKey),
      },
    ];
    await Promise.all(
      entries.map((entry) =>
        prisma.instanceConfig.upsert({
          where: { key: entry.key },
          create: { key: entry.key, value: entry.value },
          update: { value: entry.value },
        }),
      ),
    );
    return getVapidConfig();
  }

  async function clearVapidConfig() {
    await prisma.instanceConfig.deleteMany({
      where: {
        key: {
          in: [
            VAPID_CONFIG_KEYS.subject,
            VAPID_CONFIG_KEYS.publicKey,
            VAPID_CONFIG_KEYS.privateKey,
          ],
        },
      },
    });
    return { configured: false, subject: "", publicKey: "" };
  }

  function generateVapidKeys() {
    return webPushLib.generateVAPIDKeys();
  }

  async function sendToSubscription({ subscription, payload }) {
    const config = await getVapidConfig({ includePrivate: true });
    if (!config.configured) {
      throw new Error("Web push no configurado en la plataforma.");
    }

    webPushLib.setVapidDetails(
      config.subject,
      config.publicKey,
      config.privateKey,
    );

    try {
      await webPushLib.sendNotification(subscription, JSON.stringify(payload), {
        TTL: 60,
        urgency: "normal",
      });
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        statusCode: Number(err?.statusCode ?? err?.status ?? 0) || null,
        permanentFailure: isPermanentSubscriptionError(err),
        error: asErrorMessage(err),
      };
    }
  }

  return {
    getVapidConfig,
    saveVapidConfig,
    clearVapidConfig,
    generateVapidKeys,
    sendToSubscription,
    buildPushPayload,
  };
}

export { VAPID_CONFIG_KEYS, vapidConfigSchema, vapidSubjectSchema };
