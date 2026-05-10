import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Guard: avoids crash when env vars are not set yet (e.g. local dev before .env.local is filled)
export const supabase: SupabaseClient | null = (url && key)
  ? createClient(url, key)
  : null
