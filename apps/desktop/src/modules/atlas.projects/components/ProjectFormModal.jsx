import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
  Button, TextField, SelectField, MarkdownField, ConfirmDialog,
} from '@atlas/ui'
import { toast } from 'sonner'
import { useCreateProject, useUpdateProject, useArchiveProject } from '../hooks/useProjectsData'
import { PROJECT_ICONS, getProjectIcon } from '../lib/projectIcons.js'

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
  const [icon, setIcon] = useState('FolderKanban')
  const [template, setTemplate] = useState('general')
  const [archiveOpen, setArchiveOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setName(project?.name ?? '')
      setDescription(project?.description ?? '')
      setColor(project?.color ?? '#6366f1')
      setIcon(project?.icon ?? 'FolderKanban')
      setTemplate('general')
    }
  }, [open, project])

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    if (isEdit) {
      updateProject.mutate(
        { name: trimmed, description: description.trim() || null, color, icon },
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
        { name: trimmed, description: description.trim() || null, color, icon, template },
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
  const SelectedIcon = getProjectIcon(icon)

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar proyecto' : 'Nuevo proyecto'}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit ? 'Editar los datos del proyecto' : 'Crear un nuevo proyecto'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Preview badge + Name */}
          <div className="flex items-center gap-3">
            <span
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: color }}
            >
              <SelectedIcon size={18} className="text-white" />
            </span>
            <TextField
              label="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del proyecto"
              required
              className="flex-1"
            />
          </div>

          {/* Color + Icon side by side */}
          <div className="grid grid-cols-2 gap-4">
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

            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                Icono
              </label>
              <div className="grid grid-cols-8 gap-0.5 max-h-28 overflow-y-auto rounded-lg border border-border p-1">
                {PROJECT_ICONS.map(({ name: iName, Icon: Ic }) => (
                  <button
                    key={iName}
                    type="button"
                    onClick={() => setIcon(iName)}
                    title={iName}
                    className={[
                      'w-7 h-7 rounded flex items-center justify-center transition-all',
                      icon === iName
                        ? 'text-white'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                    ].join(' ')}
                    style={icon === iName ? { background: color } : {}}
                  >
                    <Ic size={13} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <MarkdownField
            label="Descripcion"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripcion opcional..."
          />

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
