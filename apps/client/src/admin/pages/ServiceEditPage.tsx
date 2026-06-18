import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AdminLayout } from '../components/AdminLayout'
import { FormBuilder } from '../components/FormBuilder'
import { Toast } from '../components/Toast'
import { DynamicLegalFormBuilder } from '../../components/DynamicLegalFormBuilder'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { FormConfig } from '../../types/form'
import {
  type ServiceStatus,
  SERVICE_STATUSES,
  toServiceStatus,
  isPublishedFor,
  STATUS_META,
} from '../../lib/serviceStatus'

type Tab = 'form' | 'ai' | 'settings'

const DEFAULT_CONFIG: FormConfig = {
  service_id: '',
  title:      '',
  subtitle:   '',
  tabs:       [{ id: 'general', label: 'Загальне' }],
  steps:      [],
}

const DEFAULT_PROMPT = `Ти досвідчений юрист. На основі наданих даних клієнта склади юридичний документ.

ВИМОГИ:
- Дотримуйся законодавства України
- Використовуй офіційний юридичний стиль
- Структурований документ з заголовками
- Вказуй конкретні статті законів
- Не вигадуй факти — використовуй лише надані дані

ДАНІ КЛІЄНТА:
{{answers}}

Склади повний текст документу.`

export function ServiceEditPage() {
  const { id }       = useParams<{ id: string }>()
  const isNew        = !id
  const navigate     = useNavigate()
  const { user }     = useAuth()

  const [tab, setTab]             = useState<Tab>('form')
  const [config, setConfig]       = useState<FormConfig>(DEFAULT_CONFIG)
  const [aiPrompt, setAiPrompt]   = useState(DEFAULT_PROMPT)
  const [icon, setIcon]           = useState('⚖️')
  const [description, setDesc]    = useState('')
  const [price, setPrice]         = useState(0)
  // New services start disabled — lawyer activates after review (DB default too).
  const [status, setStatus]       = useState<ServiceStatus>('disabled')
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [isDirty, setIsDirty]       = useState(false)
  const [previewModal, setPreviewModal] = useState(false)
  const [previewAnswerKey, setPreviewAnswerKey] = useState(0)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4000)
  }

  // Unsaved changes warning
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  // Load existing service
  useEffect(() => {
    if (isNew || !supabase) return
    supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          showToast('error', `Помилка завантаження: ${error.message}`)
          return
        }
        if (!data) return
        setConfig((data.form_config as FormConfig) ?? DEFAULT_CONFIG)
        setAiPrompt(data.ai_prompt ?? DEFAULT_PROMPT)
        setIcon(data.icon ?? '⚖️')
        setDesc(data.description ?? '')
        setPrice(data.price ?? 0)
        setStatus(toServiceStatus(data.status))
        setIsDirty(false)
      })
  }, [id, isNew])

  function markDirty() {
    setIsDirty(true)
  }

  async function handleSave() {
    if (!supabase || !user) return
    setSaving(true)

    const payload = {
      title:        config.title,
      slug:         config.service_id,
      form_config:  config,
      ai_prompt:    aiPrompt,
      icon,
      description,
      price,
      status,
      // deprecated mirror of status (migration 012) — kept coherent during deprecation
      is_published: isPublishedFor(status),
      lawyer_id:    user.id,
    }

    let error
    if (isNew) {
      ({ error } = await supabase.from('services').insert(payload))
    } else {
      ({ error } = await supabase.from('services').update(payload).eq('id', id))
    }

    setSaving(false)
    if (!error) {
      setSaved(true)
      setIsDirty(false)
      setTimeout(() => setSaved(false), 2000)
      showToast('success', 'Збережено ✓')
      if (isNew) navigate('/services')
    } else {
      showToast('error', `Помилка збереження: ${error.message}`)
    }
  }

  function handleConfigChange(c: FormConfig) {
    setConfig(c)
    markDirty()
  }

  const TABS: { id: Tab; icon: string; label: string; short: string }[] = [
    { id: 'form',     icon: '📋', label: 'Конструктор форми', short: 'Форма' },
    { id: 'ai',       icon: '🤖', label: 'AI-промпт',         short: 'AI' },
    { id: 'settings', icon: '⚙️', label: 'Налаштування',      short: 'Опції' },
  ]

  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-49px)] md:h-screen overflow-x-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-2 md:gap-4 px-3 md:px-6 py-3 md:py-4 border-b border-slate-800 flex-shrink-0">
          <button
            onClick={() => navigate('/services')}
            className="text-slate-400 hover:text-white transition-colors text-sm flex-shrink-0"
          >
            ← Назад
          </button>
          <div className="text-slate-600 hidden md:block">|</div>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <h1 className="text-white font-semibold text-sm truncate">
              {isNew ? 'Нова послуга' : config.title || 'Редагування'}
            </h1>
            {isDirty && (
              <span className="text-xs text-amber-500 flex-shrink-0">●</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Preview button — visible only on mobile/tablet (xl has side panel) */}
            {config.steps.length > 0 && (
              <button
                onClick={() => setPreviewModal(true)}
                className="xl:hidden px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-xl transition-colors flex-shrink-0"
                title="Переглянути форму"
              >
                👁
              </button>
            )}
            {/* Status control — authoritative kill-switch (migration 011/012) */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={`w-2 h-2 rounded-full ${STATUS_META[status].dot}`} title={STATUS_META[status].label} />
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value as ServiceStatus); markDirty() }}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-2 py-1.5
                           focus:outline-none focus:border-blue-500 cursor-pointer"
                title="Статус послуги. Лише «Активна» показується клієнтам."
              >
                {SERVICE_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 md:px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex-shrink-0"
            >
              {saving ? '⏳' : saved ? '✅' : '💾'}
              <span className="hidden sm:inline ml-1">
                {saving ? 'Зберігаю...' : saved ? 'Збережено' : 'Зберегти'}
              </span>
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 px-3 md:px-6 py-2 md:py-3 border-b border-slate-800 flex-shrink-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors whitespace-nowrap
                ${tab === t.id
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-500 hover:text-white hover:bg-slate-800/50'}`}
            >
              {t.icon} <span className="sm:hidden">{t.short}</span><span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left panel */}
          <div className="flex-1 overflow-y-auto p-6">

            {/* ── FORM BUILDER ── */}
            {tab === 'form' && (
              <FormBuilder config={config} onChange={handleConfigChange} />
            )}

            {/* ── AI PROMPT ── */}
            {tab === 'ai' && (
              <div className="max-w-2xl space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white mb-1">AI-промпт для документу</h2>
                  <p className="text-slate-400 text-sm mb-4">
                    Цей промпт отримує AI-модель разом з відповідями клієнта. Від нього залежить якість документу.
                  </p>

                  {/* Tips */}
                  <div className="bg-slate-800 rounded-xl p-4 mb-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">💡 Поради для якісного документу</p>
                    <ul className="text-sm text-slate-300 space-y-1.5">
                      <li>• Вказуй конкретні статті законів (ст. 71 СКУ, ст. 27 ЦПК)</li>
                      <li>• Опиши структуру документу: вступ, обставини, вимоги, підпис</li>
                      <li>• Додай "Не вигадуй факти — використовуй лише дані клієнта"</li>
                    </ul>
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Доступні змінні</p>
                      <p className="text-xs text-slate-500 mb-2">
                        <code className="text-blue-400">{'{{answers}}'}</code> буде замінено на відповіді клієнта у форматі JSON. Ключ кожного значення — це ID поля з конструктора.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {['{{answers}}', '{{service_slug}}', '{{user_id}}'].map((v) => (
                          <button
                            key={v}
                            onClick={() => { setAiPrompt((p) => p + '\n' + v); markDirty() }}
                            className="px-2 py-1 bg-slate-700 hover:bg-blue-600/30 text-blue-400 text-xs font-mono rounded transition-colors"
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <textarea
                    value={aiPrompt}
                    onChange={(e) => { setAiPrompt(e.target.value); markDirty() }}
                    rows={16}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm
                               font-mono leading-relaxed focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                {/* Quality checklist */}
                <div className="bg-slate-800 rounded-xl p-5">
                  <p className="text-sm font-semibold text-white mb-3">Чеклист якості документу</p>
                  {[
                    'Промпт містить конкретну роль юриста',
                    'Вказані відповідні статті законів',
                    'Описана структура документу',
                    'Є заборона на вигадку фактів',
                    'Вказана юрисдикція (Україна)',
                  ].map((item, i) => (
                    <label key={i} className="flex items-center gap-3 py-1.5 cursor-pointer group">
                      <input type="checkbox" className="w-4 h-4 accent-blue-500" />
                      <span className="text-sm text-slate-400 group-hover:text-slate-300">{item}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ── SETTINGS ── */}
            {tab === 'settings' && (
              <div className="max-w-lg space-y-5">
                <h2 className="text-lg font-bold text-white mb-4">Налаштування послуги</h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Іконка</label>
                    <input
                      value={icon}
                      onChange={(e) => { setIcon(e.target.value); markDirty() }}
                      placeholder="⚖️"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-2xl focus:outline-none focus:border-blue-500 text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Ціна (₴)</label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => { setPrice(Number(e.target.value)); markDirty() }}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Опис послуги</label>
                  <textarea
                    value={description}
                    onChange={(e) => { setDesc(e.target.value); markDirty() }}
                    rows={3}
                    placeholder="Короткий опис що отримає клієнт..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Підзаголовок форми</label>
                  <input
                    value={config.subtitle ?? ''}
                    onChange={(e) => { setConfig((c) => ({ ...c, subtitle: e.target.value })); markDirty() }}
                    placeholder="Підготовка позовної заяви..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* URL preview */}
                <div className="bg-slate-800 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide font-semibold">Посилання на форму</p>
                  <code className="text-sm text-blue-400 break-all">
                    https://legal-twa-xi.vercel.app/?service={config.service_id || 'your_slug'}
                  </code>
                </div>
              </div>
            )}
          </div>

          {/* Right panel — live preview (desktop only) */}
          <div className="hidden xl:flex w-96 flex-shrink-0 border-l border-slate-800 flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Превью форми</span>
              <button
                onClick={() => setPreviewAnswerKey((k) => k + 1)}
                className="text-xs text-slate-500 hover:text-white transition-colors"
                title="Скинути відповіді"
              >
                🔄 Скинути
              </button>
            </div>
            <div className="flex-1 overflow-hidden bg-white">
              {config.steps.length > 0 ? (
                <div className="h-full overflow-y-auto" key={previewAnswerKey}>
                  <DynamicLegalFormBuilder
                    config={config}
                    serviceSlug="preview"
                    onSubmit={async () => { alert('Preview — submit відключено') }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <span className="text-4xl mb-3">📋</span>
                  <p className="text-slate-400 text-sm">Додайте поля у конструкторі щоб побачити превью</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Preview modal (mobile/tablet) */}
      {previewModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60 xl:hidden">
          {/* Modal header */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 flex-shrink-0">
            <span className="text-sm font-semibold text-white">Превью форми</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewAnswerKey((k) => k + 1)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                🔄 Скинути
              </button>
              <button
                onClick={() => setPreviewModal(false)}
                className="text-slate-400 hover:text-white text-xl leading-none px-1"
              >
                ✕
              </button>
            </div>
          </div>
          {/* Form content */}
          <div className="flex-1 overflow-y-auto bg-white" key={previewAnswerKey}>
            <DynamicLegalFormBuilder
              config={config}
              serviceSlug="preview"
              onSubmit={async () => { alert('Preview — submit відключено') }}
            />
          </div>
        </div>
      )}
      {toast && <Toast type={toast.type} message={toast.message} />}
    </AdminLayout>
  )
}
