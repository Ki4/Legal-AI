import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '../components/AdminLayout'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import {
  type ServiceStatus,
  toServiceStatus,
  statusActions,
  isPublishedFor,
  STATUS_META,
} from '../../lib/serviceStatus'
import { analyzeService } from '../../lib/serviceAnatomy'
import type { FormConfig } from '../../types/form'

interface Service {
  id: string
  slug: string
  title: string
  description: string
  icon: string
  price: number
  status: ServiceStatus
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
  const [abstentionStats, setAbstention] = useState<AbstentionStats | null>(null)
  const [checklistStats, setChecklist]   = useState<ChecklistStats | null>(null)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!supabase || !user) return

    supabase
      .from('services')
      .select('id, slug, title, description, icon, price, status, generation_mode, document_template, form_config')
      .eq('lawyer_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
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
        if (!data || data.length === 0) return
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
        if (!data || data.length === 0) return
        setChecklist({
          total:  data.length,
          failed: data.filter((r) => r.checklist_failed === true).length,
        })
      })
  }, [user])

  async function changeStatus(svc: Service, next: ServiceStatus) {
    if (!supabase) return
    // status is authoritative; keep deprecated is_published coherent (migration 012)
    await supabase
      .from('services')
      .update({ status: next, is_published: isPublishedFor(next) })
      .eq('id', svc.id)
    setServices((prev) => prev.map((s) => s.id === svc.id ? { ...s, status: next } : s))
  }

  async function deleteService(id: string) {
    if (!confirm('Видалити послугу?')) return
    if (!supabase) return
    await supabase.from('services').delete().eq('id', id)
    setServices((prev) => prev.filter((s) => s.id !== id))
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
                       text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            <span className="hidden sm:inline">Нова послуга</span>
          </button>
        </div>

        {/* Abstention rate (hybrid AI cases only, last 30 days) */}
        {abstentionRate !== null && (
          <div className="mb-5 px-4 py-2.5 bg-paper border border-line rounded-xl
                          flex items-center gap-2 text-xs text-inkSoft">
            <span className={abstentionRate > 20 ? 'text-warn' : 'text-inkMute'}>●</span>
            <span>
              Abstention rate:{' '}
              <span className={`font-semibold ${abstentionRate > 20 ? 'text-warn' : 'text-inkSoft'}`}>
                {abstentionRate}%
              </span>
              {' '}({abstentionStats!.abstained}/{abstentionStats!.total} AI-кейсів за 30 днів)
            </span>
          </div>
        )}

        {/* Checklist failures (required-clause validator, #39 — any case with a checklist configured) */}
        {checklistFailRate !== null && (
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

        {/* Empty */}
        {!loading && services.length === 0 && (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">⚖️</div>
            <h3 className="text-lg font-semibold text-ink mb-2">Ще немає послуг</h3>
            <p className="text-inkMute text-sm mb-6 max-w-xs mx-auto">
              Створіть першу юридичну послугу — налаштуйте форму і AI-промпт для документу
            </p>
            <button
              onClick={() => navigate('/services/new')}
              className="px-6 py-2.5 bg-brand hover:bg-brand/90 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Створити послугу
            </button>
          </div>
        )}

        {/* Grid */}
        {!loading && services.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((svc) => {
              const fieldCount = svc.form_config?.steps?.length ?? 0
              const tabCount   = svc.form_config?.tabs?.length  ?? 0
              const health = analyzeService(svc.form_config, svc.document_template, svc.generation_mode).health
              const hd = HEALTH_DOT[health.level]
              return (
                <div
                  key={svc.id}
                  className="bg-paper border border-line rounded-2xl p-5 flex flex-col gap-4
                             hover:border-lineStrong transition-colors"
                >
                  <button
                    onClick={() => navigate(`/services/${svc.id}`)}
                    className="flex items-start gap-3 text-left group/header"
                    title="Переглянути анатомію послуги"
                  >
                    <div className="w-10 h-10 rounded-xl bg-paperAlt flex items-center justify-center text-xl flex-shrink-0">
                      {svc.icon || '⚖️'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-ink text-sm truncate group-hover/header:text-brand transition-colors">{svc.title || 'Без назви'}</h3>
                      <p className="text-inkMute text-xs mt-0.5 line-clamp-2">
                        {svc.description || 'Опис не вказано'}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-3 text-xs text-inkMute">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${hd.dot}`} title={hd.title} />
                    <span>📋 {fieldCount} полів</span>
                    <span>•</span>
                    <span>🗂 {tabCount} табів</span>
                    {svc.price > 0 && <><span>•</span><span>💰 {svc.price}₴</span></>}
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-line">
                    {/* Status badge (read-only) */}
                    <span
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${STATUS_META[svc.status].badge}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[svc.status].dot}`} />
                      {STATUS_META[svc.status].label}
                    </span>

                    {/* Lifecycle actions */}
                    {statusActions(svc.status).map((action) => (
                      <button
                        key={action.to}
                        onClick={() => changeStatus(svc, action.to)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors
                          ${action.variant === 'primary'
                            ? 'bg-brand/10 text-brand hover:bg-brand/25'
                            : 'bg-paperAlt text-inkSoft hover:bg-paperAlt'}`}
                      >
                        {action.label}
                      </button>
                    ))}

                    <div className="flex-1" />

                    <a
                      href={`/?service=${svc.slug}`}
                      target="_blank"
                      className="p-1.5 text-inkMute hover:text-ink hover:bg-paperAlt rounded-lg transition-colors"
                      title="Переглянути форму"
                    >
                      👁
                    </a>
                    <button
                      onClick={() => navigate(`/services/${svc.id}/edit`)}
                      className="p-1.5 text-inkMute hover:text-ink hover:bg-paperAlt rounded-lg transition-colors"
                      title="Редагувати"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => deleteService(svc.id)}
                      className="p-1.5 text-inkMute hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                      title="Видалити"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
