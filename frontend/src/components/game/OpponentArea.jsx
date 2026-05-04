import { useGame } from '@/context/GameContext'
import CakeDisplay from './CakeDisplay'
import Card from './Card'

const PHASE_STYLES = {
  attack: 'bg-attack-light text-attack',
  block: 'bg-block-light text-block',
  resolve: 'bg-resolve-light text-resolve',
}

export default function OpponentArea() {
  const { state } = useGame()
  if (!state) return null

  const isOppTurn = state.turnPlayer !== state.player
  const oppPhaseLabel =
    isOppTurn && state.turnPhase === 'attack'
      ? "Their Attack"
      : isOppTurn && state.turnPhase === 'block'
        ? "Their Block"
        : null

  return (
    <div className="px-3 py-2 border-b border-border">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs font-medium text-danger">
            {state.opponentName || 'Opponent'}
          </span>
          <CakeDisplay count={state.opponentCakes} />
        </div>
        {oppPhaseLabel && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PHASE_STYLES[state.turnPhase]}`}>
            {oppPhaseLabel}
          </span>
        )}
        <span className="text-xs text-text shrink-0">
          {state.opponentHandCount} card{state.opponentHandCount !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex items-center justify-center -space-x-6 py-1">
        {Array.from({ length: state.opponentHandCount }).map((_, i) => (
          <Card key={i} faceDown size="sm" />
        ))}
        {state.opponentHandCount === 0 && (
          <span className="text-xs text-text italic">No cards</span>
        )}
      </div>
    </div>
  )
}
