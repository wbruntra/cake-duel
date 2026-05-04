import { useGame } from '@/context/GameContext'
import { motion } from 'motion/react'
import { tap } from '@/utils/haptics'

export default function BoutEndScreen() {
  const { state, send } = useGame()
  if (!state) return null

  const currentBout = state.currentBout
  const boutWinners = state.boutWinners || []
  const winner = boutWinners[currentBout - 1]
  const iWon = winner === state.player

  const myName = state.myName || 'You'
  const oppName = state.opponentName || 'Opponent'
  const p1Score = boutWinners.filter((w) => w === 'p1').length
  const p2Score = boutWinners.filter((w) => w === 'p2').length
  const myScore = state.player === 'p1' ? p1Score : p2Score
  const oppScore = state.player === 'p1' ? p2Score : p1Score

  const hasAcked = state.boutEndAcks?.includes(state.player)
  const opponentAcked = state.boutEndAcks?.includes(state.player === 'p1' ? 'p2' : 'p1')

  // Determine "why" the bout ended
  let whyText = ''
  if (state.attackClaim && state.blockClaim) {
    // Could be cake depletion or just a turn that ended the bout
    whyText = 'Cakes ran out'
  } else if (!state.attackClaim && !state.blockClaim) {
    whyText = 'Both passed — most cakes wins'
  } else {
    whyText = 'Cakes ran out'
  }

  function doBoutAck() {
    tap()
    send({ type: 'boutAck' })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-20 flex flex-col items-center justify-center px-6 bg-bg/95 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex flex-col items-center gap-5 w-full max-w-sm"
      >
        <div className={`text-3xl font-bold ${iWon ? 'text-attack' : 'text-danger'}`}>
          {iWon ? `You won bout ${currentBout}` : `${oppName} won bout ${currentBout}`}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-text uppercase tracking-wide">{myName}</span>
            <span className="text-2xl font-bold text-attack">{myScore}</span>
          </div>
          <span className="text-text text-lg">–</span>
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-text uppercase tracking-wide">{oppName}</span>
            <span className="text-2xl font-bold text-danger">{oppScore}</span>
          </div>
        </div>

        <div className="flex gap-1.5">
          {boutWinners.map((w, i) => (
            <span
              key={i}
              className={`w-3 h-3 rounded-full ${
                i === currentBout - 1 ? 'ring-2 ring-offset-1 ring-accent' : ''
              } ${w === state.player ? 'bg-attack' : w ? 'bg-danger' : 'bg-border'}`}
            />
          ))}
        </div>

        <div className="text-sm text-text italic">{whyText}</div>

        {!hasAcked ? (
          <button
            className="w-full h-14 text-lg font-semibold rounded-lg bg-accent text-white active:scale-95 transition-transform touch-manipulation"
            onClick={doBoutAck}
          >
            Continue
          </button>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="text-text text-base italic">Waiting for {oppName}…</span>
            {opponentAcked && <span className="text-xs text-attack">{oppName} ready</span>}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
