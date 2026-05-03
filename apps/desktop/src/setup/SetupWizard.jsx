import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { atlas } from '../lib/atlas'
import { StepAdmin } from './StepAdmin'
import { StepCompany } from './StepCompany'
import { StepBranding } from './StepBranding'
import { StepReview } from './StepReview'

const STEPS = [
  { label: 'Cuenta admin', subtitle: 'Nombre, email, contraseña' },
  { label: 'Empresa', subtitle: 'Nombre de la empresa' },
  { label: 'Marca', subtitle: 'Logo y color principal' },
  { label: 'Revisar', subtitle: 'Confirmar e inicializar' }
]

export function SetupWizard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [formData, setFormData] = useState({
    adminDisplayName: '',
    adminEmail: '',
    adminPassword: '',
    adminConfirmPassword: '',
    companyName: '',
    primaryColor: '#6366f1',
    logo: null
  })

  function handleChange(patch) {
    setFormData(prev => ({ ...prev, ...patch }))
  }

  const mutation = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('adminDisplayName', formData.adminDisplayName)
      fd.append('adminEmail', formData.adminEmail)
      fd.append('adminPassword', formData.adminPassword)
      fd.append('companyName', formData.companyName)
      fd.append('primaryColor', formData.primaryColor)
      if (formData.logo) fd.append('logo', formData.logo)
      return atlas.setup.initialize(fd)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instance-status'] })
      navigate('/login', { replace: true })
    }
  })

  const stepProps = {
    data: formData,
    onChange: handleChange,
    onNext: () => setStep(s => s + 1),
    onBack: () => {
      mutation.reset()
      setStep(s => Math.max(0, s - 1))
    }
  }

  return (
    <div className="flex min-h-screen bg-[hsl(var(--background))]">
      <div className="w-56 bg-[hsl(var(--card))] border-r border-[hsl(var(--border))] p-6 flex flex-col shrink-0">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">Atlas ERP</p>
          <p className="text-sm font-semibold mt-1">Configuración inicial</p>
        </div>
        <div className="flex flex-col">
          {STEPS.map((s, i) => (
            <div key={i}>
              <div className={`flex items-start gap-2.5 ${i !== step ? 'opacity-40' : ''}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-semibold ${
                  i < step
                    ? 'bg-[hsl(var(--primary))]/70 text-[hsl(var(--primary-foreground))]'
                    : i === step
                    ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                    : 'border-2 border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'
                }`}>
                  {i < step ? <Check size={12} strokeWidth={2.5} /> : i + 1}
                </div>
                <div>
                  <p className="text-xs font-medium">{s.label}</p>
                  <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-0.5">{s.subtitle}</p>
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-px h-4 bg-[hsl(var(--border))] ml-2.5 my-1" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 p-10 max-w-120">
        {step === 0 && <StepAdmin {...stepProps} />}
        {step === 1 && <StepCompany {...stepProps} />}
        {step === 2 && <StepBranding {...stepProps} />}
        {step === 3 && (
          <StepReview
            data={formData}
            onBack={() => {
              mutation.reset()
              setStep(2)
            }}
            onSubmit={() => mutation.mutate()}
            isPending={mutation.isPending}
            error={mutation.error?.message}
          />
        )}
      </div>
    </div>
  )
}
