import assert from 'node:assert/strict';
import {
  createGame, chooseGoal, applyAction, performAction, key, borderCandidates, borderShape, metrics, endTurn,
} from '../src/engine/engine.js';

function setup(n = 2) {
  const s = createGame({ players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` })), seed: 11, expansions: { inc: true } });
  s.players.forEach((p) => chooseGoal(s, p.id, p.goalOptions[0]));
  s.players.forEach((p) => { p.money = 200; });
  return s;
}
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('✓', name); };
const put = (s, slot, id) => { s.market = s.market.map((x) => x || 'conv'); s.market[slot] = id; };
const placeBorderNear = (s, pi, id, slotsMustInclude, lake = false) => {
  s.market = s.market.map((x) => x || 'conv');
  s.borderOpen[0] = id;
  const cand = borderCandidates(s, pi, lake).find((c) => slotsMustInclude.every((k) => c.slots.includes(k)));
  assert.ok(cand, 'no border candidate');
  const r = performAction(s, pi, { type: 'border', idx: 0, c0: cand.c0, orient: cand.orient, lake, discard: 6 });
  assert.ok(r.ok, r.error);
  return cand;
};

test('setup: 3 open borders, bonus + challenge, Inc goals possible', () => {
  const s = setup();
  assert.equal(s.borderOpen.length, 3);
  assert.equal(s.borderDeck.length, 9);
  assert.ok(s.bonus && s.challenge);
});

test('base game unaffected when Inc is off', () => {
  const s = createGame({ players: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }], seed: 3 });
  const all = [...s.market, ...s.stacks.A, ...s.stacks.B, ...s.stacks.C];
  assert.ok(!all.some((id) => ['cemetery', 'law', 'planner', 'redistrict'].includes(id)));
  assert.equal(s.borderOpen.length, 0);
});

test('border shapes: 12 orientations give 4 distinct cells + 4 slots', () => {
  for (let o = 0; o < 12; o++) {
    const sh = borderShape(key(0, 0), o);
    assert.equal(new Set(sh.cells).size, 4);
    assert.equal(new Set(sh.slots).size, 4);
    assert.ok(!sh.cells.some((c) => sh.slots.includes(c)));
  }
});

test('Mountains: +2 rep per adjacent building in its slots', () => {
  const s = setup();
  const rep0 = s.players[0].rep;
  const c = placeBorderNear(s, 0, 'mountains', [key(0, 2)]);
  const adj = c.slots.filter((k) => s.players[0].tiles[k]).length;
  assert.equal(s.players[0].rep, Math.min(15, rep0 + 2 * adj));
  // a building later placed into a slot triggers it again
  const free = c.slots.find((k) => !s.players[0].tiles[k] && !s.players[0].borders[0].cells.includes(k));
  if (free) {
    const before = s.players[0].rep;
    put(s, 6, 'conv');
    const r = performAction(s, 0, { type: 'buy', slot: 6, cell: free });
    if (r.ok) assert.ok(s.players[0].rep >= before + 2 - 0);
  }
});

test('Border cells block hex placement', () => {
  const s = setup();
  const c = placeBorderNear(s, 0, 'forest', [key(0, 2)]);
  put(s, 6, 'conv');
  for (const cell of c.cells) {
    assert.ok(!performAction(JSON.parse(JSON.stringify(s)), 0, { type: 'buy', slot: 6, cell }).ok);
  }
});

test('Checkpoint needs an adjacent border and earns $2 per border anywhere', () => {
  const s = setup();
  put(s, 6, 'checkpoint');
  assert.ok(!performAction(JSON.parse(JSON.stringify(s)), 0, { type: 'buy', slot: 6, cell: key(1, 0) }).ok);
  // find a border position that leaves a free, buildable slot cell
  let slot = null;
  s.borderOpen[0] = 'forest';
  for (const cand of borderCandidates(s, 0)) {
    const t = JSON.parse(JSON.stringify(s));
    if (!performAction(t, 0, { type: 'border', idx: 0, c0: cand.c0, orient: cand.orient, discard: 5 }).ok) continue;
    t.market[6] = 'checkpoint';
    const k = cand.slots.find((x) => performAction(JSON.parse(JSON.stringify(t)), 0, { type: 'buy', slot: 6, cell: x }).ok);
    if (k) { assert.ok(performAction(s, 0, { type: 'border', idx: 0, c0: cand.c0, orient: cand.orient, discard: 5 }).ok); slot = k; break; }
  }
  assert.ok(slot, 'no free slot next to border');
  put(s, 6, 'checkpoint');
  const m0 = s.players[0].money;
  assert.ok(performAction(s, 0, { type: 'buy', slot: 6, cell: slot }).ok);
  assert.equal(s.players[0].money, m0 - 14 - 0 + 2); // cost 14 at $0 slot, +$2 for 1 border
  // opponent places a border → checkpoint owner +$2
  s.current = 1;
  const m1 = s.players[0].money;
  placeBorderNear(s, 1, 'forest', [key(0, 2)]);
  assert.equal(s.players[0].money, m1 + 2);
});

test('Desert cannot be placed when the $10 per adjacent building is unaffordable', () => {
  const s = setup();
  s.players[0].money = 8;
  s.borderOpen[0] = 'desert';
  const c = borderCandidates(s, 0).find((x) => x.slots.filter((k) => s.players[0].tiles[k]).length >= 1);
  const r = applyAction(s, s.players[0].id, { type: 'border', idx: 0, c0: c.c0, orient: c.orient, discard: 6 });
  assert.equal(r.ok, false);
  assert.match(r.error, /사막/);
  assert.equal(s.players[0].money, 8, 'state must be untouched');
});

test('Water Purification: pay $2 per industrial; owner pays when anyone builds industrial', () => {
  const s = setup();
  put(s, 6, 'waterpur');
  const m = s.players[0].money;
  assert.ok(performAction(s, 0, { type: 'buy', slot: 6, cell: key(1, 0) }).ok);
  // industrials: 2 factories + plant = 3 → $6
  assert.equal(s.players[0].money, m - 7 - 6);
  s.current = 1;
  const m0 = s.players[0].money;
  put(s, 6, 'farm');
  assert.ok(performAction(s, 1, { type: 'buy', slot: 6, cell: key(1, 0) }).ok);
  assert.equal(s.players[0].money, m0 - 2);
});

test('Redistricting Office: opponents -5 pop each, owner +5 per opponent; cost $6 × players', () => {
  const s = setup(3);
  s.players[1].pop = 3; s.players[2].pop = 10;
  put(s, 6, 'redistrict');
  const m = s.players[0].money;
  assert.ok(performAction(s, 0, { type: 'buy', slot: 6, cell: key(1, 0) }).ok);
  assert.equal(s.players[0].money, m - 18);
  assert.equal(s.players[1].pop, 0);
  assert.equal(s.players[2].pop, 5);
  assert.equal(s.players[0].pop, 2 + 10);
});

test('Cemetery needs 2 population', () => {
  const s = setup(); s.players[0].pop = 1;
  put(s, 6, 'cemetery');
  assert.ok(!performAction(s, 0, { type: 'buy', slot: 6, cell: key(1, 0) }).ok);
});

test('County Assessor: $2 per own building incl. itself', () => {
  const s = setup(); put(s, 6, 'assessor');
  const m = s.players[0].money;
  assert.ok(performAction(s, 0, { type: 'buy', slot: 6, cell: key(1, 0) }).ok);
  assert.equal(s.players[0].money, m - 11 + 2 * 4);
});

test('Redevelopment Planner: no effects; next turn swapped for a market tile for free', () => {
  const s = setup(); put(s, 6, 'planner');
  assert.ok(applyAction(s, s.players[0].id, { type: 'buy', slot: 6, cell: key(1, 0) }).ok);
  assert.ok(applyAction(s, s.players[1].id, { type: 'lake', slot: 6, cell: key(1, 0) }).ok);
  put(s, 6, 'mobile');
  const m = s.players[0].money; const pop = s.players[0].pop;
  const r = performAction(s, 0, { type: 'redevelop', cell: key(1, 0), slot: 6 });
  assert.ok(r.ok, r.error);
  assert.equal(s.players[0].tiles[key(1, 0)].id, 'mobile');
  assert.equal(s.players[0].money, m);
  assert.equal(s.players[0].pop, pop + 6);
  assert.ok(!performAction(JSON.parse(JSON.stringify(s)), 0, { type: 'invest', cell: key(1, 0), discard: 5 }).ok === false);
});

test('Law Office wins a tied goal', () => {
  const s = setup(); put(s, 6, 'law');
  assert.ok(performAction(s, 0, { type: 'buy', slot: 6, cell: key(1, 0) }).ok);
  s.publicGoals = ['aquatic', 'atc']; // both tied at 0 airports? atc: max airports, all 0 → tied
  s.players.forEach((p) => { p.privateGoal = 'spendthrift'; });
  s.endAfterTurn = s.turn; endTurn(s, 0, { deltas: [], removedSlot: null });
  const row = s.final.rows[0];
  assert.ok(row.goals.some((g) => g.law), 'law office should claim a tied goal');
  assert.ok(!s.final.rows[1].goals.some((g) => g.law));
});

test('Bonus pays income when the A stack runs out', () => {
  const s = setup();
  s.bonus = 'R'; // ≥3 residential → +4 income
  put(s, 6, 'mobile'); put(s, 5, 'hoa');
  s.players[0].income = 0; s.players[1].income = 0;
  assert.ok(performAction(s, 0, { type: 'buy', slot: 6, cell: key(1, 0) }).ok);
  s.players[0].tiles[key(-1, 1)] = { id: 'suburbs', order: 99 };
  s.stacks.A = [];
  const ctx = { deltas: [], removedSlot: 6, actor: 0 };
  endTurn(s, 0, ctx);
  assert.ok(s.bonusDone);
  assert.equal(s.players[0].income, 4);
  assert.equal(s.players[1].income, 0);
});

test('Lake border: $2 per adjacent building and counts as lake', () => {
  const s = setup();
  const m = s.players[0].money;
  const c = placeBorderNear(s, 0, 'forest', [key(0, 2)], true);
  const adj = c.slots.filter((k) => s.players[0].tiles[k]).length;
  assert.equal(s.players[0].money, m + 2 * adj);
  assert.equal(metrics(s.players[0]).lakes, 1);
  assert.equal(metrics(s.players[0]).borders, 0);
});

test('Investing in a border repeats its effects', () => {
  const s = setup();
  const c = placeBorderNear(s, 0, 'orchard', [key(0, 2)]);
  const inc0 = s.players[0].income;
  s.market = s.market.map((x) => x || 'conv');
  const r = performAction(s, 0, { type: 'invest', cell: c.cells[0], discard: 6 });
  assert.ok(r.ok, r.error);
  assert.ok(s.players[0].income > inc0);
  assert.ok(s.players[0].borders[0].inv);
});

console.log(`\n${passed} Inc tests passed`);
