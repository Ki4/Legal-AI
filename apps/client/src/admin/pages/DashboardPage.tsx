import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Briefcase } from 'lucide-react'
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
                       text-white text-sm font-semibold rounded-[10px] shadow-card transition-colors"
          >
            <Plus size={16} strokeWidth={2} />
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
            <div className="inline-flex w-14 h-14 rounded-2xl bg-brand/10 text-brand items-center justify-center mb-4">
              <Briefcase size={26} strokeWidth={1.6} />
            </div>
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
                  formHref={`/?service=${svc.slug}`}
                  onOpen={() => navigate(`/services/${svc.id}`)}
                  onEdit={() => navigate(`/services/${svc.id}/edit`)}
                  onDelete={() => deleteService(svc.id)}
                  onStatus={(to) => changeStatus(svc, to)}
                />
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
