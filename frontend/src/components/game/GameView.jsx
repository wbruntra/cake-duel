import GameHeader from './GameHeader'
import OpponentArea from './OpponentArea'
import PlayArea from './PlayArea'
import PlayerArea from './PlayerArea'
import ActionBar from './ActionBar'
import ClaimPicker from './ClaimPicker'
import PhaseToast from './PhaseToast'
import { useGame } from '@/context/GameContext'

export default function GameView() {
  const { state, connected, error, onLeave } = useGame()

  if (error && !state) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-4 text-text px-6">
        <p className="text-danger text-center">{error}</p>
        <button
          className="h-12 px-6 rounded-xl bg-accent text-white font-semibold active:scale-95 transition-transform touch-manipulation"
          onClick={onLeave}
        >
          Back to Lobby
        </button>
      </div>
    )
  }

  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-2 text-text px-6">
        <p>{connected ? 'Waiting for game state...' : 'Connecting...'}</p>
        <button
          className="h-10 px-4 text-sm rounded-lg border border-border bg-bg text-text-h active:scale-95 transition-transform touch-manipulation"
          onClick={onLeave}
        >
          Back to Lobby
        </button>
      </div>
    )
  }

  if (state.status === 'waiting') {
    const gameUrl = `${window.location.origin}${window.location.pathname}#/${state.id}`
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-4 px-6">
        <h2 className="text-2xl font-semibold text-text-h">Waiting for opponent</h2>
        <p className="text-sm text-text">Share this link with your opponent:</p>
        <code className="font-mono text-sm px-4 py-2 bg-code-bg rounded-lg text-text-h select-all break-all">
          {gameUrl}
        </code>
        <button
          className="h-10 px-4 text-sm rounded-lg border border-border bg-bg text-text-h active:scale-95 transition-transform touch-manipulation"
          onClick={() => navigator.clipboard.writeText(gameUrl)}
        >
          Copy Link
        </button>
        <button
          className="h-10 px-4 text-sm rounded-lg border border-border bg-bg text-danger active:scale-95 transition-transform touch-manipulation"
          onClick={onLeave}
        >
          Leave Game
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-dvh grid grid-rows-[auto_auto_1fr_auto_auto_auto] safe-top safe-bottom">
      <GameHeader />
      <OpponentArea />
      <PlayArea />
      <PlayerArea />
      <ActionBar />
      <ClaimPicker />
      <PhaseToast />
    </div>
  )
}
