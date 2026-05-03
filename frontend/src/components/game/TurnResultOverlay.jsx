import { useGame } from '@/context/GameContext'
import { AnimatePresence, motion } from 'motion/react'
import { getCardInfo } from '@/utils/cards'

export default function TurnResultOverlay() {
  const { state } = useGame()
  if (!state || !state.lastTurnResult) return null

  const result = state.lastTurnResult
  const attackClaim = result.attackClaim
  const blockClaim = result.blockClaim
  const attackInfo = getCardInfo(attackClaim.cardName)
  const blockInfo = blockClaim ? getCardInfo(blockClaim.cardName) : null

  const attackerLabel = result.iStoleCakes ? 'You' : 'Opponent'
  const defenderLabel = result.iStoleCakes ? 'Opponent' : 'You'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.35, type: 'spring', stiffness: 220, damping: 22 }}
        className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
      >
        <div className="bg-bg/95 backdrop-blur-sm border border-border rounded-2xl shadow-xl px-6 py-5 max-w-xs mx-4">
          <div className="text-xs uppercase tracking-widest text-text mb-2 text-center">
            Turn Result
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="text-center">
              <span className="text-sm text-text">{attackerLabel} attacked with</span>
              <div className="text-lg font-bold text-text-h">
                {attackInfo?.emoji} {attackClaim.cardName} ×{attackClaim.count}
              </div>
            </div>

            {blockClaim && (
              <div className="text-center">
                <span className="text-sm text-text">{defenderLabel} blocked with</span>
                <div className="text-lg font-bold text-text-h">
                  {blockInfo?.emoji} {blockClaim.cardName} ×{blockClaim.count}
                </div>
              </div>
            )}

            <div className="h-px w-12 bg-border" />

            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className={`text-2xl font-bold ${
                result.cakesStolen > 0
                  ? result.iStoleCakes
                    ? 'text-attack'
                    : 'text-danger'
                  : 'text-text-h'
              }`}
            >
              {result.cakesStolen > 0
                ? `${result.cakesStolen} 🍰 stolen!`
                : 'No cakes stolen'}
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}