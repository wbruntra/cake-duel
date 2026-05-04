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

const PHASE_STYLES = {
  attack: 'bg-attack-light text-attack',
  block: 'bg-block-light text-block',
  resolve: 'bg-resolve-light text-resolve',
  challenge_result: 'bg-danger-light text-danger',
  game_over: 'bg-accent-light text-accent',
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
  const phaseLabel = {
    attack: isMyTurn ? 'Your Attack' : `${oppName}'s Attack`,
    block: isMyTurn ? 'Your Block' : `${oppName}'s Block`,
    resolve: 'Resolving',
    challenge_result: 'Call the Bluff!',
  }

  const attackerCardInfo = state.attackClaim ? getCardInfo(state.attackClaim.cardName) : null
  const blockerCardInfo = state.blockClaim ? getCardInfo(state.blockClaim.cardName) : null

  const isWaiting = !isMyTurn && (state.turnPhase === 'attack' || state.turnPhase === 'block')

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-4 px-4 min-h-0 relative">
      <LastActionBar state={state} />
      <motion.div
        key={state.turnPhase}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        className={`px-4 py-2 rounded-full font-semibold text-sm mb-4 ${PHASE_STYLES[state.turnPhase] || 'bg-code-bg text-text'}`}
      >
        {phaseLabel[state.turnPhase] || state.turnPhase}
      </motion.div>

      {state.attackClaim && (
        <div className="text-center mb-3">
          <div className="text-[11px] uppercase tracking-wide text-text mb-1">Attack Claim</div>
          <div className="text-base font-semibold text-text-h">
            {state.attackClaim.count}× {attackerCardInfo?.emoji} {state.attackClaim.cardName}
            {attackerCardInfo?.cakes && (
              <span className="text-sm text-text font-normal">
                {' '}
                🍰 {attackerCardInfo.cakes * state.attackClaim.count} total
              </span>
            )}
          </div>
          <div className="flex items-center justify-center gap-1 mt-2">
            {state.attackClaim.playedCardIds.map((id, i) => (
              <Card key={i} cardId={id} faceDown size="sm" />
            ))}
          </div>
        </div>
      )}

      {state.blockClaim && (
        <div className="text-center mb-3">
          <div className="text-[11px] uppercase tracking-wide text-text mb-1">Block Claim</div>
          <div className="text-base font-semibold text-text-h">
            {state.blockClaim.count}× {blockerCardInfo?.emoji} {state.blockClaim.cardName}
            {blockerCardInfo?.blocks && (
              <span className="text-sm text-text font-normal">
                {' '}
                🛡️ {blockerCardInfo.blocks * state.blockClaim.count} blocked
              </span>
            )}
          </div>
          <div className="flex items-center justify-center gap-1 mt-2">
            {state.blockClaim.playedCardIds.map((id, i) => (
              <Card key={i} cardId={id} faceDown size="sm" />
            ))}
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
