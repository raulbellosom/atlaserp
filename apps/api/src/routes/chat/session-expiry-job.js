import crypto from "node:crypto";
import { createSmtpService } from "../../services/smtp-service.js";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ------------------------------------------------------------------
// Send expiry notification email to a guest
// ------------------------------------------------------------------
async function sendExpiryEmail(smtp, { guestEmail, guestName, companyName, resumeUrl }) {
  const name = guestName ?? guestEmail ?? "Visitante";
  const subject = `Tu conversacion con ${companyName} ha expirado`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#222;">
      <h2 style="font-size:18px;margin-bottom:8px;">Hola, ${name}</h2>
      <p style="color:#555;font-size:14px;line-height:1.6;">
        Tu sesion de chat con <strong>${companyName}</strong> ha expirado por inactividad.
        Si deseas retomar la conversacion, haz clic en el siguiente enlace:
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${resumeUrl}"
           style="background:#c7f049;color:#0f0f13;text-decoration:none;font-weight:700;
                  padding:10px 24px;border-radius:6px;font-size:14px;">
          Retomar conversacion
        </a>
      </div>
      <p style="color:#aaa;font-size:11px;text-align:center;">
        Este enlace es de un solo uso y expirara en 24 horas.
      </p>
    </div>
  `;
  const text = `Hola ${name},\n\nTu sesion de chat con ${companyName} ha expirado. Para retomarla visita:\n${resumeUrl}\n\nEste enlace es de un solo uso.`;
  await smtp.sendEmail({ to: guestEmail, subject, html, text });
}

// ------------------------------------------------------------------
// Main expiry job
// ------------------------------------------------------------------
export async function expireStaleGuestSessions(prisma) {
  // 1. Find sessions about to be closed that have an email — send resume link first
  const expiringWithEmail = await prisma.$queryRaw`
    SELECT cgs.id, cgs.email, cgs.name,
           ws.company_id,
           ic.value AS company_name,
           ws.domain
    FROM chat_guest_sessions cgs
    LEFT JOIN chat_conversations cc ON cc.created_by_guest_id = cgs.id
    LEFT JOIN website_site ws ON ws.id = cc.website_id
    LEFT JOIN instance_config ic ON ic.key = 'company.name'
    WHERE (cgs.idle_expires_at < NOW() OR cgs.absolute_expires_at < NOW())
      AND cgs.closed_at IS NULL
      AND cgs.email IS NOT NULL
      AND cgs.expiry_email_sent IS NOT DISTINCT FROM false
    LIMIT 50
  `;
  // website_site.domain holds the public URL; site_url does not exist

  if (expiringWithEmail.length > 0) {
    const smtp = createSmtpService({ prisma });
    const isSmtpReady = await smtp.isConfigured().catch(() => false);

    for (const row of expiringWithEmail) {
      try {
        // Generate a single-use resume token (24h window)
        const resumeToken = crypto.randomBytes(32).toString("hex");
        const resumeHash = hashToken(resumeToken);

        await prisma.$executeRaw`
          UPDATE chat_guest_sessions
          SET resume_token_hash = ${resumeHash},
              idle_expires_at = NOW() + INTERVAL '24 hours',
              absolute_expires_at = GREATEST(absolute_expires_at, NOW() + INTERVAL '24 hours'),
              expiry_email_sent = true
          WHERE id = ${row.id}
        `;

        if (isSmtpReady) {
          const siteUrl = row.domain ? `https://${row.domain.replace(/^https?:\/\//, "")}` : "https://racoondevs.com";
          const resumeUrl = `${siteUrl.replace(/\/$/, "")}?chat_resume=${resumeToken}`;
          const companyName = row.company_name ?? "nuestro equipo";
          await sendExpiryEmail(smtp, {
            guestEmail: row.email,
            guestName: row.name,
            companyName,
            resumeUrl,
          });
        }
      } catch {
        // Non-fatal per session
      }
    }
  }

  // 2. Close stale conversations
  const closedConversations = await prisma.$executeRaw`
    UPDATE chat_conversations
    SET status = 'closed', updated_at = NOW()
    WHERE type = 'external_support'
      AND status IN ('open', 'pending')
      AND deleted_at IS NULL
      AND created_by_guest_id IN (
        SELECT id FROM chat_guest_sessions
        WHERE (idle_expires_at < NOW() OR absolute_expires_at < NOW())
          AND closed_at IS NULL
      )
  `;

  // 3. Close stale sessions
  const closedSessions = await prisma.$executeRaw`
    UPDATE chat_guest_sessions
    SET closed_at = NOW()
    WHERE (idle_expires_at < NOW() OR absolute_expires_at < NOW())
      AND closed_at IS NULL
  `;

  return { closedConversations, closedSessions };
}
