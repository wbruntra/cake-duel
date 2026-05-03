import { useState } from 'react'

export default function Lobby({ onGameStart, initialJoinId }) {
  const [createdGame, setCreatedGame] = useState(null)
  const [joinId, setJoinId] = useState(initialJoinId ?? '')
  const [joinError, setJoinError] = useState(null)
  const [copied, setCopied] = useState(false)

  async function createGame() {
    const res = await fetch('/api/games', { method: 'POST' })
    const data = await res.json()
    setCreatedGame({ gameId: data.gameId, playerId: data.playerId })
  }

  async function joinGame() {
    if (!joinId.trim()) return
    setJoinError(null)
    const res = await fetch(`/api/games/${joinId.trim()}/join`, { method: 'POST' })
    if (!res.ok) {
      const data = await res.json()
      setJoinError(data.error ?? 'Failed to join')
      return
    }
    const data = await res.json()
    onGameStart(data.gameId, data.playerId)
  }

  async function copyInviteLink() {
    const url = `${window.location.origin}${window.location.pathname}?join=${createdGame.gameId}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh max-w-sm mx-auto px-6 gap-6">
      <h1 className="text-4xl font-semibold text-text-h tracking-tight mt-0">Cake Duel</h1>
      <p className="text-base text-text">Deploy your Sheepie troops and steal all the cakes!</p>

      {createdGame ? (
        <div className="flex flex-col items-center gap-4 w-full">
          <p className="text-sm text-text">Waiting for opponent — share this link:</p>
          <div className="flex items-center gap-2 flex-wrap justify-center w-full">
            <code className="font-mono text-lg tracking-wider px-4 py-2 bg-code-bg rounded-lg text-text-h select-all">
              {createdGame.gameId}
            </code>
            <button
              className="h-11 px-4 text-sm rounded-lg border border-border bg-bg text-text-h active:scale-95 transition-transform touch-manipulation"
              onClick={copyInviteLink}
            >
              {copied ? 'Copied!' : 'Copy invite link'}
            </button>
          </div>
          <button
            className="h-14 w-full text-lg font-semibold rounded-xl bg-accent text-white active:scale-95 transition-transform touch-manipulation"
            onClick={() => onGameStart(createdGame.gameId, createdGame.playerId)}
          >
            Enter as Player 1
          </button>
        </div>
      ) : (
        <>
          <button
            className="h-14 w-full text-lg font-semibold rounded-xl bg-accent text-white active:scale-95 transition-transform touch-manipulation"
            onClick={createGame}
          >
            Create New Game
          </button>

          <div className="flex items-center gap-3 w-full text-sm text-text">
            <div className="flex-1 h-px bg-border" />
            <span>or join as opponent</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="flex flex-col gap-3 w-full">
            <input
              type="text"
              placeholder="Enter game ID or paste invite link"
              value={joinId}
              onChange={(e) => {
                const val = e.target.value
                const match = val.match(/[?&]join=([^&]+)/)
                setJoinId(match ? match[1] : val)
              }}
              className="w-full h-14 text-lg px-4 rounded-xl border border-border bg-bg text-text-h outline-none focus:border-accent touch-manipulation"
            />
            <button
              className="h-14 w-full text-lg font-semibold rounded-xl bg-accent-light text-accent border border-accent-border active:scale-95 transition-transform touch-manipulation disabled:opacity-40"
              onClick={joinGame}
              disabled={!joinId.trim()}
            >
              Join as Opponent
            </button>
          </div>

          {joinError && <p className="text-sm text-danger">{joinError}</p>}
        </>
      )}
    </div>
  )
}
