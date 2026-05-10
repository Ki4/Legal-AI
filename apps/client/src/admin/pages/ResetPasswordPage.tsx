import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export function ResetPasswordPage() {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [ready, setReady]         = useState(false)
  const { updatePassword }        = useAuth()
  const navigate                  = useNavigate()

  useEffect(() => {
    // Якщо юзер вже потрапив сюди — значить AdminApp отримав PASSWORD_RECOVERY і перенаправив
    // Перевіряємо чи є активна сесія (Supabase SDK вже встановив її з хешу)
    supabase!.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Паролі не збігаються')
      return
    }
    setError('')
    setLoading(true)
    try {
      await updatePassword(password)
      navigate('/services')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Помилка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏛</div>
          <h1 className="text-2xl font-bold text-white">Legal AI</h1>
          <p className="text-slate-400 text-sm mt-1">Новий пароль</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          {!ready ? (
            <div className="text-center text-slate-400 text-sm py-4">
              Перевірка посилання...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                  Новий пароль
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white
                             placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500
                             focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                  Повторіть пароль
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white
                             placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500
                             focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>

              {error && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed
                           text-white font-semibold rounded-xl text-sm transition-colors"
              >
                {loading ? '⏳ Зачекайте...' : 'Зберегти пароль'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
