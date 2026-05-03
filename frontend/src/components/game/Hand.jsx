import Card from './Card'
import { useGameUI } from '@/hooks/useGameUI'
import { useGame } from '@/context/GameContext'

export default function Hand() {
  const { state } = useGame()
  const { selectedIndices, toggleCard } = useGameUI()

  if (!state) return null

  const canAct =
    (state.turnPhase === 'attack' || state.turnPhase === 'block') &&
    state.turnPlayer === state.player

  const cardCount = state.hand.length
  if (cardCount === 0) {
    return (
      <div className="flex items-center justify-center py-4 text-text italic text-sm">
        No cards
      </div>
    )
  }

  const CARD_WIDTH = 112
  const CARD_HEIGHT = 160
  const MAX_HAND_WIDTH = 400
  const MIN_PEEK = 52
  const PEEK =
    cardCount > 1 ? Math.max(MIN_PEEK, (MAX_HAND_WIDTH - CARD_WIDTH) / (cardCount - 1)) : 0
  const handWidth = CARD_WIDTH + PEEK * (cardCount - 1)

  return (
    <div className="relative mx-auto" style={{ width: handWidth, height: CARD_HEIGHT + 28 }}>
      <div className="relative w-full h-full">
        {state.hand.map((cardId, i) => {
          const isSelected = selectedIndices.includes(i)
          const order = isSelected ? selectedIndices.indexOf(i) : null
          return (
            <div
              key={i}
              className="absolute transition-all duration-200 ease-out"
              style={{
                left: PEEK * i,
                zIndex: isSelected ? 10 + i : i,
                top: isSelected ? -16 : 0,
              }}
            >
              <Card
                cardId={cardId}
                selected={isSelected}
                selectionOrder={order}
                onClick={canAct ? () => toggleCard(i) : null}
                size="lg"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
