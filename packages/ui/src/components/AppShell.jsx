import { useState } from 'react'
import {
  LayoutDashboard, Puzzle, Settings, Contact, Wallet, Users, Shield,
  ChevronLeft, ChevronRight, Sun, Moon
} from 'lucide-react'
import { cn } from '../lib/utils.js'

const icons = { LayoutDashboard, Puzzle, Settings, Contact, Wallet, Users, Shield }

export function AppShell({ navigation = [], currentPath = '/', children, onThemeToggle, isDark }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={cn('min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]')}>
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-screen z-40 flex flex-col transition-all duration-300',
          collapsed ? 'w-16' : 'w-64',
          'glass-strong border-r border-[hsl(var(--border))]'
        )}
      >
        {/* Logo */}
        <div className={cn(
          'flex items-center gap-3 p-4 border-b border-[hsl(var(--border))]',
          collapsed && 'justify-center'
        )}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-sm">
            <span className="text-xs font-bold">A</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.25em] text-[hsl(var(--muted-foreground))]">Atlas</p>
              <h1 className="text-sm font-semibold leading-tight">ERP</h1>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {navigation.map((item) => {
            const Icon = icons[item.icon] ?? Puzzle
            const active = currentPath === item.path
            return (
              <a
                key={item.path}
                href={item.path}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-150',
                  collapsed && 'justify-center px-0',
                  active
                    ? 'glass-tinted text-indigo-500 dark:text-indigo-400 font-medium'
                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
                )}
              >
                <Icon size={17} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </a>
            )
          })}
        </nav>

        {/* Footer actions */}
        <div className={cn(
          'p-2 border-t border-[hsl(var(--border))] flex items-center gap-1',
          collapsed ? 'flex-col' : 'flex-row justify-between'
        )}>
          {onThemeToggle && (
            <button
              onClick={onThemeToggle}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
              title="Toggle theme"
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={cn(
          'transition-all duration-300 min-h-screen',
          collapsed ? 'ml-16' : 'ml-64'
        )}
      >
        {children}
      </main>
    </div>
  )
}
