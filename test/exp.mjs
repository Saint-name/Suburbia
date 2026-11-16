import assert from 'node:assert/strict';
import { createGame, chooseGoal, applyAction, performAction, key, moveStar, endTurn, metrics } from '../src/engine/engine.js';

function setup(n = 3, expansions = { five: true, night: true, promo: true, inc: true }) {
  const s = createGame({ players: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` })), seed: 21, expansions });
  s.players.forEach((p) => chooseGoal(s, p.id, p.goalOptions[0]));
  s.players.forEach((p) => { p.money = 300; });
  return s;
}
const put = (s, slot, id) => { s.market = s.market.map((x) => x || 'conv'); s.market[slot] = id; };
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('✓', name); };

test('5 players: 8-slot market, 5 of each basic, 5 public goals', () => {
  const s = setup(5);
  assert.equal(s.market.length, 8);
  assert.deepEqual(s.marketCosts, [10, 8, 6, 4, 2, 0, 0, 0]);
  assert.equal(s.basics.suburbs, 5);
  assert.equal(s.publicGoals.length, 5);
  assert.throws(() => createGame({ players: Array.from({ length: 5 }, (_, i) => ({ id: `x${i}`, name: 'x' })) }));
});

test('Star tile moves the star token; crossing 3 gives income, 7 gives rep', () => {
  const s = setup();
  put(s, 6, 'ludwig'); // 3 stars
  const inc = s.players[0].income;
  assert.ok(performAction(s, 0, { type: 'buy', slot: 6, cell: key(1, 0) }).ok);
  assert.equal(s.players[0].starPos, 3);
  assert.equal(s.players[0].income, inc);
  moveStar(s, { deltas: [] }, 0, 1);
  assert.equal(s.players[0].starPos, 4);
  assert.equal(s.players[0].income, inc + 1);
  const rep = s.players[0].rep;
  moveStar(s, { deltas: [] }, 0, 4);
  assert.equal(s.players[0].starPos, 8);
  assert.equal(s.players[0].rep, rep + 1);
});

test('Star Track caps: rightmost space holds one token', () => {
  const s = setup();
  moveStar(s, { deltas: [] }, 0, 20);
  assert.equal(s.players[0].starPos, 12);
  moveStar(s, { deltas: [] }, 1, 20);
  assert.equal(s.players[1].starPos, 11);
});

test('Round end: most stars +1 pop, fewest -1 pop, turn order by Star Track', () => {
  const s = setup();
  s.players[2].starPos = 5; s.players[1].starPos = 2;
  const pops = s.players.map((p) => p.pop);
  for (let i = 0; i < 3; i++) {
    const pi = s.current;
    put(s, 6, 'conv');
    assert.ok(applyAction(s, s.players[pi].id, { type: 'lake', slot: 6, cell: key(-1, 1) }).ok);
  }
  assert.deepEqual(s.order, [2, 1, 0]);
  assert.equal(s.current, 2);
  assert.ok(s.players[2].pop >= pops[2] + 1);
});

test('Tourism Center: +1 star per adjacent Star tile, also later', () => {
  const s = setup();
  put(s, 6, 'tinyhouse');
  performAction(s, 0, { type: 'buy', slot: 6, cell: key(1, 0) });
  const pos = s.players[0].starPos;
  put(s, 6, 'tourismcenter');
  assert.ok(performAction(s, 0, { type: 'buy', slot: 6, cell: key(1, 1) }).ok);
  assert.equal(s.players[0].starPos, pos + 1 + 1); // own star + 1 adjacent star tile
});

test('Nightlife: Werewolf Den loses pop per own nightlife; Police makes owner immune; Night Court refunds', () => {
  const s = setup();
  s.players[0].pop = 20;
  put(s, 6, 'werewolf');
  performAction(s, 0, { type: 'buy', slot: 6, cell: key(1, 0) });
  assert.equal(s.players[0].pop, 19);
  assert.equal(s.players[0].nightDebt.pop, 1);
  put(s, 6, 'nightcourt');
  assert.ok(performAction(s, 0, { type: 'buy', slot: 6, cell: key(-1, 1) }).ok);
  assert.equal(s.players[0].pop, 20); // refunded
  assert.ok(s.players[0].nightImmune);
  put(s, 6, 'hauntedhouse');
  performAction(s, 0, { type: 'buy', slot: 6, cell: key(1, 1) });
  assert.equal(s.players[0].pop, 20 + 13); // its -1 per own nightlife is ignored
});

test('Essen tiles: maximum one of each per borough', () => {
  const s = setup();
  put(s, 6, 'grugapark');
  assert.ok(performAction(s, 0, { type: 'buy', slot: 6, cell: key(1, 0) }).ok);
  put(s, 6, 'grugapark');
  assert.ok(!performAction(s, 0, { type: 'buy', slot: 6, cell: key(-1, 1) }).ok);
});

test('Lookout Canal needs a lake and earns income per adjacent lake (also later lakes)', () => {
  const s = setup();
  put(s, 6, 'lookout');
  assert.ok(!performAction(JSON.parse(JSON.stringify(s)), 0, { type: 'buy', slot: 6, cell: key(1, 0) }).ok);
  put(s, 5, 'conv');
  assert.ok(performAction(s, 0, { type: 'lake', slot: 5, cell: key(1, 0) }).ok);
  const inc = s.players[0].income;
  put(s, 6, 'lookout');
  assert.ok(performAction(s, 0, { type: 'buy', slot: 6, cell: key(1, 1) }).ok);
  assert.equal(s.players[0].income, inc + 1 + 1);
  put(s, 5, 'conv');
  assert.ok(performAction(s, 0, { type: 'lake', slot: 5, cell: key(2, 1) }).ok);
  assert.equal(s.players[0].income, inc + 3);
});

test('Dollar Arcade: $1 per population', () => {
  const s = setup(); s.players[0].pop = 17;
  put(s, 6, 'dollararcade');
  const m = s.players[0].money;
  assert.ok(performAction(s, 0, { type: 'buy', slot: 6, cell: key(1, 0) }).ok);
  assert.equal(s.players[0].money, m - 10 + 17);
});

test('Goal ties are won by the higher Star Track position', () => {
  const s = setup(2, { five: true });
  s.publicGoals = ['atc']; // all 0 airports → tie
  s.players.forEach((p) => { p.privateGoal = 'spendthrift'; p.money = 10; });
  s.players[1].starPos = 3;
  s.endAfterTurn = s.turn; endTurn(s, s.current, { deltas: [], removedSlot: null });
  assert.ok(s.final.rows[1].goals.some((g) => g.id === 'atc'));
  assert.ok(!s.final.rows[0].goals.some((g) => g.id === 'atc'));
});

test('Expansion tiles only appear when enabled', () => {
  const s = createGame({ players: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }], seed: 5, expansions: { night: true } });
  const all = [...s.market, ...s.stacks.A, ...s.stacks.B, ...s.stacks.C];
  assert.ok(!all.some((id) => ['ludwig', 'dicetower', 'cemetery'].includes(id)));
  assert.ok(metrics(s.players[0]).nightTiles === 0);
});

console.log(`\n${passed} expansion tests passed`);
