import { useState } from "react";

export default function Lobby({ onGameStart, initialJoinId }) {
  const [createdGame, setCreatedGame] = useState(null); // { gameId, playerId }
  const [joinId, setJoinId] = useState(initialJoinId ?? "");
  const [joinError, setJoinError] = useState(null);
  const [copied, setCopied] = useState(false);

  async function createGame() {
    const res = await fetch("/api/games", { method: "POST" });
    const data = await res.json();
    setCreatedGame({ gameId: data.gameId, playerId: data.playerId });
  }

  async function joinGame() {
    if (!joinId.trim()) return;
    setJoinError(null);
    const res = await fetch(`/api/games/${joinId.trim()}/join`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      setJoinError(data.error ?? "Failed to join");
      return;
    }
    const data = await res.json();
    onGameStart(data.gameId, data.playerId);
  }

  async function copyInviteLink() {
    const url = `${window.location.origin}${window.location.pathname}?join=${createdGame.gameId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="lobby">
      <h1>Cake Duel</h1>
      <p className="lobby-subtitle">Deploy your Sheepie troops and steal all the cakes!</p>

      {createdGame ? (
        <div className="lobby-created">
          <p className="lobby-waiting">Waiting for opponent — share this link:</p>
          <div className="invite-link-row">
            <code className="game-id">{createdGame.gameId}</code>
            <button className="btn btn-copy" onClick={copyInviteLink}>
              {copied ? "Copied!" : "Copy invite link"}
            </button>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => onGameStart(createdGame.gameId, createdGame.playerId)}
          >
            Enter as Player 1
          </button>
        </div>
      ) : (
        <>
          <div className="lobby-actions">
            <button className="btn btn-primary" onClick={createGame}>
              Create New Game
            </button>
          </div>

          <div className="lobby-divider">
            <span>or join as opponent</span>
          </div>

          <div className="lobby-join">
            <input
              type="text"
              placeholder="Enter game ID or paste invite link"
              value={joinId}
              onChange={(e) => {
                const val = e.target.value;
                // accept full invite URL or bare ID
                const match = val.match(/[?&]join=([^&]+)/);
                setJoinId(match ? match[1] : val);
              }}
              className="input"
            />
            <button
              className="btn btn-secondary"
              onClick={joinGame}
              disabled={!joinId.trim()}
            >
              Join as Opponent
            </button>
          </div>

          {joinError && <p className="lobby-error">{joinError}</p>}
        </>
      )}
    </div>
  );
}
