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
      if (!data.adminDisplayName || data.adminDisplayName.length < 2)
        e.adminDisplayName = "Mínimo 2 caracteres";
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
        <TextField
          id="displayName"
          label="Nombre completo"
          required
          icon={User}
          value={data.adminDisplayName}
          onChange={(e) => onChange({ adminDisplayName: e.target.value })}
          placeholder="María García"
          error={errors.adminDisplayName}
          validate={(v) => (!v || v.length < 2 ? "Mínimo 2 caracteres" : null)}
        />
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
