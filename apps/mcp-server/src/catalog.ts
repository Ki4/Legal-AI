import { createSupabaseClient } from '../../../scripts/lib/supabase-rest.mjs'
import type { Config } from './env.js'
import type { Checklist, ServiceRow, ServiceStatus } from './types.js'

/**
 * Catalog loader (plan D4). Tools are registered at startup for services with
 * generation_mode='template' and status active|needs_review — needs_review is
 * deliberately INCLUDED so the interview can proceed while generation refuses
 * (the kill-switch demo). disabled / non-template services never get tools.
 */
export const CATALOG_QUERY =
  'select=slug,title,description,status,generation_mode,form_config,document_template,required_checklist,price' +
  '&generation_mode=eq.template&status=in.(active,needs_review)&order=slug'

/** Re-fetched at EVERY generate call so an admin status flip takes effect live. */
export const FRESH_QUERY_PREFIX = 'select=status,document_template,required_checklist&slug=eq.'

export interface ServiceFresh {
  status: ServiceStatus
  document_template: string | null
  required_checklist: Checklist | null
}

export interface CatalogSource {
  fetchAll(): Promise<ServiceRow[]>
  fetchFresh(slug: string): Promise<ServiceFresh | null>
}

export function supabaseCatalogSource(config: Config): CatalogSource {
  const client = createSupabaseClient(config.supabaseUrl, config.supabaseKey)
  return {
    async fetchAll(): Promise<ServiceRow[]> {
      return client.sbGet<ServiceRow>('services', CATALOG_QUERY)
    },
    async fetchFresh(slug: string): Promise<ServiceFresh | null> {
      const rows = await client.sbGet<ServiceFresh>(
        'services',
        `${FRESH_QUERY_PREFIX}${encodeURIComponent(slug)}`,
      )
      return rows[0] ?? null
    },
  }
}
