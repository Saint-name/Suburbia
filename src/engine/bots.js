// Bots: easy / normal / hard / expert
import {
  placementCells, performAction, clone, tileCostAt, estimateTurnsLeft, redLinesBetween,
  goalLeaders, neighborsOf, endTurn, borderCandidates, costOf, borderAt, openSpace, mc,
} from './engine.js';
import { TILE_BY_ID, BASIC_IDS, MARKET_COSTS, GOAL_BY_ID, BORDER_BY_ID } from './tiles.js';

export const BOT_LEVELS = { easy: '쉬움', normal: '보통', hard: '어려움', expert: '매우 어려움' };
const BOT_NAMES = ['데일', '로봇 김', '알파 시장', '오토 박', '비트 리', '헥사', '심시티', '타일봇'];
export const botName = (i, level) => `${BOT_NAMES[i % BOT_NAMES.length]} (${BOT_LEVELS[level]})`;

// tiny local rng so bots don't consume the game rng
let seedR = 12345;
export const seedBotRng = (n) => { seedR = n; };
const rnd = () => { seedR = (seedR * 1103515245 + 12345) & 0x7fffffff; return seedR / 0x7fffffff; };

export function chooseBotGoal(s, pi, level) {
  const p = s.players[pi];
  const [a, b] = p.goalOptions;
  if (level === 'easy') return rnd() < 0.5 ? a : b;
  const pref = (id) => {
    const g = GOAL_BY_ID[id];
    // goals a bot can steer reliably get a bonus
    const steer = { builder: 4, industrialist: 4, civil: 4, developer: 3, aquatic: 2, investor: 3, luminary: 3,
      official: 2, harbormaster: 1, atc: 1, billionaire: 1, employer: 2, aquaphobe: 3, environmentalist: 2,
      libertarian: 1, socialist: 1, capitalist: 0, miser: -3, miscreant: -3, spendthrift: 0 }[id] ?? 0;
    return g.bonus + steer;
  };
  return pref(a) >= pref(b) ? a : b;
}

// ───────────── projection of a player's final score ─────────────
function redlineBonuses(p) {
  let inc = 0; let rep = 0;
  for (const r of Object.values(p.tiles)) {
    if (r.lake) continue;
    const m = r.inv ? 2 : 1;
    if (r.id === 'casino') inc += m;
    if (r.id === 'pr') rep += m;
  }
  return { inc, rep };
}

export function projectPlayer(p, turns, moneyW) {
  let { money, income, rep, pop } = p;
  const rb = redlineBonuses(p);
  for (let t = 0; t < turns; t++) {
    money += income;
    if (money < 0) { pop = Math.max(0, pop + money); money = 0; }
    const old = pop;
    pop = Math.max(0, pop + rep);
    const up = redLinesBetween(old, pop);
    const down = redLinesBetween(pop, old);
    income = Math.max(-5, Math.min(15, income - up + up * rb.inc + down));
    rep = Math.max(-5, Math.min(15, rep - up + up * rb.rep + down));
  }
  return pop + money * moneyW;
}

function goalValue(s, pi, progress, full) {
  const w = 0.25 + 0.65 * progress;
  let v = 0;
  const ids = full ? [...s.publicGoals] : [];
  const priv = s.players[pi].privateGoal;
  for (const gid of ids) {
    const L = goalLeaders(s, gid);
    const b = GOAL_BY_ID[gid].bonus * w;
    if (L.unique === pi) v += b;
    else if (L.who.includes(pi)) v += b * 0.25;
    else if (L.unique !== null) v -= b * 0.35; // an opponent holds it alone
  }
  if (priv && priv !== 'hidden') {
    const L = goalLeaders(s, priv);
    const b = GOAL_BY_ID[priv].bonus * w * (full ? 1 : 0.6);
    if (L.unique === pi) v += b;
    else if (L.who.includes(pi)) v += b * 0.3;
  }
  return v;
}

export const LEVEL_CFG = {
  easy: { greedy: true, noise: 6, invest: false, goals: 0, full: false, oppW: 0, mw0: 0.2, mw1: 0.25, deny: false },
  normal: { noise: 2.5, invest: true, goals: 0.6, full: false, oppW: 0, mw0: 0.2, mw1: 0.25, deny: false },
  hard: { noise: 0, invest: true, goals: 1, full: true, oppW: 0.15, mw0: 0.2, mw1: 0.25, deny: true, future: 1, lookahead: 6 },
  // expert = hard's judgement + Monte-Carlo look-ahead over invented hidden worlds
  expert: { noise: 0, invest: true, goals: 1, full: true, oppW: 0.15, mw0: 0.2, mw1: 0.25, deny: true, future: 1,
    shortlist: 8, minSamples: 2, maxSamples: 40, budgetMs: 1500, playoutT: 3 },
  // how the expert imagines its rivals' replies inside a simulation
  normalSim: { noise: 0, invest: true, goals: 0.8, full: true, oppW: 0, mw0: 0.2, mw1: 0.25, deny: false, future: 1 },
};
const cfgOf = (level) => LEVEL_CFG[level] || LEVEL_CFG.normal;

// Fraction of upcoming tiles (public manifest of the letters still in play) matching a condition.
const LETTER_POOL = {};
for (const tl of Object.values(TILE_BY_ID)) if (tl.stack !== 'basic') (LETTER_POOL[tl.stack] ??= []).push(...Array(tl.count).fill(tl));
function upcomingPool(s) {
  const counts = s.stackCounts || { A: s.stacks.A.length, B: s.stacks.B.length, C: s.stacks.C.length };
  const pool = [];
  for (const L of ['A', 'B', 'C']) {
    if (counts[L] <= 0) continue;
    const list = LETTER_POOL[L].filter((tl) => !tl.exp || s.exp?.[tl.exp]);
    pool.push(...list.map((tl) => [tl, counts[L] / list.length]));
  }
  return pool;
}
function fracMatching(pool, cn) {
  let tot = 0; let hit = 0;
  for (const [tl, w] of pool) {
    tot += w;
    if (cn.icon ? tl.icon === cn.icon : cn.types?.includes(tl.type)) hit += w;
  }
  // basic tiles also get placed regularly (≈ 25% of placements)
  const basicHit = cn.types ? cn.types.filter((x) => ['R', 'V', 'I'].includes(x)).length / 3 : 0;
  return tot ? 0.75 * (hit / tot) + 0.25 * basicHit : 0;
}
function freeNeighbors(tiles, k) { return neighborsOf(k).filter((nk) => !tiles[nk]).length; }

// Expected value of effects that will trigger on future placements (hard bot only)
function futureValue(s, pi, T, moneyW, pool) {
  const n = s.players.length;
  const p = s.players[pi];
  let v = 0;
  const later = Math.max(0, T - 1);
  const resVal = (res, amt) => {
    if (res === 'income') return amt * (later / 2) * moneyW;
    if (res === 'rep') return amt * (later / 2) * 0.9;
    if (res === 'pop') return amt;
    if (res === 'money') return amt * moneyW;
    return 0;
  };
  for (const [k, r] of Object.entries(p.tiles)) {
    if (r.lake) { v += Math.min(freeNeighbors(p.tiles, k), later) * 0.35 * 2 * (r.inv ? 2 : 1) * moneyW; continue; }
    const tl = TILE_BY_ID[r.id];
    for (const cn of tl.cond) {
      const m = r.inv ? 2 : 1;
      if (cn.special === 'redline' || cn.special === 'waterfront') continue;
      const f = fracMatching(pool, cn);
      let E;
      if (cn.special === 'afterThis' || cn.scope === 'all') E = later * n * f;
      else if (cn.scope === 'others') E = later * (n - 1) * f;
      else if (cn.scope === 'own') E = later * f;
      else E = Math.min(freeNeighbors(p.tiles, k), later) * f * 0.5;
      v += resVal(cn.res, cn.amt * m * E) * 0.6;
    }
  }
  return v;
}

function evaluate(s, pi, level, T, progress, pool) {
  const cf = cfgOf(level);
  const moneyW = cf.mw0 + cf.mw1 * Math.min(1, (T - 1) / 10);
  let v = projectPlayer(s.players[pi], T, moneyW);
  if (cf.future) v += cf.future * futureValue(s, pi, T, moneyW, pool || upcomingPool(s));
  // 5★: Star Track position → turn order, +1/-1 population each round, goal tie-breaks
  if (s.exp?.five) {
    const me = s.players[pi];
    const rivals = s.players.filter((q, i) => i !== pi).map((q) => q.starPos);
    const lead = me.starPos - Math.max(...rivals);
    const last = me.starPos - Math.min(...rivals);
    const rounds = Math.max(0, T - 1);
    v += (lead > 0 ? 1 : lead === 0 ? 0.4 : 0) * rounds * 0.8 - (last < 0 ? 1 : 0) * rounds * 0.8 + me.starPos * 0.3;
  }
  // keep room to build: borders can wall a borough in
  if (s.players[pi].borders?.length && T > 2) {
    const room = openSpace(s.players[pi]);
    if (room < 14) v -= (14 - room) * 1.2 * Math.min(1, T / 5);
  }
  if (cf.goals) v += cf.goals * goalValue(s, pi, progress, cf.full);
  if (cf.oppW) {
    let best = -Infinity;
    s.players.forEach((p, i) => { if (i !== pi) best = Math.max(best, projectPlayer(p, T, moneyW)); });
    v -= cf.oppW * best;
  }
  return v;
}

// ───────────── candidate generation ─────────────
function cheapestDiscards(s, budget, k) {
  const slots = [];
  for (let i = 0; i < s.market.length; i++) if (s.market[i] && mc(s)[i] <= budget) slots.push(i);
  return slots.sort((a, b) => mc(s)[a] - mc(s)[b] || b - a).slice(0, k);
}

function candidates(s, pi, level) {
  const p = s.players[pi];
  const cells = placementCells(s, pi);
  const out = [];
  for (let slot = 0; slot < s.market.length; slot++) {
    if (!s.market[slot]) continue;
    const cost = tileCostAt(s, slot);
    if (p.money >= cost) for (const cell of cells) out.push({ type: 'buy', slot, cell });
    if (!cfgOf(level).greedy || p.money < 4) {
      if (p.money >= mc(s)[slot]) {
        for (const cell of cells) {
          const adj = neighborsOf(cell).filter((k) => p.tiles[k] && !p.tiles[k].lake).length;
          if (adj >= 2 || cfgOf(level).greedy) out.push({ type: 'lake', slot, cell });
        }
      }
    }
  }
  const disc = cheapestDiscards(s, Infinity, 1)[0];
  for (const kind of BASIC_IDS) {
    if (s.basics[kind] <= 0 || disc === undefined) continue;
    if (p.money < TILE_BY_ID[kind].cost + mc(s)[disc]) continue;
    for (const cell of cells) out.push({ type: 'basic', kind, cell, discard: disc });
  }
  if (cfgOf(level).invest && p.investLeft > 0 && disc !== undefined) {
    for (const [cell, r] of Object.entries(p.tiles)) {
      if (r.inv || (!r.lake && TILE_BY_ID[r.id].noInvest)) continue;
      const cost = r.lake ? 0 : costOf(s, r.id);
      if (p.money >= cost + mc(s)[disc]) out.push({ type: 'invest', cell, discard: disc });
    }
    for (const b of p.borders || []) {
      if (b.inv) continue;
      const cost = b.lake ? 0 : BORDER_BY_ID[b.id].cost;
      if (p.money >= cost + mc(s)[disc]) out.push({ type: 'invest', cell: b.cells[0], discard: disc });
    }
  }
  // Suburbia Inc. borders: keep only the most promising positions of each open border
  if (s.exp?.inc && disc !== undefined && !cfgOf(level).greedy) {
    const resW = { income: 3, rep: 3, pop: 1, money: 0.3 };
    s.borderOpen.forEach((id, idx) => {
      if (!id) return; // unknown (hidden) border during look-ahead
      const def = BORDER_BY_ID[id];
      if (p.money >= def.cost + mc(s)[disc]) {
        const scored = borderCandidates(s, pi, false).map((c) => {
          let v = 0;
          for (const cn of def.cond) {
            const n = c.slots.filter((k) => { const r = p.tiles[k]; return r && (r.lake ? cn.lake : cn.types.includes(TILE_BY_ID[r.id].type)); }).length;
            const free = c.slots.filter((k) => !p.tiles[k] && !borderAt(p, k)).length;
            v += cn.amt * resW[cn.res] * (n + (cn.amt > 0 ? 0.3 : 0.6) * free);
          }
          return [v, c];
        }).sort((x, y) => y[0] - x[0]).slice(0, 3);
        for (const [, c] of scored) out.push({ type: 'border', idx, c0: c.c0, orient: c.orient, lake: false, discard: disc });
      }
      if (p.money >= mc(s)[disc]) {
        const lakes = borderCandidates(s, pi, true).map((c) => [c.slots.filter((k) => p.tiles[k] && !p.tiles[k].lake).length, c])
          .sort((x, y) => y[0] - x[0]).slice(0, 1);
        for (const [n, c] of lakes) if (n >= 2) out.push({ type: 'border', idx, c0: c.c0, orient: c.orient, lake: true, discard: disc });
      }
    });
  }
  return out;
}

// Which tile to remove from the market when forced to discard (hard: deny next player)
function bestDiscard(s, pi, level, a) {
  const p = s.players[pi];
  let spend = 0;
  if (a.type === 'basic') spend = TILE_BY_ID[a.kind].cost;
  else if (a.type === 'border') spend = a.lake ? 0 : BORDER_BY_ID[s.borderOpen[a.idx]].cost;
  else if (a.type === 'invest') {
    const r = p.tiles[a.cell] || borderAt(p, a.cell);
    spend = r.lake ? 0 : r.border ? BORDER_BY_ID[r.id].cost : costOf(s, r.id);
  }
  const options = cheapestDiscards(s, p.money - spend, cfgOf(level).deny ? 3 : 1);
  if (!cfgOf(level).deny || options.length <= 1) return options[0] ?? a.discard;
  const n = s.players.length;
  const nx = (pi + 1) % n;
  const T = estimateTurnsLeft(s);
  let best = options[0]; let bestHarm = -Infinity;
  for (const slot of options) {
    // how good is this tile for the next player at its own cheapest position?
    const c = clone(s); c.current = nx;
    const base = evaluate(c, nx, 'normal', T, 0.5);
    let gain = -Infinity;
    for (const cell of placementCells(c, nx)) {
      const c2 = clone(c);
      const cost = TILE_BY_ID[c2.market[slot]].cost; // value it at face cost
      if (c2.players[nx].money < cost) break;
      c2.market[slot] = c2.market[slot];
      const r = performAction(c2, nx, { type: 'buy', slot, cell });
      if (!r.ok) continue;
      gain = Math.max(gain, evaluate(c2, nx, 'normal', T, 0.5) - base);
    }
    const harm = gain + (mc(s)[slot] === 0 ? 0.5 : -mc(s)[slot] * 0.2);
    if (harm > bestHarm) { bestHarm = harm; best = slot; }
  }
  return best;
}

function scoreCandidates(s, pi, level, T, progress, pool, cands) {
  const noise = cfgOf(level).noise;
  const out = [];
  for (const a of cands) {
    const c = clone(s);
    const r = performAction(c, pi, a);
    if (!r.ok) continue;
    let v;
    if (cfgOf(level).greedy) {
      // one-step greedy: what changed right now, with a short horizon
      const p = c.players[pi];
      const before = s.players[pi];
      const h = Math.min(T, 6);
      v = (p.income - before.income) * h * 0.8 + (p.rep - before.rep) * h * 0.8
        + (p.pop - before.pop) + (p.money - before.money) * 0.25;
    } else {
      v = evaluate(c, pi, level, T, progress, pool);
    }
    v += (rnd() - 0.5) * 2 * noise;
    out.push({ a, v, c, ctx: r.ctx });
  }
  return out.sort((x, y) => y.v - x.v);
}

// Value of my best follow-up next turn (market without unknown refill)
function followUpValue(entry, pi, level, T, progress, pool) {
  const c = entry.c;
  c.stacks = { A: [], B: [], C: [] }; // never peek at hidden tiles
  c.endAfterTurn = null;
  endTurn(c, pi, entry.ctx);
  c.market = c.market.map((x) => x); // left slot is now empty
  c.current = pi; c.phase = 'play';
  const T2 = Math.max(1, T - 1);
  const cands = candidates(c, pi, level);
  let best = -Infinity;
  for (const a of cands) {
    const c2 = clone(c);
    if (!performAction(c2, pi, a).ok) continue;
    best = Math.max(best, evaluate(c2, pi, level, T2, progress, pool));
  }
  return best;
}

// What a human in seat pi could know: other players' secret goals and the order of
// the tile stacks are removed (only stack sizes stay, as on the table).
export function botView(s, pi) {
  const v = clone(s);
  v.players.forEach((p, i) => { if (i !== pi) { p.privateGoal = null; p.goalOptions = []; } });
  v.stacks = { A: Array(s.stacks.A.length).fill(null), B: Array(s.stacks.B.length).fill(null), C: Array(s.stacks.C.length).fill(null) };
  v.rng = 0; v.seed = 0; v.log = []; v.lastAction = null; // (log is not needed and makes clones slow)
  if (v.borderDeck) v.borderDeck = v.borderDeck.map(() => null);
  return v;
}

// ───────────── expert: determinized Monte-Carlo look-ahead ─────────────
// The expert never sees hidden information. For every sample it invents one possible
// hidden world that is consistent with what is on the table (unseen tiles shuffled into
// the stacks, "1 More Round" somewhere in its possible window, unknown borders, a
// plausible secret goal for each rival), plays the candidate move, lets every rival
// answer with a sensible policy, plays its own best follow-up, and scores the result.
// The move with the best average over all invented worlds wins.
const MORE_ROUND_ID = '1MR';
function sampleRng(seed) {
  let x = (seed >>> 0) || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}
function shuffleWith(r, arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
function determinize(v, pi, r) {
  const d = clone(v);
  const seen = {};
  const see = (id) => { if (id) seen[id] = (seen[id] || 0) + 1; };
  d.market.forEach(see);
  for (const p of d.players) for (const t of Object.values(p.tiles)) see(t.id);
  const n = d.players.length;
  for (const L of ['A', 'B', 'C']) {
    const len = d.stacks[L].length;
    const hasMR = L === 'C' && !d.moreRoundRevealed && len > 0;
    const need = len - (hasMR ? 1 : 0);
    const pool = [];
    const left = { ...seen };
    for (const tl of Object.values(TILE_BY_ID)) {
      if (tl.stack !== L || (tl.exp && !d.exp?.[tl.exp])) continue;
      for (let i = 0; i < tl.count; i++) { if (left[tl.id] > 0) left[tl.id]--; else pool.push(tl.id); }
    }
    shuffleWith(r, pool);
    const stack = pool.slice(0, need);
    while (stack.length < need) stack.push(pool[stack.length % Math.max(1, pool.length)] || 'suburbs');
    if (hasMR) {
      const mixN = { 2: 6, 3: 9, 4: 12, 5: 15 }[n] || 9;
      const hi = Math.max(0, len - 5);
      const lo = Math.max(0, Math.min(hi, len - 4 - (mixN + 1)));
      stack.splice(lo + Math.floor(r() * (hi - lo + 1)), 0, MORE_ROUND_ID);
    }
    d.stacks[L] = stack;
  }
  if (d.borderDeck?.length) {
    const used = new Set([...(d.borderOpen || []), ...d.players.flatMap((p) => (p.borders || []).map((b) => b.id))]);
    const free = shuffleWith(r, Object.values(BORDER_BY_ID)
      .filter((b) => (!b.exp || d.exp?.[b.exp]) && !used.has(b.id)).map((b) => b.id));
    d.borderDeck = d.borderDeck.map((_, i) => free[i] ?? null).filter(Boolean);
  }
  const mine = new Set([...(d.players[pi].goalOptions || []), d.players[pi].privateGoal]);
  const goalPool = shuffleWith(r, Object.values(GOAL_BY_ID)
    .filter((g) => (!g.exp || d.exp?.[g.exp]) && !d.publicGoals.includes(g.id) && !mine.has(g.id)).map((g) => g.id));
  d.players.forEach((p, i) => { if (i !== pi) p.privateGoal = goalPool.pop() || null; });
  d.rng = Math.floor(r() * 0x7fffffff) + 1;
  return d;
}

// Candidate list limited to the most connected free cells and one position per border.
function trimmedCandidates(c, i, level, nCells) {
  const p = c.players[i];
  const cells = placementCells(c, i)
    .map((k) => [neighborsOf(k).filter((nk) => p.tiles[nk]).length, k])
    .sort((a, b) => b[0] - a[0]).slice(0, nCells).map((x) => x[1]);
  const keep = new Set(cells);
  const borderSeen = new Set();
  return candidates(c, i, level).filter((a) => {
    if (a.type === 'invest') return true;
    if (a.type === 'border') { const k = `${a.idx}${a.lake}`; if (borderSeen.has(k)) return false; borderSeen.add(k); return true; }
    return keep.has(a.cell);
  });
}

// Quick but sensible move for the simulated turns (best of a trimmed candidate list).
function rolloutMove(c, i, level, pool) {
  const T = estimateTurnsLeft(c);
  const total = { 2: 22, 3: 20, 4: 19, 5: 18 }[c.players.length] || 20;
  const progress = Math.max(0, Math.min(1, 1 - T / total));
  const cands = trimmedCandidates(c, i, level, 4);
  let best = null; let bestV = -Infinity; let bestCtx = null;
  for (const a of cands) {
    const c2 = clone(c);
    const r = performAction(c2, i, a);
    if (!r.ok) continue;
    const v = evaluate(c2, i, level, T, progress, pool);
    if (v > bestV) { bestV = v; best = { c: c2, ctx: r.ctx }; bestCtx = r.ctx; }
  }
  if (!best) {
    const a = anyLegalAction(c, i);
    const c2 = clone(c);
    const r = performAction(c2, i, a);
    if (!r.ok) return null;
    best = { c: c2, ctx: r.ctx }; bestCtx = r.ctx;
  }
  endTurn(best.c, i, bestCtx);
  return best.c;
}

function terminalValue(c, pi, oppW) {
  const me = c.players[pi].pop;
  let best = -Infinity;
  c.players.forEach((p, i) => { if (i !== pi) best = Math.max(best, p.pop); });
  return me - oppW * best + (me > best ? 4 : me === best ? 1.5 : 0);
}

// One simulated world: my move, then everyone else until my next turn, then my reply.
function rolloutValue(d, pi, a, cf, pool, rivalLevel) {
  let c = clone(d);
  const r = performAction(c, pi, a);
  if (!r.ok) return null;
  endTurn(c, pi, r.ctx);
  let guard = 0;
  while (c.phase === 'play' && c.current !== pi && guard++ < 12) {
    const nx = rolloutMove(c, c.current, rivalLevel, pool);
    if (!nx) return null;
    c = nx;
  }
  if (c.phase !== 'play') return terminalValue(c, pi, cf.oppW);
  // my follow-up: best move judged by the full evaluation
  const T = estimateTurnsLeft(c);
  const total = { 2: 22, 3: 20, 4: 19, 5: 18 }[c.players.length] || 20;
  const progress = Math.max(0, Math.min(1, 1 - T / total));
  if (T <= (c.players.length <= 3 ? (cf.playoutT || 1) : 1)) {
    // close to the end: play the rest of the game out, then score it exactly (goals included)
    guard = 0;
    while (c.phase === 'play' && guard++ < 40) {
      const z = rolloutMove(c, c.current, c.current === pi ? 'expert' : rivalLevel, pool);
      if (!z) break;
      c = z;
    }
    return c.phase === 'over' ? terminalValue(c, pi, cf.oppW) : evaluate(c, pi, 'expert', 1, 1, pool);
  }
  let best = -Infinity;
  for (const b of trimmedCandidates(c, pi, 'expert', 7)) {
    const c2 = clone(c);
    if (!performAction(c2, pi, b).ok) continue;
    best = Math.max(best, evaluate(c2, pi, 'expert', T, progress, pool));
  }
  return best === -Infinity ? evaluate(c, pi, 'expert', T, progress, pool) : best;
}

function scoredEntry(s, pi, a) {
  const c = clone(s);
  const r = performAction(c, pi, a);
  return { a, c, ctx: r.ctx };
}

function chooseExpertAction(s, pi, T, progress, pool) {
  const cf = cfgOf('expert');
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const t0 = now();
  const scored = scoreCandidates(s, pi, 'expert', T, progress, pool, candidates(s, pi, 'expert'));
  if (scored.length <= 1) return scored[0]?.a || null;
  // candidate shortlist (with the denial discard already chosen)
  const seenKey = new Set();
  const shortlist = [];
  for (const e of scored) {
    let a = e.a;
    if (a.type === 'basic' || a.type === 'invest' || a.type === 'border') {
      const sw = { ...a, discard: bestDiscard(s, pi, 'expert', a) };
      if (performAction(clone(s), pi, sw).ok) a = sw;
    }
    const k = JSON.stringify(a);
    if (seenKey.has(k)) continue;
    seenKey.add(k);
    shortlist.push({ a, sum: 0, n: 0, prior: e.v });
    if (shortlist.length >= cf.shortlist) break;
  }
  const tShort = now() - t0;
  const r = sampleRng((s.turn + 1) * 7919 + pi * 104729 + Math.floor(rnd() * 1e6));
  const rivalLevel = 'normalSim';
  let live = shortlist.slice();
  let samples = 0;
  let timeUp = false;
  while (samples < cf.maxSamples && !timeUp) {
    if (samples >= cf.minSamples && now() - t0 > cf.budgetMs) break;
    const d = determinize(s, pi, r); // the same invented world for every candidate
    const res = [];
    for (const e of live) {
      // hard cap: never think much longer than the budget, whatever the table size
      if (now() - t0 > cf.budgetMs * 1.4) { timeUp = true; break; }
      res.push([e, rolloutValue(d, pi, e.a, cf, pool, rivalLevel)]);
    }
    if (timeUp) break; // an unfinished sample would compare candidates unfairly: drop it
    for (const [e, v] of res) { e.sum += v === null ? -1e6 : v; e.n++; }
    samples++;
    // successive halving: drop the weaker half after a few samples
    if ((samples === 3 || samples === 7) && live.length > 3) {
      live.sort((x, y) => y.sum / y.n - x.sum / x.n);
      live = live.slice(0, Math.max(3, Math.ceil(live.length / 2)));
    }
  }
  if (!samples) return null; // no time for even one full sample: let the hard bot decide
  // With only a few samples the averages are noisy, so blend them with the hard bot's
  // own two-step judgement (both centred, so only the differences between moves count).
  const k = cf.prior ?? 4;
  if (k > 0) {
    for (const e of live) e.hv = e.hv ?? (0.5 * e.prior + 0.5 * followUpValue(scoredEntry(s, pi, e.a), pi, 'expert', T, progress, pool));
    const mr = live.reduce((t, e) => t + e.sum / e.n, 0) / live.length;
    const mh = live.reduce((t, e) => t + e.hv, 0) / live.length;
    for (const e of live) e.score = (samples * (e.sum / e.n - mr) + k * (e.hv - mh)) / (samples + k);
  } else for (const e of live) e.score = e.sum / e.n;
  live.sort((x, y) => y.score - x.score);
  if (typeof process !== 'undefined' && process.env?.EXPERT_DEBUG) console.log('samples', samples, 'shortlist', shortlist.length, 'T', T, 'pre', Math.round(tShort), 'ms', Math.round(now() - t0));
  return live[0].a;
}

export function chooseBotAction(state, pi, level = 'normal') {
  const s = botView(state, pi);
  if (level === 'expert') {
    const T = estimateTurnsLeft(s);
    const total = { 2: 22, 3: 20, 4: 19, 5: 18 }[s.players.length] || 20;
    const progress = Math.max(0, Math.min(1, 1 - T / total));
    const pool = upcomingPool(s);
    const legal = (x) => x && performAction(clone(s), pi, x).ok;
    const best = chooseExpertAction(s, pi, T, progress, pool);
    if (legal(best)) return best;
    return chooseBotAction(state, pi, 'hard');
  }
  const T = estimateTurnsLeft(s);
  const total = { 2: 22, 3: 20, 4: 19, 5: 18 }[s.players.length] || 20;
  const progress = Math.max(0, Math.min(1, 1 - T / total));
  const pool = upcomingPool(s);
  const scored = scoreCandidates(s, pi, level, T, progress, pool, candidates(s, pi, level));
  let best = scored[0]?.a || null;
  const K = cfgOf(level).lookahead || 0;
  if (K && T > 1 && scored.length > 1) {
    let bestV = -Infinity;
    for (const e of scored.slice(0, K)) {
      const v = 0.5 * e.v + 0.5 * followUpValue(e, pi, level, T, progress, pool);
      if (v > bestV) { bestV = v; best = e.a; }
    }
  }
  const legal = (x) => x && performAction(clone(s), pi, x).ok;
  if (best && (best.type === 'basic' || best.type === 'invest' || best.type === 'border')) {
    const swapped = { ...best, discard: bestDiscard(s, pi, level, best) };
    if (legal(swapped)) best = swapped; // the denial discard may cost more than the bot can pay
  }
  if (legal(best)) return best;
  for (const e of scored) if (legal(e.a)) return e.a;
  return anyLegalAction(s, pi);
}

// Last resort: the cheapest legal action there is (a lake at the cheapest market slot).
export function anyLegalAction(s, pi) {
  const cells = placementCells(s, pi);
  const slots = s.market.map((_, i) => i).filter((i) => s.market[i]).sort((x, y) => mc(s)[x] - mc(s)[y]);
  for (const slot of slots) for (const cell of cells) {
    const a = { type: 'lake', slot, cell };
    if (performAction(clone(s), pi, a).ok) return a;
  }
  return { type: 'pass', discard: slots[slots.length - 1] ?? 6 };
}
