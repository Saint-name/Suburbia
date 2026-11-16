// node test/duel.mjs <games> '<json cfg A>' '<json cfg B>' [players]
import { createGame, chooseGoal, applyAction } from '../src/engine/engine.js';
import { chooseBotAction, chooseBotGoal, LEVEL_CFG } from '../src/engine/bots.js';

const N = Number(process.argv[2] || 40);
LEVEL_CFG.A = { ...LEVEL_CFG.normal, ...JSON.parse(process.argv[3] || '{}') };
LEVEL_CFG.B = { ...LEVEL_CFG.normal, ...JSON.parse(process.argv[4] || '{}') };
const np = Number(process.argv[5] || 2);
let winA = 0; let diff = 0; let popA = 0; let popB = 0; let cA = 0; let cB = 0;
for (let g = 0; g < N; g++) {
  const levels = Array.from({ length: np }, (_, i) => ((i + g) % 2 === 0 ? 'A' : 'B'));
  const s = createGame({ players: levels.map((lv, i) => ({ id: `p${i}`, name: lv, bot: lv })), seed: 5000 + g });
  s.players.forEach((p, i) => chooseGoal(s, p.id, chooseBotGoal(s, i, 'normal')));
  while (s.phase === 'play') {
    const p = s.players[s.current];
    applyAction(s, p.id, chooseBotAction(s, s.current, p.bot));
  }
  if (s.players[s.final.order[0]].bot === 'A') winA++;
  for (const p of s.players) { if (p.bot === 'A') { popA += p.pop; cA++; } else { popB += p.pop; cB++; } }
}
console.log(`A wins ${winA}/${N}  avgA ${(popA / cA).toFixed(1)} avgB ${(popB / cB).toFixed(1)}`);
