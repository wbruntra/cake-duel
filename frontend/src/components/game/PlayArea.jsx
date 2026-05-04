import { useGame } from '@/context/GameContext'
import Card from './Card'
import BoutEndScreen from './BoutEndScreen'
import ChallengeResultScreen from './ChallengeResultScreen'
import TurnResultOverlay from './TurnResultOverlay'
import { getCardInfo } from '@/utils/cards'
import { motion } from 'motion/react'

function LastActionBar({ state }) {
  const action = state.lastAction
  if (!action) return null

  const myName = state.myName || 'You'
  const oppName = state.opponentName || 'Opponent'
  const iAm = (player) => player === state.player

  let text = null

  if (action.type === 'pass') {
    text = iAm(action.player) ? 'You passed' : `${oppName} passed`
  } else if (action.type === 'attack') {
    const { attackClaim, blockClaim, cakesStolen } = action
    const attackerLabel = iAm(attackClaim.player) ? myName : oppName
    const cardInfo = getCardInfo(attackClaim.cardName)
    const emoji = cardInfo?.emoji ?? ''

    let outcome
    if (cakesStolen > 0) {
      outcome = iAm(attackClaim.player) ? `+${cakesStolen}🍰 stolen` : `${cakesStolen}🍰 lost`
    } else if (blockClaim) {
      outcome = 'blocked'
    } else {
      outcome = 'no effect'
    }

    text = `${attackerLabel} claimed ${attackClaim.count}× ${emoji} ${attackClaim.cardName} — ${outcome}`
  }

  if (!text) return null

  return (
    <motion.div
      key={text}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="text-[11px] text-text/60 text-center px-4 pb-1 truncate"
    >
      {text}
    </motion.div>
  )
}

export default function PlayArea() {
  const { state } = useGame()
  if (!state) return null

  const oppName = state.opponentName || 'Opponent'

  if (state.turnPhase === 'bout_end') {
    return <BoutEndScreen />
  }

  if (state.turnPhase === 'challenge_result') {
    return <ChallengeResultScreen />
  }

  if (state.turnPhase === 'turn_resolution') {
    return <TurnResultOverlay />
  }

  if (state.turnPhase === 'game_over') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-6 px-4">
        <div className="px-4 py-2 rounded-full bg-accent-light text-accent font-semibold text-lg mb-4">
          Game Over!
        </div>
        <div className="text-2xl font-bold text-text-h">
          {state.winner === state.player ? '🎉 You won the duel!' : `${oppName} won the duel.`}
        </div>
      </div>
    )
  }

  const isMyTurn = state.turnPlayer === state.player

  const attackerCardInfo = state.attackClaim ? getCardInfo(state.attackClaim.cardName) : null
  const blockerCardInfo = state.blockClaim ? getCardInfo(state.blockClaim.cardName) : null

  const isWaiting = !isMyTurn && (state.turnPhase === 'attack' || state.turnPhase === 'block')

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-2 px-4 min-h-0 relative">
      <LastActionBar state={state} />

      {state.attackClaim && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-0.5">
            {state.attackClaim.playedCardIds.map((id, i) => (
              <Card key={i} cardId={id} faceDown size="xs" />
            ))}
          </div>
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-wide text-text leading-none mb-0.5">Attack</div>
            <div className="text-sm font-semibold text-text-h leading-tight">
              {state.attackClaim.count}× {attackerCardInfo?.emoji} {state.attackClaim.cardName}
              {attackerCardInfo?.cakes && (
                <span className="text-xs text-text font-normal">
                  {' '}🍰{attackerCardInfo.cakes * state.attackClaim.count}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {state.blockClaim && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-0.5">
            {state.blockClaim.playedCardIds.map((id, i) => (
              <Card key={i} cardId={id} faceDown size="xs" />
            ))}
          </div>
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-wide text-text leading-none mb-0.5">Block</div>
            <div className="text-sm font-semibold text-text-h leading-tight">
              {state.blockClaim.count}× {blockerCardInfo?.emoji} {state.blockClaim.cardName}
              {blockerCardInfo?.blocks && (
                <span className="text-xs text-text font-normal">
                  {' '}🛡️{blockerCardInfo.blocks * state.blockClaim.count}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {isWaiting && (
        <div className="text-sm italic text-text">
          {state.turnPhase === 'attack'
            ? `Waiting for ${oppName} to attack…`
            : `Waiting for ${oppName} to block…`}
        </div>
      )}
    </div>
  )
}
