import { useGame } from "@/context/GameContext";

export default function GameHeader() {
  const { state } = useGame();
  if (!state) return null;

  const boutWinners = state.boutWinners || [];
  const p1Score = boutWinners.filter((w) => w === "p1").length;
  const p2Score = boutWinners.filter((w) => w === "p2").length;

  return (
    <div className="game-header">
      <div className="bout-info">Bout {state.currentBout} / 3</div>
      <div className="score">
        <span className="score-p1">P1: {p1Score} 🏆</span>
        <span className="score-divider">-</span>
        <span className="score-p2">P2: {p2Score} 🏆</span>
      </div>
      {state.winner && (
        <div className="winner-banner">
          {state.winner === (state.player || (state.turnPlayer === "p1" ? "p2" : "p1")) ? "You win!" : "Opponent wins!"}
        </div>
      )}
    </div>
  );
}
