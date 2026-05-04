import { useState, useEffect } from 'react'

export default function Lobby({ joinId, onNavigateToGame }) {
  const [name, setName] = useState(() => {
    try {
      return window.localStorage.getItem('cakeduel_name') || ''
    } catch {
      return ''
    }
  })
  const [createdGame, setCreatedGame] = useState(null)
  const [joinIdValue, setJoinIdValue] = useState(joinId ?? '')
  const [joinError, setJoinError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (name) {
      try {
        window.localStorage.setItem('cakeduel_name', name)
      } catch {}
    }
  }, [name])

  async function createGame() {
    setCreating(true)
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || undefined }),
      })
      const data = await res.json()
      setCreatedGame({ gameId: data.gameId, playerId: data.playerId })
    } catch {
      setJoinError('Failed to create game')
    } finally {
      setCreating(false)
    }
  }

  async function joinGame() {
    if (!joinIdValue.trim()) return
    setJoinError(null)
    setJoining(true)
    try {
      const res = await fetch(`/api/games/${joinIdValue.trim()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || undefined }),
      })
      if (!res.ok) {
        const data = await res.json()
        setJoinError(data.error ?? 'Failed to join')
        return
      }
      const data = await res.json()
      onNavigateToGame(data.gameId, data.playerId)
    } catch {
      setJoinError('Failed to join game')
    } finally {
      setJoining(false)
    }
  }

  async function copyInviteLink() {
    const url = `${window.location.origin}${window.location.pathname}#/${createdGame.gameId}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function enterAsPlayer1() {
    onNavigateToGame(createdGame.gameId, createdGame.playerId)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh max-w-sm mx-auto px-6 gap-6">
      <h1 className="text-4xl font-semibold text-text-h tracking-tight mt-0">Cake Duel</h1>
      <p className="text-base text-text">Deploy your Sheepie troops and steal all the cakes!</p>

      <input
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={20}
        className="w-full h-14 text-lg px-4 rounded-xl border border-border bg-bg text-text-h outline-none focus:border-accent touch-manipulation"
      />

      {createdGame ? (
        <div className="flex flex-col items-center gap-4 w-full">
          <p className="text-sm text-text">Waiting for opponent — share this link:</p>
          <div className="flex items-center gap-2 flex-wrap justify-center w-full">
            <code className="font-mono text-lg tracking-wider px-4 py-2 bg-code-bg rounded-lg text-text-h select-all break-all">
              {`${window.location.origin}${window.location.pathname}#/${createdGame.gameId}`}
            </code>
          </div>
          <button
            className="h-11 px-4 text-sm rounded-lg border border-border bg-bg text-text-h active:scale-95 transition-transform touch-manipulation"
            onClick={copyInviteLink}
          >
            {copied ? 'Copied!' : 'Copy invite link'}
          </button>
          <button
            className="h-14 w-full text-lg font-semibold rounded-xl bg-accent text-white active:scale-95 transition-transform touch-manipulation"
            onClick={enterAsPlayer1}
          >
            Enter as Player 1
          </button>
        </div>
      ) : (
        <>
          <button
            className="h-14 w-full text-lg font-semibold rounded-xl bg-accent text-white active:scale-95 transition-transform touch-manipulation disabled:opacity-40"
            onClick={createGame}
            disabled={creating}
          >
            {creating ? 'Creating...' : 'Create New Game'}
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
              value={joinIdValue}
              onChange={(e) => {
                const val = e.target.value
                const match = val.match(/[#/]([a-z0-9]{8})(?:\/|$)/)
                if (match) {
                  setJoinIdValue(match[1])
                } else {
                  const joinMatch = val.match(/[?&]join=([^&]+)/)
                  setJoinIdValue(joinMatch ? joinMatch[1] : val)
                }
              }}
              className="w-full h-14 text-lg px-4 rounded-xl border border-border bg-bg text-text-h outline-none focus:border-accent touch-manipulation"
            />
            <button
              className="h-14 w-full text-lg font-semibold rounded-xl bg-accent-light text-accent border border-accent-border active:scale-95 transition-transform touch-manipulation disabled:opacity-40"
              onClick={joinGame}
              disabled={!joinIdValue.trim() || joining}
            >
              {joining ? 'Joining...' : 'Join as Opponent'}
            </button>
          </div>

          {joinError && <p className="text-sm text-danger">{joinError}</p>}
        </>
      )}
    </div>
  )
}
