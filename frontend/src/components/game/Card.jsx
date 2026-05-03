import { getCardInfo, CARD_BACK_IMAGE } from '@/utils/cards'
import { tap } from '@/utils/haptics'

const SIZE_CLASSES = {
  sm: 'w-14 h-20',
  md: 'w-20 h-28',
  lg: 'w-28 h-40',
}

export default function Card({
  cardId,
  selected,
  onClick,
  faceDown,
  size = 'md',
  selectionOrder,
}) {
  const info = cardId ? getCardInfo(cardId) : { name: '', image: '' }
  const sizeClasses = SIZE_CLASSES[size] || SIZE_CLASSES.md

  function handleClick() {
    if (onClick) {
      tap()
      onClick()
    }
  }

  return (
    <button
      className={`
        relative flex flex-col items-center justify-center overflow-hidden
        rounded-lg border-2 transition-transform touch-manipulation select-none
        min-h-[44px] aspect-[5/7]
        ${sizeClasses}
        ${faceDown ? 'bg-code-bg border-border cursor-default' : 'bg-bg border-border cursor-pointer'}
        ${selected ? 'border-accent shadow-[0_0_0_3px_var(--color-accent-light)] -translate-y-4' : ''}
        ${onClick ? 'active:scale-95' : ''}
      `}
      onClick={handleClick}
      disabled={!onClick}
      title={faceDown ? '?' : info.name}
    >
      {selectionOrder != null && (
        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center z-10">
          {selectionOrder + 1}
        </span>
      )}
      {faceDown ? (
        <img
          src={CARD_BACK_IMAGE}
          alt="Card back"
          className="w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <>
          <img
            src={info.image}
            alt={info.name}
            className="w-full aspect-square object-cover rounded-t-md"
            draggable={false}
          />
          <span
            className={`${size === 'sm' ? 'text-[9px]' : 'text-xs'} font-semibold text-text-h leading-tight truncate w-full text-center pt-0.5`}
          >
            {info.name}
          </span>
        </>
      )}
    </button>
  )
}
