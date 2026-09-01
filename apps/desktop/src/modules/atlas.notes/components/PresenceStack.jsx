import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@atlas/ui'

const MAX_VISIBLE = 3

function initials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Small avatar stack showing which other users currently have this note
// open — sourced from the Y.js awareness channel via usePresence(). Renders
// nothing when nobody else is present, so the common case stays quiet.
export function PresenceStack({ users }) {
  if (!users || users.length === 0) return null

  const visible = users.slice(0, MAX_VISIBLE)
  const overflow = users.length - visible.length

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center -space-x-2">
        {visible.map((user) => (
          <Tooltip key={user.clientId}>
            <TooltipTrigger asChild>
              <Avatar
                className="w-6 h-6 ring-2 ring-background"
                style={{ outline: `1px solid ${user.color ?? 'transparent'}` }}
              >
                {user.avatarUrl && (
                  <AvatarImage src={user.avatarUrl} alt={user.name ?? ''} />
                )}
                <AvatarFallback
                  className="text-[10px] text-white"
                  style={{ backgroundColor: user.color ?? undefined }}
                >
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>{user.name || 'Colaborador'}</TooltipContent>
          </Tooltip>
        ))}
        {overflow > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-6 h-6 rounded-full ring-2 ring-background bg-muted text-muted-foreground text-[10px] font-medium flex items-center justify-center">
                +{overflow}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {users
                .slice(MAX_VISIBLE)
                .map((u) => u.name || 'Colaborador')
                .join(', ')}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}
