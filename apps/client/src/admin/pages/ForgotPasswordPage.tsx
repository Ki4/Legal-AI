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
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏛</div>
          <h1 className="text-2xl font-bold text-ink">Legal AI</h1>
          <p className="text-inkSoft text-sm mt-1">Відновлення пароля</p>
        </div>

        <div className="bg-paper border border-line rounded-2xl p-6">
          {success ? (
            <div className="space-y-4">
              <div className="px-4 py-3 bg-ok/10 border border-ok/20 rounded-xl text-ok text-sm">
                {success}
              </div>
              <Link
                to="/login"
                className="block text-center text-sm text-inkSoft hover:text-ink transition-colors"
              >
                Повернутись до входу
              </Link>
            </div>
          ) : (
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
                  className="w-full px-4 py-3 bg-paperAlt border border-lineStrong rounded-xl text-ink
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
                {loading ? '⏳ Зачекайте...' : 'Надіслати посилання'}
              </button>

              <Link
                to="/login"
                className="block text-center text-sm text-inkSoft hover:text-ink transition-colors"
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
