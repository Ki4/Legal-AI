// "Карта" — system view: the law → article → service → document graph on real data.
// Per-service depth lives on the mirror (/services/:slug); this page is the cross-service map.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminLayout } from '../components/AdminLayout'
import { supabase } from '../../lib/supabase'
import { useVizServices, buildCatalogGraph } from '../viz/vizData'
import { CatalogGraph, type CatalogChange } from '../viz/views/CatalogGraph'

interface ChangeRow { id: number | string; law_title: string | null; affected_services: string[] | null; created_at: string }

export function MapPage() {
  const navigate = useNavigate()
  const { services, loading } = useVizServices()
  const [changes, setChanges] = useState<CatalogChange[]>([])

  // Flagged law changes → highlight the services they touch (same source as the mirror's warning).
  useEffect(() => {
    if (!supabase) return
    supabase
      .from('law_change_log')
      .select('id, law_title, affected_services, created_at')
      .eq('action', 'flagged')
      .order('created_at', { ascending: false })
      .then(({ data }) => setChanges(((data ?? []) as ChangeRow[]).map((r) => ({
        id: String(r.id),
        lawTitle: r.law_title ?? 'Зміна закону',
        date: r.created_at,
        affectedSlugs: r.affected_services ?? [],
      }))))
  }, [])

  const graph = useMemo(() => buildCatalogGraph(services), [services])

  return (
    <AdminLayout>
      <div className="px-4 md:px-6 py-6 md:py-8">
        <h1 className="text-lg md:text-xl font-bold text-ink mb-1">Карта послуг</h1>
        <p className="text-inkMute text-sm mb-6">
          Що на що впливає: закон → стаття → послуга → документ. Натисніть послугу, щоб відкрити її дзеркало.
        </p>
        {loading ? (
          <div className="h-96 bg-paper border border-line rounded-2xl animate-pulse" />
        ) : (
          <CatalogGraph
            nodes={graph.nodes}
            edges={graph.edges}
            changes={changes}
            services={services}
            onOpenService={(slug) => navigate(`/services/${slug}`)}
          />
        )}
      </div>
    </AdminLayout>
  )
}
