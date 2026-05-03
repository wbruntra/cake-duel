import GameHeader from './GameHeader'
import OpponentArea from './OpponentArea'
import PlayArea from './PlayArea'
import PlayerArea from './PlayerArea'
import ActionBar from './ActionBar'
import ClaimPicker from './ClaimPicker'
import PhaseToast from './PhaseToast'
import { useGame } from '@/context/GameContext'

export default function GameView() {
  const { state, connected } = useGame()

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-dvh text-text">
        {connected ? 'Waiting for game state...' : 'Connecting...'}
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
