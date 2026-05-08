import { useEffect } from 'react'

const CARDS = [
  {
    id: 'soldier',
    name: 'Soldier',
    image: '/cards/soldier.webp',
    tag: 'Weapon · 1 cake',
    desc: 'A reliable attacker. Claims 1 cake if it lands.',
  },
  {
    id: 'archer',
    name: 'Archer',
    image: '/cards/archer.webp',
    tag: 'Weapon · 1 cake',
    desc: 'Another weapon attacker. Blocked by the Defender.',
  },
  {
    id: 'wizard',
    name: 'Wizard',
    image: '/cards/wizard.webp',
    tag: 'Magic · 2 cakes',
    desc: 'A powerful magic attack worth 2 cakes. Blocked by the Scientist.',
  },
  {
    id: 'defender',
    name: 'Defender',
    image: '/cards/defender.webp',
    tag: 'Blocker · weapon',
    desc: 'Blocks any weapon attack (Soldier or Archer).',
  },
  {
    id: 'scientist',
    name: 'Scientist',
    image: '/cards/scientist.webp',
    tag: 'Blocker · magic',
    desc: 'Blocks any magic attack (Wizard).',
  },
  {
    id: 'sir_wolfy',
    name: 'Sir Wolfy',
    image: '/cards/sir_wolfy.webp',
    tag: 'Unclaimable',
    desc: "Can't be played as a weapon or magic. A wild card with no claim.",
  },
]

const STEPS = [
  {
    phase: 'Attack',
    color: 'text-attack',
    bg: 'bg-attack-light',
    border: 'border-attack/30',
    text: "Play a card face-down and claim it is a Soldier, Archer, or Wizard. You can bluff — your opponent can't see the card.",
  },
  {
    phase: 'Block or Pass',
    color: 'text-block',
    bg: 'bg-block-light',
    border: 'border-block/30',
    text: 'The defender chooses to block the claimed attack (using the matching blocker), challenge the claim, or let it through.',
  },
  {
    phase: 'Resolve',
    color: 'text-resolve',
    bg: 'bg-resolve-light',
    border: 'border-resolve/30',
    text: 'The card is revealed. If blocked correctly — attack fails. If challenged — whoever lied loses the bout and forfeits cakes. If no block, the cakes go to the attacker.',
  },
]

export default function RulesModal({ onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full sm:max-w-lg bg-bg rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-xl flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <h2 className="text-xl font-semibold text-text-h tracking-tight">How to Play</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-text hover:text-text-h bg-code-bg active:scale-90 transition-transform touch-manipulation"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M1 1l12 12M13 1L1 13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto scrollbar-none px-5 pb-6 flex flex-col gap-6">
          {/* Video link */}
          <a
            href="https://www.youtube.com/watch?v=TVjvr6POrQE"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-border bg-code-bg px-4 py-3 text-text-h active:opacity-70 transition-opacity touch-manipulation"
          >
            <span className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                <path d="M6 4.5l6 3.5-6 3.5V4.5z" />
              </svg>
            </span>
            <div className="text-left min-w-0">
              <p className="text-sm font-semibold leading-tight">Watch a video instead</p>
              <p className="text-xs text-text truncate">youtube.com · How to Play</p>
            </div>
            <svg
              className="ml-auto shrink-0 text-text"
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
            >
              <path
                d="M3 7h8M7 3l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>

          {/* Intro */}
          <p className="text-base text-text leading-relaxed">
            Deploy your Sheepie troops and steal all the cakes! Play cards face-down, bluff your
            opponent, and challenge suspicious attacks. First to steal all cakes wins.
          </p>

          {/* Turn flow */}
          <section>
            <h3 className="text-sm font-semibold text-text-h uppercase tracking-wide mb-3">
              Each Turn
            </h3>
            <div className="flex flex-col gap-2">
              {STEPS.map((step, i) => (
                <div
                  key={step.phase}
                  className={`rounded-xl border ${step.border} ${step.bg} px-4 py-3 flex gap-3 items-start`}
                >
                  <span className={`text-sm font-bold ${step.color} w-5 pt-0.5 shrink-0`}>
                    {i + 1}
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${step.color} mb-0.5`}>{step.phase}</p>
                    <p className="text-sm text-text leading-relaxed">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Challenge callout */}
          <section className="rounded-xl border border-accent-border bg-accent-light px-4 py-3">
            <p className="text-sm font-semibold text-accent mb-1">Challenging a claim</p>
            <p className="text-sm text-text leading-relaxed">
              If you call a bluff and you're right — the attacker loses the bout and forfeits cakes
              equal to the false claim. If you're wrong — you lose the bout and pay cakes instead.
              Bluff wisely!
            </p>
          </section>

          {/* Card gallery */}
          <section>
            <h3 className="text-sm font-semibold text-text-h uppercase tracking-wide mb-3">
              The Cards
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {CARDS.map((card) => (
                <div key={card.id} className="flex gap-3 items-start bg-code-bg rounded-xl p-3">
                  <img
                    src={card.image}
                    alt={card.name}
                    className="w-14 h-20 object-cover rounded-lg border border-border shrink-0"
                  />
                  <div className="flex flex-col gap-1 min-w-0 pt-0.5">
                    <p className="text-sm font-semibold text-text-h leading-tight">{card.name}</p>
                    <p className="text-xs font-medium text-accent leading-tight">{card.tag}</p>
                    <p className="text-xs text-text leading-relaxed">{card.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Winning */}
          <section className="rounded-xl border border-border bg-code-bg px-4 py-3">
            <p className="text-sm font-semibold text-text-h mb-1">Winning a Bout</p>
            <p className="text-sm text-text leading-relaxed">
              When a player runs out of cards or reaches 0 cakes, the bout ends and cakes are
              redistributed. Win enough bouts to take all your opponent's cakes — then the duel is
              yours!
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
