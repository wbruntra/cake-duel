import { motion, AnimatePresence } from 'motion/react'
import { useGameUI } from '@/hooks/useGameUI'
import { getAttackerOptions } from '@/utils/cards'
import { tap } from '@/utils/haptics'

export default function ClaimPicker() {
  const { claimPickerOpen, setClaimPickerOpen, setClaimedName } = useGameUI()
  const options = getAttackerOptions()

  function handleSelect(name) {
    tap()
    setClaimedName(name)
    setClaimPickerOpen(false)
  }

  return (
    <AnimatePresence>
      {claimPickerOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setClaimPickerOpen(false)}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 bg-bg border-t border-border rounded-t-2xl safe-bottom"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="px-4 pt-3 pb-2">
              <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text-h mb-3">Claim as</h3>
              <div className="flex flex-col gap-2">
                {options.map((opt) => (
                  <button
                    key={opt.id}
                    className="w-full flex items-center gap-4 h-24 px-4 rounded-xl border border-border bg-bg hover:bg-code-bg active:scale-[0.98] transition-all touch-manipulation select-none"
                    onClick={() => handleSelect(opt.name)}
                  >
                    <img
                      src={opt.image}
                      alt={opt.name}
                      className="w-16 h-16 rounded-lg object-cover"
                      draggable={false}
                    />
                    <div className="text-left">
                      <div className="text-base font-semibold text-text-h">{opt.name}</div>
                      <div className="text-sm text-text">
                        {opt.id === 'soldier' && '🗡 Weapon · steal 🍰1'}
                        {opt.id === 'archer' && '🏹 Weapon · steal 🍰1'}
                        {opt.id === 'wizard' && '✨ Magic · steal 🍰2'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
