import { useEffect, useState } from 'react'
import { useGame } from '@/context/GameContext'
import { motion, AnimatePresence } from 'motion/react'
import { getCardInfo } from '@/utils/cards'
import { tap, success } from '@/utils/haptics'

const STAGE_DELAYS = {
  reveal: 0,
  compare: 700,
  cakes: 1500,
  outcome: 2400,
}
const AUTO_ACK_DELAY_MS = STAGE_DELAYS.outcome + 1500

export default function TurnResultOverlay() {
  const { state, send } = useGame()
  const result = state?.lastTurnResult
  const turnAcks = state?.turnAcks || []
  const player = state?.player

  const [stage, setStage] = useState('reveal')
  const [autoAcked, setAutoAcked] = useState(false)

  const hasAcked = player ? turnAcks.includes(player) : false
  const opponentAcked = player ? turnAcks.includes(player === 'p1' ? 'p2' : 'p1') : false

  useEffect(() => {
    setStage('reveal')
    setAutoAcked(false)
    if (!result) return

    const timers = [
      setTimeout(() => setStage('compare'), STAGE_DELAYS.compare),
      setTimeout(() => setStage('cakes'), STAGE_DELAYS.cakes),
      setTimeout(() => {
        setStage('outcome')
        if (result.cakesStolen > 0) success()
      }, STAGE_DELAYS.outcome),
    ]
    return () => timers.forEach(clearTimeout)
  }, [result?.attackClaim?.playedCardIds?.join(','), result?.blockClaim?.playedCardIds?.join(',')])

  useEffect(() => {
    if (!result) return
    if (result.cakesStolen > 0 || result.boutOver) return
    if (hasAcked || autoAcked) return
    const t = setTimeout(() => {
      setAutoAcked(true)
      send({ type: 'turnAck' })
    }, AUTO_ACK_DELAY_MS)
    return () => clearTimeout(t)
  }, [result, hasAcked, autoAcked, send])

  if (!result || !result.attackClaim) return null

  const { attackClaim, blockClaim, cakesStolen, defenderCakes, boutOver, iStoleCakes } = result
  const attackInfo = getCardInfo(attackClaim.cardName)
  const blockInfo = blockClaim ? getCardInfo(blockClaim.cardName) : null
  const myName = state.myName || 'You'
  const oppName = state.opponentName || 'Opponent'
  const attackerLabel = iStoleCakes ? myName : oppName
  const defenderLabel = iStoleCakes ? oppName : myName

  const attackWolfyCount = (attackClaim.playedCardIds || []).filter((id) => id === 'sir_wolfy').length
  const blockWolfyCount = (blockClaim?.playedCardIds || []).filter((id) => id === 'sir_wolfy').length
  const wolfyInfo = getCardInfo('sir_wolfy')

  const cakePerAttacker = attackInfo?.cakes || 0
  const totalAttack = cakePerAttacker * attackClaim.count
  const totalBlockCakes = blockClaim
    ? (blockInfo?.blocks || 0) * blockClaim.count * cakePerAttacker
    : 0
  const effective = Math.max(0, totalAttack - totalBlockCakes)
  const attackersBlocked = blockClaim ? (blockInfo?.blocks || 0) * blockClaim.count : 0

  function doAck() {
    tap()
    send({ type: 'turnAck' })
  }

  const showContinue = result.cakesStolen > 0 || result.boutOver

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-20 flex flex-col items-center justify-center px-6 bg-bg/95 backdrop-blur-sm"
    >
      <div className="text-xs uppercase tracking-widest text-text font-medium mb-4">
        Turn Resolution
      </div>

      <div className="flex items-start justify-center gap-4 w-full max-w-md mb-6">
        <ClaimCard
          label={`${attackerLabel} attacked`}
          info={attackInfo}
          count={attackClaim.count}
          tone="attack"
          delay={0}
        />
        {blockClaim ? (
          <ClaimCard
            label={`${defenderLabel} blocked`}
            info={blockInfo}
            count={blockClaim.count}
            tone="block"
            delay={0.15}
            attackerCakes={cakePerAttacker}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            className="flex flex-col items-center gap-1 w-32 pt-6"
          >
            <div className="text-3xl opacity-40">—</div>
            <div className="text-xs text-text">{defenderLabel} did not block</div>
          </motion.div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {stage !== 'reveal' && (
          <motion.div
            key="math"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-baseline justify-center gap-2 mb-4"
          >
            <span className="text-attack text-2xl font-bold">{totalAttack}🍰</span>
            <span className="text-text">−</span>
            <span className="text-block text-2xl font-bold">{totalBlockCakes}🛡️</span>
            <span className="text-text">=</span>
            <motion.span
              key={effective}
              initial={{ scale: 1.4 }}
              animate={{ scale: 1 }}
              className={`text-3xl font-bold ${effective > 0 ? 'text-danger' : 'text-text-h'}`}
            >
              {effective}🍰
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative h-16 w-full max-w-md flex items-center justify-center mb-2">
        <AnimatePresence>
          {stage === 'cakes' || stage === 'outcome'
            ? Array.from({ length: Math.min(cakesStolen, 7) }).map((_, i) => (
                <motion.span
                  key={`cake-${i}`}
                  initial={{
                    x: iStoleCakes ? 100 : -100,
                    y: 0,
                    opacity: 0,
                    scale: 0.6,
                    rotate: 0,
                  }}
                  animate={{
                    x: iStoleCakes ? -100 : 100,
                    y: [0, -20, 0],
                    opacity: [0, 1, 1, 0.9],
                    scale: 1,
                    rotate: iStoleCakes ? -360 : 360,
                  }}
                  transition={{
                    duration: 0.85,
                    delay: i * 0.08,
                    ease: 'easeInOut',
                  }}
                  className="absolute text-4xl pointer-events-none"
                >
                  🍰
                </motion.span>
              ))
            : null}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        {stage === 'outcome' && (
          <motion.div
            key="outcome"
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            className="flex flex-col items-center gap-1 mb-4"
          >
            <div
              className={`text-3xl font-bold ${
                cakesStolen === 0 ? 'text-text-h' : iStoleCakes ? 'text-attack' : 'text-danger'
              }`}
            >
              {cakesStolen === 0
                ? blockClaim
                  ? 'Fully blocked!'
                  : 'No damage'
                : iStoleCakes
                  ? `+${cakesStolen} 🍰 stolen!`
                  : `${cakesStolen} 🍰 lost`}
            </div>
            <div className="text-sm text-text">
              {defenderLabel} {defenderCakes} 🍰 left
            </div>
            {boutOver && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-2 px-3 py-1 rounded-full bg-accent-light text-accent text-xs font-semibold uppercase tracking-wider"
              >
                Bout over
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage === 'outcome' && (attackWolfyCount > 0 || blockWolfyCount > 0) && (
          <motion.div
            key="wolfy-reveal"
            initial={{ opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4, type: 'spring', stiffness: 200, damping: 18 }}
            className="flex flex-col items-center gap-2 mb-3"
          >
            <div className="text-[10px] uppercase tracking-widest text-text">Revealed face-up</div>
            <div className="flex gap-3">
              {attackWolfyCount > 0 && (
                <SirWolfyRevealCard label={`${attackerLabel}`} count={attackWolfyCount} info={wolfyInfo} />
              )}
              {blockWolfyCount > 0 && (
                <SirWolfyRevealCard label={`${defenderLabel}`} count={blockWolfyCount} info={wolfyInfo} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="h-14 w-full max-w-sm flex items-center justify-center">
        {stage === 'outcome' && showContinue && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="w-full"
          >
            {!hasAcked ? (
              <button
                className="w-full h-14 text-lg font-semibold rounded-lg bg-accent text-white active:scale-95 transition-transform touch-manipulation"
                onClick={doAck}
              >
                Continue
              </button>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <span className="text-text text-base italic">Waiting for {oppName}…</span>
                {opponentAcked && <span className="text-xs text-attack">{oppName} ready</span>}
              </div>
            )}
          </motion.div>
        )}
        {stage === 'outcome' && !showContinue && (
          <span className="text-text text-xs italic">Continuing…</span>
        )}
      </div>
    </motion.div>
  )
}

function SirWolfyRevealCard({ label, count, info }) {
  return (
    <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl border border-text/30 bg-text/5">
      <span className="text-[10px] uppercase tracking-wider text-text">{label}</span>
      <span className="text-3xl">{info?.emoji || '🐺'}</span>
      <span className="text-sm font-semibold text-text-h">
        {count > 1 ? `${count}× ` : ''}{info?.name || 'Sir Wolfy'}
      </span>
      <span className="text-[10px] text-text italic">Taunt!</span>
    </div>
  )
}

function ClaimCard({ label, info, count, tone, delay, attackerCakes }) {
  const toneClass =
    tone === 'attack' ? 'border-attack/60 bg-attack-light/40' : 'border-block/60 bg-block-light/40'
  const blockCakes = info?.blocks != null ? info.blocks * count * (attackerCakes || 1) : null
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.35, type: 'spring', stiffness: 220, damping: 22 }}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border ${toneClass}`}
    >
      <span className="text-[10px] uppercase tracking-wider text-text">{label}</span>
      <span className="text-3xl">{info?.emoji || '❓'}</span>
      <span className="text-sm font-semibold text-text-h">
        {count}× {info?.name || 'Unknown'}
      </span>
      {info?.cakes != null && (
        <span className="text-[10px] text-text">{info.cakes * count} 🍰 incoming</span>
      )}
      {blockCakes != null && (
        <span className="text-[10px] text-text">{blockCakes} 🍰 blocking</span>
      )}
    </motion.div>
  )
}
