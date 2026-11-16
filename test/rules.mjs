import assert from 'node:assert/strict';
import { createGame, chooseGoal, applyAction, performAction, key, placementCells } from '../src/engine/engine.js';

function setup(n = 4) {
  const s = createGame({ players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` })), seed: 7 });
  s.players.forEach((p) => chooseGoal(s, p.id, p.goalOptions[0]));
  return s;
}
const put = (s, slot, id) => { s.market[slot] = id; };
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('✓', name); };

test('start state', () => {
  const s = setup();
  for (const p of s.players) { assert.equal(p.money, 15); assert.equal(p.income, 0); assert.equal(p.rep, 1); assert.equal(p.pop, 2); }
  assert.equal(s.market.length, 7);
  assert.equal(s.stacks.A.length, 21 - 7);
});

test('HOA on first turn in 4p gives $10 (5 residentials incl. itself)', () => {
  const s = setup(); put(s, 5, 'hoa'); s.players[0].money = 20;
  const r = performAction(s, 0, { type: 'buy', slot: 5, cell: key(1, 0) });
  assert.ok(r.ok, r.error);
  assert.equal(s.players[0].money, 20 - 5 + 10);
  assert.equal(s.players[0].pop, 3);
});

test('Community Park adjacency (+1 rep for adjacent R/C/I)', () => {
  const s = setup(); put(s, 6, 'conv');
  // (1,0) is adjacent to (0,0) suburbs and (0,1) park
  performAction(s, 0, { type: 'buy', slot: 6, cell: key(1, 0) });
  assert.equal(s.players[0].rep, 2); // park reacts to commercial
  assert.equal(s.players[0].income, 1);
});

test('Fancy restaurant penalty + farm bonus across boroughs', () => {
  const s = setup(2); s.players.forEach((p) => { p.money = 100; });
  put(s, 6, 'farm'); applyAction(s, s.players[0].id, { type: 'buy', slot: 6, cell: key(-1, 3) });
  put(s, 6, 'fancy'); const inc1 = s.players[1].income;
  applyAction(s, s.players[1].id, { type: 'buy', slot: 6, cell: key(-1, 3) });
  assert.equal(s.players[1].income - inc1, 3);
  const p0inc = s.players[0].income; const p1inc = s.players[1].income;
  put(s, 6, 'fastfood');
  assert.ok(performAction(s, 0, { type: 'buy', slot: 6, cell: key(1, 2) }).ok);
  assert.equal(s.players[0].income - p0inc, 1 + 1); // own +1 and farm +1
  assert.equal(s.players[1].income - p1inc, -1); // fancy penalty
});

test('Lake: $2 per adjacent building, then $2 per later adjacent building', () => {
  const s = setup(); s.players[0].money = 0;
  put(s, 6, 'conv');
  performAction(s, 0, { type: 'lake', slot: 6, cell: key(1, 0) }); // adj to (0,0),(0,1)
  assert.equal(s.players[0].money, 4);
  s.players[0].money = 10; s.current = 0;
  put(s, 6, 'conv');
  performAction(s, 0, { type: 'buy', slot: 6, cell: key(2, -1) }); // adj to lake (1,0)
  assert.equal(s.players[0].money, 10 - 6 + 2);
});

test('Investment doubles immediate and conditional', () => {
  const s = setup(); s.players[0].money = 50;
  put(s, 6, 'conv'); performAction(s, 0, { type: 'buy', slot: 6, cell: key(1, 0) });
  const inc = s.players[0].income; const m = s.players[0].money;
  put(s, 6, 'mobile');
  const r = performAction(s, 0, { type: 'invest', cell: key(1, 0), discard: 6 });
  assert.ok(r.ok, r.error);
  assert.equal(s.players[0].income, inc + 1);
  assert.equal(s.players[0].money, m - 6);
  assert.equal(s.players[0].investLeft, 2);
});

test('Red line: crossing 15 lowers income and reputation', () => {
  const s = setup(); const p = s.players[0]; p.pop = 13; p.rep = 3; p.income = 2;
  put(s, 6, 'conv'); s.players[0].money = 50;
  applyAction(s, p.id, { type: 'lake', slot: 6, cell: key(-1, 3) });
  // income 2 -> collect, rep 3 -> pop 16 crosses 15 -> income 1, rep 2
  assert.equal(p.pop, 16); assert.equal(p.income, 1); assert.equal(p.rep, 2);
});

test('Board blocks placement above the start column', () => {
  const s = setup();
  const cells = placementCells(s, 0);
  assert.ok(!cells.includes(key(0, -1)));
  assert.ok(!cells.includes(key(1, -1)));
  assert.ok(cells.includes(key(1, 0)) && cells.includes(key(-1, 1)));
});

test('Game ends with equal turns for all players', () => {
  for (const n of [2, 3, 4]) {
    const s = setup(n);
    s.players.forEach((p) => { p.money = 999; });
    while (s.phase === 'play') {
      const pi = s.current;
      const cells = placementCells(s, pi);
      const slot = s.market.findIndex(Boolean);
      applyAction(s, s.players[pi].id, { type: 'lake', slot, cell: cells[0] });
    }
    assert.equal((s.turn + 1) % n, 0, `turns ${s.turn + 1} not multiple of ${n}`);
    assert.ok(s.final);
  }
});

test('Bots ignore hidden info (stack order, opponents\' secret goals)', async () => {});
{
  const { chooseBotAction, seedBotRng } = await import('../src/engine/bots.js');
  for (const level of ['easy', 'normal', 'hard']) {
    for (let seed = 1; seed <= 4; seed++) {
      const a = createGame({ players: [0, 1, 2].map((i) => ({ id: `p${i}`, name: `P${i}` })), seed });
      a.players.forEach((p) => chooseGoal(a, p.id, p.goalOptions[0]));
      const b = JSON.parse(JSON.stringify(a));
      b.stacks.A.reverse(); b.stacks.B.reverse(); b.stacks.C.reverse();
      b.players.forEach((p, i) => { if (i !== 0) p.privateGoal = p.goalOptions[1]; });
      seedBotRng(99); const x = chooseBotAction(a, 0, level); seedBotRng(99); const y = chooseBotAction(b, 0, level);
      assert.deepEqual(x, y, `${level} seed ${seed}`);
    }
  }
  console.log('✓ bots decide identically when hidden info differs');
}
console.log(`\n${passed} rule tests passed`);
