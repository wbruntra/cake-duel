import { getCardInfo } from "@/utils/cards";

export default function Card({ cardId, selected, onClick, faceDown, small }) {
  const info = getCardInfo(cardId);
  return (
    <button
      className={`card ${selected ? "selected" : ""} ${faceDown ? "facedown" : ""} ${small ? "small" : ""}`}
      onClick={onClick}
      disabled={!onClick}
      title={faceDown ? "?" : info.name}
    >
      {faceDown ? (
        <span className="card-back">🃏</span>
      ) : (
        <>
          <span className="card-emoji">{info.emoji}</span>
          <span className="card-name">{info.name}</span>
          <span className="card-type">{info.type}</span>
          {info.cakes && <span className="card-stat">🍰 {info.cakes}</span>}
          {info.blocks && <span className="card-stat">🛡️ {info.blocks}</span>}
        </>
      )}
    </button>
  );
}
