import { Component, type ErrorInfo, type ReactNode } from 'react'
import { hapticError } from '../lib/telegram'

// App-level safety net for the TWA. Without this, any render throw in App /
// PreviewPage / the form leaves the user on a blank white screen with no way
// out (there was no error boundary anywhere before #88). Here we catch it and
// offer a friendly Ukrainian fallback with a reload, plus keep the raw message
// in a small mono line so a screenshot is enough to diagnose.

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // Console keeps the full stack for anyone with devtools; haptic signals the
    // failure on a real device where the console isn't visible.
    console.error('[TWA ErrorBoundary]', error, info.componentStack)
    hapticError()
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      // role="alert" so assistive tech announces the swap-in — the fallback
      // otherwise replaces the whole app silently for screen-reader users.
      <div
        role="alert"
        className="flex flex-col items-center justify-center h-dvh px-6 text-center bg-surface"
      >
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Щось пішло не так</h2>
        <p className="text-sm text-gray-500 leading-relaxed mb-6 max-w-xs">
          Виникла неочікувана помилка. Ваші дані не втрачені — спробуйте оновити сторінку.
          Якщо це повториться, зверніться до підтримки.
        </p>
        <button
          type="button"
          autoFocus
          onClick={this.handleReload}
          className="w-full max-w-xs py-3 rounded-btn bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 active:scale-95 transition-all duration-200"
        >
          Оновити
        </button>
        {this.state.message && (
          <p className="mt-4 text-[10px] font-mono text-gray-400 break-all max-w-xs">
            {this.state.message}
          </p>
        )}
      </div>
    )
  }
}
