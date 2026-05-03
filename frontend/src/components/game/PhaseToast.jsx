import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useGame } from '@/context/GameContext'

export default function PhaseToast() {
  const { state } = useGame()
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!state) return
    const isMyTurn = state.turnPlayer === state.player
    let message = null

    if (state.turnPhase === 'attack' && !isMyTurn) {
      message = 'Opponent is attacking…'
    } else if (state.turnPhase === 'block' && !isMyTurn) {
      message = 'Opponent is blocking…'
    } else if (state.turnPhase === 'attack' && isMyTurn) {
      message = 'Your turn: Attack!'
    } else if (state.turnPhase === 'block' && isMyTurn) {
      message = 'Your turn: Block!'
    } else if (state.turnPhase === 'resolve') {
      message = 'Resolving…'
    } else if (state.turnPhase === 'resupply') {
      message = 'Resupplying…'
    }

    if (message) {
      setToast(message)
      const timer = setTimeout(() => setToast(null), 2500)
      return () => clearTimeout(timer)
    }
  }, [state?.turnPhase, state?.turnPlayer, state?.currentBout])

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.25 }}
          className="fixed top-[env(safe-area-inset-top,8px)] left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-text-h text-bg text-sm font-medium shadow-lg"
        >
          {toast}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
