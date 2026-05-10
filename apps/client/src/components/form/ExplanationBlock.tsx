import { useState } from 'react'
import { Info, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  text: string
}

export function ExplanationBlock({ text }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-primary-600 font-medium hover:text-primary-700 transition-colors"
      >
        <Info size={13} />
        Навіщо ми про це питаємо?
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={13} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-gray-600 leading-relaxed">
              <span className="text-blue-600 font-semibold">Юридичне обґрунтування: </span>
              {text}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
