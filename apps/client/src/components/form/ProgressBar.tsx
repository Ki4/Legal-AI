import { motion } from 'framer-motion'

interface Props {
  progress: number // 0..1
  currentTab: number
  totalTabs: number
}

export function ProgressBar({ progress, currentTab, totalTabs }: Props) {
  return (
    <div className="px-4 pt-3 pb-2 bg-white border-b border-gray-100">
      {/* Step dots */}
      <div className="flex items-center justify-between mb-2">
        {Array.from({ length: totalTabs }).map((_, i) => (
          <div key={i} className="flex items-center flex-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                i < currentTab
                  ? 'bg-primary-600 text-white'
                  : i === currentTab
                  ? 'bg-white border-2 border-primary-600 text-primary-600'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {i < currentTab ? '✓' : i + 1}
            </div>
            {i < totalTabs - 1 && (
              <div className="flex-1 h-0.5 mx-1 bg-gray-100 overflow-hidden rounded-full">
                <motion.div
                  className="h-full bg-primary-600"
                  animate={{ width: i < currentTab ? '100%' : '0%' }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Thin progress bar */}
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full"
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        />
      </div>

      <p className="text-xs text-gray-400 mt-1.5">
        Крок {currentTab + 1} з {totalTabs}
      </p>
    </div>
  )
}
