import { useState } from "react";

export default function Lobby({ onGameStart }) {
  const [gameId, setGameId] = useState("");
  const [status, setStatus] = useState(null);
  const [playerId, setPlayerId] = useState(null);

  async function createGame() {
    const res = await fetch("/api/games", { method: "POST" });
    const data = await res.json();
    setGameId(data.gameId);
    setPlayerId(data.playerId);
    setStatus("created");
  }

  async function joinGame() {
    if (!gameId.trim()) return;
    const res = await fetch(`/api/games/${gameId}/join`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      setStatus(`Error: ${data.error}`);
      return;
    }
    const data = await res.json();
    setPlayerId(data.playerId);
    setStatus("joined");
    onGameStart(data.gameId, data.playerId);
  }

  function startGame() {
    onGameStart(gameId, playerId);
  }

  return (
    <div className="lobby">
      <h1>Cake Duel</h1>
      <p className="lobby-subtitle">Deploy your Sheepie troops and steal all the cakes!</p>

      <div className="lobby-actions">
        {!gameId ? (
          <button className="btn btn-primary" onClick={createGame}>
            Create New Game
          </button>
        ) : status === "created" ? (
          <div className="lobby-game-info">
            <p>
              Game created! Share this ID with your opponent:
            </p>
            <code className="game-id">{gameId}</code>
            <button className="btn btn-primary" onClick={startGame}>
              Enter Game
            </button>
          </div>
        ) : null}
      </div>

      <div className="lobby-divider">
        <span>or join existing</span>
      </div>

      <div className="lobby-join">
        <input
          type="text"
          placeholder="Enter game ID"
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          className="input"
        />
        <button
          className="btn btn-secondary"
          onClick={joinGame}
          disabled={!gameId.trim()}
        >
          Join Game
        </button>
      </div>

      {status && !["created", "joined"].includes(status) && (
        <p className="lobby-status">{status}</p>
      )}
    </div>
  );
}
