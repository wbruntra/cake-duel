import { describe, test, expect } from "bun:test";
import {
  newBout,
  playAttack,
  playBlock,
  pass,
  resolveTurn,
  resupply,
  stateForPlayer,
} from "./engine";
import { createDeck } from "./cards";
import type { GameState, Claim } from "./types";

function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    id: "test-game",
    status: "playing",
    player1Id: "a",
    player2Id: "b",
    currentBout: 1,
    boutWinners: [null, null, null],
    winner: null,
    turnPlayer: "p1",
    turnPhase: "attack",
    p1Hand: [],
    p2Hand: [],
    p1Cakes: 3,
    p2Cakes: 4,
    p1HandSize: 4,
    p2HandSize: 4,
    deck: [],
    discard: [],
    attackClaim: null,
    blockClaim: null,
    passedLast: null,
    ...overrides,
  };
}

function makeHand(cardIds: string[]): string[] {
  return cardIds.map((id, i) => `${id}_${i}`);
}

describe("newBout", () => {
  test("creates initial bout state", () => {
    const state = baseState();
    const result = newBout(state, "p1");

    expect(result.p1Hand.length).toBe(4);
    expect(result.p2Hand.length).toBe(4);
    expect(result.p1Cakes).toBe(3);
    expect(result.p2Cakes).toBe(4);
    expect(result.turnPlayer).toBe("p1");
    expect(result.turnPhase).toBe("attack");
    expect(result.attackClaim).toBeNull();
    expect(result.blockClaim).toBeNull();
    expect(result.discard).toEqual([]);

    const deckCards = createDeck();
    expect(result.deck.length + result.p1Hand.length + result.p2Hand.length).toBe(deckCards.length);
  });

  test("starts with specified player", () => {
    const state = baseState();
    const result = newBout(state, "p2");
    expect(result.turnPlayer).toBe("p2");
  });
});

describe("playAttack", () => {
  test("successful attack", () => {
    const hand = makeHand(["soldier", "soldier", "archer", "wizard"]);
    const state = baseState({ p1Hand: hand, turnPlayer: "p1", turnPhase: "attack" });

    const result = playAttack(state, "p1", [hand[0]!, hand[1]!], "Soldier");

    expect(result.error).toBeUndefined();
    expect(result.state.p1Hand.length).toBe(2);
    expect(result.state.attackClaim!.cardName).toBe("Soldier");
    expect(result.state.attackClaim!.count).toBe(2);
    expect(result.state.attackClaim!.player).toBe("p1");
    expect(result.state.turnPhase).toBe("block");
    expect(result.state.turnPlayer).toBe("p2");
    expect(result.state.discard.length).toBe(2);
  });

  test("claiming multiple attackers of same name", () => {
    const hand = makeHand(["soldier", "soldier", "soldier", "archer"]);
    const state = baseState({ p1Hand: hand, turnPlayer: "p1", turnPhase: "attack" });

    const result = playAttack(state, "p1", [hand[0]!, hand[1]!, hand[2]!], "Soldier");
    expect(result.error).toBeUndefined();
    expect(result.state.attackClaim!.count).toBe(3);
    expect(result.state.attackClaim!.cardName).toBe("Soldier");
  });

  test("error: not your turn", () => {
    const state = baseState({ turnPlayer: "p1", turnPhase: "attack", p2Hand: makeHand(["soldier"]) });
    const result = playAttack(state, "p2", [state.p2Hand[0]!], "Soldier");
    expect(result.error).toBe("Not your turn");
  });

  test("error: not in attack phase", () => {
    const state = baseState({ turnPlayer: "p1", turnPhase: "block", p1Hand: makeHand(["soldier"]) });
    const result = playAttack(state, "p1", [state.p1Hand[0]!], "Soldier");
    expect(result.error).toBe("Not in attack phase");
  });

  test("error: zero cards", () => {
    const state = baseState({ turnPlayer: "p1", turnPhase: "attack" });
    const result = playAttack(state, "p1", [], "Soldier");
    expect(result.error).toBe("Must play at least one card");
  });

  test("error: card not in hand", () => {
    const state = baseState({ turnPlayer: "p1", turnPhase: "attack", p1Hand: makeHand(["soldier"]) });
    const result = playAttack(state, "p1", ["nonexistent"], "Soldier");
    expect(result.error).toBe("Cards not in hand");
  });

  test("error: unknown card name", () => {
    const hand = makeHand(["soldier"]);
    const state = baseState({ turnPlayer: "p1", turnPhase: "attack", p1Hand: hand });
    const result = playAttack(state, "p1", [hand[0]!], "NotACard");
    expect(result.error).toBe("Unknown card: NotACard");
  });

  test("error: cannot claim unclaimable card", () => {
    const hand = makeHand(["sir_wolfy"]);
    const state = baseState({ turnPlayer: "p1", turnPhase: "attack", p1Hand: hand });
    const result = playAttack(state, "p1", [hand[0]!], "Sir Wolfy");
    expect(result.error).toBe("Sir Wolfy cannot be claimed");
  });

  test("error: claiming blocker as attacker", () => {
    const hand = makeHand(["defender"]);
    const state = baseState({ turnPlayer: "p1", turnPhase: "attack", p1Hand: hand });
    const result = playAttack(state, "p1", [hand[0]!], "Defender");
    expect(result.error).toBe("Defender is not an attacker");
  });

  test("can attack with Archer (weapon type)", () => {
    const hand = makeHand(["archer"]);
    const state = baseState({ turnPlayer: "p1", turnPhase: "attack", p1Hand: hand });
    const result = playAttack(state, "p1", [hand[0]!], "Archer");
    expect(result.error).toBeUndefined();
  });

  test("can attack with Wizard (magic type)", () => {
    const hand = makeHand(["wizard"]);
    const state = baseState({ turnPlayer: "p1", turnPhase: "attack", p1Hand: hand });
    const result = playAttack(state, "p1", [hand[0]!], "Wizard");
    expect(result.error).toBeUndefined();
  });
});

describe("playBlock", () => {
  test("successful block - Defender blocks Weapon", () => {
    const hand = makeHand(["defender", "defender", "scientist", "wizard"]);
    const attackClaim: Claim = { cardName: "Soldier", count: 2, player: "p1", playedCardIds: ["s_1", "s_2"] };
    const state = baseState({
      p2Hand: hand,
      turnPlayer: "p2",
      turnPhase: "block",
      attackClaim,
    });

    const result = playBlock(state, "p2", [hand[0]!], "Defender");
    expect(result.error).toBeUndefined();
    expect(result.state.blockClaim!.cardName).toBe("Defender");
    expect(result.state.blockClaim!.count).toBe(1);
    expect(result.state.turnPhase).toBe("resolve");
    expect(result.state.p2Hand.length).toBe(3);
  });

  test("successful block - Scientist blocks Magic", () => {
    const hand = makeHand(["scientist", "defender", "soldier", "archer"]);
    const attackClaim: Claim = { cardName: "Wizard", count: 1, player: "p1", playedCardIds: ["w_1"] };
    const state = baseState({
      p2Hand: hand,
      turnPlayer: "p2",
      turnPhase: "block",
      attackClaim,
    });

    const result = playBlock(state, "p2", [hand[0]!], "Scientist");
    expect(result.error).toBeUndefined();
  });

  test("error: Scientist cannot block Weapon", () => {
    const hand = makeHand(["scientist"]);
    const attackClaim: Claim = { cardName: "Soldier", count: 1, player: "p1", playedCardIds: ["s_1"] };
    const state = baseState({
      p2Hand: hand,
      turnPlayer: "p2",
      turnPhase: "block",
      attackClaim,
    });

    const result = playBlock(state, "p2", [hand[0]!], "Scientist");
    expect(result.error).toBe("Scientist cannot block Soldier");
  });

  test("error: Defender cannot block Magic", () => {
    const hand = makeHand(["defender"]);
    const attackClaim: Claim = { cardName: "Wizard", count: 1, player: "p1", playedCardIds: ["w_1"] };
    const state = baseState({
      p2Hand: hand,
      turnPlayer: "p2",
      turnPhase: "block",
      attackClaim,
    });

    const result = playBlock(state, "p2", [hand[0]!], "Defender");
    expect(result.error).toBe("Defender cannot block Wizard");
  });

  test("error: not in block phase", () => {
    const state = baseState({ turnPlayer: "p2", turnPhase: "attack", p2Hand: makeHand(["defender"]) });
    const result = playBlock(state, "p2", [state.p2Hand[0]!], "Defender");
    expect(result.error).toBe("Not in block phase");
  });

  test("error: nothing to block", () => {
    const state = baseState({ turnPlayer: "p2", turnPhase: "block", p2Hand: makeHand(["defender"]) });
    const result = playBlock(state, "p2", [state.p2Hand[0]!], "Defender");
    expect(result.error).toBe("Nothing to block");
  });

  test("error: zero cards", () => {
    const attackClaim: Claim = { cardName: "Soldier", count: 1, player: "p1", playedCardIds: ["s_1"] };
    const state = baseState({ turnPlayer: "p2", turnPhase: "block", attackClaim });
    const result = playBlock(state, "p2", [], "Defender");
    expect(result.error).toBe("Must play at least one card");
  });

  test("error: claiming non-blocker as blocker", () => {
    const hand = makeHand(["soldier"]);
    const attackClaim: Claim = { cardName: "Soldier", count: 1, player: "p1", playedCardIds: ["s_1"] };
    const state = baseState({
      p2Hand: hand,
      turnPlayer: "p2",
      turnPhase: "block",
      attackClaim,
    });

    const result = playBlock(state, "p2", [hand[0]!], "Soldier");
    expect(result.error).toBe("Soldier is not a blocker");
  });
});

describe("pass", () => {
  test("attacker passes turn", () => {
    const state = baseState({ turnPlayer: "p1", turnPhase: "attack" });
    const result = pass(state, "p1");

    expect(result.error).toBeUndefined();
    expect(result.state.passedLast).toBe("p1");
    expect(result.state.turnPlayer).toBe("p2");
    expect(result.state.turnPhase).toBe("attack");
  });

  test("error: not your turn", () => {
    const state = baseState({ turnPlayer: "p1", turnPhase: "attack" });
    const result = pass(state, "p2");
    expect(result.error).toBe("Not your turn");
  });

  test("error: not in attack phase", () => {
    const state = baseState({ turnPlayer: "p1", turnPhase: "block" });
    const result = pass(state, "p1");
    expect(result.error).toBe("Not in attack phase");
  });
});

describe("resolveTurn", () => {
  test("2 Soldiers steal 2 cakes with no block", () => {
    const hand = makeHand(["soldier", "soldier"]);
    const state = baseState({
      p1Hand: hand,
      p1Cakes: 3,
      p2Cakes: 4,
      attackClaim: { cardName: "Soldier", count: 2, player: "p1", playedCardIds: [] },
      blockClaim: null,
    });

    const result = resolveTurn(state);

    expect(result.boutOver).toBe(false);
    expect(result.state.p1Cakes).toBe(5);
    expect(result.state.p2Cakes).toBe(2);
  });

  test("1 Wizard steals 2 cakes with no block", () => {
    const state = baseState({
      p1Cakes: 3,
      p2Cakes: 4,
      attackClaim: { cardName: "Wizard", count: 1, player: "p1", playedCardIds: [] },
      blockClaim: null,
    });

    const result = resolveTurn(state);

    expect(result.state.p1Cakes).toBe(5);
    expect(result.state.p2Cakes).toBe(2);
  });

  test("2 Wizards steal 4 cakes with no block", () => {
    const state = baseState({
      p1Cakes: 3,
      p2Cakes: 4,
      attackClaim: { cardName: "Wizard", count: 2, player: "p1", playedCardIds: [] },
      blockClaim: null,
    });

    const result = resolveTurn(state);

    expect(result.state.p1Cakes).toBe(7);
    expect(result.state.p2Cakes).toBe(0);
    expect(result.boutOver).toBe(true);
    expect(result.attackerWins).toBe(true);
  });

  test("1 Soldier blocked by 1 Defender - no cakes stolen", () => {
    const state = baseState({
      p1Cakes: 3,
      p2Cakes: 4,
      attackClaim: { cardName: "Soldier", count: 1, player: "p1", playedCardIds: [] },
      blockClaim: { cardName: "Defender", count: 1, player: "p2", playedCardIds: [] },
    });

    const result = resolveTurn(state);

    expect(result.state.p1Cakes).toBe(3);
    expect(result.state.p2Cakes).toBe(4);
    expect(result.boutOver).toBe(false);
  });

  test("2 Soldiers blocked by 1 Defender - 1 cake stolen", () => {
    const state = baseState({
      p1Cakes: 3,
      p2Cakes: 4,
      attackClaim: { cardName: "Soldier", count: 2, player: "p1", playedCardIds: [] },
      blockClaim: { cardName: "Defender", count: 1, player: "p2", playedCardIds: [] },
    });

    const result = resolveTurn(state);

    expect(result.state.p1Cakes).toBe(4);
    expect(result.state.p2Cakes).toBe(3);
  });

  test("2 Wizards blocked by 1 Scientist - 2 cakes stolen (one Wizard unblocked)", () => {
    const state = baseState({
      p1Cakes: 3,
      p2Cakes: 4,
      attackClaim: { cardName: "Wizard", count: 2, player: "p1", playedCardIds: [] },
      blockClaim: { cardName: "Scientist", count: 1, player: "p2", playedCardIds: [] },
    });

    const result = resolveTurn(state);

    expect(result.state.p2Cakes).toBe(2);
    expect(result.state.p1Cakes).toBe(5);
    expect(result.boutOver).toBe(false);
  });

  test("2 Defenders block 2 Soldiers - no cakes stolen", () => {
    const state = baseState({
      p1Cakes: 3,
      p2Cakes: 4,
      attackClaim: { cardName: "Soldier", count: 2, player: "p1", playedCardIds: [] },
      blockClaim: { cardName: "Defender", count: 2, player: "p2", playedCardIds: [] },
    });

    const result = resolveTurn(state);

    expect(result.state.p1Cakes).toBe(3);
    expect(result.state.p2Cakes).toBe(4);
  });

  test("P2 attacks P1", () => {
    const state = baseState({
      p1Cakes: 3,
      p2Cakes: 4,
      attackClaim: { cardName: "Soldier", count: 1, player: "p2", playedCardIds: [] },
      blockClaim: null,
    });

    const result = resolveTurn(state);

    expect(result.state.p2Cakes).toBe(5);
    expect(result.state.p1Cakes).toBe(2);
  });

  test("cannot steal more cakes than defender has", () => {
    const state = baseState({
      p1Cakes: 3,
      p2Cakes: 1,
      attackClaim: { cardName: "Wizard", count: 2, player: "p1", playedCardIds: [] },
      blockClaim: null,
    });

    const result = resolveTurn(state);

    expect(result.state.p1Cakes).toBe(4);
    expect(result.state.p2Cakes).toBe(0);
    expect(result.boutOver).toBe(true);
    expect(result.attackerWins).toBe(true);
  });

  test("bout over when defender loses all cakes", () => {
    const state = baseState({
      p1Cakes: 3,
      p2Cakes: 3,
      attackClaim: { cardName: "Wizard", count: 2, player: "p1", playedCardIds: [] },
      blockClaim: null,
    });

    const result = resolveTurn(state);

    expect(result.state.p2Cakes).toBe(0);
    expect(result.boutOver).toBe(true);
    expect(result.attackerWins).toBe(true);
  });

  test("bout not over when defender has cakes remaining", () => {
    const state = baseState({
      p1Cakes: 3,
      p2Cakes: 4,
      attackClaim: { cardName: "Soldier", count: 2, player: "p1", playedCardIds: [] },
      blockClaim: null,
    });

    const result = resolveTurn(state);

    expect(result.state.p2Cakes).toBe(2);
    expect(result.boutOver).toBe(false);
    expect(result.attackerWins).toBe(false);
  });
});

describe("resupply", () => {
  test("refills hands to size 4 after attack", () => {
    const state = baseState({
      p1Hand: makeHand(["soldier", "wizard"]),
      p2Hand: makeHand(["defender"]),
      p1Cakes: 5,
      p2Cakes: 2,
      deck: makeHand(["archer", "scientist", "soldier", "defender", "wizard", "soldier", "archer"]),
      attackClaim: { cardName: "Soldier", count: 2, player: "p1", playedCardIds: [] },
      blockClaim: { cardName: "Defender", count: 1, player: "p2", playedCardIds: [] },
    });

    const result = resupply(state);

    expect(result.p1Hand.length).toBe(4);
    expect(result.p2Hand.length).toBe(4);
    expect(result.attackClaim).toBeNull();
    expect(result.blockClaim).toBeNull();
    expect(result.turnPhase).toBe("attack");
    expect(result.turnPlayer).toBe("p2");
  });

  test("attacker resupplies first, gets cards even if deck runs out for blocker", () => {
    const state = baseState({
      p1Hand: makeHand(["soldier"]),
      p2Hand: makeHand(["soldier", "archer"]),
      deck: makeHand(["wizard"]),
      attackClaim: { cardName: "Soldier", count: 1, player: "p1", playedCardIds: [] },
      blockClaim: null,
    });

    const result = resupply(state);

    expect(result.p1Hand.length).toBe(2);
    expect(result.p2Hand.length).toBe(2);
    expect(result.deck.length).toBe(0);
  });

  test("turn passes to defender after attacker attacks", () => {
    const state = baseState({
      p1Hand: makeHand(["soldier"]),
      p2Hand: makeHand(["archer"]),
      deck: makeHand(["wizard", "defender", "scientist", "soldier", "soldier", "archer", "defender"]),
      attackClaim: { cardName: "Soldier", count: 1, player: "p1", playedCardIds: [] },
      blockClaim: null,
    });

    const result = resupply(state);

    expect(result.turnPlayer).toBe("p2");
  });
});

describe("full turn flow", () => {
  test("complete turn: p1 attacks, p2 blocks, resolve, resupply", () => {
    const state = baseState({
      p1Hand: makeHand(["soldier", "soldier", "archer", "wizard"]),
      p2Hand: makeHand(["defender", "defender", "scientist", "archer"]),
      deck: makeHand(["soldier", "soldier", "soldier", "archer", "wizard", "scientist", "soldier"]),
      turnPlayer: "p1",
      turnPhase: "attack",
    });

    // 1. P1 attacks with 2 Soldiers
    const attackResult = playAttack(state, "p1", [state.p1Hand[0]!, state.p1Hand[1]!], "Soldier");
    expect(attackResult.error).toBeUndefined();
    const afterAttack = attackResult.state;
    expect(afterAttack.turnPhase).toBe("block");
    expect(afterAttack.turnPlayer).toBe("p2");

    // 2. P2 blocks with 1 Defender
    const blockResult = playBlock(afterAttack, "p2", [afterAttack.p2Hand[0]!], "Defender");
    expect(blockResult.error).toBeUndefined();
    const afterBlock = blockResult.state;
    expect(afterBlock.turnPhase).toBe("resolve");

    // 3. Resolve - 1 Soldier gets through (2 - 1 blocked = 1 stolen)
    const resolveResult = resolveTurn(afterBlock);
    expect(resolveResult.boutOver).toBe(false);
    expect(resolveResult.state.p1Cakes).toBe(4);
    expect(resolveResult.state.p2Cakes).toBe(3);

    // 4. Resupply
    const afterResupply = resupply(resolveResult.state);
    expect(afterResupply.p1Hand.length).toBe(4);
    expect(afterResupply.p2Hand.length).toBe(4);
    expect(afterResupply.turnPhase).toBe("attack");
    expect(afterResupply.turnPlayer).toBe("p2");
  });

  test("multiple turns: p1 attacks, p2 attacks back", () => {
    const state = baseState({
      p1Hand: makeHand(["soldier", "soldier", "archer", "wizard"]),
      p2Hand: makeHand(["soldier", "archer", "defender", "scientist"]),
      deck: makeHand(["soldier", "wizard", "soldier", "archer", "defender", "scientist", "soldier"]),
      turnPlayer: "p1",
      turnPhase: "attack",
      p1Cakes: 3,
      p2Cakes: 4,
    });

    // Turn 1: P1 attacks with Soldier, P2 doesn't block
    const a1 = playAttack(state, "p1", [state.p1Hand[0]!], "Soldier");
    const r1 = resolveTurn(a1.state);
    const res1 = resupply(r1.state);

    expect(res1.turnPlayer).toBe("p2");
    expect(res1.p1Cakes).toBe(4);
    expect(res1.p2Cakes).toBe(3);

    // Turn 2: P2 attacks with Soldier, P1 doesn't block
    const a2 = playAttack(res1, "p2", [res1.p2Hand[0]!], "Soldier");
    const r2 = resolveTurn(a2.state);
    const res2 = resupply(r2.state);

    expect(res2.turnPlayer).toBe("p1");
    expect(res2.p1Cakes).toBe(3);
    expect(res2.p2Cakes).toBe(4);
  });

  test("bout ends when P1 steals all P2 cakes across turns", () => {
    const state = baseState({
      p1Hand: makeHand(["wizard", "wizard", "archer", "soldier"]),
      p2Hand: makeHand(["soldier", "archer", "defender", "defender"]),
      deck: makeHand(["soldier", "wizard", "soldier", "archer", "scientist", "defender", "soldier"]),
      turnPlayer: "p1",
      turnPhase: "attack",
      p1Cakes: 3,
      p2Cakes: 4,
    });

    // Turn 1: P1 plays 2 Wizards (4 cakes), no block → steals all 4, bout over
    const a1 = playAttack(state, "p1", [state.p1Hand[0]!, state.p1Hand[1]!], "Wizard");
    const r1 = resolveTurn(a1.state);

    expect(r1.boutOver).toBe(true);
    expect(r1.attackerWins).toBe(true);
    expect(r1.state.p1Cakes).toBe(7);
    expect(r1.state.p2Cakes).toBe(0);
  });

  test("blockers don't know specific card type, just block based on claimed name", () => {
    const p1Hand = makeHand(["soldier", "archer", "wizard", "soldier"]);
    const p2Hand = makeHand(["defender", "defender", "scientist", "archer"]);
    const deck = makeHand(["soldier", "soldier", "archer", "wizard", "scientist", "defender", "soldier"]);

    const state = baseState({
      p1Hand,
      p2Hand,
      deck,
      turnPlayer: "p1",
      turnPhase: "attack",
      p1Cakes: 3,
      p2Cakes: 4,
    });

    // P1 plays an Archer card but claims it as a Soldier
    const a1 = playAttack(state, "p1", [p1Hand[1]!], "Soldier");
    const b1 = playBlock(a1.state, "p2", [a1.state.p2Hand[0]!], "Defender");
    const r1 = resolveTurn(b1.state);

    // Defender blocks 1 Weapon (Soldier), so no cake stolen
    expect(r1.state.p1Cakes).toBe(3);
    expect(r1.state.p2Cakes).toBe(4);
  });
});

describe("stateForPlayer", () => {
  test("returns correct P1 perspective", () => {
    const state = baseState({
      p1Hand: makeHand(["soldier", "archer"]),
      p2Hand: makeHand(["defender", "wizard", "scientist"]),
      p1Cakes: 3,
      p2Cakes: 4,
      deck: makeHand(["soldier"]),
      attackClaim: { cardName: "Soldier", count: 1, player: "p1", playedCardIds: [] },
    });

    const p1View = stateForPlayer(state, "p1");

    expect(p1View.hand).toEqual(state.p1Hand);
    expect(p1View.myCakes).toBe(3);
    expect(p1View.opponentCakes).toBe(4);
    expect(p1View.opponentHandCount).toBe(3);
    expect(p1View.player).toBe("p1");
    expect(p1View.attackClaim).not.toBeNull();
  });

  test("returns correct P2 perspective", () => {
    const state = baseState({
      p1Hand: makeHand(["soldier", "archer"]),
      p2Hand: makeHand(["defender", "wizard", "scientist"]),
      p1Cakes: 3,
      p2Cakes: 4,
      attackClaim: { cardName: "Soldier", count: 1, player: "p1", playedCardIds: [] },
    });

    const p2View = stateForPlayer(state, "p2");

    expect(p2View.hand).toEqual(state.p2Hand);
    expect(p2View.myCakes).toBe(4);
    expect(p2View.opponentCakes).toBe(3);
    expect(p2View.opponentHandCount).toBe(2);
    expect(p2View.player).toBe("p2");
  });
});

describe("edge cases", () => {
  test("deck empty, players continue with remaining cards", () => {
    const state = baseState({
      p1Hand: makeHand(["soldier", "wizard"]),
      p2Hand: makeHand(["defender"]),
      deck: [],
      attackClaim: { cardName: "Soldier", count: 1, player: "p1", playedCardIds: [] },
      blockClaim: null,
    });

    const result = resupply(state);

    expect(result.p1Hand.length).toBe(2);
    expect(result.p2Hand.length).toBe(1);
    expect(result.deck.length).toBe(0);
  });

  test("resolve without attack claim returns early", () => {
    const state = baseState({ attackClaim: null });
    const result = resolveTurn(state);

    expect(result.boutOver).toBe(false);
    expect(result.attackerWins).toBe(false);
  });

  test("resupply without attack claim, switches turn", () => {
    const state = baseState({
      attackClaim: null,
      turnPlayer: "p1",
      turnPhase: "attack",
    });

    const result = resupply(state);

    expect(result.turnPlayer).toBe("p2");
    expect(result.turnPhase).toBe("attack");
  });

  test("both players start with correct hand sizes", () => {
    const state = baseState();
    const result = newBout(state, "p1");

    expect(result.p1Hand.length).toBe(4);
    expect(result.p2Hand.length).toBe(4);
    expect(result.deck.length).toBe(12);
  });
});
