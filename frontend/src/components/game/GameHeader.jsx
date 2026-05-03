import { useGame } from '@/context/GameContext'

export default function GameHeader() {
  const { state } = useGame()
  if (!state) return null

  const boutWinners = state.boutWinners || []
  const p1Score = boutWinners.filter((w) => w === 'p1').length
  const p2Score = boutWinners.filter((w) => w === 'p2').length

  const isGameOver = state.turnPhase === 'game_over'

  return (
    <div className="game-header">
      {!isGameOver && <div className="bout-info">Bout {state.currentBout}</div>}
      <div className="score">
        <span className={state.player === 'p1' ? 'score-you' : 'score-opp'}>
          {state.player === 'p1' ? 'You' : 'P1'}: {p1Score} 🏆
        </span>
        <span className="score-divider">-</span>
        <span className={state.player === 'p2' ? 'score-you' : 'score-opp'}>
          {state.player === 'p2' ? 'You' : 'P2'}: {p2Score} 🏆
        </span>
      </div>
      {boutWinners.map((w, i) => (
        <span key={i} className="bout-marker">
          B{i + 1}: {w === state.player ? '✓' : w ? '✗' : '—'}
        </span>
      ))}
    </div>
  )
}
