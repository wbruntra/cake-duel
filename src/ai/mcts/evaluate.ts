import type { MCTSConfig, MCTSDifficulty } from './types'
import { DIFFICULTY_CONFIGS } from './types'
import { runBoutSelfPlay } from './self-play'

interface EvalResult {
  matchup: string
  p1WinRate: number
  p2WinRate: number
  drawRate: number
  avgMoves: number
  avgTimePerMove: number
}

function evaluateMatchup(
  config1: MCTSConfig | null,
  config2: MCTSConfig | null,
  name1: string,
  name2: string,
  numBouts: number,
): EvalResult {
  console.log(`\nEvaluating: ${name1} vs ${name2} (${numBouts} bouts)`)
  const result = runBoutSelfPlay(config1, config2, numBouts)

  const p1WinRate = result.p1Wins / result.boutsPlayed
  const p2WinRate = result.p2Wins / result.boutsPlayed
  const drawRate = result.draws / result.boutsPlayed

  return {
    matchup: `${name1} vs ${name2}`,
    p1WinRate,
    p2WinRate,
    drawRate,
    avgMoves: result.avgMovesPerBout,
    avgTimePerMove: result.avgTimePerMoveMs,
  }
}

if (import.meta.main) {
  const numBouts = parseInt(process.argv[2] || '50', 10)

  const configs: { name: string; config: MCTSConfig | null }[] = [
    { name: 'random', config: null },
    { name: 'easy', config: DIFFICULTY_CONFIGS.easy },
    { name: 'medium', config: DIFFICULTY_CONFIGS.medium },
  ]

  const matchups: [string, string][] = [
    ['random', 'easy'],
    ['easy', 'medium'],
    ['easy', 'random'],
  ]

  console.log('=== MCTS CPU Evaluation (bout-level) ===')
  console.log(`Bouts per matchup: ${numBouts}\n`)

  const results: EvalResult[] = []

  for (const [name1, name2] of matchups) {
    const c1 = configs.find((c) => c.name === name1)!.config
    const c2 = configs.find((c) => c.name === name2)!.config
    const result = evaluateMatchup(c1, c2, name1, name2, numBouts)
    results.push(result)
    console.log(
      `  ${name1} wins: ${(result.p1WinRate * 100).toFixed(1)}%, ` +
        `${name2} wins: ${(result.p2WinRate * 100).toFixed(1)}%, ` +
        `draws: ${(result.drawRate * 100).toFixed(1)}%, ` +
        `avg moves: ${result.avgMoves.toFixed(1)}, ` +
        `avg time/move: ${result.avgTimePerMove.toFixed(1)}ms`,
    )
  }

  console.log('\n=== Summary ===')
  for (const r of results) {
    console.log(
      `${r.matchup}: P1=${(r.p1WinRate * 100).toFixed(1)}% P2=${(r.p2WinRate * 100).toFixed(1)}%`,
    )
  }
}
