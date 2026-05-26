import { Outlet } from 'react-router-dom'

export function PublicShell() {
  return (
    <div className="min-h-dvh bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <Outlet />
    </div>
  )
}
