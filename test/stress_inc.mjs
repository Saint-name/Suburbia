import { createGame, chooseGoal, applyAction, placementCells } from '../src/engine/engine.js';
import { chooseBotAction, chooseBotGoal } from '../src/engine/bots.js';
const N = Number(process.argv[2] || 60); let passes = 0; let minCells = 99; let borders = 0;
for (let g = 0; g < N; g++) {
  const n = 2 + (g % 3);
  const levels = Array.from({ length: n }, (_, i) => (g % 5 === 0 && i === 0 ? 'hard' : 'normal'));
  const s = createGame({ players: levels.map((lv, i) => ({ id: `p${i}`, name: lv + i, bot: lv })), seed: 7000 + g, expansions: { inc: true } });
  s.players.forEach((p, i) => chooseGoal(s, p.id, chooseBotGoal(s, i, p.bot)));
  let guard = 0;
  while (s.phase === 'play') {
    const pi = s.current; const p = s.players[pi];
    const a = chooseBotAction(s, pi, p.bot);
    if (a.type === 'pass') passes++;
    const r = applyAction(s, p.id, a);
    if (!r.ok) throw new Error(`game ${g}: illegal ${JSON.stringify(a)} ${r.error}`);
    minCells = Math.min(minCells, placementCells(s, pi).length);
    if (++guard > 500) throw new Error('no end');
  }
  borders += s.players.reduce((a, p) => a + p.borders.length, 0);
}
console.log(`${N} games ok · passes ${passes} · min free cells seen ${minCells} · borders ${borders}`);
