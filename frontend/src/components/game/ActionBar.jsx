import { useState } from 'react'
import { useGame } from '@/context/GameContext'
import { useGameUI } from '@/hooks/useGameUI'
import { getCardInfo, getBlockerName } from '@/utils/cards'
import { tap } from '@/utils/haptics'

const BAR_CLASS =
  'sticky bottom-0 safe-bottom bg-bg/95 backdrop-blur-sm border-t border-border px-4 py-3 h-[108px] flex flex-col items-center justify-center gap-2'

export default function ActionBar() {
  const { state, send, onLeave, gameId, playerId } = useGame()
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)
  const { selectedIndices, claimedName, setClaimPickerOpen, clearSelection } = useGameUI()

  if (!state) return null

  const isMyTurn = state.turnPlayer === state.player
  const isAttackPhase = state.turnPhase === 'attack' && isMyTurn
  const isBlockPhase = state.turnPhase === 'block' && isMyTurn
  const isResolvePhase = state.turnPhase === 'resolve'
  const isGameOver = state.turnPhase === 'game_over'
  const isChallengeResult = state.turnPhase === 'challenge_result'
  const isWaiting = !isMyTurn && (state.turnPhase === 'attack' || state.turnPhase === 'block')
  const amAttacker = state.attackClaim?.player === state.player
  const canChallengeBlock = isResolvePhase && amAttacker && state.blockClaim != null

  const attackerType = state.attackClaim
    ? getCardInfo(state.attackClaim.cardName)?.type || null
    : null
  const blockerName = isBlockPhase && attackerType ? getBlockerName(attackerType) : null

  function doAttack() {
    if (selectedIndices.length === 0 || !claimedName) return
    tap()
    const cardIds = selectedIndices.map((i) => state.hand[i])
    send({ type: 'attack', cardIds, claimedName })
    clearSelection()
  }

  function doBlock() {
    if (selectedIndices.length === 0) return
    tap()
    const cardIds = selectedIndices.map((i) => state.hand[i])
    send({ type: 'block', cardIds })
    clearSelection()
  }

  function doPass() {
    tap()
    send({ type: 'pass' })
  }

  function doSkipBlock() {
    tap()
    send({ type: 'skipBlock' })
  }

  function doResolve() {
    tap()
    send({ type: 'resolve' })
  }

  function doChallenge(target) {
    tap()
    send({ type: 'challenge', target })
  }

  function doChallengeAck() {
    tap()
    send({ type: 'challengeAck' })
  }

  function doPlayAgain() {
    tap()
    onLeave()
  }

  async function doAiMove() {
    if (aiLoading) return
    tap()
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch(`/api/games/${gameId}/ai-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      })
      const data = await res.json()
      if (!res.ok) setAiError(data.error ?? 'AI move failed')
    } catch {
      setAiError('AI request failed')
    } finally {
      setAiLoading(false)
    }
  }

  if (isChallengeResult) {
    const hasAcked = state.challengeAcks?.includes(state.player)
    return (
      <div className={BAR_CLASS}>
        {!hasAcked ? (
          <button
            className="w-full h-14 text-lg font-semibold rounded-lg bg-accent text-white active:scale-95 transition-transform touch-manipulation"
            onClick={doChallengeAck}
          >
            Continue
          </button>
        ) : (
          <span className="text-text text-base italic">Waiting for opponent…</span>
        )}
        <div className="h-5" />
      </div>
    )
  }

  if (isWaiting) {
    const waitingText =
      state.turnPhase === 'attack' ? "Opponent's turn: Attack" : "Opponent's turn: Block"
    return (
      <div className={BAR_CLASS}>
        <span className="text-text text-base italic">{waitingText}…</span>
        <div className="h-5" />
      </div>
    )
  }

  const aiButton = (
    <button
      className="text-xs text-text/50 underline touch-manipulation"
      onClick={doAiMove}
      disabled={aiLoading}
    >
      {aiLoading ? '🤖 Thinking…' : '🤖 AI move'}
    </button>
  )
  const aiButtonOrError = aiError ? (
    <span className="text-xs text-danger">{aiError}</span>
  ) : (
    aiButton
  )

  if (isAttackPhase) {
    if (selectedIndices.length === 0) {
      return (
        <div className={BAR_CLASS}>
          <button
            className="w-full h-14 text-lg font-semibold rounded-lg border border-border text-text bg-transparent active:scale-95 transition-transform touch-manipulation"
            onClick={doPass}
          >
            Pass
          </button>
          {aiButtonOrError}
        </div>
      )
    }

    if (!claimedName) {
      return (
        <div className={BAR_CLASS}>
          <button
            className="w-full h-14 text-lg font-semibold rounded-lg bg-accent text-white active:scale-95 transition-transform touch-manipulation"
            onClick={() => setClaimPickerOpen(true)}
          >
            Choose claim →
          </button>
          <div className="flex gap-4">
            <button className="text-sm text-text underline" onClick={doPass}>
              Pass
            </button>
            {aiButtonOrError}
          </div>
        </div>
      )
    }

    return (
      <div className={BAR_CLASS}>
        <button
          className="w-full h-14 text-lg font-semibold rounded-lg bg-attack text-white active:scale-95 transition-transform touch-manipulation"
          onClick={doAttack}
        >
          Attack as {claimedName} (×{selectedIndices.length})
        </button>
        <div className="flex gap-4">
          <button className="text-sm text-text underline" onClick={doPass}>
            Pass
          </button>
          <button className="text-sm text-text underline" onClick={() => setClaimPickerOpen(true)}>
            Change claim
          </button>
          {aiButtonOrError}
        </div>
      </div>
    )
  }

  if (isBlockPhase) {
    if (selectedIndices.length === 0) {
      return (
        <div className={BAR_CLASS}>
          <div className="flex gap-2 w-full">
            <button
              className="flex-1 h-14 text-base font-semibold rounded-lg border border-danger text-danger bg-transparent active:scale-95 transition-transform touch-manipulation"
              onClick={doSkipBlock}
            >
              Let through
            </button>
            <button
              className="flex-1 h-14 text-base font-semibold rounded-lg border border-accent text-accent bg-transparent active:scale-95 transition-transform touch-manipulation"
              onClick={() => doChallenge('attack')}
            >
              Call the bluff!
            </button>
          </div>
          {aiButtonOrError}
        </div>
      )
    }

    return (
      <div className={BAR_CLASS}>
        <button
          className="w-full h-14 text-lg font-semibold rounded-lg bg-block text-white active:scale-95 transition-transform touch-manipulation"
          onClick={doBlock}
        >
          Block as {blockerName?.name || 'Defender'} (×{selectedIndices.length})
        </button>
        <div className="flex gap-4">
          <button className="text-sm text-danger underline" onClick={doSkipBlock}>
            Let through
          </button>
          {aiButtonOrError}
        </div>
      </div>
    )
  }

  if (isResolvePhase) {
    return (
      <div className={BAR_CLASS}>
        {canChallengeBlock ? (
          <div className="flex gap-2 w-full">
            <button
              className="flex-1 h-14 text-base font-semibold rounded-lg bg-resolve text-white active:scale-95 transition-transform touch-manipulation"
              onClick={doResolve}
            >
              Continue
            </button>
            <button
              className="flex-1 h-14 text-base font-semibold rounded-lg border border-accent text-accent bg-transparent active:scale-95 transition-transform touch-manipulation"
              onClick={() => doChallenge('block')}
            >
              Call the bluff!
            </button>
          </div>
        ) : (
          <button
            className="w-full h-14 text-lg font-semibold rounded-lg bg-resolve text-white active:scale-95 transition-transform touch-manipulation"
            onClick={doResolve}
          >
            Continue
          </button>
        )}
        {aiButtonOrError}
      </div>
    )
  }

  if (isGameOver) {
    return (
      <div className={BAR_CLASS}>
        <button
          className="w-full h-14 text-lg font-semibold rounded-lg bg-accent text-white active:scale-95 transition-transform touch-manipulation"
          onClick={doPlayAgain}
        >
          Play again
        </button>
        <div className="h-5" />
      </div>
    )
  }

  return null
}
