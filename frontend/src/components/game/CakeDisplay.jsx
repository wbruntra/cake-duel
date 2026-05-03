import { AnimatePresence, motion } from 'motion/react'

export default function CakeDisplay({ count }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-code-bg text-sm font-medium text-text-h">
      <span>🍰</span>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={count}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
        >
          × {count}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}
