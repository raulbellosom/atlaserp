import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ModuleSidebar } from '@atlas/ui'
import { useRuntimeModules } from '../app/useRuntimeModules'

const TRIGGER_PX = 80
const HIDE_DELAY_MS = 400

export function ImmersiveShell({ children, moduleKey }) {
  const [overlayVisible, setOverlayVisible] = useState(false)
  const hideTimer = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { moduleMap } = useRuntimeModules()
  const module = moduleMap.get(moduleKey) ?? null

  const showOverlay = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setOverlayVisible(true)
  }, [])

  const scheduleHide = useCallback(() => {
    hideTimer.current = setTimeout(() => setOverlayVisible(false), HIDE_DELAY_MS)
  }, [])

  const cancelHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
  }, [])

  useEffect(() => {
    function onMouseMove(e) {
      if (e.clientX <= TRIGGER_PX && e.clientY <= TRIGGER_PX) showOverlay()
    }
    window.addEventListener('mousemove', onMouseMove)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [showOverlay])

  // Dismiss overlay on navigation (same pattern as AtlasApp mobile drawer)
  useEffect(() => {
    setOverlayVisible(false)
  }, [location.pathname])

  const handleNavigate = useCallback((path) => {
    navigate(path)
    setOverlayVisible(false)
  }, [navigate])

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Custom component — fills full viewport */}
      <div className="absolute inset-0 overflow-auto">
        {children}
      </div>

      {/* Desktop overlay sidebar — slide in from left */}
      {overlayVisible && (
        <div
          className="hidden lg:flex fixed inset-y-0 left-0 z-50 flex-col"
          style={{ animation: 'immersive-slide-in 0.2s ease-out' }}
          onMouseLeave={scheduleHide}
          onMouseEnter={cancelHide}
        >
          <ModuleSidebar
            module={module}
            currentPath={location.pathname}
            onNavigate={handleNavigate}
            collapsed={false}
            onCollapse={() => {}}
            mobileOpen={false}
            onMobileClose={() => {}}
          />
        </div>
      )}

      {/* Mobile: floating hamburger — always visible */}
      <button
        type="button"
        onClick={() => setOverlayVisible((v) => !v)}
        className="lg:hidden fixed bottom-4 left-4 z-50 h-11 w-11 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] flex items-center justify-center shadow-lg"
        aria-label="Abrir menú"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
          <rect y="2" width="18" height="2" rx="1" />
          <rect y="8" width="18" height="2" rx="1" />
          <rect y="14" width="18" height="2" rx="1" />
        </svg>
      </button>

      {/* Mobile: backdrop */}
      {overlayVisible && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOverlayVisible(false)}
        />
      )}

      {/* Mobile: full sidebar drawer */}
      {overlayVisible && (
        <div className="lg:hidden fixed inset-y-0 left-0 z-50">
          <ModuleSidebar
            module={module}
            currentPath={location.pathname}
            onNavigate={handleNavigate}
            collapsed={false}
            onCollapse={() => {}}
            mobileOpen={true}
            onMobileClose={() => setOverlayVisible(false)}
          />
        </div>
      )}
    </div>
  )
}
