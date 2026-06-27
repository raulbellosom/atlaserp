import { useState } from 'react'
import { useNoteFolders, useCreateNoteFolder } from '../hooks/useNoteFolders.js'

const SidebarItem = ({ label, icon, isActive, onClick, count }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
      isActive ? 'bg-amber-100 text-amber-800 font-medium' : 'text-gray-600 hover:bg-gray-100'
    }`}
  >
    <span className="text-base">{icon}</span>
    <span className="flex-1 text-left truncate">{label}</span>
    {count != null && <span className="text-xs text-gray-400">{count}</span>}
  </button>
)

export function NotesSidebar({ activeView, onViewChange }) {
  const { data: foldersData } = useNoteFolders()
  const createFolder = useCreateNoteFolder()
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)

  const folders = foldersData?.folders ?? []

  function handleCreateFolder(e) {
    e.preventDefault()
    if (!newFolderName.trim()) return
    createFolder.mutate({ name: newFolderName.trim() }, {
      onSuccess: () => {
        setNewFolderName('')
        setShowNewFolder(false)
      },
    })
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 border-r border-gray-200 py-3 px-2 gap-0.5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">Notas</p>

      <SidebarItem label="Todas las notas" icon="📝" isActive={activeView === 'all'} onClick={() => onViewChange('all')} />
      <SidebarItem label="Recientes" icon="🕐" isActive={activeView === 'recent'} onClick={() => onViewChange('recent')} />
      <SidebarItem label="Compartidas" icon="👥" isActive={activeView === 'shared'} onClick={() => onViewChange('shared')} />
      <SidebarItem label="Papelera" icon="🗑" isActive={activeView === 'trash'} onClick={() => onViewChange('trash')} />

      <div className="h-px bg-gray-200 my-2" />

      <div className="flex items-center justify-between px-2 mb-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Carpetas</p>
        <button onClick={() => setShowNewFolder(v => !v)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">+</button>
      </div>

      {showNewFolder && (
        <form onSubmit={handleCreateFolder} className="px-2 mb-1">
          <input
            autoFocus
            type="text"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="Nombre de carpeta..."
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-400"
            onKeyDown={e => e.key === 'Escape' && setShowNewFolder(false)}
          />
        </form>
      )}

      {folders.map(folder => (
        <SidebarItem
          key={folder.id}
          label={folder.name}
          icon={folder.icon ?? '📁'}
          isActive={activeView === `folder:${folder.id}`}
          onClick={() => onViewChange(`folder:${folder.id}`)}
          count={folder.note_count ?? undefined}
        />
      ))}

      {folders.length === 0 && !showNewFolder && (
        <p className="text-xs text-gray-400 px-3">Sin carpetas aun</p>
      )}
    </div>
  )
}
