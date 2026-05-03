import { useState, useEffect, useRef, useCallback } from 'react'

export function useWebSocket(gameId, playerId) {
  const wsRef = useRef(null)
  const [state, setState] = useState(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!gameId || !playerId) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws
    let active = true

    ws.onopen = () => {
      if (!active) return
      setConnected(true)
      ws.send(JSON.stringify({ type: 'join', gameId, playerId }))
    }

    ws.onmessage = (event) => {
      if (!active) return
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'state') {
          setState(msg.state)
        } else if (msg.type === 'error') {
          setError(msg.message)
        } else if (msg.type === 'connected') {
          setConnected(true)
        }
      } catch (e) {
        console.error('WS parse error:', e)
      }
    }

    ws.onclose = () => {
      if (!active) return
      setConnected(false)
    }

    ws.onerror = () => {
      if (!active) return
      setError('WebSocket connection error')
    }

    return () => {
      active = false
      ws.close()
    }
  }, [gameId, playerId])

  const send = useCallback((msg) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  return { state, connected, error, send }
}
