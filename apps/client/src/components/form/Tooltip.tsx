import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  text: string
}

export function Tooltip({ text }: Props) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, placement: 'top' as 'top' | 'bottom' })
  const btnRef = useRef<HTMLButtonElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const calcPos = useCallback(() => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    const placement: 'top' | 'bottom' = r.top > 120 ? 'top' : 'bottom'
    setPos({ top: placement === 'top' ? r.top - 8 : r.bottom + 8, left: r.left + r.width / 2, placement })
  }, [])

  function show() {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    calcPos()
    setVisible(true)
  }

  function hide() {
    closeTimer.current = setTimeout(() => setVisible(false), 80)
  }

  // Close on outside click (for tap-to-open on mobile)
  useEffect(() => {
    if (!visible) return
    function onOutside(e: MouseEvent | TouchEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setVisible(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('touchstart', onOutside)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('touchstart', onOutside)
    }
  }, [visible])

  const bubbleStyle = pos.placement === 'top'
    ? { bottom: `calc(100vh - ${pos.top}px + 6px)` }
    : { top: pos.top + 6 }

  const arrowStyle = pos.placement === 'top'
    ? { borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #111827', top: '100%' }
    : { borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '5px solid #111827', bottom: '100%' }

  return (
    <span className="inline-flex items-center ml-1.5">
      <button
        ref={btnRef}
        type="button"
        className="text-gray-400 hover:text-primary-600 transition-colors focus:outline-none"
        onMouseEnter={show}
        onMouseLeave={hide}
        onClick={() => (visible ? setVisible(false) : show())}
        aria-label="Підказка"
      >
        <HelpCircle size={15} />
      </button>

      {createPortal(
        <AnimatePresence>
          {visible && (() => {
            const clampedLeft = Math.max(8, Math.min(pos.left - 110, window.innerWidth - 228))
            const arrowLeft = pos.left - clampedLeft
            return (
            // Outer div handles fixed positioning (no framer transform interference)
            <div
              style={{
                position: 'fixed',
                zIndex: 9999,
                left: clampedLeft,
                maxWidth: 220,
                width: 'fit-content',
                pointerEvents: 'auto',
                ...bubbleStyle,
              }}
              onMouseEnter={() => { if (closeTimer.current) clearTimeout(closeTimer.current) }}
              onMouseLeave={hide}
            >
              {/* Inner motion.div handles animation only */}
              <motion.div
                initial={{ opacity: 0, y: pos.placement === 'top' ? 6 : -6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
              >
                <div className="bg-gray-900 text-white text-xs rounded-xl p-3 shadow-2xl leading-relaxed relative" style={{ textWrap: 'balance' } as React.CSSProperties}>
                  {text}
                  <span
                    className="absolute w-0 h-0"
                    style={{ ...arrowStyle, left: arrowLeft, transform: 'translateX(-50%)' }}
                  />
                </div>
              </motion.div>
            </div>
            )
          })()}
        </AnimatePresence>,
        document.body
      )}
    </span>
  )
}
