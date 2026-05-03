import { useGame } from '@/context/GameContext'
import Card from './Card'
import { getCardInfo } from '@/utils/cards'
import { motion } from 'motion/react'

const PHASE_STYLES = {
  attack: 'bg-attack-light text-attack',
  block: 'bg-block-light text-block',
  resolve: 'bg-resolve-light text-resolve',
  resupply: 'bg-code-bg text-text',
  game_over: 'bg-accent-light text-accent',
}

export default function PlayArea() {
  const { state } = useGame()
  if (!state) return null

  if (state.turnPhase === 'game_over') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-6 px-4">
        <div className="px-4 py-2 rounded-full bg-accent-light text-accent font-semibold text-lg mb-4">
          Game Over!
        </div>
        <div className="text-2xl font-bold text-text-h">
          {state.winner === state.player ? '🎉 You won the duel!' : 'Opponent won the duel.'}
        </div>
      </div>
    )
  }

  const isMyTurn = state.turnPlayer === state.player
  const phaseLabel = {
    attack: isMyTurn ? 'Your Attack' : "Opponent's Attack",
    block: isMyTurn ? 'Your Block' : "Opponent's Block",
    resolve: 'Resolving',
    resupply: 'Resupplying',
  }

  const attackerCardInfo = state.attackClaim ? getCardInfo(state.attackClaim.cardName) : null
  const blockerCardInfo = state.blockClaim ? getCardInfo(state.blockClaim.cardName) : null

  const isWaiting = !isMyTurn && (state.turnPhase === 'attack' || state.turnPhase === 'block')

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-4 px-4 min-h-0">
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
            ? 'Waiting for opponent to attack…'
            : 'Waiting for opponent to block…'}
        </div>
      )}
    </div>
  )
}
