export function SkeletonLoader() {
  return (
    <div className="flex flex-col h-screen bg-surface overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-7 h-7 rounded-full bg-gray-200 animate-pulse" />
          <div className="h-5 w-36 bg-gray-200 rounded animate-pulse" />
          <div className="ml-auto h-4 w-12 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full mt-3 animate-pulse" />
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-hidden px-4 pt-5 space-y-6">
        {[80, 56, 72, 56].map((w, i) => (
          <div key={i}>
            <div
              className="h-3 bg-gray-200 rounded animate-pulse mb-2"
              style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }}
            />
            <div
              className="h-12 bg-gray-100 rounded-btn animate-pulse"
              style={{ animationDelay: `${i * 80 + 40}ms` }}
            />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="px-4 py-3 flex gap-2 border-t border-gray-100">
        {[60, 76, 52, 68].map((w, i) => (
          <div
            key={i}
            className="h-7 rounded-full bg-gray-200 animate-pulse"
            style={{ width: `${w}px`, animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>

      {/* Button */}
      <div className="px-4 pb-6">
        <div className="h-12 bg-primary-100 rounded-btn animate-pulse" />
      </div>
    </div>
  )
}
