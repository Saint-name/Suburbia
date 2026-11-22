// node test/duel_expert.mjs <games> <players> <seedBase> [levelB=hard] [expansions=none|all]
// Seats alternate: the expert plays every seat position equally often.
import { createGame, chooseGoal, applyAction } from '../src/engine/engine.js';
import { chooseBotAction, chooseBotGoal, LEVEL_CFG } from '../src/engine/bots.js';

const N = Number(process.argv[2] || 10);
const np = Number(process.argv[3] || 2);
const base = Number(process.argv[4] || 9000);
const other = process.argv[5] || 'hard';
const ex = process.argv[6] === 'all' ? { inc: true, five: np <= 5, night: true, promo: true } : {};
if (process.env.BUDGET) LEVEL_CFG.expert.budgetMs = Number(process.env.BUDGET);
if (process.env.SAMPLES) Object.assign(LEVEL_CFG.expert, { budgetMs: 1e9, minSamples: Number(process.env.SAMPLES), maxSamples: Number(process.env.SAMPLES) });
if (process.env.CFG) Object.assign(LEVEL_CFG.expert, JSON.parse(process.env.CFG));
let win = 0; let tie = 0; let margin = 0; let illegal = 0;
for (let g = 0; g < N; g++) {
  const eSeat = g % np;
  const s = createGame({ players: Array.from({ length: np }, (_, i) => ({ id: `p${i}`, name: `p${i}`, bot: i === eSeat ? (process.env.BASELINE ? 'hard' : 'expert') : other })), seed: base + g, expansions: ex });
  s.players.forEach((p, i) => chooseGoal(s, p.id, chooseBotGoal(s, i, p.bot)));
  while (s.phase === 'play') {
    const p = s.players[s.current];
    const r = applyAction(s, p.id, chooseBotAction(s, s.current, p.bot));
    if (!r.ok) { illegal++; break; }
  }
  if (s.phase !== 'over') continue;
  const ei = s.players.findIndex((p) => p.id === `p${eSeat}`);
  const best = Math.max(...s.players.filter((_, i) => i !== ei).map((p) => p.pop));
  if (s.final.order[0] === ei) win++;
  if (s.players[ei].pop === best) tie++;
  margin += s.players[ei].pop - best;
}
console.log(JSON.stringify({ N, np, win, tie, margin, illegal }));
