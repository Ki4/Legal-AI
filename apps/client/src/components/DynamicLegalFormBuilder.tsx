import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Scale, ChevronRight, ChevronLeft, Send } from 'lucide-react'
import type { FormConfig, Answers } from '../types/form'
import { isVisible } from '../lib/conditions'
import {
  loadDraft, saveDraft,
  countVisible, countAnswered, countRequired, countRequiredAnswered,
  validateForm as validateFormUtil, validateFormats as validateFormatsUtil,
  findFirstErrorTab as findFirstErrorTabUtil,
  isAnswered, clearStaleAnswers,
} from '../lib/form-utils'
import { hapticSuccess, hapticError, hapticImpact, showBackButton, hideBackButton } from '../lib/telegram'
import { FormFieldRenderer } from './form/FormField'

interface Props {
  config: FormConfig
  serviceSlug: string
  onSubmit: (answers: Answers) => void | Promise<void>
  loading?: boolean
}

export function DynamicLegalFormBuilder({ config, serviceSlug, onSubmit, loading = false }: Props) {
  const [activeTabIdx, setActiveTabIdx] = useState(0)
  // ── Fix #1: Restore draft from localStorage ──
  const [answers, setAnswers] = useState<Answers>(() => loadDraft(serviceSlug))
  const [submitting, setSubmitting] = useState(false)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [formatErrors, setFormatErrors] = useState<{ label: string; message: string }[]>([])
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const activeTab = config.tabs[activeTabIdx]
  const totalTabs = config.tabs.length
  const isLast = activeTabIdx === totalTabs - 1

  const totalVisible = config.steps.filter(s => isVisible(s, answers)).length

  const totalAnswered = config.steps.filter((s) => {
    if (!isVisible(s, answers)) return false
    return isAnswered(answers[s.id])
  }).length

  const progress = totalVisible > 0 ? totalAnswered / totalVisible : 0

  // ── Fix #1: Persist draft on every change ──
  const handleChange = useCallback((id: string, value: Answers[string]) => {
    setAnswers((prev) => {
      const updated = { ...prev, [id]: value }
      const next = clearStaleAnswers(config.steps, updated)
      saveDraft(serviceSlug, next)
      return next
    })
    if (validationErrors.length > 0) setValidationErrors([])
    if (formatErrors.length > 0) setFormatErrors([])
  }, [config.steps, serviceSlug, validationErrors.length, formatErrors.length])

  function goToTab(idx: number) {
    if (idx < 0 || idx >= totalTabs) return
    setDirection(idx > activeTabIdx ? 1 : -1)
    setActiveTabIdx(idx)
    hapticImpact('light')
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    // Scroll active tab pill fully into view
    setTimeout(() => {
      tabRefs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }, 30)
  }

  // ── Fix #2: Telegram BackButton ──
  useEffect(() => {
    if (activeTabIdx > 0) {
      showBackButton(() => goToTab(activeTabIdx - 1))
    } else {
      hideBackButton()
    }
    return () => hideBackButton()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabIdx])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault()
        goToTab(activeTabIdx - 1)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabIdx])

  // ── Fix #5: Better swipe — track both X and Y, require intentional horizontal gesture ──
  function onTouchStart(e: React.TouchEvent) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStart.current === null) return
    const dx = touchStart.current.x - e.changedTouches[0].clientX
    const dy = touchStart.current.y - e.changedTouches[0].clientY
    // Only switch tab if horizontal swipe is dominant and exceeds 80px threshold
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2) {
      if (dx > 0) goToTab(activeTabIdx + 1)
      else goToTab(activeTabIdx - 1)
    }
    touchStart.current = null
  }

  function validateForm(): string[] {
    return validateFormUtil(config, answers)
  }

  function findFirstErrorTab(): number {
    return findFirstErrorTabUtil(config, answers)
  }

  async function handleSubmit() {
    const errors = validateForm()
    const fmtErrors = validateFormatsUtil(config, answers)
    if (errors.length > 0 || fmtErrors.length > 0) {
      setValidationErrors(errors)
      setFormatErrors(fmtErrors)
      setSubmitAttempted(true)
      hapticError()
      const errorTab = findFirstErrorTab()
      if (errorTab >= 0) goToTab(errorTab)
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setValidationErrors([])
    setFormatErrors([])
    setSubmitAttempted(false)
    setSubmitting(true)
    hapticSuccess()
    try {
      await onSubmit(answers)
    } finally {
      setSubmitting(false)
    }
  }

  const currentTabFields = config.steps.filter((s) => s.tab === activeTab.id)
  const tabAnswered = countAnswered(config, activeTab.id, answers)
  const tabVisible = countVisible(config, activeTab.id, answers)

  const slideVariants = {
    enter: (d: number) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -40 : 40, opacity: 0 }),
  }

  return (
    // ── Fix #4: h-dvh instead of h-screen for iOS keyboard ──
    <div className="flex flex-col h-dvh bg-surface overflow-hidden">

      {/* ── MINIMAL TOP HEADER ── */}
      <div className="bg-white flex-shrink-0 border-b border-gray-100 px-4 pt-3 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Scale size={14} className="text-primary-600" />
          </div>
          <span className="text-sm font-bold text-gray-900 flex-1 truncate">{config.title}</span>
          <span className="text-xs text-gray-400 flex-shrink-0">
            {tabAnswered}/{tabVisible} полів
          </span>
        </div>
        {/* Thin progress line */}
        <div className="h-[3px] bg-gray-100 rounded-full overflow-hidden mt-2">
          <motion.div
            className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full"
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
          />
        </div>
      </div>

      {/* Validation errors banner */}
      {(validationErrors.length > 0 || formatErrors.length > 0) && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 flex-shrink-0">
          {validationErrors.length > 0 && (
            <>
              <p className="text-xs font-semibold text-red-700 mb-1">
                Заповніть обов'язкові поля ({validationErrors.length}):
              </p>
              <p className="text-xs text-red-600 line-clamp-2">
                {validationErrors.slice(0, 5).join(', ')}{validationErrors.length > 5 ? ` та ще ${validationErrors.length - 5}...` : ''}
              </p>
            </>
          )}
          {formatErrors.length > 0 && (
            <>
              <p className={`text-xs font-semibold text-red-700 mb-1${validationErrors.length > 0 ? ' mt-2' : ''}`}>
                Перевірте формат полів ({formatErrors.length}):
              </p>
              <p className="text-xs text-red-600 line-clamp-2">
                {formatErrors.slice(0, 5).map(e => e.label).join(', ')}{formatErrors.length > 5 ? ` та ще ${formatErrors.length - 5}...` : ''}
              </p>
            </>
          )}
        </div>
      )}

      {/* Fields — max space */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={activeTab.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="px-4 pt-4 pb-4"
          >
            {currentTabFields.map((field) => (
              <FormFieldRenderer
                key={field.id}
                field={field}
                answers={answers}
                onChange={handleChange}
                forceShowError={submitAttempted}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── BOTTOM BAR: tabs + action ── */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100 px-4 pt-2 pb-2">
        {/* Tab pills row */}
        <div className="flex items-center gap-2 mb-1.5">
          <div className="tab-scroll-wrap">
            <div className="tab-scroll-inner">
              {config.tabs.map((tab, i) => {
                const answered = countAnswered(config, tab.id, answers)
                const visible = countVisible(config, tab.id, answers)
                const reqTotal = countRequired(config, tab.id, answers)
                const reqDone = countRequiredAnswered(config, tab.id, answers)
                const done = reqTotal > 0 ? reqDone === reqTotal : (visible > 0 && answered === visible)
                return (
                  <button
                    key={tab.id}
                    ref={(el) => { tabRefs.current[i] = el }}
                    type="button"
                    onClick={() => goToTab(i)}
                    className={`tab-pill flex items-center gap-1 ${i === activeTabIdx ? 'active' : ''}`}
                  >
                    {done && i !== activeTabIdx && (
                      <span className="w-3.5 h-3.5 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-[9px] font-bold">✓</span>
                    )}
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
          {/* Step badge — outside scroll, always visible */}
          <span className="text-[11px] font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
            {activeTabIdx + 1}/{totalTabs}
          </span>
        </div>

        {/* Action buttons — slimmer */}
        <div className="flex gap-2">
          {activeTabIdx > 0 && (
            <button
              type="button"
              onClick={() => goToTab(activeTabIdx - 1)}
              className="flex items-center gap-1 px-4 py-2.5 rounded-btn border border-gray-200 text-sm font-medium text-gray-500 hover:border-gray-300 transition-all"
            >
              <ChevronLeft size={15} />
              Назад
            </button>
          )}
          {!isLast ? (
            <button
              type="button"
              onClick={() => goToTab(activeTabIdx + 1)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-btn bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 active:scale-95 transition-all duration-200"
            >
              Далі <ChevronRight size={15} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || loading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-btn bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 active:scale-95 transition-all duration-200 disabled:opacity-60"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Відправка...
                </span>
              ) : (
                <><Send size={15} /> Надіслати</>
              )}
            </button>
          )}
        </div>
      </div>

    </div>
  )
}
