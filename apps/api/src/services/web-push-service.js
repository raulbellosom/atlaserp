import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { z } from "zod";
import webpush from "web-push";
import { decryptPassword, encryptPassword } from "./smtp-service.js";

// VAPID keys use the Supabase service role key as the derivation secret because
// it is more stable than JWT_SECRET (Supabase infra sets it once and never changes it).
// Fallback: if SERVICE_ROLE_KEY is absent, derive from JWT_SECRET.
const VAPID_CIPHER = 'aes-256-gcm';
const VAPID_SALT = 'atlas-vapid-v2';

function deriveVapidKey() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.JWT_SECRET;
  if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY or JWT_SECRET is required');
  return scryptSync(secret, VAPID_SALT, 32);
}

function encryptVapid(plaintext) {
  const key = deriveVapidKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(VAPID_CIPHER, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptVapid(ciphertext) {
  const key = deriveVapidKey();
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv(VAPID_CIPHER, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

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
  // 404/410: subscription gone. 401: VAPID key mismatch — subscription invalid with current keys.
  if (status === 401 || status === 404 || status === 410) return true;
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
    let privateKey = null;
    if (encryptedPrivateKey) {
      try {
        // Try new stable key (SUPABASE_SERVICE_ROLE_KEY-derived) first.
        privateKey = decryptVapid(encryptedPrivateKey);
      } catch {
        try {
          // Backward compat: keys saved before this fix were encrypted with JWT_SECRET.
          privateKey = decryptPassword(encryptedPrivateKey);
        } catch (e2) {
          console.warn('[web-push] VAPID private key decryption failed — re-save keys from Settings > Web Push.', e2?.message);
          privateKey = null;
        }
      }
    }
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

    // Check if the public key is changing — if so, all existing browser push
    // subscriptions were registered with the old applicationServerKey and will
    // be rejected by the push service. Delete them so they stop retrying.
    const existing = await getVapidConfig();
    const publicKeyChanged = existing.configured && existing.publicKey !== data.publicKey;

    const entries = [
      { key: VAPID_CONFIG_KEYS.subject, value: data.subject },
      { key: VAPID_CONFIG_KEYS.publicKey, value: data.publicKey },
      {
        key: VAPID_CONFIG_KEYS.privateKey,
        value: encryptVapid(data.privateKey),
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

    if (publicKeyChanged) {
      // Remove stale subscriptions and queued deliveries — both are now invalid
      // because the new applicationServerKey won't match what browsers subscribed with.
      await prisma.pushSubscription.deleteMany({}).catch(() => {});
      await prisma.notificationDelivery.deleteMany({
        where: { channel: 'web_push', status: { in: ['queued', 'failed'] } },
      }).catch(() => {});
      console.log('[web-push] VAPID public key changed — all push subscriptions and pending deliveries cleared. Users must re-subscribe.');
    }

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
      const statusCode = Number(err?.statusCode ?? err?.status ?? 0) || null;
      const baseMsg = asErrorMessage(err);
      const error = statusCode ? `${baseMsg} (HTTP ${statusCode})` : baseMsg;
      return {
        ok: false,
        statusCode,
        permanentFailure: isPermanentSubscriptionError(err),
        error,
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
