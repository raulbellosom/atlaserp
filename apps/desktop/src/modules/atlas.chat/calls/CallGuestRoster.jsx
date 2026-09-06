import { useState } from "react";
import { Button, ConfirmDialog, EmptyState } from "@atlas/ui";
import { Check, X, MicOff, Mic, UserX } from "lucide-react";

// `guestsApi` is the object returned by useCallGuests(). Rendered inside the
// call room, host only.
export function CallGuestRoster({ guestsApi }) {
  const { lobby, admitted, admit, deny, kick, mute } = guestsApi;
  const [muted, setMuted] = useState({});
  const [confirmKick, setConfirmKick] = useState(null);

  const empty = lobby.length === 0 && admitted.length === 0;

  return (
    <div className="flex flex-col gap-3 p-3 text-sm text-white">
      {empty && (
        <EmptyState
          title="Sin invitados"
          description="Comparte el enlace para que se unan invitados externos."
        />
      )}

      {lobby.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-white/50">
            Esperando aprobación
          </p>
          <ul className="space-y-1.5">
            {lobby.map((g) => (
              <li key={g.id} className="flex items-center gap-2 rounded-lg bg-white/10 px-2.5 py-1.5">
                <span className="flex-1 truncate">{g.displayName}</span>
                <Button size="sm" className="h-7 px-2" onClick={() => admit(g.id)}>
                  <Check className="mr-1 h-3.5 w-3.5" /> Admitir
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-red-400" onClick={() => deny(g.id)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {admitted.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-white/50">
            En la llamada
          </p>
          <ul className="space-y-1.5">
            {admitted.map((g) => {
              const isMuted = !!muted[g.id];
              return (
                <li key={g.id} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5">
                  <span className="flex-1 truncate">{g.displayName}</span>
                  <Button
                    size="sm" variant="ghost" className="h-7 w-7 p-0"
                    title={isMuted ? "Reactivar micrófono" : "Silenciar"}
                    onClick={() => { setMuted((m) => ({ ...m, [g.id]: !isMuted })); mute(g.id, !isMuted); }}
                  >
                    {isMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400"
                    title="Expulsar" onClick={() => setConfirmKick(g)}
                  >
                    <UserX className="h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmKick}
        onOpenChange={(v) => !v && setConfirmKick(null)}
        title="Expulsar invitado"
        description={confirmKick ? `Se sacará a ${confirmKick.displayName} de la llamada.` : ""}
        confirmLabel="Expulsar"
        variant="destructive"
        onConfirm={() => { kick(confirmKick.id); setConfirmKick(null); }}
      />
    </div>
  );
}
