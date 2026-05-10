import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { signIn }              = useAuth()
  const navigate                = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/services')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Помилка авторизації')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏛</div>
          <h1 className="text-2xl font-bold text-white">Legal AI</h1>
          <p className="text-slate-400 text-sm mt-1">Панель юриста</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="lawyer@example.com"
                required
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white
                           placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500
                           focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                Пароль
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
              {loading ? '⏳ Зачекайте...' : 'Увійти'}
            </button>

            <Link
              to="/forgot-password"
              className="block text-center text-sm text-slate-500 hover:text-slate-300 transition-colors"
            >
              Забули пароль?
            </Link>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          Legal AI Admin Panel v1.0
        </p>
      </div>
    </div>
  )
}
