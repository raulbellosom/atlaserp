import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Button, TextField } from "@atlas/ui";
import { Loader2 } from "lucide-react";
import { useGuestCall } from "./useGuestCall";
import { endedReason } from "./lib/guestCall";
import { GuestCallRoom } from "./GuestCallRoom";

export default function GuestCallScreen() {
  const { token = null } = useParams();
  const [sp] = useSearchParams();
  const inviteToken = sp.get("i");
  const urlCode = sp.get("code");

  // Force light + chromeless, same pattern as PublicNoteScreen.
  useEffect(() => {
    const html = document.documentElement;
    const hadDark = html.classList.contains("dark");
    html.classList.remove("dark");
    return () => { if (hadDark) html.classList.add("dark"); };
  }, []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(urlCode ?? "");
  const gc = useGuestCall({ token, code: token ? null : code, inviteToken });
  const formRef = useRef({ name: "", email: "" });
  const waitTimer = useRef(null);

  // While the call has not started, re-attempt the join with the same values.
  useEffect(() => {
    if (gc.phase === "lobby" && gc.state.status === "waiting") {
      waitTimer.current = setInterval(() => {
        if (formRef.current.name) {
          gc.join({ displayName: formRef.current.name, email: formRef.current.email || undefined });
        }
      }, 4000);
      return () => { if (waitTimer.current) clearInterval(waitTimer.current); };
    }
    return undefined;
  }, [gc.phase, gc.state.status]); // eslint-disable-line react-hooks/exhaustive-deps

  function submitGate(e) {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 2) return;
    formRef.current = { name: n, email: email.trim() };
    gc.join({ displayName: n, email: email.trim() || undefined });
  }

  if (gc.phase === "room") {
    return (
      <GuestCallRoom
        fetchLivekitToken={gc.fetchLivekitToken}
        messages={gc.messages}
        onSendMessage={gc.sendMessage}
        onLeave={gc.leave}
        myName={formRef.current.name || name}
      />
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        {gc.phase === "gate" && (
          <form onSubmit={submitGate} className="space-y-4">
            <h1 className="text-lg font-semibold text-gray-900">Unirte a la llamada</h1>
            <TextField label="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
            {!inviteToken && (
              <TextField label="Correo (opcional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            )}
            {inviteToken && <p className="text-xs text-gray-500">Invitación por correo verificada.</p>}
            {!token && (
              <TextField
                label="Código de la llamada"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
              />
            )}
            {gc.state.error && <p className="text-sm text-red-600">{gc.state.error}</p>}
            <Button type="submit" className="w-full" disabled={gc.joining || name.trim().length < 2}>
              {gc.joining ? "Conectando..." : "Entrar"}
            </Button>
          </form>
        )}

        {gc.phase === "lobby" && (
          <div className="space-y-3 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
            <p className="text-sm text-gray-700">
              {gc.state.status === "waiting"
                ? "La llamada aún no ha comenzado. Te uniremos automáticamente."
                : "Esperando a que el anfitrión te admita..."}
            </p>
          </div>
        )}

        {gc.phase === "ended" && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-gray-700">{endedReason(gc.state)}</p>
            <Button variant="secondary" className="w-full" onClick={() => window.location.reload()}>Volver a intentar</Button>
          </div>
        )}

        {gc.phase === "error" && (
          <div className="space-y-3 text-center">
            <p className="text-sm text-red-600">{gc.state.error || "Algo salió mal."}</p>
            <Button variant="secondary" className="w-full" onClick={() => window.location.reload()}>Reintentar</Button>
          </div>
        )}
      </div>
    </div>
  );
}
