import { useGame } from '@/context/GameContext'
import { useGameUI } from '@/hooks/useGameUI'
import { getCardInfo, getAttackerOptions, getBlockerName } from '@/utils/cards'
import { tap } from '@/utils/haptics'

export default function ActionBar() {
  const { state, send, onLeave } = useGame()
  const { selectedIndices, claimedName, setClaimPickerOpen, clearSelection } = useGameUI()

  if (!state) return null

  const isMyTurn = state.turnPlayer === state.player
  const isAttackPhase = state.turnPhase === 'attack' && isMyTurn
  const isBlockPhase = state.turnPhase === 'block' && isMyTurn
  const isResolvePhase = state.turnPhase === 'resolve'
  const isGameOver = state.turnPhase === 'game_over'
  const isResupply = state.turnPhase === 'resupply'
  const isWaiting = !isMyTurn && (state.turnPhase === 'attack' || state.turnPhase === 'block')

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

  function doPlayAgain() {
    tap()
    onLeave()
  }

  if (isWaiting) {
    const waitingText =
      state.turnPhase === 'attack' ? "Opponent's turn: Attack" : "Opponent's turn: Block"
    return (
      <div className="sticky bottom-0 safe-bottom bg-bg/95 backdrop-blur-sm border-t border-border px-4 py-3 flex items-center justify-center min-h-[64px]">
        <span className="text-text text-base italic">{waitingText}…</span>
      </div>
    )
  }

  if (isResupply) {
    return (
      <div className="sticky bottom-0 safe-bottom bg-bg/95 backdrop-blur-sm border-t border-border px-4 py-3 flex items-center justify-center min-h-[64px]">
        <span className="text-text text-base italic">Resupplying…</span>
      </div>
    )
  }

  if (isAttackPhase) {
    if (selectedIndices.length === 0) {
      return (
        <div className="sticky bottom-0 safe-bottom bg-bg/95 backdrop-blur-sm border-t border-border px-4 py-3 flex items-center justify-center min-h-[64px]">
          <button
            className="w-full h-14 text-lg font-semibold rounded-lg border border-border text-text bg-transparent active:scale-95 transition-transform touch-manipulation"
            onClick={doPass}
          >
            Pass
          </button>
        </div>
      )
    }

    if (!claimedName) {
      return (
        <div className="sticky bottom-0 safe-bottom bg-bg/95 backdrop-blur-sm border-t border-border px-4 py-3 flex flex-col gap-2 min-h-[64px]">
          <button
            className="w-full h-14 text-lg font-semibold rounded-lg bg-accent text-white active:scale-95 transition-transform touch-manipulation"
            onClick={() => setClaimPickerOpen(true)}
          >
            Choose claim →
          </button>
          <button className="text-sm text-text underline" onClick={doPass}>
            Pass
          </button>
        </div>
      )
    }

    const claimInfo = getAttackerOptions().find((o) => o.name === claimedName)
    return (
      <div className="sticky bottom-0 safe-bottom bg-bg/95 backdrop-blur-sm border-t border-border px-4 py-3 flex flex-col gap-2 min-h-[64px]">
        <button
          className="w-full h-14 text-lg font-semibold rounded-lg bg-attack text-white active:scale-95 transition-transform touch-manipulation"
          onClick={doAttack}
        >
          Attack as {claimedName} (×{selectedIndices.length})
        </button>
        <button className="text-sm text-text underline" onClick={doPass}>
          Pass
        </button>
      </div>
    )
  }

  if (isBlockPhase) {
    if (selectedIndices.length === 0) {
      return (
        <div className="sticky bottom-0 safe-bottom bg-bg/95 backdrop-blur-sm border-t border-border px-4 py-3 flex items-center justify-center min-h-[64px]">
          <button
            className="w-full h-14 text-lg font-semibold rounded-lg border border-danger text-danger bg-transparent active:scale-95 transition-transform touch-manipulation"
            onClick={doSkipBlock}
          >
            Let through
          </button>
        </div>
      )
    }

    return (
      <div className="sticky bottom-0 safe-bottom bg-bg/95 backdrop-blur-sm border-t border-border px-4 py-3 flex flex-col gap-2 min-h-[64px]">
        <button
          className="w-full h-14 text-lg font-semibold rounded-lg bg-block text-white active:scale-95 transition-transform touch-manipulation"
          onClick={doBlock}
        >
          Block as {blockerName?.name || 'Defender'} (×{selectedIndices.length})
        </button>
        <button className="text-sm text-danger underline" onClick={doSkipBlock}>
          Let through
        </button>
      </div>
    )
  }

  if (isResolvePhase) {
    return (
      <div className="sticky bottom-0 safe-bottom bg-bg/95 backdrop-blur-sm border-t border-border px-4 py-3 flex items-center justify-center min-h-[64px]">
        <button
          className="w-full h-14 text-lg font-semibold rounded-lg bg-resolve text-white active:scale-95 transition-transform touch-manipulation"
          onClick={doResolve}
        >
          Continue
        </button>
      </div>
    )
  }

  if (isGameOver) {
    return (
      <div className="sticky bottom-0 safe-bottom bg-bg/95 backdrop-blur-sm border-t border-border px-4 py-3 flex items-center justify-center min-h-[64px]">
        <button
          className="w-full h-14 text-lg font-semibold rounded-lg bg-accent text-white active:scale-95 transition-transform touch-manipulation"
          onClick={doPlayAgain}
        >
          Play again
        </button>
      </div>
    )
  }

  return null
}
