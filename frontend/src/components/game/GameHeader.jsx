import { useState } from 'react'
import { useGame } from '@/context/GameContext'

export default function GameHeader() {
  const { state, onLeave } = useGame()
  if (!state) return null

  const boutWinners = state.boutWinners || []
  const p1Score = boutWinners.filter((w) => w === 'p1').length
  const p2Score = boutWinners.filter((w) => w === 'p2').length
  const isGameOver = state.turnPhase === 'game_over'

  const playerScore = state.player === 'p1' ? p1Score : p2Score
  const oppScore = state.player === 'p1' ? p2Score : p1Score

  const myName = state.myName || 'You'
  const oppName = state.opponentName || 'Opponent'

  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="h-11 flex items-center justify-between px-3 safe-top border-b border-border bg-bg/95">
      <div className="flex items-center gap-2 text-sm font-medium">
        {!isGameOver && (
          <span className="text-text-h font-semibold">Bout {state.currentBout}</span>
        )}
        <span className="text-text">·</span>
        <span className="text-attack font-semibold">
          {myName} {playerScore}
        </span>
        <span className="text-text">–</span>
        <span className="text-danger font-semibold">{oppScore}</span>
        <span className="text-text">·</span>
        <span className="flex gap-0.5">
          {boutWinners.map((w, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full ${w === state.player ? 'bg-attack' : w ? 'bg-danger' : 'bg-border'}`}
            />
          ))}
        </span>
      </div>
      <div className="relative">
        <button
          className="w-8 h-8 flex items-center justify-center text-text hover:text-text-h"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          ⋯
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-9 z-40 bg-bg border border-border rounded-lg shadow-lg py-1 min-w-[120px]">
              <button
                className="w-full px-4 py-2 text-left text-sm text-danger hover:bg-danger-light"
                onClick={() => {
                  setMenuOpen(false)
                  onLeave()
                }}
              >
                Leave Game
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
