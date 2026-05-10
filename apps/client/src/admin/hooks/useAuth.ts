import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

export function useAuth() {
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase?.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    }) ?? { data: { subscription: { unsubscribe: () => {} } } }

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(email: string, password: string) {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase?.auth.signOut()
  }

  async function resetPassword(email: string) {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }

  async function updatePassword(password: string) {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }

  return { user, loading, signIn, signUp, signOut, resetPassword, updatePassword }
}
