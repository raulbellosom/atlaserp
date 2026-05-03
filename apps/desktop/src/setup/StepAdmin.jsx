import { useState } from 'react'
import { Button, Input, Label } from '@atlas/ui'

export function StepAdmin({ data, onChange, onNext }) {
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!data.adminDisplayName || data.adminDisplayName.length < 2)
      e.adminDisplayName = 'Mínimo 2 caracteres'
    if (!data.adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.adminEmail))
      e.adminEmail = 'Correo inválido'
    if (!data.adminPassword || data.adminPassword.length < 8)
      e.adminPassword = 'Mínimo 8 caracteres'
    if (data.adminPassword !== data.adminConfirmPassword)
      e.adminConfirmPassword = 'Las contraseñas no coinciden'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  return (
    <div className="flex flex-col h-full justify-between">
      <div>
        <h2 className="text-lg font-semibold">Cuenta de administrador</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 mb-6">
          Esta será la cuenta principal del sistema.
        </p>
        <div className="space-y-4">
          <div>
            <Label htmlFor="displayName">Nombre completo</Label>
            <Input
              id="displayName"
              value={data.adminDisplayName}
              onChange={e => onChange({ adminDisplayName: e.target.value })}
              placeholder="María García"
            />
            {errors.adminDisplayName && (
              <p className="text-xs text-red-500 mt-1">{errors.adminDisplayName}</p>
            )}
          </div>
          <div>
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              value={data.adminEmail}
              onChange={e => onChange({ adminEmail: e.target.value })}
              placeholder="admin@empresa.com"
            />
            {errors.adminEmail && (
              <p className="text-xs text-red-500 mt-1">{errors.adminEmail}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={data.adminPassword}
                onChange={e => onChange({ adminPassword: e.target.value })}
              />
              {errors.adminPassword && (
                <p className="text-xs text-red-500 mt-1">{errors.adminPassword}</p>
              )}
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirmar</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={data.adminConfirmPassword}
                onChange={e => onChange({ adminConfirmPassword: e.target.value })}
              />
              {errors.adminConfirmPassword && (
                <p className="text-xs text-red-500 mt-1">{errors.adminConfirmPassword}</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end pt-4 mt-4 border-t border-[hsl(var(--border))]">
        <Button onClick={() => { if (validate()) onNext() }}>Siguiente →</Button>
      </div>
    </div>
  )
}
