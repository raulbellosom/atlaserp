// Shared branded Atlas ERP email shell + concrete templates.
// Same visual language as buildNotificationEmail in notification-delivery-worker.js
// (logo header, white card, blue CTA, footer). Keep new transactional emails
// going through renderAtlasEmailLayout so they stay on-brand.

const CTA_COLOR = "#2563eb";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeBaseUrl(value) {
  if (!value || typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    if (!/^https?:$/i.test(url.protocol)) return null;
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

// Public URL of the SPA (for join / open links).
export function resolveAppBaseUrl(env = process.env) {
  for (const candidate of [env.PUBLIC_APP_URL, env.APP_URL, env.ATLAS_APP_URL, env.WEB_APP_URL]) {
    const normalized = normalizeBaseUrl(candidate);
    if (normalized) return normalized;
  }
  return env.NODE_ENV !== "production" ? "http://localhost:5173" : null;
}

// Base URL of the API — only used to serve the brand logo asset.
export function resolveApiBaseUrl(env = process.env) {
  for (const candidate of [env.ATLAS_API_URL, env.API_URL, env.VITE_ATLAS_API_URL]) {
    const normalized = normalizeBaseUrl(candidate);
    if (normalized) return normalized;
  }
  return env.NODE_ENV !== "production" ? "http://localhost:4010" : null;
}

// Branded shell. `bodyHtml` is inserted verbatim — callers must escape their
// own interpolations (use escapeHtml). `cta` is `{ label, url }` or null.
export function renderAtlasEmailLayout({ kicker, heading, bodyHtml = "", cta = null, footnote, env = process.env }) {
  const apiBaseUrl = resolveApiBaseUrl(env);
  const logoUrl = apiBaseUrl ? `${apiBaseUrl}/brand/atlas-logo-horizontal.png` : null;
  const foot = footnote ?? "Este correo fue generado automaticamente por Atlas ERP.";

  return `
<div style="background:#f3f4f6;padding:24px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#111827">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden">
    <tr>
      <td style="padding:20px 24px;border-bottom:1px solid #eef2ff;background:#f8fafc">
        ${logoUrl ? `<img src="${logoUrl}" alt="Atlas ERP" style="height:26px;display:block;margin-bottom:10px" />` : ""}
        ${kicker ? `<div style="font-size:12px;color:#6b7280;letter-spacing:.06em;text-transform:uppercase">${escapeHtml(kicker)}</div>` : ""}
        <h1 style="margin:6px 0 0 0;font-size:24px;line-height:1.25;color:#0f172a">${escapeHtml(heading)}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 24px">
        ${bodyHtml}
        ${
          cta?.url
            ? `<a href="${escapeHtml(cta.url)}" style="display:inline-block;background:${CTA_COLOR};color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:10px;font-size:14px;font-weight:600">${escapeHtml(cta.label ?? "Abrir")}</a>`
            : ""
        }
      </td>
    </tr>
    <tr>
      <td style="padding:14px 24px;border-top:1px solid #e5e7eb;background:#f8fafc;font-size:12px;color:#64748b">
        ${escapeHtml(foot)}
      </td>
    </tr>
  </table>
</div>
  `.trim();
}

// ── Concrete templates ──────────────────────────────────────────────────────

export function buildCallInviteEmail({ joinUrl, inviterName = null, conversationTitle = null, env = process.env }) {
  const who = inviterName ? `${inviterName} te invitó` : "Te invitaron";
  const where = conversationTitle ? ` en "${conversationTitle}"` : "";
  const heading = "Te invitaron a una llamada";

  const bodyHtml = `
        <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#334155">
          ${escapeHtml(who)} a una videollamada${escapeHtml(where)} en Atlas ERP.
        </p>
        <p style="margin:0 0 16px 0;font-size:13px;line-height:1.6;color:#64748b">
          Solo necesitas tu nombre para entrar. Si el boton no funciona, copia este enlace en tu navegador:<br />
          <span style="word-break:break-all;color:#334155">${escapeHtml(joinUrl)}</span>
        </p>`;

  const html = renderAtlasEmailLayout({
    kicker: "Invitacion a llamada",
    heading,
    bodyHtml,
    cta: { label: "Unirme a la llamada", url: joinUrl },
    footnote: "Recibiste este correo porque alguien te invito a una llamada en Atlas ERP.",
    env,
  });

  const text = [
    "Atlas ERP",
    "",
    `${who} a una videollamada${where}.`,
    "",
    `Unirme a la llamada: ${joinUrl}`,
  ].join("\n");

  return { subject: heading, html, text };
}
