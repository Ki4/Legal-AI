import { useState } from 'react'
import { motion } from 'framer-motion'
import { Lock, FileCheck, Clock, Download, ShieldCheck, Loader2 } from 'lucide-react'
import { derivePreviewPayUrl, requestPreviewPay } from '../lib/previewPay'
import { hapticImpact, hapticSuccess, hapticError } from '../lib/telegram'

// preview-module G5 (#83). Shown after the form is submitted: the safe excerpt
// (G2/G3, already in the form-submit response) styled as a document page with a
// bottom fade + watermark, then the «Сплатити» → «Отримати документ» flow that
// calls the preview-pay workflow (G4) for the signed download URL.

type Phase = 'preview' | 'paying' | 'paid' | 'error'

// The async document tail (PDF export + Storage upload) finishes a little after
// the early response. If the user pays before it's ready, preview-pay answers
// `not_ready` (4xx) — we wait and retry rather than surface an error.
const RETRY_DELAY_MS = 2500
const MAX_ATTEMPTS = 24 // ~60s ceiling
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function openDocument(url: string) {
  // Telegram WebApp exposes openLink; fall back to a normal new tab in the browser.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- openLink is not in our minimal SDK shim
  const tg = window.Telegram?.WebApp as any
  if (tg?.openLink) tg.openLink(url)
  else window.open(url, '_blank', 'noopener')
}

export function PreviewPage({
  serviceTitle,
  caseId,
  excerpt,
}: {
  serviceTitle: string
  caseId: string
  excerpt: string
}) {
  const [phase, setPhase] = useState<Phase>('preview')
  const [signedUrl, setSignedUrl] = useState('')
  const [errMsg, setErrMsg] = useState('')
  const [waiting, setWaiting] = useState(false)

  const payUrl = derivePreviewPayUrl(
    import.meta.env.VITE_N8N_WEBHOOK_URL || '',
    import.meta.env.VITE_N8N_PREVIEW_PAY_URL || undefined,
  )

  async function handlePay() {
    hapticImpact('medium')
    setPhase('paying')
    setWaiting(false)
    const initData = window.Telegram?.WebApp?.initData || ''

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const outcome = await requestPreviewPay(payUrl, { caseId, initData })
      if (outcome.kind === 'paid') {
        setSignedUrl(outcome.signedUrl)
        setPhase('paid')
        hapticSuccess()
        return
      }
      if (outcome.kind === 'error') {
        setErrMsg(outcome.message)
        setPhase('error')
        hapticError()
        return
      }
      // not_ready → the document tail is still finishing; wait and retry.
      setWaiting(true)
      await sleep(RETRY_DELAY_MS)
    }
    setErrMsg('Документ ще готується. Спробуйте, будь ласка, за хвилину.')
    setPhase('error')
    hapticError()
  }

  return (
    <div className="flex flex-col h-dvh bg-surface">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        {/* Header */}
        <div className="mb-5 text-center">
          <h1 className="text-lg font-bold text-gray-900">{serviceTitle}</h1>
          <p className="text-xs text-gray-500 mt-0.5">Попередній перегляд документа</p>
        </div>

        {/* A4-styled document page with bottom fade + watermark */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="relative mx-auto bg-white shadow-card rounded-card overflow-hidden border border-gray-100"
          style={{ maxWidth: 440 }}
        >
          <div
            className="px-6 py-7 text-[12.5px] leading-relaxed text-gray-800 whitespace-pre-wrap min-h-[320px]"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif', textAlign: 'justify' }}
          >
            {excerpt}
          </div>

          {/* Watermark */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
            <span
              className="font-bold tracking-[0.25em] text-gray-900/[0.05] -rotate-45 select-none"
              style={{ fontSize: 64 }}
            >
              ЗРАЗОК
            </span>
          </div>

          {/* Bottom blur/fade — the rest of the document continues after payment */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-white via-white/95 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5 text-gray-400">
            <Lock size={13} />
            <span className="text-[11px] font-medium">Продовження — у повному документі</span>
          </div>
        </motion.div>

        {/* What you get after payment */}
        <div className="mt-5 bg-white rounded-card shadow-card border border-gray-100 p-4 space-y-2.5">
          <p className="text-xs font-semibold text-primary-600">Що ви отримаєте</p>
          <div className="flex gap-2.5 items-start">
            <FileCheck size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600 leading-relaxed">
              Повний документ у форматі PDF — готовий до подання в суд
            </p>
          </div>
          <div className="flex gap-2.5 items-start">
            <ShieldCheck size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600 leading-relaxed">
              Складено за чинним законодавством, з посиланнями на статті
            </p>
          </div>
          <div className="flex gap-2.5 items-start">
            <Clock size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600 leading-relaxed">
              Посилання на завантаження дійсне 24 години
            </p>
          </div>
        </div>
      </div>

      {/* Bottom CTA bar */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100 px-5 py-4">
        {phase === 'preview' && (
          <button
            type="button"
            onClick={handlePay}
            className="w-full py-3.5 rounded-btn bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 active:scale-95 transition-all duration-200"
          >
            Сплатити
          </button>
        )}

        {phase === 'paying' && (
          <button
            type="button"
            disabled
            className="w-full py-3.5 rounded-btn bg-primary-600/70 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-not-allowed"
          >
            <Loader2 size={16} className="animate-spin" />
            {waiting ? 'Готуємо документ…' : 'Обробляємо…'}
          </button>
        )}

        {phase === 'paid' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center justify-center gap-1.5 mb-2.5 text-green-600">
              <ShieldCheck size={16} />
              <span className="text-xs font-semibold">Оплачено — документ готовий</span>
            </div>
            <button
              type="button"
              onClick={() => { hapticImpact('light'); openDocument(signedUrl) }}
              className="w-full py-3.5 rounded-btn bg-green-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-green-700 active:scale-95 transition-all duration-200"
            >
              <Download size={16} />
              Отримати документ
            </button>
            <p className="text-[10px] text-gray-400 text-center mt-2">Посилання дійсне 24 години</p>
          </motion.div>
        )}

        {phase === 'error' && (
          <div>
            <p className="text-xs text-gray-500 text-center mb-2.5 leading-relaxed">{errMsg}</p>
            <button
              type="button"
              onClick={handlePay}
              className="w-full py-3.5 rounded-btn bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 active:scale-95 transition-all duration-200"
            >
              Спробувати ще раз
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
