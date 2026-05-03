import { useState } from 'react'
import { GameContext } from './context/GameContext'
import { GameUIProvider } from './hooks/useGameUI'
import { useWebSocket } from './hooks/useWebSocket'
import Lobby from './components/lobby/Lobby'
import GameView from './components/game/GameView'

function getJoinParam() {
  const params = new URLSearchParams(window.location.search)
  return params.get('join')
}

function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initial
    } catch {
      return initial
    }
  })

  const set = (v) => {
    setValue(v)
    window.localStorage.setItem(key, JSON.stringify(v))
  }

  return [value, set]
}

export default function App() {
  const [gameId, setGameId] = useLocalStorage('cakeduel_gameId', null)
  const [playerId, setPlayerId] = useLocalStorage('cakeduel_playerId', null)

  const { state, connected, error, send } = useWebSocket(gameId, playerId)

  function handleGameStart(gId, pId) {
    setGameId(gId)
    setPlayerId(pId)
  }

  function handleLeave() {
    setGameId(null)
    setPlayerId(null)
  }

  if (!gameId || !playerId) {
    return <Lobby onGameStart={handleGameStart} initialJoinId={getJoinParam()} />
  }

  return (
    <GameContext.Provider value={{ state, connected, error, send, onLeave: handleLeave }}>
      <GameUIProvider>
        <div className="min-h-dvh grid grid-rows-[1fr]">
          <GameView />
        </div>
      </GameUIProvider>
    </GameContext.Provider>
  )
}
