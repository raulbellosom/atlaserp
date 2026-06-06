import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { TextField, TextareaField, CreatableComboboxField } from '@atlas/ui'

const GIROS = [
  { value: 'restaurantes',     label: 'Restaurantes y alimentos' },
  { value: 'spa',              label: 'Spa y bienestar' },
  { value: 'ecommerce',        label: 'Comercio electronico' },
  { value: 'servicios',        label: 'Servicios profesionales' },
  { value: 'agencia',          label: 'Agencia creativa' },
  { value: 'salud',            label: 'Salud y medicina' },
  { value: 'educacion',        label: 'Educacion' },
  { value: 'entretenimiento',  label: 'Entretenimiento' },
  { value: 'hosteleria',       label: 'Hosteleria y turismo' },
  { value: 'tecnologia',       label: 'Tecnologia' },
  { value: 'construccion',     label: 'Construccion' },
  { value: 'legal',            label: 'Servicios legales' },
  { value: 'moda',             label: 'Moda y ropa' },
]

const schema = z.object({
  name:        z.string().min(1, 'Requerido').max(255),
  domain:      z.string().max(255).optional(),
  giro:        z.string().max(100).optional(),
  description: z.string().max(500).optional(),
})

export function WizardStepInfo({ defaultValues, onNext, onBack }) {
  const { register, handleSubmit, control, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? { name: '', domain: '', giro: '', description: '' },
  })

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-4">
      <TextField
        label="Nombre del sitio"
        placeholder="Mi empresa S.A."
        required
        error={errors.name?.message}
        {...register('name')}
      />
      <TextField
        label="Dominio"
        placeholder="misitioweb.com"
        hint="Puedes configurarlo despues si aun no lo tienes."
        {...register('domain')}
      />
      <Controller
        name="giro"
        control={control}
        render={({ field }) => (
          <CreatableComboboxField
            label="Giro o sector"
            hint="Opcional"
            placeholder="Buscar o escribir giro..."
            options={GIROS}
            value={field.value}
            onChange={field.onChange}
            onCreate={(newVal) => field.onChange(newVal)}
          />
        )}
      />
      <TextareaField
        label="Descripcion corta"
        placeholder="Breve descripcion de tu negocio o sitio."
        {...register('description')}
      />
      <div className="flex gap-3 pt-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-3 rounded-xl font-semibold text-sm text-foreground border-2 border-border hover:bg-muted transition-all"
          >
            Atras
          </button>
        )}
        <button
          type="submit"
          className="flex-1 py-3 rounded-xl font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
        >
          Siguiente
        </button>
      </div>
    </form>
  )
}
