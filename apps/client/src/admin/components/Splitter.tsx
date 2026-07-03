import { useCallback, useEffect, useRef, useState } from 'react'
import { GripVertical } from 'lucide-react'

const MIN_RATIO = 0.2
const MAX_RATIO = 0.8
const DEFAULT_RATIO = 0.5

function readRatio(storageKey: string): number {
  try {
    const raw = Number(localStorage.getItem(storageKey))
    return Number.isFinite(raw) && raw >= MIN_RATIO && raw <= MAX_RATIO ? raw : DEFAULT_RATIO
  } catch {
    return DEFAULT_RATIO
  }
}

function storeRatio(storageKey: string, ratio: number): void {
  try {
    localStorage.setItem(storageKey, String(ratio))
  } catch {
    /* localStorage unavailable (private mode) — this session only */
  }
}

/**
 * Two-pane draggable splitter, no libraries (issue #87 decision 4): dragging
 * the handle grows one pane and shrinks the other, Windows-Snap style. The
 * ratio persists globally in localStorage — one proportion for every service,
 * not per-service (decision: one global split, not per-service). Double-click
 * resets to 50/50.
 */
export function Splitter({
  storageKey,
  first,
  second,
  ariaLabel = 'Змінити розмір панелей',
}: {
  storageKey: string
  first: React.ReactNode
  second: React.ReactNode
  ariaLabel?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const [ratio, setRatioState] = useState(() => readRatio(storageKey))

  const applyRatio = useCallback(
    (next: number) => {
      const clamped = Math.round(Math.min(MAX_RATIO, Math.max(MIN_RATIO, next)) * 1000) / 1000
      setRatioState(clamped)
      storeRatio(storageKey, clamped)
    },
    [storageKey],
  )

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      if (rect.width <= 0) return
      applyRatio((e.clientX - rect.left) / rect.width)
    }
    function onUp() {
      draggingRef.current = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [applyRatio])

  return (
    <div ref={containerRef} className="flex h-full min-h-0 w-full">
      <div className="min-w-0 overflow-hidden flex-shrink-0" style={{ width: `${ratio * 100}%` }}>
        {first}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={ariaLabel}
        aria-valuenow={Math.round(ratio * 100)}
        tabIndex={0}
        onMouseDown={() => { draggingRef.current = true }}
        onDoubleClick={() => applyRatio(DEFAULT_RATIO)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') applyRatio(ratio - 0.02)
          else if (e.key === 'ArrowRight') applyRatio(ratio + 0.02)
        }}
        className="w-2 flex-shrink-0 flex items-center justify-center cursor-col-resize group
                   hover:bg-brand/10 active:bg-brand/20 transition-colors touch-none"
      >
        <GripVertical size={14} className="text-inkMute group-hover:text-brand pointer-events-none" aria-hidden />
      </div>
      <div className="min-w-0 overflow-hidden flex-1">
        {second}
      </div>
    </div>
  )
}
