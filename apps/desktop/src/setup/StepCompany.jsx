import { useState, forwardRef, useImperativeHandle } from "react";
import { TextField } from "@atlas/ui";
import { Building2 } from "lucide-react";

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
  const slug = data.companyName ? toSlug(data.companyName) : "";

  useImperativeHandle(ref, () => ({
    validate() {
      const e = {};
      if (!data.companyName || data.companyName.length < 2)
        e.companyName = "Mínimo 2 caracteres";
      setErrors(e);
      return Object.keys(e).length === 0;
    },
  }));

  return (
    <div>
      <div className="space-y-5">
        <TextField
          id="companyName"
          label="Nombre de la empresa"
          required
          icon={Building2}
          value={data.companyName}
          onChange={(e) => onChange({ companyName: e.target.value })}
          placeholder="Acme SA de CV"
          error={errors.companyName}
          validate={(v) => (!v || v.length < 2 ? "Mínimo 2 caracteres" : null)}
          hint={
            slug && !errors.companyName ? `Identificador: ${slug}` : undefined
          }
        />
      </div>
    </div>
  );
});
