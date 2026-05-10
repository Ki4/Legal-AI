import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getViewportHeight, hapticSelection } from '../../../lib/telegram'

const UA_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
const UA_MONTHS_LONG = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
]
const UA_MONTHS_SHORT = [
  'Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер',
  'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру',
]

type ViewMode = 'day' | 'month' | 'year'

interface Props {
  id: string
  value: string   // 'YYYY-MM-DD' or ''
  onChange: (v: string) => void
  placeholder?: string
}

function parseYMD(v: string): { y: number; m: number; d: number } | null {
  if (!v) return null
  const [y, m, d] = v.split('-').map(Number)
  if (!y || !m || !d) return null
  return { y, m, d }
}

function formatDisplay(v: string) {
  const p = parseYMD(v)
  if (!p) return ''
  return `${String(p.d).padStart(2, '0')}.${String(p.m).padStart(2, '0')}.${p.y}`
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  return (new Date(year, month - 1, 1).getDay() + 6) % 7
}

interface CalPos { top: number; left: number; width: number; above: boolean }

const YEARS_PER_PAGE = 12  // 3 cols × 4 rows

export function DatePickerField({ id, value, onChange, placeholder = 'ДД.ММ.РРРР' }: Props) {
  const today = new Date()
  const parsed = parseYMD(value)

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<ViewMode>('day')
  const [viewY, setViewY] = useState(parsed?.y ?? today.getFullYear())
  const [viewM, setViewM] = useState(parsed?.m ?? today.getMonth() + 1)
  // Year grid page: base year of the current 12-year block
  const [yearBase, setYearBase] = useState(() =>
    Math.floor((parsed?.y ?? today.getFullYear()) / YEARS_PER_PAGE) * YEARS_PER_PAGE
  )
  const [pos, setPos] = useState<CalPos>({ top: 0, left: 0, width: 320, above: false })
  const wrapRef = useRef<HTMLDivElement>(null)
  const calRef = useRef<HTMLDivElement>(null)

  const calcPos = useCallback(() => {
    if (!wrapRef.current) return
    const r = wrapRef.current.getBoundingClientRect()
    const calH = 340
    const bottomBarH = 100 // tab pills + action buttons
    // Fix #6: use Telegram viewport height instead of window.innerHeight
    const vpHeight = getViewportHeight()
    const spaceBelow = vpHeight - r.bottom - bottomBarH
    const above = spaceBelow < calH && r.top > calH
    setPos({
      top: above ? r.top - calH - 6 : r.bottom + 6,
      left: Math.min(r.left, window.innerWidth - 300 - 8),
      width: Math.max(r.width, 280),
      above,
    })
  }, [])

  function openPicker() {
    const y = parsed?.y ?? today.getFullYear()
    const m = parsed?.m ?? today.getMonth() + 1
    calcPos()
    setViewY(y)
    setViewM(m)
    setYearBase(Math.floor(y / YEARS_PER_PAGE) * YEARS_PER_PAGE)
    setMode('day')
    setOpen(true)
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent | TouchEvent) {
      if (
        wrapRef.current?.contains(e.target as Node) ||
        calRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  // ── Day mode helpers ──
  function prevMonth() {
    if (viewM === 1) { setViewM(12); setViewY(y => y - 1) }
    else setViewM(m => m - 1)
  }
  function nextMonth() {
    if (viewM === 12) { setViewM(1); setViewY(y => y + 1) }
    else setViewM(m => m + 1)
  }
  function selectDay(d: number) {
    hapticSelection()
    onChange(`${viewY}-${String(viewM).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    setOpen(false)
  }

  // ── Month mode helpers ──
  function selectMonth(m: number) {
    setViewM(m)
    setMode('day')
  }

  // ── Year mode helpers ──
  function selectYear(y: number) {
    setViewY(y)
    setYearBase(Math.floor(y / YEARS_PER_PAGE) * YEARS_PER_PAGE)
    setMode('month')
  }

  // Day grid data
  const daysInMonth = getDaysInMonth(viewY, viewM)
  const firstDow = getFirstDayOfWeek(viewY, viewM)
  const cells: Array<number | null> = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  // Year grid: 12 years starting from yearBase
  const years = Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearBase + i)

  const calendar = (
    <AnimatePresence>
      {open && (
        <div
          ref={calRef}
          style={{
            position: 'fixed',
            zIndex: 9998,
            top: pos.top,
            left: pos.left,
            width: pos.width,
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: pos.above ? 6 : -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
          >
            {/* ── DAY VIEW ── */}
            {mode === 'day' && (
              <>
                {/* Nav bar */}
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
                  <button type="button" onClick={prevMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('month')}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-sm font-bold text-gray-900">{UA_MONTHS_LONG[viewM - 1]}</span>
                    <span className="text-sm font-bold text-primary-600">{viewY}</span>
                    <ChevronDown size={12} className="text-gray-400" />
                  </button>
                  <button type="button" onClick={nextMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
                    <ChevronRight size={16} />
                  </button>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 px-3 pt-2 pb-1">
                  {UA_DAYS.map((d, i) => (
                    <div key={d} className={`text-center text-[11px] font-semibold py-1 ${i >= 5 ? 'text-red-400' : 'text-gray-400'}`}>
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day grid */}
                <div className="grid grid-cols-7 px-3 pb-2 gap-y-0.5">
                  {cells.map((day, i) => {
                    if (!day) return <div key={`e-${i}`} />
                    const dayStr = `${viewY}-${String(viewM).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const isSelected = dayStr === value
                    const isToday = dayStr === todayStr
                    const isWeekend = (firstDow + (day - 1)) % 7 >= 5
                    return (
                      <button key={day} type="button" onClick={() => selectDay(day)}
                        className={`h-9 w-full flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-150 select-none
                          ${isSelected
                            ? 'bg-primary-600 text-white shadow-sm'
                            : isToday
                            ? 'bg-primary-50 text-primary-700 font-bold'
                            : isWeekend
                            ? 'text-red-400 hover:bg-red-50'
                            : 'text-gray-700 hover:bg-gray-100'
                          }`}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center px-4 py-2 border-t border-gray-100">
                  <button type="button" onClick={() => { onChange(''); setOpen(false) }}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                    Очистити
                  </button>
                  <button type="button"
                    onClick={() => { setViewY(today.getFullYear()); setViewM(today.getMonth() + 1); selectDay(today.getDate()) }}
                    className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors">
                    Сьогодні
                  </button>
                </div>
              </>
            )}

            {/* ── MONTH VIEW ── */}
            {mode === 'month' && (
              <>
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
                  <button type="button" onClick={() => setViewY(y => y - 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setYearBase(Math.floor(viewY / YEARS_PER_PAGE) * YEARS_PER_PAGE); setMode('year') }}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <span className="text-sm font-bold text-primary-600">{viewY}</span>
                    <ChevronDown size={12} className="text-gray-400" />
                  </button>
                  <button type="button" onClick={() => setViewY(y => y + 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 p-3">
                  {UA_MONTHS_SHORT.map((name, i) => {
                    const m = i + 1
                    const isActive = m === viewM && viewY === (parsed?.y ?? today.getFullYear()) && value
                    const isCurrent = m === today.getMonth() + 1 && viewY === today.getFullYear()
                    return (
                      <button key={m} type="button" onClick={() => selectMonth(m)}
                        className={`py-2.5 rounded-xl text-sm font-medium transition-all
                          ${isActive
                            ? 'bg-primary-600 text-white'
                            : isCurrent
                            ? 'bg-primary-50 text-primary-700 font-semibold'
                            : 'text-gray-700 hover:bg-gray-100'
                          }`}
                      >
                        {name}
                      </button>
                    )
                  })}
                </div>

                <div className="px-4 py-2 border-t border-gray-100">
                  <button type="button" onClick={() => setMode('day')}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                    ← Назад
                  </button>
                </div>
              </>
            )}

            {/* ── YEAR VIEW ── */}
            {mode === 'year' && (
              <>
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
                  <button type="button" onClick={() => setYearBase(b => b - YEARS_PER_PAGE)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm font-bold text-gray-700">
                    {yearBase} – {yearBase + YEARS_PER_PAGE - 1}
                  </span>
                  <button type="button" onClick={() => setYearBase(b => b + YEARS_PER_PAGE)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 p-3">
                  {years.map(y => {
                    const isActive = y === viewY
                    const isCurrent = y === today.getFullYear()
                    return (
                      <button key={y} type="button" onClick={() => selectYear(y)}
                        className={`py-2.5 rounded-xl text-sm font-medium transition-all
                          ${isActive
                            ? 'bg-primary-600 text-white'
                            : isCurrent
                            ? 'bg-primary-50 text-primary-700 font-semibold'
                            : 'text-gray-700 hover:bg-gray-100'
                          }`}
                      >
                        {y}
                      </button>
                    )
                  })}
                </div>

                <div className="px-4 py-2 border-t border-gray-100">
                  <button type="button" onClick={() => setMode('month')}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                    ← Назад
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )

  return (
    <div ref={wrapRef} className="mt-1">
      <div
        className={`form-input flex items-center justify-between cursor-pointer select-none ${
          open ? 'border-primary-500 ring-2 ring-primary-100' : ''
        }`}
        onClick={openPicker}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && openPicker()}
        id={id}
      >
        <span className={value ? 'text-gray-800' : 'text-gray-400'}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <Calendar size={16} className={`flex-shrink-0 ${open ? 'text-primary-500' : 'text-gray-400'}`} />
      </div>
      {createPortal(calendar, document.body)}
    </div>
  )
}
