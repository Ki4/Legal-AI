import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

export function PrivacyPolicyModal({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />

          {/* Modal */}
          <motion.div
            className="relative w-full sm:max-w-lg max-h-[85vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-base font-bold text-gray-900">Політика конфіденційності</h2>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              >
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-gray-700 leading-relaxed space-y-4">
              <section>
                <h3 className="font-semibold text-gray-900 mb-1">1. Які дані ми збираємо</h3>
                <p>
                  Для підготовки юридичних документів ми збираємо персональні дані, які ви вводите у формі:
                  прізвище, ім'я, по батькові, ІПН, адресу, контактні дані, а також дані про сімейний стан
                  та інші відомості, необхідні для складання документа.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">2. Як ми використовуємо дані</h3>
                <p>
                  Ваші дані використовуються виключно для генерації юридичного документа за вашим запитом.
                  Ми не передаємо дані третім особам, крім випадків, передбачених законодавством України.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">3. Захист даних</h3>
                <p>
                  Персональні дані шифруються за допомогою алгоритму AES-256-GCM перед збереженням.
                  Доступ до даних мають тільки уповноважені особи. Ми дотримуємося вимог
                  Закону України «Про захист персональних даних» та принципів GDPR.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">4. Строк зберігання</h3>
                <p>
                  Ваші дані зберігаються протягом 90 днів з моменту створення документа,
                  після чого автоматично видаляються. Ви можете запросити видалення даних
                  раніше цього строку, звернувшись до нас.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">5. Ваші права</h3>
                <p>Відповідно до законодавства, ви маєте право:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-gray-600">
                  <li>Знати, які ваші дані обробляються</li>
                  <li>Отримати копію ваших даних</li>
                  <li>Вимагати виправлення неточних даних</li>
                  <li>Вимагати видалення ваших даних</li>
                  <li>Відкликати згоду на обробку даних</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-gray-900 mb-1">6. Контакти</h3>
                <p>
                  З питань обробки персональних даних звертайтеся через Telegram-бота,
                  через який ви отримали доступ до цього сервісу.
                </p>
              </section>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-btn bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 active:scale-95 transition-all duration-200"
              >
                Зрозуміло
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
