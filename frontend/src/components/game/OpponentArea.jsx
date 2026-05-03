import { useGame } from '@/context/GameContext'
import CakeDisplay from './CakeDisplay'
import Card from './Card'

export default function OpponentArea() {
  const { state } = useGame()
  if (!state) return null

  return (
    <div className="px-3 py-2 border-b border-border">
      <div className="flex items-center justify-between mb-1">
        <CakeDisplay count={state.opponentCakes} />
        <span className="text-xs text-text">
          {state.opponentHandCount} card{state.opponentHandCount !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex items-center justify-center -space-x-6 py-1">
        {Array.from({ length: state.opponentHandCount }).map((_, i) => (
          <div
            key={i}
            className="w-10 h-14 rounded-md bg-code-bg border border-border flex items-center justify-center text-lg"
          >
            🃏
          </div>
        ))}
        {state.opponentHandCount === 0 && (
          <span className="text-xs text-text italic">No cards</span>
        )}
      </div>
      {state.blockClaim && (
        <div className="flex items-center justify-center gap-1 mt-1">
          <span className="text-xs text-text">
            Played {state.blockClaim.count} as {state.blockClaim.cardName}
          </span>
          <div className="flex items-center gap-0.5">
            {state.blockClaim.playedCardIds.map((id, i) => (
              <Card key={i} cardId={id} faceDown size="sm" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
