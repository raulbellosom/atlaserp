import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

// Stored format:  @[uuid:DisplayName]
// Display format: @[DisplayName]   (no UUID visible in textarea)
const STORED_TOKEN_RE = /@\[([a-f0-9-]{36}):([^\]]+)\]/g
const DISPLAY_TOKEN_RE = /@\[([^\]]+)\]/g

export function renderMentionText(text) {
  if (!text) return null
  const parts = []
  let last = 0
  let match
  STORED_TOKEN_RE.lastIndex = 0
  while ((match = STORED_TOKEN_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push(
      <span
        key={match.index}
        className="inline-flex items-center bg-accent/30 text-accent-foreground rounded px-1 text-sm font-medium"
      >
        @{match[2]}
      </span>
    )
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length === 0 ? text : parts
}

export function parseMentionIds(text) {
  if (!text) return []
  const ids = []
  STORED_TOKEN_RE.lastIndex = 0
  let match
  while ((match = STORED_TOKEN_RE.exec(text)) !== null) {
    ids.push(match[1])
  }
  return [...new Set(ids)]
}

// Converts stored @[uuid:name] → display @[name], populating mentionMap
function toDisplay(serialized, mentionMap) {
  if (!serialized) return ''
  STORED_TOKEN_RE.lastIndex = 0
  return serialized.replace(STORED_TOKEN_RE, (_, uuid, name) => {
    mentionMap.set(name, uuid)
    return `@[${name}]`
  })
}

// Converts display @[name] → stored @[uuid:name] using mentionMap
function toSerialized(display, mentionMap) {
  if (!display) return ''
  DISPLAY_TOKEN_RE.lastIndex = 0
  return display.replace(DISPLAY_TOKEN_RE, (match, name) => {
    const uuid = mentionMap.get(name)
    return uuid ? `@[${uuid}:${name}]` : match
  })
}

function MemberAvatar({ member }) {
  const [imgErr, setImgErr] = useState(false)
  if (member.avatarUrl && !imgErr) {
    return (
      <img
        src={member.avatarUrl}
        alt={member.displayName}
        onError={() => setImgErr(true)}
        className="w-6 h-6 rounded-full object-cover shrink-0"
      />
    )
  }
  return (
    <span className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-xs font-medium shrink-0 select-none">
      {member.displayName.charAt(0).toUpperCase()}
    </span>
  )
}

/**
 * Textarea with @mention support.
 * Props:
 *   value, onChange(newValue) — controlled (serialized @[uuid:name] format)
 *   members — array of { id, displayName } for the mention picker
 *   placeholder, rows, className
 *   disabled
 */
export default function MentionTextarea({
  value = '',
  onChange,
  onBlur,
  onKeyDown: onKeyDownProp,
  members = [],
  placeholder,
  rows = 3,
  className = '',
  disabled = false,
  portalContainer = null,
}) {
  const mentionMap = useRef(new Map())
  // Internal state uses display format (@[name]); external value is stored format (@[uuid:name])
  const [displayValue, setDisplayValue] = useState(() => toDisplay(value, mentionMap.current))
  const lastSerializedRef = useRef(value)

  // Sync from outside only when value truly changed from an external source
  useEffect(() => {
    if (value !== lastSerializedRef.current) {
      lastSerializedRef.current = value
      const newDisplay = toDisplay(value, mentionMap.current)
      setDisplayValue(newDisplay)
    }
  }, [value])

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [triggerPos, setTriggerPos] = useState(0)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const [activeIdx, setActiveIdx] = useState(0)
  const textareaRef = useRef(null)
  const containerRef = useRef(null)

  const filtered = query
    ? members.filter((m) => {
        const q = query.toLowerCase()
        return (
          m.displayName.toLowerCase().includes(q) ||
          (m.email && m.email.toLowerCase().includes(q))
        )
      })
    : members

  function computeMenuPos(textarea) {
    const MENU_H = 260
    const MENU_W = 240
    const rect = textarea.getBoundingClientRect()
    const vvp = window.visualViewport
    const vw = vvp ? vvp.width : window.innerWidth
    const vh = vvp ? vvp.offsetTop + vvp.height : window.innerHeight

    // Mirror-div technique: get pixel position of the caret within the textarea
    let caretOffsetTop = 0
    let lineH = 20
    try {
      const cs = getComputedStyle(textarea)
      lineH = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4 || 20
      const mirror = document.createElement('div')
      for (const p of [
        'boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
        'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight',
      ]) mirror.style[p] = cs[p]
      mirror.style.position = 'absolute'
      mirror.style.visibility = 'hidden'
      mirror.style.top = '-9999px'
      mirror.style.whiteSpace = 'pre-wrap'
      mirror.style.wordWrap = 'break-word'
      mirror.style.overflowWrap = 'break-word'
      const caretSpan = document.createElement('span')
      caretSpan.textContent = '​'
      mirror.appendChild(document.createTextNode(textarea.value.slice(0, textarea.selectionStart)))
      mirror.appendChild(caretSpan)
      document.body.appendChild(mirror)
      caretOffsetTop = caretSpan.offsetTop
      document.body.removeChild(mirror)
    } catch (_) {}

    const paddingTop = parseFloat(getComputedStyle(textarea).paddingTop) || 0
    const caretTop = rect.top + paddingTop + caretOffsetTop - textarea.scrollTop
    const caretBottom = caretTop + lineH

    // Clamp so we don't anchor outside the visible textarea area
    const anchorBottom = Math.min(Math.max(caretBottom, rect.top + 4), rect.bottom)
    const anchorTop = Math.min(Math.max(caretTop, rect.top), rect.bottom - 4)

    const spaceBelow = vh - anchorBottom
    const spaceAbove = anchorTop

    const top = spaceBelow >= MENU_H + 8
      ? anchorBottom + 4
      : spaceAbove >= MENU_H + 8
        ? anchorTop - MENU_H - 4
        : anchorBottom + 4

    const left = Math.min(Math.max(8, rect.left), vw - MENU_W - 8)
    return { top, left }
  }

  const handleChange = useCallback(
    (e) => {
      const newDisplay = e.target.value
      setDisplayValue(newDisplay)
      const serialized = toSerialized(newDisplay, mentionMap.current)
      lastSerializedRef.current = serialized
      onChange(serialized)

      const caret = e.target.selectionStart
      const before = newDisplay.slice(0, caret)
      const atMatch = before.match(/@([^\s@\[]*)$/)
      if (atMatch && !before.match(/@\[[^\]]*$/)) {
        const atIdx = before.lastIndexOf('@')
        setTriggerPos(atIdx)
        setQuery(atMatch[1])
        setOpen(true)
        setActiveIdx(0)
        setMenuPos(computeMenuPos(e.target))
      } else {
        setOpen(false)
      }
    },
    [onChange]
  )

  const insertMention = useCallback(
    (member) => {
      const ta = textareaRef.current
      if (!ta) return
      const caret = ta.selectionStart
      const before = displayValue.slice(0, triggerPos)
      const after = displayValue.slice(caret)
      mentionMap.current.set(member.displayName, member.id)
      const token = `@[${member.displayName}]`
      const newDisplay = `${before}${token} ${after}`
      setDisplayValue(newDisplay)
      const serialized = toSerialized(newDisplay, mentionMap.current)
      lastSerializedRef.current = serialized
      onChange(serialized)
      setOpen(false)
      setQuery('')
      requestAnimationFrame(() => {
        const newCaret = before.length + token.length + 1
        ta.setSelectionRange(newCaret, newCaret)
        ta.focus()
      })
    },
    [displayValue, triggerPos, onChange]
  )

  function handleKeyDown(e) {
    if (open) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filtered[activeIdx]) {
          e.preventDefault()
          insertMention(filtered[activeIdx])
        }
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    } else {
      onKeyDownProp?.(e)
    }
  }

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        !e.target?.closest?.('[data-mention-dropdown]')
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleClick)
    return () => document.removeEventListener('pointerdown', handleClick)
  }, [open])

  const idRef = useRef(`mention-ta-${Math.random().toString(36).slice(2)}`)

  return (
    <div ref={containerRef} className="relative">
      <textarea
        ref={textareaRef}
        id={idRef.current}
        name={idRef.current}
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={`w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 ${className}`}
      />
      {open && filtered.length > 0 && createPortal(
        <div
          data-mention-dropdown
          className="min-w-50 max-w-65 rounded-xl py-1 overflow-y-auto"
          style={{
            position: 'fixed',
            top: menuPos.top,
            left: menuPos.left,
            zIndex: 9999,
            maxHeight: 260,
            backdropFilter: 'blur(var(--glass-blur))',
            WebkitBackdropFilter: 'blur(var(--glass-blur))',
            background: 'var(--glass-bg-strong)',
            border: '1px solid var(--glass-border)',
            boxShadow: 'var(--glass-shadow)',
          }}
        >
          {filtered.slice(0, 8).map((m, i) => (
            <button
              key={m.id}
              type="button"
              className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 ${
                i === activeIdx ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
              }`}
              onMouseEnter={() => setActiveIdx(i)}
              onPointerDown={(e) => {
                e.preventDefault()
                insertMention(m)
              }}
            >
              <MemberAvatar member={m} />
              <span className="truncate">{m.displayName}</span>
            </button>
          ))}
        </div>,
        portalContainer ?? document.body
      )}
    </div>
  )
}
