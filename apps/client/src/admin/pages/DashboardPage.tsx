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

interface Service {
  id: string
  slug: string
  title: string
  description: string
  icon: string
  price: number
  status: ServiceStatus
  form_config: { steps?: unknown[]; tabs?: unknown[] } | null
}

export function DashboardPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading]   = useState(true)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!supabase || !user) return
    supabase
      .from('services')
      .select('id, slug, title, description, icon, price, status, form_config')
      .eq('lawyer_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const rows = (data ?? []).map((r) => ({ ...r, status: toServiceStatus(r.status) })) as Service[]
        setServices(rows)
        setLoading(false)
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

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Мої послуги</h1>
            <p className="text-slate-400 text-xs md:text-sm mt-1 hidden sm:block">
              Створюйте форми та AI-документи для ваших клієнтів
            </p>
          </div>
          <button
            onClick={() => navigate('/services/new')}
            className="flex items-center gap-2 px-3 md:px-5 py-2 md:py-2.5 bg-blue-600 hover:bg-blue-500
                       text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            <span className="hidden sm:inline">Нова послуга</span>
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map((i) => (
              <div key={i} className="h-44 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && services.length === 0 && (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">⚖️</div>
            <h3 className="text-lg font-semibold text-white mb-2">Ще немає послуг</h3>
            <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">
              Створіть першу юридичну послугу — налаштуйте форму і AI-промпт для документу
            </p>
            <button
              onClick={() => navigate('/services/new')}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
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
              return (
                <div
                  key={svc.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4
                             hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl flex-shrink-0">
                      {svc.icon || '⚖️'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white text-sm truncate">{svc.title || 'Без назви'}</h3>
                      <p className="text-slate-500 text-xs mt-0.5 line-clamp-2">
                        {svc.description || 'Опис не вказано'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>📋 {fieldCount} полів</span>
                    <span>•</span>
                    <span>🗂 {tabCount} табів</span>
                    {svc.price > 0 && <><span>•</span><span>💰 {svc.price}₴</span></>}
                  </div>

                  <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
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
                            ? 'bg-blue-600/15 text-blue-400 hover:bg-blue-600/25'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                      >
                        {action.label}
                      </button>
                    ))}

                    <div className="flex-1" />

                    <a
                      href={`/?service=${svc.slug}`}
                      target="_blank"
                      className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                      title="Переглянути форму"
                    >
                      👁
                    </a>
                    <button
                      onClick={() => navigate(`/services/${svc.id}`)}
                      className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                      title="Редагувати"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => deleteService(svc.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
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
