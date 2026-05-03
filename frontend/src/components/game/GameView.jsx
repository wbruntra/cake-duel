import GameHeader from "./GameHeader";
import OpponentArea from "./OpponentArea";
import PlayArea from "./PlayArea";
import PlayerArea from "./PlayerArea";
import { useGame } from "@/context/GameContext";

export default function GameView() {
  const { state, connected } = useGame();

  if (!state) {
    return (
      <div className="game-loading">
        {connected ? "Waiting for game state..." : "Connecting..."}
      </div>
    );
  }

  return (
    <div className="game-view">
      <GameHeader />
      <OpponentArea />
      <PlayArea />
      <PlayerArea />
    </div>
  );
}
