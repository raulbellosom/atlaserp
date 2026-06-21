import React from 'react'

const TOOLS = [
  { id: 'SELECT', label: 'Seleccionar', preview: null },
  null,
  { id: 'TABLE_SQUARE', label: 'Mesa cuadrada', preview: 'square' },
  { id: 'TABLE_ROUND', label: 'Mesa redonda', preview: 'round' },
  null,
  { id: 'BAR', label: 'Barra', preview: 'bar' },
  { id: 'WALL', label: 'Pared', preview: 'wall' },
  { id: 'PLANT', label: 'Planta', preview: 'plant' },
  { id: 'DOOR', label: 'Puerta', preview: 'door' },
]

function Preview({ type }) {
  if (!type) return <span className="w-4 h-4 text-xs flex items-center justify-center font-bold">&#8598;</span>
  if (type === 'square') return <div className="w-4 h-4 rounded border-2 border-current shrink-0" />
  if (type === 'round') return <div className="w-4 h-4 rounded-full border-2 border-current shrink-0" />
  if (type === 'bar') return <div className="w-4 h-2 rounded-sm bg-slate-500 shrink-0" />
  if (type === 'wall') return <div className="w-4 h-1 bg-slate-700 shrink-0" />
  if (type === 'plant') return <div className="w-4 h-4 rounded-full bg-green-500 shrink-0" />
  if (type === 'door') return <div className="w-4 h-2 rounded-sm border border-current shrink-0" />
  return null
}

export function FloorToolbox({ activeTool, onToolChange }) {
  return (
    <div className="w-44 shrink-0 border-r border-border bg-card flex flex-col overflow-y-auto">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 pt-4 pb-2">
        Herramientas
      </div>
      <div className="flex flex-col gap-0">
        {TOOLS.map((tool, idx) => {
          if (tool === null) {
            return <hr key={`sep-${idx}`} className="border-border my-1.5" />
          }
          return (
            <button
              key={tool.id}
              onClick={() => onToolChange(tool.id)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-left transition-colors ${
                activeTool === tool.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Preview type={tool.preview} />
              <span>{tool.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
