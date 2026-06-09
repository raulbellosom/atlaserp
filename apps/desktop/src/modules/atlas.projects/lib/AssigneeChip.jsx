import { useState } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@atlas/ui'
import { useUserAvatarUrl } from './UserAvatarContext'

function getInitials(user) {
  return [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?'
}

function getFullName(user) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Usuario'
}

const SIZE_CLASSES = {
  sm: 'w-5 h-5 text-[9px]',
  md: 'w-6 h-6 text-[10px]',
  lg: 'w-8 h-8 text-xs',
}

export function AssigneeAvatar({ user, size = 'sm' }) {
  const [imgError, setImgError] = useState(false)
  const contextAvatarUrl = useUserAvatarUrl(user?.id)
  const avatarUrl = user?.avatarUrl ?? contextAvatarUrl
  const initials = getInitials(user)
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.md

  if (avatarUrl && !imgError) {
    return (
      <span className={`${sizeClass} rounded-full shrink-0 select-none overflow-hidden inline-flex`}>
        <img
          src={avatarUrl}
          alt={getFullName(user)}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      </span>
    )
  }

  return (
    <span className={`${sizeClass} aspect-square rounded-full bg-indigo-500 text-white inline-flex items-center justify-center font-medium shrink-0 select-none`}>
      {initials}
    </span>
  )
}

export function AssigneeChip({ user, maxChars = 14 }) {
  if (!user) return <span className="text-xs text-muted-foreground">—</span>
  const fullName = getFullName(user)
  const shortName = fullName.length > maxChars ? fullName.slice(0, maxChars) + '…' : fullName

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-default min-w-0">
            <AssigneeAvatar user={user} />
            <span className="text-xs text-muted-foreground truncate">{shortName}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-medium">{fullName}</p>
          {user.email && <p className="text-muted-foreground">{user.email}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function StackedAssignees({ assignees, fallback }) {
  const list = assignees?.length
    ? assignees.map((r) => r.user).filter(Boolean)
    : fallback ? [fallback] : []
  if (!list.length) return null
  const shown = list.slice(0, 3)
  const extra = list.length - shown.length
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((u, i) => (
        <span key={u.id ?? i} title={[u.firstName, u.lastName].filter(Boolean).join(' ')} className="shrink-0 inline-flex">
          <AssigneeAvatar user={u} size="sm" />
        </span>
      ))}
      {extra > 0 && (
        <span className="w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center text-[9px] text-muted-foreground font-medium shrink-0">
          +{extra}
        </span>
      )}
    </div>
  )
}
