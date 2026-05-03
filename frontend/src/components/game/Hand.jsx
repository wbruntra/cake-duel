import Card from "./Card";
import { getCardInfo } from "@/utils/cards";

export default function Hand({ cards, selectedIndices, onToggleCard, disabled }) {
  return (
    <div className="hand">
      <div className="hand-label">
        Your Hand ({cards.length})
      </div>
      <div className="hand-cards">
        {cards.map((cardId, i) => {
          return (
            <Card
              key={i}
              cardId={cardId}
              selected={selectedIndices && selectedIndices.includes(i)}
              onClick={disabled ? null : () => onToggleCard && onToggleCard(i)}
            />
          );
        })}
        {cards.length === 0 && <span className="empty-hand">No cards</span>}
      </div>
    </div>
  );
}
