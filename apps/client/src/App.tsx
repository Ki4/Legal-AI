import { useEffect, useState } from 'react'
import './index.css'
import { DynamicLegalFormBuilder } from './components/DynamicLegalFormBuilder'
import { SkeletonLoader } from './components/SkeletonLoader'
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal'
import { supabase } from './lib/supabase'
import { enableClosingConfirmation, disableClosingConfirmation, hideBackButton } from './lib/telegram'
import type { Answers, FormConfig } from './types/form'
import { Scale, Shield, Clock, FileText } from 'lucide-react'

// ── localStorage cache (TTL: 1 hour) ──────────────────────────────────────
const CACHE_TTL = 60 * 60 * 1000
function getCached(slug: string): FormConfig | null {
  try {
    const raw = localStorage.getItem(`fc_${slug}`)
    if (!raw) return null
    const { config, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL) return null
    return config
  } catch { return null }
}
function setCache(slug: string, config: FormConfig) {
  try { localStorage.setItem(`fc_${slug}`, JSON.stringify({ config, ts: Date.now() })) } catch { /* ignore */ }
}

// Telegram WebApp SDK type shim
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void
        expand: () => void
        close: () => void
        showAlert: (msg: string, cb?: () => void) => void
        showPopup: (params: object, cb?: (id: string) => void) => void
        MainButton: {
          text: string
          show: () => void
          hide: () => void
          onClick: (cb: () => void) => void
          offClick: (cb: () => void) => void
        }
        BackButton: {
          show: () => void
          hide: () => void
          onClick: (cb: () => void) => void
          offClick: (cb: () => void) => void
        }
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void
          selectionChanged: () => void
        }
        enableClosingConfirmation?: () => void
        disableClosingConfirmation?: () => void
        viewportHeight: number
        viewportStableHeight: number
        onEvent: (event: string, cb: () => void) => void
        offEvent: (event: string, cb: () => void) => void
        initDataUnsafe: {
          user?: { id: number; first_name: string; username?: string }
          start_param?: string
        }
        colorScheme: 'light' | 'dark'
        themeParams: Record<string, string>
      }
    }
  }
}

function SuccessScreen({ name, pending = false }: { name: string; pending?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-dvh px-6 text-center bg-surface">
      <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${pending ? 'bg-amber-100' : 'bg-green-100'}`}>
        <span className="text-4xl">{pending ? '⏳' : '✓'}</span>
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        {pending ? 'Дані обробляються...' : 'Дані успішно відправлено!'}
      </h2>
      <p className="text-sm text-gray-500 mb-6 leading-relaxed">
        {pending ? (
          <>Дякуємо, {name}. Зʼєднання було повільним, але ваші дані, ймовірно, збережені. Якщо документ не прийде протягом 10 хвилин — зверніться до підтримки.</>
        ) : (
          <>Дякуємо, {name}. Наш AI-юрист вже аналізує вашу справу і готує документи. Зазвичай це займає до 5 хвилин.</>
        )}
      </p>
      <div className="w-full p-4 bg-blue-50 border border-blue-100 rounded-card text-left">
        <p className="text-xs font-semibold text-primary-600 mb-1">Що далі?</p>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• Ви отримаєте повідомлення в Telegram</li>
          <li>• Документи будуть готові у форматі PDF</li>
          <li>• За потреби юрист звʼяжеться з вами</li>
        </ul>
      </div>
    </div>
  )
}

function ConsentScreen({ serviceName, onAccept }: { serviceName: string, onAccept: () => void }) {
  const [showPrivacy, setShowPrivacy] = useState(false)

  return (
    <div className="flex flex-col h-dvh bg-surface">
      <div className="flex-1 overflow-y-auto px-5 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Scale size={20} className="text-primary-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{serviceName}</h1>
            <p className="text-xs text-gray-500">Підготовка юридичного документа</p>
          </div>
        </div>

        {/* Info cards */}
        <div className="space-y-3 mb-6">
          <div className="bg-white rounded-card shadow-card p-4 flex gap-3">
            <FileText size={18} className="text-primary-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-0.5">Що буде далі</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Ви заповните форму з даними для документа. Після відправки AI-система підготує
                юридичний документ протягом кількох хвилин.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-card shadow-card p-4 flex gap-3">
            <Shield size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-0.5">Захист даних</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Ваші персональні дані шифруються (AES-256) і зберігаються відповідно до
                Закону України «Про захист персональних даних».
              </p>
            </div>
          </div>

          <div className="bg-white rounded-card shadow-card p-4 flex gap-3">
            <Clock size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-0.5">Строк зберігання</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Дані автоматично видаляються через 90 днів. Ви можете запросити
                видалення раніше у будь-який момент.
              </p>
            </div>
          </div>
        </div>

        {/* Privacy link */}
        <p className="text-center text-xs text-gray-400">
          Детальніше:{' '}
          <button
            type="button"
            onClick={() => setShowPrivacy(true)}
            className="text-primary-600 underline underline-offset-2"
          >
            Політика конфіденційності
          </button>
        </p>
      </div>

      {/* Bottom CTA */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100 px-5 py-4">
        <button
          type="button"
          onClick={onAccept}
          className="w-full py-3 rounded-btn bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 active:scale-95 transition-all duration-200"
        >
          Погоджуюсь, перейти до форми
        </button>
        <p className="text-[10px] text-gray-400 text-center mt-2 leading-tight">
          Натискаючи кнопку, ви погоджуєтесь на обробку персональних даних
        </p>
      </div>

      <PrivacyPolicyModal open={showPrivacy} onClose={() => setShowPrivacy(false)} />
    </div>
  )
}

function ErrorScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-dvh px-6 text-center bg-surface">
      <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <span className="text-3xl">✕</span>
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Послугу не знайдено</h2>
      <p className="text-sm text-gray-500">Спробуйте відкрити форму повторно через Telegram-бота.</p>
    </div>
  )
}

export default function App() {
  const [submitted, setSubmitted] = useState(false)
  const [submitPending, setSubmitPending] = useState(false)
  const [consented, setConsented] = useState(false)
  const [consentedAt, setConsentedAt] = useState('')
  const [userName, setUserName] = useState('')
  const [config, setConfig] = useState<FormConfig | null>(null)
  const [loadError, setLoadError] = useState(false)

  // Read service slug from URL param (set by Telegram bot inline button)
  const serviceSlug = new URLSearchParams(window.location.search).get('service') ?? 'divorce'

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (tg) {
      tg.ready()
      tg.expand()
      const user = tg.initDataUnsafe?.user
      if (user) setUserName(user.first_name)
    }
  }, [])

  useEffect(() => {
    // Serve from cache instantly, then refresh in background
    const cached = getCached(serviceSlug)
    if (cached) setConfig(cached)

    if (!supabase) {
      if (!cached) setLoadError(true)
      return
    }
    supabase
      .from('services')
      .select('form_config, title')
      .eq('slug', serviceSlug)
      .single()
      .then(({ data, error }) => {
        if (error || !data?.form_config) {
          if (!cached) setLoadError(true)
          return
        }
        const fresh = data.form_config as FormConfig
        setConfig(fresh)
        setCache(serviceSlug, fresh)
      })
  }, [serviceSlug])

  async function handleSubmit(answers: Answers) {
    const tg = window.Telegram?.WebApp
    const userId = tg?.initDataUnsafe?.user?.id
    const userIdFromUrl = new URLSearchParams(window.location.search).get('uid')

    const N8N_WEBHOOK = import.meta.env.VITE_N8N_WEBHOOK_URL || ''

    if (N8N_WEBHOOK) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      const resolvedUserId = String(userId || userIdFromUrl || 'dev_test')
      // Telegram first_name is needed by n8n "Ensure Profile" node when creating
      // a fresh profile for a user who never went through /start in the bot
      // (e.g. opened a forwarded form link). Falls back to 'Клієнт'.
      const tgFirstName = tg?.initDataUnsafe?.user?.first_name || 'Клієнт'
      console.log('[Legal AI] user_id:', resolvedUserId, '| source:', userId ? 'tg' : userIdFromUrl ? 'url' : 'fallback')

      try {
        const res = await fetch(N8N_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_slug: serviceSlug,
            user_id: resolvedUserId,
            user_first_name: tgFirstName,
            answers,
            consented_at: consentedAt,
          }),
          signal: controller.signal,
        })
        clearTimeout(timeout)
        const data = await res.json()
        if (!res.ok) {
          console.error('[Legal AI] Server error:', data)
          tg?.showAlert('Помилка відправки. Спробуйте ще раз.')
          return
        }
        console.log('[Legal AI] Submitted, case_id:', data.case_id)
      } catch (err) {
        clearTimeout(timeout)
        if ((err as Error).name === 'AbortError') {
          // Timeout — data MAY have been saved, show pending screen
          console.log('[Legal AI] Timeout — showing pending screen')
          setSubmitPending(true)
          setSubmitted(true)
          setUserName(tg?.initDataUnsafe?.user?.first_name || '')
          return
        } else {
          console.error('[Legal AI] Submit error:', err)
          tg?.showAlert('Помилка відправки. Спробуйте ще раз.')
          return
        }
      }
    } else {
      // Dev mode — log only
      console.log('[Legal AI] DEV MODE — answers:', JSON.stringify(answers, null, 2))
      await new Promise((r) => setTimeout(r, 800))
    }

    setSubmitted(true)
    setUserName(tg?.initDataUnsafe?.user?.first_name || '')
  }

  // ── Closing confirmation: enable when form has data, disable on success ──
  useEffect(() => {
    if (consented && !submitted) {
      enableClosingConfirmation()
    } else {
      disableClosingConfirmation()
    }
  }, [consented, submitted])

  // ── BackButton: hide on success/error/loading screens ──
  useEffect(() => {
    if (!consented || submitted || loadError || !config) {
      hideBackButton()
    }
  }, [consented, submitted, loadError, config])

  // ── Clear draft on successful submit ──
  useEffect(() => {
    if (submitted && !submitPending) {
      try { localStorage.removeItem(`draft_${serviceSlug}`) } catch { /* ignore */ }
    }
  }, [submitted, submitPending, serviceSlug])

  if (submitted)  return <SuccessScreen name={userName || 'Клієнт'} pending={submitPending} />
  if (loadError)  return <ErrorScreen />
  if (!config)    return <SkeletonLoader />

  if (!consented) {
    return (
      <ConsentScreen
        serviceName={config.title}
        onAccept={() => { setConsented(true); setConsentedAt(new Date().toISOString()) }}
      />
    )
  }

  return (
    <DynamicLegalFormBuilder
      config={config}
      serviceSlug={serviceSlug}
      onSubmit={handleSubmit}
    />
  )
}
