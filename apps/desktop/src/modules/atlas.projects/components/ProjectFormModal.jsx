import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
  Button, TextField, SelectField, MarkdownField, ConfirmDialog,
} from '@atlas/ui'
import { toast } from 'sonner'
import { useCreateProject, useUpdateProject, useArchiveProject } from '../hooks/useProjectsData'

const TEMPLATE_OPTIONS = [
  { value: 'general',    label: 'General' },
  { value: 'desarrollo', label: 'Desarrollo' },
  { value: 'ventas',     label: 'Ventas' },
  { value: 'marketing',  label: 'Marketing' },
]

const PRESET_COLORS = [
  '#6366f1', '#3b82f6', '#22c55e', '#f59e0b',
  '#ef4444', '#a855f7', '#ec4899', '#64748b',
]

export default function ProjectFormModal({ open, onOpenChange, project, onCreated, onArchived }) {
  const isEdit = Boolean(project)
  const createProject = useCreateProject()
  const updateProject = useUpdateProject(project?.id)
  const archiveProject = useArchiveProject()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [template, setTemplate] = useState('general')
  const [archiveOpen, setArchiveOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setName(project?.name ?? '')
      setDescription(project?.description ?? '')
      setColor(project?.color ?? '#6366f1')
      setTemplate('general')
    }
  }, [open, project])

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    if (isEdit) {
      updateProject.mutate(
        { name: trimmed, description: description.trim() || null, color },
        {
          onSuccess: () => {
            toast.success('Proyecto actualizado')
            onOpenChange(false)
          },
          onError: () => toast.error('No se pudo actualizar el proyecto'),
        },
      )
    } else {
      createProject.mutate(
        { name: trimmed, description: description.trim() || null, color, template },
        {
          onSuccess: (data) => {
            toast.success('Proyecto creado')
            onOpenChange(false)
            onCreated?.(data?.data ?? data)
          },
          onError: () => toast.error('No se pudo crear el proyecto'),
        },
      )
    }
  }

  function handleArchive() {
    archiveProject.mutate(project.id, {
      onSuccess: () => {
        toast.success('Proyecto archivado')
        setArchiveOpen(false)
        onOpenChange(false)
        onArchived?.()
      },
      onError: () => toast.error('No se pudo archivar el proyecto'),
    })
  }

  const isPending = createProject.isPending || updateProject.isPending

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar proyecto' : 'Nuevo proyecto'}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? 'Editar los datos del proyecto' : 'Crear un nuevo proyecto'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextField
            label="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del proyecto"
            required
          />
          <MarkdownField
            label="Descripcion"
            value={description}
            onChange={setDescription}
            placeholder="Descripcion opcional..."
          />
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={[
                    'w-7 h-7 rounded-full border-2 transition-all',
                    color === c ? 'border-foreground scale-110' : 'border-transparent',
                  ].join(' ')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          {!isEdit && (
            <SelectField
              label="Plantilla de columnas"
              value={template}
              onValueChange={setTemplate}
              options={TEMPLATE_OPTIONS}
            />
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {isEdit && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive mr-auto"
                onClick={() => setArchiveOpen(true)}
              >
                Archivar
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || isPending}>
              {isEdit ? 'Guardar cambios' : 'Crear proyecto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      open={archiveOpen}
      onOpenChange={setArchiveOpen}
      title="Archivar proyecto"
      description={`El proyecto "${project?.name ?? ''}" se marcara como archivado. Podras restaurarlo desde la configuracion.`}
      confirmLabel="Archivar"
      onConfirm={handleArchive}
    />
    </>
  )
}
