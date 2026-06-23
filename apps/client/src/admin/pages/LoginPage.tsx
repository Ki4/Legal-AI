import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { ThemeToggle } from '../theme/ThemeToggle'

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
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      {/* Theme switch */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏛</div>
          <h1 className="text-2xl font-bold text-ink">Legal AI</h1>
          <p className="text-inkSoft text-sm mt-1">Панель юриста</p>
        </div>

        {/* Card */}
        <div className="bg-paper border border-line rounded-2xl p-6 shadow-card">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-inkSoft mb-1.5 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="lawyer@example.com"
                required
                className="w-full px-4 py-3 bg-paperAlt border border-line rounded-xl text-ink
                           placeholder-inkMute text-sm focus:outline-none focus:border-brand
                           focus:ring-1 focus:ring-brand transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-inkSoft mb-1.5 uppercase tracking-wide">
                Пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full px-4 py-3 bg-paperAlt border border-line rounded-xl text-ink
                           placeholder-inkMute text-sm focus:outline-none focus:border-brand
                           focus:ring-1 focus:ring-brand transition-colors"
              />
            </div>

            {error && (
              <div className="px-4 py-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed
                         text-white font-semibold rounded-xl text-sm transition-colors"
            >
              {loading ? '⏳ Зачекайте...' : 'Увійти'}
            </button>

            <Link
              to="/forgot-password"
              className="block text-center text-sm text-inkMute hover:text-inkSoft transition-colors"
            >
              Забули пароль?
            </Link>
          </form>
        </div>

        <p className="text-center text-xs text-inkMute mt-4">
          Legal AI Admin Panel v1.0
        </p>
      </div>
    </div>
  )
}
