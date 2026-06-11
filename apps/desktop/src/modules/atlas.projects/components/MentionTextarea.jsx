import { useState, useRef, useEffect, useCallback } from 'react'

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
    ? members.filter((m) => m.displayName.toLowerCase().includes(query.toLowerCase()))
    : members

  function getCaretRect(el, pos) {
    const div = document.createElement('div')
    const style = getComputedStyle(el)
    for (const prop of style) div.style[prop] = style[prop]
    div.style.position = 'absolute'
    div.style.visibility = 'hidden'
    div.style.whiteSpace = 'pre-wrap'
    div.style.wordBreak = 'break-word'
    div.style.overflow = 'hidden'
    div.textContent = el.value.slice(0, pos)
    const span = document.createElement('span')
    span.textContent = '|'
    div.appendChild(span)
    document.body.appendChild(div)
    const rect = span.getBoundingClientRect()
    document.body.removeChild(div)
    return rect
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
        // Only open picker for bare @ (not inside an already-inserted @[name] token)
        const atIdx = before.lastIndexOf('@')
        setTriggerPos(atIdx)
        setQuery(atMatch[1])
        setOpen(true)
        setActiveIdx(0)
        const rect = getCaretRect(e.target, caret)
        const MENU_H = 300
        const spaceBelow = window.innerHeight - rect.bottom
        const top = spaceBelow < MENU_H + 8
          ? Math.max(4, rect.top - MENU_H - 4)
          : rect.bottom + 4
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - 260))
        setMenuPos({ top, left })
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
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handleClick)
    return () => document.removeEventListener('pointerdown', handleClick)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <textarea
        ref={textareaRef}
        value={displayValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={`w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 ${className}`}
      />
      {open && filtered.length > 0 && (
        <div
          className="fixed z-9999 min-w-45 max-w-60 bg-popover border border-border rounded-md shadow-lg py-1"
          style={{ top: menuPos.top, left: menuPos.left }}
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
              <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                {m.displayName.charAt(0).toUpperCase()}
              </span>
              {m.displayName}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
