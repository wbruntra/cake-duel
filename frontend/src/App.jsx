import { useState, useEffect } from 'react'
import { GameContext } from './context/GameContext'
import { GameUIProvider } from './hooks/useGameUI'
import { useWebSocket } from './hooks/useWebSocket'
import Lobby from './components/lobby/Lobby'
import GameView from './components/game/GameView'

function parseRoute() {
  const params = new URLSearchParams(window.location.search)
  const gameId = params.get('game')
  const playerId = params.get('player')
  if (gameId && playerId) return { gameId, playerId }

  const joinId = params.get('join')
  if (joinId) return { joinId }

  return {}
}

function useRouter() {
  const [route, setRoute] = useState(parseRoute)

  useEffect(() => {
    function onChange() {
      setRoute(parseRoute())
    }
    window.addEventListener('popstate', onChange)
    return () => window.removeEventListener('popstate', onChange)
  }, [])

  return route
}

function navigateToGame(gameId, playerId) {
  const url = `${window.location.pathname}?game=${encodeURIComponent(gameId)}&player=${encodeURIComponent(playerId)}`
  window.history.pushState(null, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function navigateToLobby() {
  window.history.pushState(null, '', window.location.pathname)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function App() {
  const { gameId, playerId, joinId } = useRouter()
  const { state, connected, error, send } = useWebSocket(gameId, playerId)

  if (!gameId || !playerId) {
    return (
      <Lobby
        joinId={joinId}
        onNavigateToGame={navigateToGame}
        onNavigateToLobby={navigateToLobby}
      />
    )
  }

  function handleLeave() {
    navigateToLobby()
  }

  return (
    <GameContext.Provider
      value={{ state, connected, error, send, onLeave: handleLeave, gameId, playerId }}
    >
      <GameUIProvider>
        <div className="min-h-dvh grid grid-rows-[1fr]">
          <GameView />
        </div>
      </GameUIProvider>
    </GameContext.Provider>
  )
}
