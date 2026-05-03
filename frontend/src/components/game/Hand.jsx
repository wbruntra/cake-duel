import Card from "./Card";
import { getCardInfo } from "@/utils/cards";

export default function Hand({ cards, selectedIds, onToggleCard, disabled }) {
  return (
    <div className="hand">
      <div className="hand-label">
        Your Hand ({cards.length})
      </div>
      <div className="hand-cards">
        {cards.map((cardId, i) => {
          const info = getCardInfo(cardId);
          return (
            <Card
              key={`${cardId}-${i}`}
              cardId={cardId}
              selected={selectedIds && selectedIds.includes(cardId)}
              onClick={disabled ? null : () => onToggleCard && onToggleCard(cardId)}
            />
          );
        })}
        {cards.length === 0 && <span className="empty-hand">No cards</span>}
      </div>
    </div>
  );
}
