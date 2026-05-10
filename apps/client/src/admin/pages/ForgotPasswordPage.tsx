import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const { resetPassword }     = useAuth()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      await resetPassword(email)
      setSuccess('Лист з посиланням для скидання пароля надіслано на ' + email)
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
          <p className="text-slate-400 text-sm mt-1">Відновлення пароля</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          {success ? (
            <div className="space-y-4">
              <div className="px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
                {success}
              </div>
              <Link
                to="/login"
                className="block text-center text-sm text-slate-400 hover:text-white transition-colors"
              >
                Повернутись до входу
              </Link>
            </div>
          ) : (
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
                {loading ? '⏳ Зачекайте...' : 'Надіслати посилання'}
              </button>

              <Link
                to="/login"
                className="block text-center text-sm text-slate-400 hover:text-white transition-colors"
              >
                Повернутись до входу
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
