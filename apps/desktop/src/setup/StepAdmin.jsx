import { useState, forwardRef, useImperativeHandle } from "react";
import { User, Mail, Lock } from "lucide-react";
import { TextField, PasswordField } from "@atlas/ui";

export const StepAdmin = forwardRef(function StepAdmin(
  { data, onChange },
  ref,
) {
  const [errors, setErrors] = useState({});

  useImperativeHandle(ref, () => ({
    validate() {
      const e = {};
      if (!data.adminFirstName || data.adminFirstName.length < 1)
        e.adminFirstName = "Requerido";
      if (!data.adminLastName || data.adminLastName.length < 1)
        e.adminLastName = "Requerido";
      if (
        !data.adminEmail ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.adminEmail)
      )
        e.adminEmail = "Correo inválido";
      if (!data.adminPassword || data.adminPassword.length < 8)
        e.adminPassword = "Mínimo 8 caracteres";
      if (data.adminPassword !== data.adminConfirmPassword)
        e.adminConfirmPassword = "Las contraseñas no coinciden";
      setErrors(e);
      return Object.keys(e).length === 0;
    },
  }));

  return (
    <div>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <TextField
            id="firstName"
            label="Nombre"
            required
            icon={User}
            value={data.adminFirstName}
            onChange={(e) => onChange({ adminFirstName: e.target.value })}
            placeholder="María"
            error={errors.adminFirstName}
            validate={(v) => (!v || v.length < 1 ? "Requerido" : null)}
          />
          <TextField
            id="lastName"
            label="Apellido"
            required
            value={data.adminLastName}
            onChange={(e) => onChange({ adminLastName: e.target.value })}
            placeholder="García"
            error={errors.adminLastName}
            validate={(v) => (!v || v.length < 1 ? "Requerido" : null)}
          />
        </div>
        <TextField
          id="email"
          type="email"
          label="Correo electrónico"
          required
          icon={Mail}
          value={data.adminEmail}
          onChange={(e) => onChange({ adminEmail: e.target.value })}
          placeholder="admin@empresa.com"
          error={errors.adminEmail}
          validate={(v) =>
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "Correo inválido" : null
          }
        />
        <PasswordField
          id="password"
          label="Contraseña"
          required
          showStrength
          icon={Lock}
          value={data.adminPassword}
          onChange={(e) => onChange({ adminPassword: e.target.value })}
          error={errors.adminPassword}
          validate={(v) => (!v || v.length < 8 ? "Mínimo 8 caracteres" : null)}
        />
        <PasswordField
          id="confirmPassword"
          label="Confirmar contraseña"
          icon={Lock}
          value={data.adminConfirmPassword}
          onChange={(e) => onChange({ adminConfirmPassword: e.target.value })}
          error={errors.adminConfirmPassword}
          validate={(v) =>
            v !== data.adminPassword ? "Las contraseñas no coinciden" : null
          }
        />
      </div>
    </div>
  );
});
