import { useRef, useState, useEffect } from 'react'
import Card from './Card'
import { useGameUI } from '@/hooks/useGameUI'
import { useGame } from '@/context/GameContext'

// Card pixel dimensions per size (must match Card.jsx SIZE_CLASSES)
const SIZES = [
  { name: 'lg', w: 112, h: 160 },
  { name: 'md', w: 80, h: 112 },
  { name: 'sm', w: 56, h: 80 },
]
const MIN_PEEK = 28 // minimum visible strip of each hidden card

function pickLayout(availableWidth, cardCount) {
  if (cardCount <= 1) return { size: SIZES[0], peek: 0 }
  for (const size of SIZES) {
    const minWidth = size.w + MIN_PEEK * (cardCount - 1)
    if (minWidth <= availableWidth) {
      const peek = Math.min(size.w - 8, (availableWidth - size.w) / (cardCount - 1))
      return { size, peek }
    }
  }
  // Even sm doesn't fit — squish as much as possible
  const size = SIZES[SIZES.length - 1]
  const peek = Math.max(MIN_PEEK * 0.5, (availableWidth - size.w) / (cardCount - 1))
  return { size, peek }
}

export default function Hand() {
  const { state } = useGame()
  const { selectedIndices, toggleCard } = useGameUI()
  const containerRef = useRef(null)
  const [availableWidth, setAvailableWidth] = useState(320)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      setAvailableWidth(entry.contentRect.width)
    })
    obs.observe(el)
    setAvailableWidth(el.clientWidth)
    return () => obs.disconnect()
  }, [])

  if (!state) return null

  const canAct =
    (state.turnPhase === 'attack' || state.turnPhase === 'block') &&
    state.turnPlayer === state.player

  const cardCount = state.hand.length
  if (cardCount === 0) {
    return (
      <div ref={containerRef} className="flex items-center justify-center py-4 text-text italic text-sm">
        No cards
      </div>
    )
  }

  const { size, peek } = pickLayout(availableWidth, cardCount)
  const handWidth = cardCount === 1 ? size.w : size.w + peek * (cardCount - 1)
  const liftPx = Math.round(size.h * 0.12)

  return (
    <div ref={containerRef} className="w-full flex justify-center">
      <div className="relative" style={{ width: handWidth, height: size.h + liftPx + 4 }}>
        {state.hand.map((cardId, i) => {
          const isSelected = selectedIndices.includes(i)
          const order = isSelected ? selectedIndices.indexOf(i) : null
          return (
            <div
              key={i}
              className="absolute transition-all duration-200 ease-out"
              style={{
                left: peek * i,
                zIndex: isSelected ? 10 + i : i,
                top: isSelected ? 0 : liftPx,
              }}
            >
              <Card
                cardId={cardId}
                selected={isSelected}
                selectionOrder={order}
                onClick={canAct ? () => toggleCard(i) : null}
                size={size.name}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
