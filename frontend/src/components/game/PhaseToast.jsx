import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useGame } from '@/context/GameContext'

export default function PhaseToast() {
  const { state } = useGame()
  const [toast, setToast] = useState(null)
  const [actionToast, setActionToast] = useState(null)

  const prevPhaseRef = useRef(null)
  const prevPassedLastRef = useRef(null)

  // Phase change toasts (generic turn announcements)
  useEffect(() => {
    if (!state) return
    const isMyTurn = state.turnPlayer === state.player
    let message = null
    let isBoutEnd = false

    if (state.turnPhase === 'challenge_result') {
      message = state.challengeResult?.iChallenged
        ? 'You called the bluff!'
        : 'Opponent called the bluff!'
      isBoutEnd = false
    } else if (state.turnPhase === 'bout_end') {
      const boutWinner = state.boutWinners[state.currentBout - 1]
      const iWon = boutWinner === state.player
      message = iWon
        ? `You win Bout ${state.currentBout}!`
        : `Opponent wins Bout ${state.currentBout}.`
      isBoutEnd = true
    } else if (state.turnPhase === 'attack' && isMyTurn) {
      message = 'Your turn: Attack!'
    } else if (state.turnPhase === 'block' && isMyTurn) {
      message = 'Your turn: Block!'
    }

    if (message) {
      setToast({ text: message, boutEnd: isBoutEnd })
      if (!isBoutEnd) {
        const timer = setTimeout(() => setToast(null), 2500)
        return () => clearTimeout(timer)
      }
    }
  }, [state?.turnPhase, state?.turnPlayer, state?.currentBout])

  // Opponent action toasts (what the opponent just did)
  useEffect(() => {
    if (!state) return

    const prevPhase = prevPhaseRef.current
    const prevPassedLast = prevPassedLastRef.current
    prevPhaseRef.current = state.turnPhase
    prevPassedLastRef.current = state.passedLast

    const opponent = state.player === 'p1' ? 'p2' : 'p1'
    const oppName = state.opponentName || 'Opponent'

    let message = null

    // Opponent passed
    if (state.passedLast === opponent && prevPassedLast !== opponent) {
      message = `${oppName} passed`
    }
    // Opponent attacked → phase moved to block and it's now our turn to defend
    else if (
      prevPhase === 'attack' &&
      state.turnPhase === 'block' &&
      state.attackClaim?.player === opponent
    ) {
      const { count, cardName } = state.attackClaim
      message = `${oppName} attacked: ${count}× ${cardName}`
    }
    // Opponent responded to block phase (we were the attacker, they were the defender)
    else if (
      prevPhase === 'block' &&
      state.turnPhase === 'resolve' &&
      state.attackClaim?.player === state.player
    ) {
      if (state.blockClaim) {
        message = `${oppName} blocked: ${state.blockClaim.count}× ${state.blockClaim.cardName}`
      } else {
        message = `${oppName} let it through`
      }
    }

    if (message) {
      setActionToast(message)
      const timer = setTimeout(() => setActionToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [state?.turnPhase, state?.passedLast])

  return (
    <>
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.text}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
            className={
              toast.boutEnd
                ? 'fixed top-[env(safe-area-inset-top,8px)] left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl bg-accent text-white text-base font-semibold shadow-xl whitespace-nowrap'
                : 'fixed top-[env(safe-area-inset-top,8px)] left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-text-h text-bg text-sm font-medium shadow-lg whitespace-nowrap'
            }
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {actionToast && (
          <motion.div
            key={actionToast}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+116px)] left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-surface border border-border text-text-h text-sm font-medium shadow-lg whitespace-nowrap"
          >
            {actionToast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
