import { forwardRef, useImperativeHandle } from "react";
import { Pencil } from "lucide-react";
import { Country, State } from "country-state-city";

const COMPANY_TYPE_LABELS = {
  sa_de_cv: "SA de CV",
  srl_de_cv: "SRL de CV",
  sa: "SA",
  srl: "SRL",
  sc: "SC - Sociedad Cooperativa",
  ac: "AC - Asociacion Civil",
  sapi_de_cv: "SAPI de CV",
  otro: "Otro",
};

const INDUSTRY_LABELS = {
  tecnologia: "Tecnologia",
  software: "Software",
  mineria: "Mineria",
  contabilidad: "Contabilidad",
  manufactura: "Manufactura",
  retail: "Retail",
  salud: "Salud",
  educacion: "Educacion",
  logistica: "Logistica",
  construccion: "Construccion",
  servicios_profesionales: "Servicios profesionales",
  agroindustria: "Agroindustria",
  financiero: "Financiero",
  hospitalidad: "Hospitalidad",
  marketing: "Marketing",
  inmobiliario: "Inmobiliario",
  ong: "ONG",
  otro: "Otro",
};

const COMPANY_SIZE_LABELS = {
  micro: "Micro (1-10)",
  small: "Pequena (11-50)",
  medium: "Mediana (51-200)",
  large: "Grande (201-500)",
  corporate: "Corporativo (500+)",
};

function ReviewSection({ title, rows, onEdit }) {
  const visibleRows = rows.filter((r) => r.value);
  if (visibleRows.length === 0) return null;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1 text-[11px] font-medium text-primary/60 hover:text-primary transition-colors duration-150"
          >
            <Pencil size={10} strokeWidth={2} />
            Editar
          </button>
        )}
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        {visibleRows.map((row, i) => (
          <div
            key={row.label}
            className={[
              "grid grid-cols-2 gap-4 px-4 py-3 text-sm",
              i > 0 ? "border-t border-border" : "",
            ].join(" ")}
          >
            <span className="text-muted-foreground font-medium">{row.label}</span>
            <span className="text-foreground">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const StepReview = forwardRef(function StepReview(
  { data, error, onGoToStep },
  ref,
) {
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

  const countryName = data.country
    ? (Country.getCountryByCode(data.country)?.name ?? data.country)
    : "";
  const stateName =
    data.country && data.state
      ? (State.getStateByCodeAndCountry(data.state, data.country)?.name ??
        data.state)
      : "";

  const companyTypeLabel =
    data.companyType === "otro"
      ? data.companyTypeName || "Otro"
      : COMPANY_TYPE_LABELS[data.companyType] || data.companyType;

  const companyIndustryLabel =
    data.companyIndustryKey === "otro"
      ? data.companyIndustryName || "Otro"
      : data.companyIndustryName ||
        INDUSTRY_LABELS[data.companyIndustryKey] ||
        data.companyIndustryKey;

  const addressParts = [
    data.street &&
      (data.extNumber ? `${data.street} ${data.extNumber}` : data.street),
    data.intNumber,
    data.city,
    stateName,
    data.postalCode,
    countryName,
  ].filter(Boolean);
  const addressLine = addressParts.join(", ");

  return (
    <div>
      <div className="space-y-5">
        <ReviewSection
          title="Cuenta de administrador"
          onEdit={onGoToStep ? () => onGoToStep(0) : undefined}
          rows={[
            {
              label: "Nombre",
              value: `${data.adminFirstName} ${data.adminLastName}`.trim(),
            },
            { label: "Correo", value: data.adminEmail },
          ]}
        />

        <ReviewSection
          title="Empresa"
          onEdit={onGoToStep ? () => onGoToStep(1) : undefined}
          rows={[
            { label: "Nombre comercial", value: data.companyName },
            { label: "Razon social", value: data.legalName },
            { label: "RFC", value: data.rfc },
            { label: "Forma legal", value: companyTypeLabel },
            { label: "Giro", value: companyIndustryLabel },
            { label: "Tamano", value: COMPANY_SIZE_LABELS[data.companySize] },
            { label: "Domicilio", value: addressLine },
          ]}
        />

        <ReviewSection
          title="Identidad visual"
          onEdit={onGoToStep ? () => onGoToStep(2) : undefined}
          rows={[
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
          ]}
        />
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
