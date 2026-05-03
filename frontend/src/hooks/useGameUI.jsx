import { createContext, useContext, useState } from 'react'

const GameUIContext = createContext(null)

export function GameUIProvider({ children }) {
  const [selectedIndices, setSelectedIndices] = useState([])
  const [claimedName, setClaimedName] = useState('')
  const [claimPickerOpen, setClaimPickerOpen] = useState(false)

  function toggleCard(index) {
    setSelectedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    )
  }

  function clearSelection() {
    setSelectedIndices([])
    setClaimedName('')
  }

  return (
    <GameUIContext.Provider
      value={{
        selectedIndices,
        claimedName,
        claimPickerOpen,
        setClaimedName,
        setClaimPickerOpen,
        toggleCard,
        clearSelection,
      }}
    >
      {children}
    </GameUIContext.Provider>
  )
}

export function useGameUI() {
  const ctx = useContext(GameUIContext)
  if (!ctx) throw new Error('useGameUI must be used within GameUIProvider')
  return ctx
}
