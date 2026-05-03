import { useGame } from '@/context/GameContext'
import Card from './Card'
import { getCardInfo } from '@/utils/cards'

export default function PlayArea() {
  const { state, send } = useGame()
  if (!state) return null

  if (state.turnPhase === 'game_over') {
    return (
      <div className="play-area">
        <div className="phase-indicator phase-game-over">Game Over!</div>
        <div className="game-result">
          {state.winner === state.player ? '🎉 You won the duel!' : 'Opponent won the duel.'}
        </div>
      </div>
    )
  }

  const phaseLabel = {
    attack: state.turnPlayer === state.player ? 'Your Turn: Attack' : "Opponent's Turn: Attack",
    block: state.turnPlayer === state.player ? 'Your Turn: Block' : "Opponent's Turn: Block",
    resolve: 'Resolving...',
    resupply: 'Resupplying...',
  }

  function doResolve() {
    send({ type: 'resolve' })
  }

  const attackerCardInfo = state.attackClaim ? getCardInfo(state.attackClaim.cardName) : null
  const blockerCardInfo = state.blockClaim ? getCardInfo(state.blockClaim.cardName) : null

  return (
    <div className="play-area">
      <div className={`phase-indicator phase-${state.turnPhase}`}>
        {phaseLabel[state.turnPhase] || state.turnPhase}
      </div>

      {state.attackClaim && (
        <div className="claim-section attack-claim">
          <div className="claim-title">Attack Claim</div>
          <div className="claim-detail">
            {state.attackClaim.count}x {attackerCardInfo?.emoji} {state.attackClaim.cardName}
            {attackerCardInfo?.cakes && (
              <span className="claim-effect">
                {' '}
                (🍰 {attackerCardInfo.cakes * state.attackClaim.count} total)
              </span>
            )}
          </div>
          <div className="claim-cards">
            {state.attackClaim.playedCardIds.map((id, i) => (
              <Card key={i} cardId={id} faceDown small />
            ))}
          </div>
        </div>
      )}

      {state.blockClaim && (
        <div className="claim-section block-claim">
          <div className="claim-title">Block Claim</div>
          <div className="claim-detail">
            {state.blockClaim.count}x {blockerCardInfo?.emoji} {state.blockClaim.cardName}
            {blockerCardInfo?.blocks && (
              <span className="claim-effect">
                {' '}
                (🛡️ {blockerCardInfo.blocks * state.blockClaim.count} blocked)
              </span>
            )}
          </div>
          <div className="claim-cards">
            {state.blockClaim.playedCardIds.map((id, i) => (
              <Card key={i} cardId={id} faceDown small />
            ))}
          </div>
        </div>
      )}

      {state.turnPhase === 'resolve' && !state.winner && (
        <button className="btn btn-resolve" onClick={doResolve}>
          Resolve Turn
        </button>
      )}

      {state.turnPhase === 'attack' && state.turnPlayer !== state.player && !state.winner && (
        <div className="waiting">Waiting for opponent to attack...</div>
      )}

      {state.turnPhase === 'block' && state.turnPlayer !== state.player && !state.winner && (
        <div className="waiting">Waiting for opponent to block...</div>
      )}
    </div>
  )
}
