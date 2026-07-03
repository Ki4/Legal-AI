import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AdminLayout } from '../components/AdminLayout'
import { FormBuilder } from '../components/FormBuilder'
import { Toast } from '../components/Toast'
import { DynamicLegalFormBuilder } from '../../components/DynamicLegalFormBuilder'
import { TemplateEditorPanel } from '../components/TemplateEditorPanel'
import { TemplateDraftPreview } from '../components/TemplateDraftPreview'
import { TemplateRevisionHistory } from '../components/TemplateRevisionHistory'
import { validateDraft } from '../lib/documentPreview'
import { publishTemplate } from '../lib/serviceTemplate'
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
import { SERVICE_CATEGORIES, UNCATEGORISED_LABEL } from '../../lib/serviceCategories'

type Tab = 'form' | 'template' | 'ai' | 'settings'

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
  // Legal vertical for grouping in the catalog. null = «Без категорії». Fixed list in code.
  const [category, setCategory]   = useState<string | null>(null)
  // New services start disabled — lawyer activates after review (DB default too).
  const [status, setStatus]       = useState<ServiceStatus>('disabled')
  // Template editor (specs/features/template-editor): draft is edited here; the
  // bot generates ONLY from the published document_template until «Опублікувати».
  const [docPublished, setDocPublished] = useState<string | null>(null)
  const [docDraft, setDocDraft]         = useState('')
  const [savingDraft, setSavingDraft]   = useState(false)
  const [publishing, setPublishing]     = useState(false)
  // Bumped after every publish/restore so the revision history reloads (§5).
  const [revisionsBump, setRevisionsBump] = useState(0)
  // S2 slice C: editor caret line → preview paragraph sync-highlight.
  const [caretLine, setCaretLine] = useState<number | null>(null)
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
        setDocPublished(data.document_template ?? null)
        setDocDraft(data.document_template_draft ?? data.document_template ?? '')
        setIcon(data.icon ?? '⚖️')
        setDesc(data.description ?? '')
        setPrice(data.price ?? 0)
        setCategory(data.category ?? null)
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
      category,
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

  // «Зберегти чернетку» — always allowed, even with a parse error (never lose
  // the lawyer's work). Production generation is untouched by design.
  async function handleSaveDraft() {
    if (!supabase || !id) return
    setSavingDraft(true)
    const { error } = await supabase
      .from('services')
      .update({ document_template_draft: docDraft })
      .eq('id', id)
    setSavingDraft(false)
    if (error) showToast('error', `Не вдалося зберегти чернетку: ${error.message}`)
    else showToast('success', 'Чернетку збережено ✓')
  }

  // «Опублікувати» — parse gate → snapshot to service_revisions → copy draft
  // into document_template (serviceTemplate.publishTemplate).
  async function handlePublish() {
    if (!supabase || !id) return
    setPublishing(true)
    const result = await publishTemplate(
      { supabase, validate: validateDraft },
      { serviceId: id, draft: docDraft, userId: user?.id ?? null },
    )
    setPublishing(false)
    if (result.ok) {
      setDocPublished(docDraft)
      setRevisionsBump((b) => b + 1)
      showToast('success', 'Опубліковано ✓ Клієнти отримують нову версію документа')
    } else {
      showToast('error', result.error)
    }
  }

  const TABS: { id: Tab; icon: string; label: string; short: string }[] = [
    { id: 'form',     icon: '📋', label: 'Конструктор форми', short: 'Форма' },
    { id: 'template', icon: '📄', label: 'Шаблон документа',  short: 'Шаблон' },
    { id: 'ai',       icon: '🤖', label: 'AI-промпт',         short: 'AI' },
    { id: 'settings', icon: '⚙️', label: 'Налаштування',      short: 'Опції' },
  ]

  return (
    <AdminLayout>
      <div className="flex flex-col h-[calc(100vh-49px)] md:h-screen overflow-x-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-2 md:gap-4 px-3 md:px-6 py-3 md:py-4 border-b border-line flex-shrink-0">
          <button
            onClick={() => navigate('/services')}
            className="text-inkSoft hover:text-ink transition-colors text-sm flex-shrink-0"
          >
            ← Назад
          </button>
          <div className="text-inkMute hidden md:block">|</div>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <h1 className="text-ink font-semibold text-sm truncate">
              {isNew ? 'Нова послуга' : config.title || 'Редагування'}
            </h1>
            {isDirty && (
              <span className="text-xs text-warn flex-shrink-0">●</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Preview button — visible only on mobile/tablet (xl has side panel) */}
            {config.steps.length > 0 && (
              <button
                onClick={() => setPreviewModal(true)}
                className="xl:hidden px-3 py-2 bg-paperAlt hover:bg-paperAlt text-inkSoft text-sm rounded-xl transition-colors flex-shrink-0"
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
                className="bg-paperAlt border border-lineStrong text-ink text-sm rounded-lg px-2 py-1.5
                           focus:outline-none focus:border-brand cursor-pointer"
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
              className="px-3 md:px-5 py-2 bg-brand hover:bg-brand/90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex-shrink-0"
            >
              {saving ? '⏳' : saved ? '✅' : '💾'}
              <span className="hidden sm:inline ml-1">
                {saving ? 'Зберігаю...' : saved ? 'Збережено' : 'Зберегти'}
              </span>
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 px-3 md:px-6 py-2 md:py-3 border-b border-line flex-shrink-0 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors whitespace-nowrap
                ${tab === t.id
                  ? 'bg-paperAlt text-ink'
                  : 'text-inkMute hover:text-ink hover:bg-paperAlt/50'}`}
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

            {/* ── TEMPLATE EDITOR ── */}
            {tab === 'template' && (
              <>
                {/* Desktop: full editor. Draft state lives here so the right
                    preview panel re-renders on every keystroke. */}
                <div className="hidden xl:flex h-full flex-col gap-4">
                  {/* overflow-y-auto: in a short window the panel's min heights
                      (editor floor + toolbar) can exceed this slot — scroll it
                      instead of painting over the revision history below (s67
                      overlap: the editor's min-h spilled 66px past the panel). */}
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <TemplateEditorPanel
                      draft={docDraft}
                      published={docPublished}
                      isNew={isNew}
                      formConfig={config}
                      validate={validateDraft}
                      onDraftChange={(v) => { setDocDraft(v); markDirty() }}
                      onSaveDraft={handleSaveDraft}
                      onPublish={handlePublish}
                      savingDraft={savingDraft}
                      publishing={publishing}
                      onCaretLine={setCaretLine}
                    />
                  </div>
                  {!isNew && id && (
                    <TemplateRevisionHistory
                      serviceId={id}
                      userId={user?.id ?? null}
                      refreshToken={revisionsBump}
                      onRestored={(tpl) => {
                        setDocDraft(tpl)
                        setDocPublished(tpl)
                        setRevisionsBump((b) => b + 1)
                        showToast('success', 'Версію відновлено ✓ Вона знову опублікована')
                      }}
                    />
                  )}
                </div>
                {/* Mobile/tablet: read-only (interview Q10 — desktop-first). */}
                <div className="xl:hidden">
                  <p className="text-sm text-inkSoft bg-paperAlt border border-line rounded-xl px-3 py-2.5 mb-4">
                    Редагування шаблона доступне з компʼютера. Нижче — перегляд чинної чернетки.
                  </p>
                  <TemplateDraftPreview
                    template={docDraft || docPublished}
                    slug={config.service_id || null}
                    formConfig={config}
                  />
                </div>
              </>
            )}

            {/* ── AI PROMPT ── */}
            {tab === 'ai' && (
              <div className="max-w-2xl space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-ink mb-1">AI-промпт для документу</h2>
                  <p className="text-inkSoft text-sm mb-4">
                    Цей промпт отримує AI-модель разом з відповідями клієнта. Від нього залежить якість документу.
                  </p>

                  {/* Tips */}
                  <div className="bg-paperAlt rounded-xl p-4 mb-4 space-y-2">
                    <p className="text-xs font-semibold text-inkSoft uppercase tracking-wide">💡 Поради для якісного документу</p>
                    <ul className="text-sm text-inkSoft space-y-1.5">
                      <li>• Вказуй конкретні статті законів (ст. 71 СКУ, ст. 27 ЦПК)</li>
                      <li>• Опиши структуру документу: вступ, обставини, вимоги, підпис</li>
                      <li>• Додай "Не вигадуй факти — використовуй лише дані клієнта"</li>
                    </ul>
                    <div className="mt-3 pt-3 border-t border-lineStrong">
                      <p className="text-xs font-semibold text-inkSoft uppercase tracking-wide mb-1">Доступні змінні</p>
                      <p className="text-xs text-inkMute mb-2">
                        <code className="text-brand">{'{{answers}}'}</code> буде замінено на відповіді клієнта у форматі JSON. Ключ кожного значення — це ID поля з конструктора.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {['{{answers}}', '{{service_slug}}', '{{user_id}}'].map((v) => (
                          <button
                            key={v}
                            onClick={() => { setAiPrompt((p) => p + '\n' + v); markDirty() }}
                            className="px-2 py-1 bg-paperAlt hover:bg-brand/30 text-brand text-xs font-mono rounded transition-colors"
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
                    className="w-full px-4 py-3 bg-paperAlt border border-lineStrong rounded-xl text-ink text-sm
                               font-mono leading-relaxed focus:outline-none focus:border-brand resize-none"
                  />
                </div>

                {/* Quality checklist */}
                <div className="bg-paperAlt rounded-xl p-5">
                  <p className="text-sm font-semibold text-ink mb-3">Чеклист якості документу</p>
                  {[
                    'Промпт містить конкретну роль юриста',
                    'Вказані відповідні статті законів',
                    'Описана структура документу',
                    'Є заборона на вигадку фактів',
                    'Вказана юрисдикція (Україна)',
                  ].map((item, i) => (
                    <label key={i} className="flex items-center gap-3 py-1.5 cursor-pointer group">
                      <input type="checkbox" className="w-4 h-4 accent-brand" />
                      <span className="text-sm text-inkSoft group-hover:text-inkSoft">{item}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ── SETTINGS ── */}
            {tab === 'settings' && (
              <div className="max-w-lg space-y-5">
                <h2 className="text-lg font-bold text-ink mb-4">Налаштування послуги</h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-inkSoft mb-1.5 uppercase tracking-wide">Іконка</label>
                    <input
                      value={icon}
                      onChange={(e) => { setIcon(e.target.value); markDirty() }}
                      placeholder="⚖️"
                      className="w-full px-3 py-2 bg-paperAlt border border-lineStrong rounded-xl text-ink text-2xl focus:outline-none focus:border-brand text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-inkSoft mb-1.5 uppercase tracking-wide">Ціна (₴)</label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => { setPrice(Number(e.target.value)); markDirty() }}
                      placeholder="0"
                      className="w-full px-3 py-2 bg-paperAlt border border-lineStrong rounded-xl text-ink text-sm focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-inkSoft mb-1.5 uppercase tracking-wide">Категорія</label>
                  <select
                    value={category ?? ''}
                    onChange={(e) => { setCategory(e.target.value || null); markDirty() }}
                    className="w-full px-3 py-2 bg-paperAlt border border-lineStrong rounded-xl text-ink text-sm focus:outline-none focus:border-brand"
                  >
                    <option value="">— {UNCATEGORISED_LABEL} —</option>
                    {SERVICE_CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                  <p className="text-[11.5px] text-inkMute mt-1.5">Групує послугу в каталозі за напрямом права.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-inkSoft mb-1.5 uppercase tracking-wide">Опис послуги</label>
                  <textarea
                    value={description}
                    onChange={(e) => { setDesc(e.target.value); markDirty() }}
                    rows={3}
                    placeholder="Короткий опис що отримає клієнт..."
                    className="w-full px-3 py-2 bg-paperAlt border border-lineStrong rounded-xl text-ink text-sm focus:outline-none focus:border-brand resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-inkSoft mb-1.5 uppercase tracking-wide">Підзаголовок форми</label>
                  <input
                    value={config.subtitle ?? ''}
                    onChange={(e) => { setConfig((c) => ({ ...c, subtitle: e.target.value })); markDirty() }}
                    placeholder="Підготовка позовної заяви..."
                    className="w-full px-3 py-2 bg-paperAlt border border-lineStrong rounded-xl text-ink text-sm focus:outline-none focus:border-brand"
                  />
                </div>

                {/* URL preview */}
                <div className="bg-paperAlt rounded-xl p-4">
                  <p className="text-xs text-inkMute mb-1 uppercase tracking-wide font-semibold">Посилання на форму</p>
                  <code className="text-sm text-brand break-all">
                    https://legal-twa-xi.vercel.app/?service={config.service_id || 'your_slug'}
                  </code>
                </div>
              </div>
            )}
          </div>

          {/* Right panel — live preview (desktop only). Form preview normally;
              the document-draft preview when the template tab is active. */}
          <div className="hidden xl:flex w-96 flex-shrink-0 border-l border-line flex-col">
            {tab === 'template' ? (
              <TemplateDraftPreview
                template={docDraft || docPublished}
                slug={config.service_id || null}
                formConfig={config}
                caretLine={caretLine}
              />
            ) : (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                  <span className="text-xs font-semibold text-inkSoft uppercase tracking-wide">Превью форми</span>
                  <button
                    onClick={() => setPreviewAnswerKey((k) => k + 1)}
                    className="text-xs text-inkMute hover:text-ink transition-colors"
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
                      <p className="text-inkSoft text-sm">Додайте поля у конструкторі щоб побачити превью</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {/* Preview modal (mobile/tablet) */}
      {previewModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/60 xl:hidden">
          {/* Modal header */}
          <div className="flex items-center justify-between px-4 py-3 bg-paper border-b border-line flex-shrink-0">
            <span className="text-sm font-semibold text-ink">Превью форми</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreviewAnswerKey((k) => k + 1)}
                className="text-xs text-inkSoft hover:text-ink px-2 py-1 rounded-lg hover:bg-paperAlt transition-colors"
              >
                🔄 Скинути
              </button>
              <button
                onClick={() => setPreviewModal(false)}
                className="text-inkSoft hover:text-ink text-xl leading-none px-1"
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
