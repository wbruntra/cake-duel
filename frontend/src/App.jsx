import { useState, useEffect } from 'react'
import { GameContext } from './context/GameContext'
import { GameUIProvider } from './hooks/useGameUI'
import { useWebSocket } from './hooks/useWebSocket'
import Lobby from './components/lobby/Lobby'
import GameView from './components/game/GameView'

function parseRoute() {
  const search = new URLSearchParams(window.location.search)
  const joinId = search.get('join')
  if (joinId) return { joinId }

  const hash = window.location.hash
  if (!hash || hash === '#' || hash === '#/') return {}
  const path = hash.replace(/^#\/?/, '')
  const parts = path.split('/')
  if (parts.length === 1 && parts[0]) {
    return { joinId: parts[0] }
  }
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return { gameId: parts[0], playerId: parts[1] }
  }
  return {}
}

function useHashRouter() {
  const [route, setRoute] = useState(parseRoute)

  useEffect(() => {
    function onChange() {
      setRoute(parseRoute())
    }
    window.addEventListener('hashchange', onChange)
    window.addEventListener('popstate', onChange)
    return () => {
      window.removeEventListener('hashchange', onChange)
      window.removeEventListener('popstate', onChange)
    }
  }, [])

  return route
}

function navigateToGame(gameId, playerId) {
  window.location.hash = `#/${gameId}/${playerId}`
}

function navigateToLobby() {
  window.location.href = window.location.pathname
}

export default function App() {
  const { gameId, playerId, joinId } = useHashRouter()
  const { state, connected, error, send } = useWebSocket(gameId, playerId)

  if (!gameId || !playerId) {
    return <Lobby joinId={joinId} onNavigateToGame={navigateToGame} />
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
