import { useGame } from "@/context/GameContext";
import CakeDisplay from "./CakeDisplay";
import Card from "./Card";

export default function OpponentArea() {
  const { state } = useGame();
  if (!state) return null;

  return (
    <div className="opponent-area">
      <CakeDisplay count={state.opponentCakes} label="Opponent's Cakes" />
      <div className="opponent-info">
        <span className="hand-count">Hand: {state.opponentHandCount} cards</span>
      </div>
      {state.blockClaim && (
        <div className="played-cards">
          <div className="played-label">
            Played {state.blockClaim.count} as {state.blockClaim.cardName}
          </div>
          <div className="played-row">
            {state.blockClaim.playedCardIds.map((id, i) => (
              <Card key={i} cardId={id} faceDown small />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
