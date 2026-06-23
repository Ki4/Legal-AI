interface ToastProps {
  type: 'success' | 'error'
  message: string
}

export function Toast({ type, message }: ToastProps) {
  return (
    <div
      role="status"
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] max-w-[90vw] px-4 py-3 rounded-xl shadow-lg
        text-sm font-medium text-white text-center
        ${type === 'success' ? 'bg-ok' : 'bg-danger'}`}
    >
      {message}
    </div>
  )
}
