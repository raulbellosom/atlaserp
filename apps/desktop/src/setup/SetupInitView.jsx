import { Check, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@runly/ui";

// ── SetupInitView ────────────────────────────────────────────────────────────
// Replaces the stepper/nav once the admin confirms step 4. Tied to the real
// mutation lifecycle (no simulated/fake progress ticks): every task shows as
// pending while the request is in flight and flips to done together on
// success, since a single `POST /setup/initialize` call doesn't expose
// per-task progress.
export function SetupInitView({
  tasks,
  success,
  isError,
  errorMessage,
  onRestart,
  onBack,
  onEnter,
}) {
  const alreadyInitialized = Boolean(
    errorMessage &&
      (errorMessage.includes("Already initialized") ||
        errorMessage.includes("already initialized")),
  );

  return (
    <div className="flex flex-col gap-6 py-2">
      <div className="flex flex-col gap-4">
        {success ? (
          <div
            className="w-15.5 h-15.5 rounded-2xl grid place-items-center text-white"
            style={{
              background: "linear-gradient(140deg,#FD6016,#E4262A)",
              boxShadow: "0 18px 40px rgba(253,96,22,.35)",
            }}
          >
            <Check size={28} strokeWidth={2.6} />
          </div>
        ) : (
          <div className="w-15.5 h-15.5 rounded-2xl grid place-items-center glass text-(--brand-primary)">
            {isError ? (
              <AlertCircle size={26} />
            ) : (
              <Loader2 size={26} className="animate-spin" />
            )}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <h2 className="text-[28px] font-bold tracking-tight text-foreground">
            {success
              ? "Tu instancia está lista"
              : isError
                ? "No se pudo inicializar"
                : "Inicializando tu instancia"}
          </h2>
          <p className="text-[14.5px] leading-relaxed text-muted-foreground max-w-[44ch]">
            {success
              ? "Todo quedó configurado. Puedes entrar al escritorio e invitar a tu equipo cuando quieras."
              : isError
                ? alreadyInitialized
                  ? "Esta instancia ya fue configurada."
                  : `Error al inicializar: ${errorMessage}`
                : "No cierres esta ventana. Tarda menos de un minuto."}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {tasks.map((t) => (
          <div
            key={t.label}
            className="flex items-center gap-3.5 rounded-2xl px-4 py-3.5 glass-subtle"
          >
            {success ? (
              <div className="shrink-0 w-5.5 h-5.5 rounded-full grid place-items-center bg-success/15 text-success">
                <Check size={12} strokeWidth={3} />
              </div>
            ) : (
              <div className="shrink-0 w-5.5 h-5.5 rounded-full border-[1.5px] border-border" />
            )}
            <span className="flex-1 min-w-0 text-[13.5px] text-foreground">
              {t.label}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {success ? t.meta : ""}
            </span>
          </div>
        ))}
      </div>

      {success && (
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="gradient"
            style={{
              backgroundImage: "linear-gradient(120deg,#FD6016,#E4262A)",
            }}
            onClick={onEnter}
          >
            Entrar al escritorio
            <ArrowRight size={15} />
          </Button>
          <Button type="button" variant="secondary" onClick={onRestart}>
            Volver a empezar
          </Button>
        </div>
      )}

      {isError && (
        <div>
          <Button type="button" variant="secondary" onClick={onBack}>
            Volver a revisar
          </Button>
        </div>
      )}
    </div>
  );
}
