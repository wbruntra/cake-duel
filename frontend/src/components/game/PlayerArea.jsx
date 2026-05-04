import CakeDisplay from './CakeDisplay'
import Hand from './Hand'
import { useGame } from '@/context/GameContext'
import { useGameUI } from '@/hooks/useGameUI'
import { getCardInfo } from '@/utils/cards'

export default function PlayerArea() {
  const { state } = useGame()
  const { selectedIndices } = useGameUI()

  if (!state) return null

  const isMyTurn = state.turnPlayer === state.player
  const isAttackPhase = state.turnPhase === 'attack' && isMyTurn
  const isBlockPhase = state.turnPhase === 'block' && isMyTurn
  const canAct = isAttackPhase || isBlockPhase

  const totalCakes = selectedIndices.reduce((sum, i) => {
    const cardId = state.hand[i]
    if (!cardId) return sum
    const info = getCardInfo(cardId)
    return sum + (info?.cakes || 0)
  }, 0)

  return (
    <div className="px-3 py-2 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-attack">{state.myName || 'You'}</span>
          <CakeDisplay count={state.myCakes} />
        </div>
        {canAct && selectedIndices.length > 0 && (
          <span className="text-xs text-text">
            {selectedIndices.length} card{selectedIndices.length !== 1 ? 's' : ''}
            {totalCakes > 0 && ` · 🍰${totalCakes} total`}
          </span>
        )}
      </div>
      <Hand />
    </div>
  )
}
