// Shared interpretation of the POST /calls/.../link/invites response so every
// invite surface (CallInvitePanel, CallShareDialog, NewMeetingDialog) shows the
// same, truthful messaging.
//
// The API returns:
//   { matchedUsers, notifiedUsers, invited, pendingManual, smtpConfigured, sendError }
// where:
//   - matchedUsers  : typed addresses that belong to a platform account
//   - notifiedUsers  : the subset actually pulled into the meeting + pinged
//                      in-app / web_push (no guest email sent to them)
//   - invited        : external addresses emailed a guest link
//   - pendingManual  : external addresses we could NOT email; each carries a
//                      `reason`:
//       "smtp_not_configured" : no SMTP saved on the instance
//       "smtp_error"           : SMTP saved but unusable (e.g. undecryptable pass)
//       "send_failed"          : SMTP accepted the config but rejected the message

export function summarizeInviteResult(res) {
  const emailedCount = res?.invited?.length ?? 0;
  // Prefer the explicit "actually notified" list; fall back to matchedUsers for
  // older API responses that did not split them out.
  const notifiedCount = res?.notifiedUsers?.length ?? res?.matchedUsers?.length ?? 0;
  const pending = res?.pendingManual ?? [];
  const reasons = new Set(pending.map((p) => p?.reason).filter(Boolean));

  let notice = null;
  if (pending.length) {
    if (res?.sendError || reasons.has("smtp_error") || reasons.has("send_failed")) {
      notice = {
        title: "No se pudieron enviar los correos — comparte el enlace manualmente.",
        description: res?.sendError ?? null,
      };
    } else {
      notice = {
        title: "El correo no está configurado — comparte el enlace manualmente.",
        description: null,
      };
    }
  }

  return {
    successCount: emailedCount + notifiedCount,
    emailedCount,
    notifiedCount,
    pendingCount: pending.length,
    notice,
  };
}

// One-line summary of what happened, for a toast. Returns null when nothing
// succeeded (the caller shows `notice` instead).
export function describeInviteOutcome(res) {
  const { emailedCount, notifiedCount } = summarizeInviteResult(res);
  const parts = [];
  if (notifiedCount) {
    parts.push(
      notifiedCount === 1
        ? "1 usuario de Atlas recibió el aviso en la app"
        : `${notifiedCount} usuarios de Atlas recibieron el aviso en la app`,
    );
  }
  if (emailedCount) {
    parts.push(
      emailedCount === 1 ? "1 invitación enviada por correo" : `${emailedCount} invitaciones enviadas por correo`,
    );
  }
  if (!parts.length) return null;
  return `${parts.join(" · ")}.`;
}
