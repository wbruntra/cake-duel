import { useState, useEffect } from 'react'
import { useGame } from '@/context/GameContext'
import { motion } from 'motion/react'
import { tap } from '@/utils/haptics'
import { getCardInfo, CARD_BACK_IMAGE } from '@/utils/cards'

function FlipCard({ cardName, delay }) {
  const [flipped, setFlipped] = useState(false)
  const info = getCardInfo(cardName)

  useEffect(() => {
    const timer = setTimeout(() => setFlipped(true), delay)
    return () => clearTimeout(timer)
  }, [delay])

  return (
    <div className="w-20 h-28" style={{ perspective: '600px' }}>
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Card Back */}
        <div
          className="absolute inset-0 rounded-lg overflow-hidden border-2 border-border bg-code-bg"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <img
            src={CARD_BACK_IMAGE}
            alt="Card back"
            className="w-full h-full object-cover"
            draggable={false}
          />
        </div>
        {/* Card Front */}
        <div
          className="absolute inset-0 rounded-lg overflow-hidden border-2 border-border bg-bg flex flex-col"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          {info.image ? (
            <img
              src={info.image}
              alt={info.name}
              className="w-full aspect-square object-cover rounded-t-md"
              draggable={false}
            />
          ) : (
            <span className="text-2xl mt-2">{info.emoji || '?'}</span>
          )}
          <span className="text-[9px] font-semibold text-text-h leading-tight truncate w-full text-center pt-0.5 px-0.5">
            {info.name}
          </span>
        </div>
      </motion.div>
    </div>
  )
}

export default function ChallengeResultScreen() {
  const { state, send } = useGame()
  if (!state || !state.challengeResult) return null

  const { challengeResult } = state
  const hasAcked = state.challengeAcks?.includes(state.player)
  const opponentAcked = state.challengeAcks?.includes(state.player === 'p1' ? 'p2' : 'p1')

  const oppName = state.opponentName || 'Opponent'
  const myName = state.myName || 'You'

  const targetLabel = challengeResult.target === 'attack' ? 'Attack' : 'Block'
  const truthfulLabel = challengeResult.claimWasTruthful ? 'Truthful!' : 'A Bluff!'
  const truthfulEmoji = challengeResult.claimWasTruthful ? '✓' : '✗'
  const truthfulColor = challengeResult.claimWasTruthful ? 'text-attack' : 'text-danger'

  function doAck() {
    tap()
    send({ type: 'challengeAck' })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-20 flex flex-col items-center justify-center px-6 bg-bg/95 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.85, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="flex flex-col items-center gap-4 w-full max-w-sm"
      >
        <div className="text-xs uppercase tracking-widest text-text font-medium">
          Call the Bluff!
        </div>

        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2, type: 'spring', stiffness: 200 }}
          className={`text-4xl font-bold ${challengeResult.iWon ? 'text-attack' : 'text-danger'}`}
        >
          {challengeResult.iWon ? 'You won!' : `${oppName} won!`}
        </motion.div>

        <div className="flex flex-col items-center gap-1 mt-1">
          <span className="text-sm text-text">
            {challengeResult.iChallenged ? 'You called the bluff' : `${oppName} called the bluff`}{' '}
            on the {targetLabel}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-2xl font-bold ${truthfulColor}`}>{truthfulEmoji}</span>
            <span className={`text-lg font-semibold ${truthfulColor}`}>{truthfulLabel}</span>
          </div>
        </div>

        <div className="mt-1 px-4 py-2 rounded-lg bg-code-bg border border-border">
          <div className="text-xs text-text mb-2">Cards revealed:</div>
          <div className="flex flex-wrap justify-center gap-2">
            {challengeResult.revealedCardNames.map((name, i) => (
              <FlipCard key={i} cardName={name} delay={600 + i * 400} />
            ))}
          </div>
        </div>

        <div className="text-sm text-text mt-1">
          This bout goes to{' '}
          <span
            className={`font-semibold ${challengeResult.iWon ? 'text-attack' : 'text-danger'}`}
          >
            {challengeResult.iWon ? 'you' : oppName}
          </span>
        </div>

        {!hasAcked ? (
          <button
            className="w-full h-14 text-lg font-semibold rounded-lg bg-accent text-white active:scale-95 transition-transform touch-manipulation mt-2"
            onClick={doAck}
          >
            Continue
          </button>
        ) : (
          <div className="flex flex-col items-center gap-2 mt-2">
            <span className="text-text text-base italic">Waiting for {oppName}…</span>
            {opponentAcked && <span className="text-xs text-attack">{oppName} ready</span>}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
