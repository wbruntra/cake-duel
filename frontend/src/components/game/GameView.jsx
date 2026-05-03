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

  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh gap-4 text-text px-6">
        {error ? (
          <>
            <p className="text-danger text-center">{error}</p>
            <button
              className="h-12 px-6 rounded-xl bg-accent text-white font-semibold active:scale-95 transition-transform touch-manipulation"
              onClick={onLeave}
            >
              Back to Lobby
            </button>
          </>
        ) : connected ? (
          'Waiting for game state...'
        ) : (
          'Connecting...'
        )}
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