import CakeDisplay from './CakeDisplay'
import Hand from './Hand'
import { useState, useMemo } from 'react'
import { useGame } from '@/context/GameContext'
import { getCardInfo, getAttackerOptions, getBlockerName } from '@/utils/cards'

export default function PlayerArea() {
  const { state, send } = useGame()
  const [selectedIndices, setSelectedIndices] = useState([])
  const [claimedName, setClaimedName] = useState('')

  if (!state) return null

  const isMyTurn = state.turnPlayer === state.player
  const isAttackPhase = state.turnPhase === 'attack' && isMyTurn
  const isBlockPhase = state.turnPhase === 'block' && isMyTurn
  const canAct = isAttackPhase || isBlockPhase

  const attackerType = state.attackClaim
    ? getCardInfo(state.attackClaim.cardName)?.type || null
    : null

  const claimOptions = useMemo(() => {
    if (isAttackPhase) return getAttackerOptions()
    return []
  }, [isAttackPhase])

  const blockerName = useMemo(() => {
    if (isBlockPhase && attackerType) return getBlockerName(attackerType)
    return null
  }, [isBlockPhase, attackerType])

  function toggleCard(index) {
    setSelectedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    )
  }

  function doPlay() {
    if (isAttackPhase && (selectedIndices.length === 0 || !claimedName)) return
    if (isBlockPhase && selectedIndices.length === 0) return

    if (isAttackPhase) {
      const cardIds = selectedIndices.map((i) => state.hand[i])
      send({ type: 'attack', cardIds, claimedName })
    } else {
      const cardIds = selectedIndices.map((i) => state.hand[i])
      send({ type: 'block', cardIds })
    }
    setSelectedIndices([])
    setClaimedName('')
  }

  function doSkipBlock() {
    send({ type: 'skipBlock' })
  }

  function doPass() {
    send({ type: 'pass' })
  }

  return (
    <div className="player-area">
      <CakeDisplay count={state.myCakes} label="Your Cakes" />

      {canAct && (
        <div className="action-controls">
          {isAttackPhase && (
            <div className="claim-select">
              <label>Claim as:</label>
              <select value={claimedName} onChange={(e) => setClaimedName(e.target.value)}>
                <option value="">-- Choose --</option>
                {claimOptions.map((opt) => (
                  <option key={opt.id} value={opt.name}>
                    {opt.emoji} {opt.name}
                    {opt.cakes ? ` (🍰${opt.cakes})` : ''}
                    {opt.blocks ? ` (🛡️${opt.blocks})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isBlockPhase && blockerName && (
            <div className="claim-select">
              <label>Blocking as:</label>
              <span className="auto-claim">
                {blockerName.emoji} {blockerName.name} (🛡️{blockerName.blocks} per card)
              </span>
            </div>
          )}

          <div className="action-buttons">
            {isAttackPhase && (
              <button className="btn btn-pass" onClick={doPass}>
                Pass
              </button>
            )}
            {isBlockPhase && (
              <button className="btn btn-skip" onClick={doSkipBlock}>
                Let Through
              </button>
            )}
            <button
              className="btn btn-play"
              onClick={doPlay}
              disabled={
                isAttackPhase
                  ? selectedIndices.length === 0 || !claimedName
                  : selectedIndices.length === 0
              }
            >
              {isAttackPhase ? 'Attack' : `Block (${blockerName?.name || ''})`}
            </button>
          </div>

          <div className="selected-info">
            Selected: {selectedIndices.length} card{selectedIndices.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      <Hand
        cards={state.hand}
        selectedIndices={selectedIndices}
        onToggleCard={canAct ? toggleCard : null}
        disabled={!canAct}
      />
    </div>
  )
}
