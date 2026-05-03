import { useState, forwardRef, useImperativeHandle, useMemo } from "react";
import { Building2, FileText, Hash, MapPin } from "lucide-react";
import { Country, State, City } from "country-state-city";
import { TextField, SelectField, ComboboxField } from "@atlas/ui";

const COMPANY_TYPES = [
  { value: "sa_de_cv", label: "SA de CV" },
  { value: "srl_de_cv", label: "SRL de CV" },
  { value: "sa", label: "SA" },
  { value: "srl", label: "SRL" },
  { value: "sc", label: "SC — Sociedad Cooperativa" },
  { value: "ac", label: "AC — Asociación Civil" },
  { value: "sapi_de_cv", label: "SAPI de CV" },
  { value: "otro", label: "Otro" },
];

const COMPANY_SIZES = [
  { value: "micro", label: "Micro — 1 a 10 empleados" },
  { value: "small", label: "Pequeña — 11 a 50 empleados" },
  { value: "medium", label: "Mediana — 51 a 200 empleados" },
  { value: "large", label: "Grande — 201 a 500 empleados" },
  { value: "corporate", label: "Corporativo — más de 500 empleados" },
];

function toSlug(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const StepCompany = forwardRef(function StepCompany(
  { data, onChange },
  ref,
) {
  const [errors, setErrors] = useState({});

  useImperativeHandle(ref, () => ({
    validate() {
      const e = {};
      if (!data.companyName || data.companyName.length < 2)
        e.companyName = "Mínimo 2 caracteres";
      setErrors(e);
      return Object.keys(e).length === 0;
    },
  }));

  const slug = data.companyName ? toSlug(data.companyName) : "";

  const countryOptions = useMemo(
    () =>
      Country.getAllCountries().map((c) => ({
        value: c.isoCode,
        label: c.name,
      })),
    [],
  );

  const stateOptions = useMemo(
    () =>
      data.country
        ? State.getStatesOfCountry(data.country).map((s) => ({
            value: s.isoCode,
            label: s.name,
          }))
        : [],
    [data.country],
  );

  const cityOptions = useMemo(
    () =>
      data.country && data.state
        ? City.getCitiesOfState(data.country, data.state).map((c) => ({
            value: c.name,
            label: c.name,
          }))
        : [],
    [data.country, data.state],
  );

  function handleCountryChange(val) {
    onChange({ country: val, state: "", city: "" });
  }

  function handleStateChange(val) {
    onChange({ state: val, city: "" });
  }

  return (
    <div>
      <div className="space-y-7">
        {/* ── Section: Datos generales ── */}
        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Datos generales
          </p>
          <TextField
            id="companyName"
            label="Nombre comercial"
            required
            icon={Building2}
            value={data.companyName}
            onChange={(e) => onChange({ companyName: e.target.value })}
            placeholder="Acme SA de CV"
            error={errors.companyName}
            validate={(v) => (!v || v.length < 2 ? "Mínimo 2 caracteres" : null)}
            hint={slug && !errors.companyName ? `Identificador: ${slug}` : undefined}
          />
          <TextField
            id="legalName"
            label="Razón social"
            icon={FileText}
            value={data.legalName || ""}
            onChange={(e) => onChange({ legalName: e.target.value })}
            placeholder="ACME SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE"
            hint="Nombre legal registrado ante el SAT u organismo equivalente"
          />
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              id="companyType"
              label="Tipo de empresa"
              options={COMPANY_TYPES}
              placeholder="Seleccionar..."
              value={data.companyType || ""}
              onChange={(e) => onChange({ companyType: e.target.value, companyTypeName: "" })}
            />
            <SelectField
              id="companySize"
              label="Tamaño"
              options={COMPANY_SIZES}
              placeholder="Seleccionar..."
              value={data.companySize || ""}
              onChange={(e) => onChange({ companySize: e.target.value })}
            />
          </div>
          {data.companyType === "otro" && (
            <TextField
              id="companyTypeName"
              label="Especificar tipo"
              value={data.companyTypeName || ""}
              onChange={(e) => onChange({ companyTypeName: e.target.value })}
              placeholder="Describe el tipo de empresa"
            />
          )}
        </div>

        {/* ── Section: Datos fiscales ── */}
        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Datos fiscales
          </p>
          <TextField
            id="rfc"
            label="RFC"
            icon={Hash}
            value={data.rfc || ""}
            onChange={(e) => onChange({ rfc: e.target.value.toUpperCase() })}
            placeholder="ACM920101AAA"
            hint="RFC del contribuyente (12 o 13 caracteres)"
            maxLength={13}
          />
        </div>

        {/* ── Section: Domicilio ── */}
        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Domicilio
          </p>
          <ComboboxField
            id="country"
            label="País"
            icon={MapPin}
            options={countryOptions}
            value={data.country || ""}
            onChange={handleCountryChange}
            placeholder="Seleccionar país..."
            searchPlaceholder="Buscar país..."
          />
          {stateOptions.length > 0 && (
            <ComboboxField
              id="state"
              label="Estado / Provincia"
              options={stateOptions}
              value={data.state || ""}
              onChange={handleStateChange}
              placeholder="Seleccionar estado..."
              searchPlaceholder="Buscar estado..."
            />
          )}
          {cityOptions.length > 0 && (
            <ComboboxField
              id="city"
              label="Ciudad / Municipio"
              options={cityOptions}
              value={data.city || ""}
              onChange={(val) => onChange({ city: val })}
              placeholder="Seleccionar ciudad..."
              searchPlaceholder="Buscar ciudad..."
              minSearchLength={2}
            />
          )}
          {data.state !== undefined && data.state !== "" && cityOptions.length === 0 && (
            <TextField
              id="city"
              label="Ciudad / Municipio"
              value={data.city || ""}
              onChange={(e) => onChange({ city: e.target.value })}
              placeholder="Nombre de la ciudad"
            />
          )}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <TextField
                id="street"
                label="Calle"
                value={data.street || ""}
                onChange={(e) => onChange({ street: e.target.value })}
                placeholder="Av. Reforma"
              />
            </div>
            <TextField
              id="extNumber"
              label="Número ext."
              value={data.extNumber || ""}
              onChange={(e) => onChange({ extNumber: e.target.value })}
              placeholder="123"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              id="intNumber"
              label="Número int."
              value={data.intNumber || ""}
              onChange={(e) => onChange({ intNumber: e.target.value })}
              placeholder="Piso 4 (opcional)"
            />
            <TextField
              id="postalCode"
              label="Código postal"
              value={data.postalCode || ""}
              onChange={(e) => onChange({ postalCode: e.target.value })}
              placeholder="06600"
            />
          </div>
        </div>
      </div>
    </div>
  );
});
