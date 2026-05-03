import CakeDisplay from "./CakeDisplay";
import Hand from "./Hand";
import { useState, useMemo } from "react";
import { useGame } from "@/context/GameContext";
import { getCardInfo, getAttackerOptions, getBlockerOptions } from "@/utils/cards";

export default function PlayerArea() {
  const { state, send } = useGame();
  const [selectedCards, setSelectedCards] = useState([]);
  const [claimedName, setClaimedName] = useState("");

  if (!state) return null;

  const isMyTurn = state.turnPlayer === state.player;
  const isAttackPhase = state.turnPhase === "attack" && isMyTurn;
  const isBlockPhase = state.turnPhase === "block" && isMyTurn;
  const canAct = isAttackPhase || isBlockPhase;

  const attackerType = state.attackClaim
    ? (getCardInfo(state.attackClaim.cardName)?.type || null)
    : null;

  const claimOptions = useMemo(() => {
    if (isAttackPhase) return getAttackerOptions();
    if (isBlockPhase && attackerType) return getBlockerOptions(attackerType);
    return [];
  }, [isAttackPhase, isBlockPhase, attackerType]);

  function toggleCard(cardId) {
    setSelectedCards((prev) =>
      prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId]
    );
  }

  function doPlay() {
    if (selectedCards.length === 0 || !claimedName) return;
    const action = isAttackPhase ? "attack" : "block";
    send({
      type: action,
      cardIds: selectedCards,
      claimedName,
    });
    setSelectedCards([]);
    setClaimedName("");
  }

  function doPass() {
    send({ type: "pass" });
  }

  return (
    <div className="player-area">
      <CakeDisplay count={state.myCakes} label="Your Cakes" />

      {canAct && (
        <div className="action-controls">
          <div className="claim-select">
            <label>Claim as:</label>
            <select
              value={claimedName}
              onChange={(e) => setClaimedName(e.target.value)}
            >
              <option value="">-- Choose --</option>
              {claimOptions.map((opt) => (
                <option key={opt.id} value={opt.name}>
                  {opt.emoji} {opt.name}
                  {opt.cakes ? ` (🍰${opt.cakes})` : ""}
                  {opt.blocks ? ` (🛡️${opt.blocks})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="action-buttons">
            {isAttackPhase && (
              <button className="btn btn-pass" onClick={doPass}>
                Pass
              </button>
            )}
            <button
              className="btn btn-play"
              onClick={doPlay}
              disabled={selectedCards.length === 0 || !claimedName}
            >
              {isAttackPhase ? "Attack" : "Block"}
            </button>
          </div>

          <div className="selected-info">
            Selected: {selectedCards.length} card{selectedCards.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      <Hand
        cards={state.hand}
        selectedIds={selectedCards}
        onToggleCard={canAct ? toggleCard : null}
        disabled={!canAct}
      />
    </div>
  );
}
