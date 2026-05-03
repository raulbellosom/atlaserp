import { forwardRef, useImperativeHandle } from "react";

export const StepReview = forwardRef(function StepReview({ data, error }, ref) {
  useImperativeHandle(ref, () => ({
    validate() {
      return true;
    },
  }));

  const alreadyInitialized = Boolean(
    error &&
    (error.includes("Already initialized") ||
      error.includes("already initialized")),
  );

  return (
    <div>
      <div className="rounded-xl border border-border overflow-hidden">
        {[
          { label: "Administrador", value: data.adminDisplayName },
          { label: "Correo", value: data.adminEmail },
          { label: "Empresa", value: data.companyName },
          {
            label: "Color principal",
            value: (
              <span className="flex items-center gap-2">
                <span
                  className="inline-block w-4 h-4 rounded border border-border"
                  style={{ background: data.primaryColor }}
                />
                <span className="font-mono text-xs">{data.primaryColor}</span>
              </span>
            ),
          },
          {
            label: "Logotipo",
            value: data.logo ? data.logo.name : "Sin logotipo",
          },
        ].map((row, i) => (
          <div
            key={row.label}
            className={[
              "grid grid-cols-2 gap-4 px-4 py-3 text-sm",
              i > 0 ? "border-t border-border" : "",
            ].join(" ")}
          >
            <span className="text-muted-foreground font-medium">
              {row.label}
            </span>
            <span className="text-foreground">{row.value}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-5 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {alreadyInitialized
            ? "Esta instancia ya fue configurada."
            : `Error al inicializar: ${error}`}
        </div>
      )}
    </div>
  );
});
