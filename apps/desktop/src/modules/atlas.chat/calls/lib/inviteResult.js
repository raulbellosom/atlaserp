// Shared interpretation of the POST /calls/.../link/invites response so every
// invite surface (CallInvitePanel, CallShareDialog, NewMeetingDialog) shows the
// same, truthful messaging.
//
// The API returns:
//   { matchedUsers, invited, pendingManual, smtpConfigured, sendError }
// where each pendingManual entry has a `reason`:
//   - "smtp_not_configured" : no SMTP saved on the instance
//   - "smtp_error"           : SMTP saved but unusable (e.g. undecryptable pass)
//   - "send_failed"          : SMTP accepted the config but rejected the message

export function summarizeInviteResult(res) {
  const invited = res?.invited?.length ?? 0;
  const matched = res?.matchedUsers?.length ?? 0;
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

  return { successCount: invited + matched, pendingCount: pending.length, notice };
}
