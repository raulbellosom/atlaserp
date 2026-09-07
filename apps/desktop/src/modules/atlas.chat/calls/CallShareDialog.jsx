import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  Button, TagsField, CheckboxField, NumberField, ConfirmDialog,
} from "@atlas/ui";
import { Copy, Check, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";
import { summarizeInviteResult, describeInviteOutcome } from "./lib/inviteResult";

function unwrap(r) {
  return r?.data ?? r;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CallShareDialog({ open, onOpenChange, conversationId }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState([]);
  const [inviteResult, setInviteResult] = useState(null);
  const [copied, setCopied] = useState("");
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  useEffect(() => {
    if (!open || !conversationId || !token) return;
    setLoading(true);
    atlas.calls.createLink(conversationId, token)
      .then((r) => setLink(unwrap(r)?.link ?? null))
      .catch((e) => toast.error(e?.message || "No se pudo generar el enlace."))
      .finally(() => setLoading(false));
  }, [open, conversationId, token]);

  async function patch(next) {
    try {
      const r = await atlas.calls.updateLink(conversationId, next, token);
      setLink(unwrap(r)?.link ?? link);
    } catch (e) { toast.error(e?.message || "No se pudo actualizar."); }
  }

  async function regenerate() {
    setLoading(true);
    try {
      await atlas.calls.revokeLink(conversationId, token);
      const r = await atlas.calls.createLink(conversationId, token);
      setLink(unwrap(r)?.link ?? null);
      toast.success("Enlace regenerado.");
    } catch (e) {
      toast.error(e?.message || "No se pudo regenerar.");
    } finally {
      setLoading(false);
    }
  }

  async function revoke() {
    try {
      await atlas.calls.revokeLink(conversationId, token);
      setLink(null);
      setConfirmRevoke(false);
      toast.success("Enlace revocado.");
    } catch (e) { toast.error(e?.message || "No se pudo revocar."); }
  }

  async function sendInvites() {
    if (!emails.length) return;
    try {
      const r = unwrap(await atlas.calls.sendInvites(conversationId, emails, token));
      setInviteResult(r);
      setEmails([]);
      const { notice } = summarizeInviteResult(r);
      const outcome = describeInviteOutcome(r);
      if (outcome) toast.success(outcome);
      if (notice) {
        toast.message(notice.title, notice.description ? { description: notice.description } : undefined);
      }
    } catch (e) { toast.error(e?.message || "No se pudieron enviar."); }
  }

  function copy(value, key) {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Invitar a la llamada</DialogTitle></DialogHeader>

        {loading && !link ? (
          <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">Generando enlace...</p>
        ) : !link ? (
          <div className="py-6 text-center">
            <p className="mb-3 text-sm text-[hsl(var(--muted-foreground))]">No hay un enlace activo.</p>
            <Button onClick={regenerate}>Generar enlace</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <span className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">Enlace</span>
              <div className="flex gap-2">
                <input readOnly value={link.url} className="flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 text-sm" />
                <Button variant="secondary" size="icon" onClick={() => copy(link.url, "url")} title="Copiar enlace">
                  {copied === "url" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                Con este enlace no hace falta ningún código: se abre directo en la sala de espera.
              </p>
            </div>

            <div>
              <span className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
                Código (alternativa al enlace)
              </span>
              <div className="flex gap-2">
                <input readOnly value={link.code} className="w-40 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-3 py-2 font-mono text-lg tracking-widest" />
                <Button variant="secondary" size="icon" onClick={() => copy(link.code, "code")} title="Copiar código">
                  {copied === "code" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={regenerate} title="Regenerar" disabled={loading}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                Para quien prefiera escribirlo: entra a {link.url.replace(/\/p\/call\/.*$/, "/p/call")} y teclea este código.
              </p>
            </div>

            <CheckboxField
              label="Requiere aprobación del anfitrión (sala de espera)"
              checked={link.requireLobby}
              onChange={(e) => patch({ requireLobby: e.target.checked })}
            />
            <NumberField
              label="Máximo de usos (opcional)"
              value={link.maxUses ?? ""}
              min={1}
              onChange={(e) => {
                const n = Number(e.target.value);
                patch({ maxUses: Number.isFinite(n) && n > 0 ? n : null });
              }}
            />

            <div>
              <TagsField
                label="Invitar por correo"
                placeholder="ana@empresa.com  (Enter para agregar)"
                value={emails}
                onChange={setEmails}
                type="email"
                inputMode="email"
                normalizeItem={(v) => v.trim().toLowerCase()}
                validateItem={(v) => (EMAIL_RE.test(v) ? null : "Correo no válido")}
              />
              <div className="mt-2 flex justify-end">
                <Button size="sm" onClick={sendInvites} disabled={!emails.length}>Enviar invitaciones</Button>
              </div>
              {(inviteResult?.notifiedUsers?.length ?? inviteResult?.matchedUsers?.length ?? 0) > 0 && (
                <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                  {inviteResult.notifiedUsers?.length ?? inviteResult.matchedUsers.length} ya tienen cuenta: se
                  añadieron a la reunión y recibieron el aviso de llamada en la app.
                </p>
              )}
              {inviteResult?.pendingManual?.length > 0 && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  {inviteResult.smtpConfigured === false
                    ? "El servidor de correo (SMTP) no está configurado en Ajustes. Copia y comparte el enlace manualmente."
                    : inviteResult.sendError
                      ? `El correo está configurado pero el envío falló: ${inviteResult.sendError}`
                      : "No se pudieron enviar algunos correos. Comparte el enlace manualmente."}
                </p>
              )}
              {inviteResult?.pendingManual?.map((p) => (
                <div key={p.inviteId} className="mt-2 flex items-center gap-2 text-xs">
                  <span className="truncate text-[hsl(var(--muted-foreground))]">{p.email}: envío pendiente</span>
                  <button type="button" className="underline" onClick={() => copy(p.url, p.inviteId)}>
                    {copied === p.inviteId ? "copiado" : "copiar enlace"}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-[hsl(var(--border))] pt-3">
              <span className="text-xs text-[hsl(var(--muted-foreground))]">{link.useCount} uso(s)</span>
              <Button variant="ghost" size="sm" className="text-red-500" onClick={() => setConfirmRevoke(true)}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Revocar enlace
              </Button>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={confirmRevoke}
          onOpenChange={setConfirmRevoke}
          title="Revocar enlace"
          description="El enlace y el código dejarán de funcionar. Los invitados conectados serán expulsados."
          confirmLabel="Revocar"
          variant="destructive"
          onConfirm={revoke}
        />
      </DialogContent>
    </Dialog>
  );
}
