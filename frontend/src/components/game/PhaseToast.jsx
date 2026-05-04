import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useGame } from '@/context/GameContext'

export default function PhaseToast() {
  const { state } = useGame()
  const prevPhaseRef = useRef(null)
  const prevPassedLastRef = useRef(null)

  // Phase change toasts
  useEffect(() => {
    if (!state) return
    const isMyTurn = state.turnPlayer === state.player
    let message = null

    if (state.turnPhase === 'challenge_result') {
      message = state.challengeResult?.iChallenged
        ? 'You called the bluff!'
        : 'Opponent called the bluff!'
    } else if (state.turnPhase === 'bout_end') {
      const boutWinner = state.boutWinners[state.currentBout - 1]
      const iWon = boutWinner === state.player
      message = iWon
        ? `You win Bout ${state.currentBout}!`
        : `Opponent wins Bout ${state.currentBout}.`
    } else if (state.turnPhase === 'attack' && isMyTurn) {
      message = 'Your turn: Attack!'
    } else if (state.turnPhase === 'block' && isMyTurn) {
      message = 'Your turn: Block!'
    }

    if (message) {
      toast(message, { duration: 2500 })
    }
  }, [state?.turnPhase, state?.turnPlayer, state?.currentBout])

  // Opponent action toasts
  useEffect(() => {
    if (!state) return

    const prevPhase = prevPhaseRef.current
    const prevPassedLast = prevPassedLastRef.current
    prevPhaseRef.current = state.turnPhase
    prevPassedLastRef.current = state.passedLast

    const opponent = state.player === 'p1' ? 'p2' : 'p1'
    const oppName = state.opponentName || 'Opponent'

    let message = null

    if (state.passedLast === opponent && prevPassedLast !== opponent) {
      message = `${oppName} passed`
    } else if (
      prevPhase === 'attack' &&
      state.turnPhase === 'block' &&
      state.attackClaim?.player === opponent
    ) {
      const { count, cardName } = state.attackClaim
      message = `${oppName} attacked: ${count}× ${cardName}`
    } else if (
      prevPhase === 'block' &&
      state.turnPhase === 'resolve' &&
      state.attackClaim?.player === state.player
    ) {
      message = state.blockClaim
        ? `${oppName} blocked: ${state.blockClaim.count}× ${state.blockClaim.cardName}`
        : `${oppName} let it through`
    }

    if (message) {
      toast(message, { duration: 3000 })
    }
  }, [state?.turnPhase, state?.passedLast])

  return null
}
