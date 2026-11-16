import { createGame, chooseGoal, applyAction, viewFor } from '../src/engine/engine.js';
import { chooseBotAction, chooseBotGoal } from '../src/engine/bots.js';

function play(levels, seed) {
  const players = levels.map((lv, i) => ({ id: `p${i}`, name: `${lv}${i}`, bot: lv }));
  const s = createGame({ players, seed });
  s.players.forEach((p, i) => chooseGoal(s, p.id, chooseBotGoal(s, i, p.bot)));
  let guard = 0; let maxMs = 0;
  while (s.phase === 'play') {
    const pi = s.current; const p = s.players[pi];
    const t0 = performance.now();
    const a = chooseBotAction(s, pi, p.bot);
    maxMs = Math.max(maxMs, performance.now() - t0);
    const r = applyAction(s, p.id, a);
    if (!r.ok) throw new Error(`illegal bot action ${JSON.stringify(a)}: ${r.error}`);
    for (const q of s.players) {
      if (q.income < -5 || q.income > 15 || q.rep < -5 || q.rep > 15) throw new Error('track out of bounds');
      if (q.pop < 0) throw new Error('negative pop');
      if (q.money < 0) throw new Error(`negative money ${q.name} ${q.money} after ${JSON.stringify(a)}`);
    }
    if (s.market.filter(Boolean).length < 6 && s.phase === 'play' && s.endAfterTurn === null) throw new Error('market underfilled');
    if (s.market.filter(Boolean).length < 1 && s.phase === 'play') throw new Error('market empty');
    if (++guard > 400) throw new Error('game did not end');
  }
  JSON.stringify(viewFor(s, 'p0'));
  return { s, turns: s.turn + 1, maxMs };
}

const N = Number(process.argv[2] || 30);
const wins = {}; const pops = {}; let maxMs = 0; let turns = 0;
const configs = [['easy', 'normal', 'hard'], ['hard', 'easy', 'normal'], ['normal', 'hard', 'easy'], ['easy', 'hard'], ['hard', 'normal'], ['normal', 'easy', 'hard', 'easy']];
let games = 0;
for (let g = 0; g < N; g++) {
  const levels = configs[g % configs.length];
  const { s, maxMs: m, turns: t } = play(levels, 1000 + g);
  maxMs = Math.max(maxMs, m); turns += t; games++;
  const w = s.players[s.final.order[0]].bot;
  wins[w] = (wins[w] || 0) + 1;
  for (const p of s.players) { pops[p.bot] ??= []; pops[p.bot].push(p.pop); }
}
const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1);
console.log('games', games, 'avg turns', (turns / games).toFixed(1), 'max bot ms', maxMs.toFixed(0));
console.log('wins', wins);
for (const k of Object.keys(pops)) console.log(k, 'avg final pop', avg(pops[k]), 'min', Math.min(...pops[k]), 'max', Math.max(...pops[k]));
