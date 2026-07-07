import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Briefcase, AlertTriangle } from 'lucide-react'
import { AdminLayout } from '../components/AdminLayout'
import { ServiceCard } from '../components/ServiceCard'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import {
  type ServiceStatus,
  toServiceStatus,
  isPublishedFor,
} from '../../lib/serviceStatus'
import { analyzeService } from '../../lib/serviceAnatomy'
import { clientFormUrl } from '../../lib/clientApp'
import { groupByCategory } from '../../lib/serviceCategories'
import { useConfirm } from '../ui'
import type { FormConfig } from '../../types/form'

interface Service {
  id: string
  slug: string
  title: string
  description: string
  icon: string
  price: number
  status: ServiceStatus
  category: string | null
  generation_mode: string | null
  document_template: string | null
  form_config: FormConfig | null
}

const HEALTH_DOT: Record<'green' | 'amber' | 'red', { dot: string; title: string }> = {
  green: { dot: 'bg-ok', title: 'Готова — шаблон і поля узгоджені' },
  amber: { dot: 'bg-warn',   title: 'Є зауваження — відкрий, щоб побачити деталі' },
  red:   { dot: 'bg-danger',     title: 'Потребує уваги — шаблон/поля не узгоджені' },
}

interface AbstentionStats {
  total: number
  abstained: number
}

interface ChecklistStats {
  total: number
  failed: number
}

export function DashboardPage() {
  const [services, setServices]          = useState<Service[]>([])
  const [loading, setLoading]            = useState(true)
  // Main catalog query failure — must never masquerade as «Ще немає послуг» (#88 §5).
  const [loadError, setLoadError]        = useState<string | null>(null)
  const [retryToken, setRetryToken]      = useState(0)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)  // null = усі категорії
  const [abstentionStats, setAbstention] = useState<AbstentionStats | null>(null)
  const [checklistStats, setChecklist]   = useState<ChecklistStats | null>(null)
  const { user } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()

  // Depend on the id, not the user object: supabase emits a FRESH user object
  // on every auth event (e.g. hourly TOKEN_REFRESHED), and re-running this
  // effect would collapse the loaded catalog into the skeleton each time.
  const userId = user?.id ?? null

  useEffect(() => {
    if (!supabase || !userId) return

    // Out-of-order guard: a retry/auth re-run while a slower request is still
    // in flight must not let the stale response land last (e.g. a late error
    // replacing a freshly rendered catalog).
    let cancelled = false

    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset to the loading state before (re)fetching the catalog
    setLoading(true)
    setLoadError(null)
    supabase
      .from('services')
      .select('id, slug, title, description, icon, price, status, category, generation_mode, document_template, form_config')
      .eq('lawyer_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          // An empty dashboard on a network/RLS failure invites the lawyer to
          // recreate services that actually exist — surface the error instead.
          setLoadError(error.message)
          setLoading(false)
          return
        }
        const rows = (data ?? []).map((r) => ({ ...r, status: toServiceStatus(r.status) })) as Service[]
        setServices(rows)
        setLoading(false)
      })

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    supabase
      .from('cases')
      .select('abstained')
      .not('abstained', 'is', null)
      .gte('created_at', thirtyDaysAgo)
      .then(({ data }) => {
        if (cancelled || !data || data.length === 0) return
        setAbstention({
          total:     data.length,
          abstained: data.filter((r) => r.abstained === true).length,
        })
      })

    supabase
      .from('cases')
      .select('checklist_failed')
      .not('checklist_failed', 'is', null)
      .gte('created_at', thirtyDaysAgo)
      .then(({ data }) => {
        if (cancelled || !data || data.length === 0) return
        setChecklist({
          total:  data.length,
          failed: data.filter((r) => r.checklist_failed === true).length,
        })
      })

    return () => { cancelled = true }
  }, [userId, retryToken])

  async function changeStatus(svc: Service, next: ServiceStatus) {
    if (!supabase) return
    // Disabling pulls the service from clients — confirm it. Activating is affirmative, no prompt.
    if (next === 'disabled') {
      const ok = await confirm({
        title: `Вимкнути «${svc.title || 'послугу'}»?`,
        body: 'Послуга стане недоступною клієнтам, доки ви не активуєте її знову.',
        confirmLabel: 'Вимкнути',
        variant: 'warn',
      })
      if (!ok) return
    }
    // status is authoritative; keep deprecated is_published coherent (migration 012)
    // and needs_law_review coherent with the transition (mirrors service-lifecycle.mjs:
    // active/disabled clear the pending-law-review flag, needs_review sets it) — otherwise
    // a lawyer approving via UI leaves the flag stale (the CLI path already reset it).
    await supabase
      .from('services')
      .update({
        status: next,
        is_published: isPublishedFor(next),
        needs_law_review: next === 'needs_review',
      })
      .eq('id', svc.id)
    setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, status: next } : s))
  }

  async function deleteService(svc: Service) {
    const ok = await confirm({
      title: `Видалити «${svc.title || 'послугу'}»?`,
      body: 'Дію не можна скасувати. Послуга та її налаштування будуть видалені назавжди.',
      confirmLabel: 'Видалити',
      variant: 'danger',
    })
    if (!ok) return
    if (!supabase) return
    await supabase.from('services').delete().eq('id', svc.id)
    setServices((prev) => prev.filter((s) => s.id !== svc.id))
  }

  const abstentionRate = abstentionStats
    ? abstentionStats.total > 0
      ? Math.round(abstentionStats.abstained / abstentionStats.total * 100)
      : 0
    : null

  const checklistFailRate = checklistStats
    ? checklistStats.total > 0
      ? Math.round(checklistStats.failed / checklistStats.total * 100)
      : 0
    : null

  // Group cards by legal vertical; the filter narrows to one group (null = show all).
  const groups = groupByCategory(services)
  const visibleGroups = categoryFilter === null
    ? groups
    : groups.filter((g) => g.key === categoryFilter)

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-ink">Мої послуги</h1>
            <p className="text-inkSoft text-xs md:text-sm mt-1 hidden sm:block">
              Створюйте форми та AI-документи для ваших клієнтів
            </p>
          </div>
          <button
            onClick={() => navigate('/services/new')}
            className="flex items-center gap-2 px-3 md:px-5 py-2 md:py-2.5 bg-brand hover:bg-brand/90
                       text-white text-sm font-semibold rounded-[10px] shadow-card transition-colors"
          >
            <Plus size={16} strokeWidth={2} />
            <span className="hidden sm:inline">Нова послуга</span>
          </button>
        </div>

        {/* Abstention rate (hybrid AI cases only, last 30 days) — lawyer-facing
            wording, not ML jargon (#88 §6) */}
        {!loadError && abstentionRate !== null && (
          <div className="mb-5 px-4 py-2.5 bg-paper border border-line rounded-xl
                          flex items-center gap-2 text-xs text-inkSoft">
            <span className={abstentionRate > 20 ? 'text-warn' : 'text-inkMute'}>●</span>
            <span>
              Складні справи (AI передав юристу):{' '}
              <span className={`font-semibold ${abstentionRate > 20 ? 'text-warn' : 'text-inkSoft'}`}>
                {abstentionRate}%
              </span>
              {' '}({abstentionStats!.abstained}/{abstentionStats!.total} AI-кейсів за 30 днів)
            </span>
          </div>
        )}

        {/* Checklist failures (required-clause validator, #39 — any case with a checklist configured) */}
        {!loadError && checklistFailRate !== null && (
          <div className="mb-5 px-4 py-2.5 bg-paper border border-line rounded-xl
                          flex items-center gap-2 text-xs text-inkSoft">
            <span className={checklistStats!.failed > 0 ? 'text-warn' : 'text-inkMute'}>●</span>
            <span>
              Документи з неповним чеклістом:{' '}
              <span className={`font-semibold ${checklistStats!.failed > 0 ? 'text-warn' : 'text-inkSoft'}`}>
                {checklistFailRate}%
              </span>
              {' '}({checklistStats!.failed}/{checklistStats!.total} документів за 30 днів)
            </span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map((i) => (
              <div key={i} className="h-44 bg-paper border border-line rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Load failure — error + retry instead of a fake-empty catalog (#88 §5) */}
        {!loading && loadError && (
          <div className="text-center py-24">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-danger/10 text-danger items-center justify-center mb-4">
              <AlertTriangle size={26} strokeWidth={1.6} />
            </div>
            <h3 className="text-lg font-semibold text-ink mb-2">Не вдалося завантажити послуги</h3>
            <p className="text-inkMute text-sm mb-2 max-w-sm mx-auto">
              Перевірте інтернет-зʼєднання і спробуйте ще раз. Якщо помилка повторюється —
              покажіть цей екран розробнику.
            </p>
            {/* raw message kept small so support can diagnose from a screenshot */}
            <p className="text-[11px] text-inkMute/70 font-mono mb-6 max-w-sm mx-auto break-words">
              {loadError}
            </p>
            <button
              onClick={() => setRetryToken((t) => t + 1)}
              className="px-6 py-2.5 bg-brand hover:bg-brand/90 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Спробувати ще раз
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !loadError && services.length === 0 && (
          <div className="text-center py-24">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-brand/10 text-brand items-center justify-center mb-4">
              <Briefcase size={26} strokeWidth={1.6} />
            </div>
            <h3 className="text-lg font-semibold text-ink mb-2">Ще немає послуг</h3>
            <p className="text-inkMute text-sm mb-6 max-w-xs mx-auto">
              Створіть першу юридичну послугу — налаштуйте форму і шаблон документа
            </p>
            <button
              onClick={() => navigate('/services/new')}
              className="px-6 py-2.5 bg-brand hover:bg-brand/90 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Створити послугу
            </button>
          </div>
        )}

        {/* Category filter — only when there is more than one group to switch between */}
        {!loading && !loadError && groups.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <FilterPill active={categoryFilter === null} onClick={() => setCategoryFilter(null)}>
              Усі <span className="opacity-60">{services.length}</span>
            </FilterPill>
            {groups.map((g) => (
              <FilterPill
                key={g.key || 'none'}
                active={categoryFilter === g.key}
                onClick={() => setCategoryFilter(g.key)}
              >
                {g.label} <span className="opacity-60">{g.items.length}</span>
              </FilterPill>
            ))}
          </div>
        )}

        {/* Grouped grid */}
        {!loading && !loadError && services.length > 0 && visibleGroups.map((group) => (
          <section key={group.key || 'none'} className="mb-8 last:mb-0">
            <div className="flex items-center gap-2.5 mb-3">
              <h2 className="text-[13px] font-semibold text-inkSoft uppercase tracking-wide">{group.label}</h2>
              <span className="text-xs text-inkMute">{group.items.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.items.map((svc) => {
                const fieldCount = svc.form_config?.steps?.length ?? 0
                const tabCount   = svc.form_config?.tabs?.length  ?? 0
                const health = analyzeService(svc.form_config, svc.document_template, svc.generation_mode).health
                const hd = HEALTH_DOT[health.level]
                return (
                  <ServiceCard
                    key={svc.id}
                    title={svc.title}
                    description={svc.description}
                    fields={fieldCount}
                    tabs={tabCount}
                    price={svc.price}
                    healthDot={hd.dot}
                    healthTitle={hd.title}
                    status={svc.status}
                    formHref={clientFormUrl(svc.slug)}
                    onOpen={() => navigate(`/services/${svc.slug}`)}
                    onEdit={() => navigate(`/services/${svc.id}/edit`)}
                    onDelete={() => deleteService(svc)}
                    onStatus={(to) => changeStatus(svc, to)}
                  />
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </AdminLayout>
  )
}

// Category filter pill — active shows the brand-tinted state used by the sidebar nav.
function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors
        ${active
          ? 'bg-brand/10 text-brand'
          : 'text-inkSoft hover:text-ink hover:bg-paperAlt border border-line'}`}
    >
      {children}
    </button>
  )
}
