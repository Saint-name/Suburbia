// Bots: easy / normal / hard
import {
  placementCells, performAction, clone, tileCostAt, estimateTurnsLeft, redLinesBetween,
  goalLeaders, neighborsOf, endTurn, borderCandidates, costOf, borderAt, openSpace,
} from './engine.js';
import { TILE_BY_ID, BASIC_IDS, MARKET_COSTS, GOAL_BY_ID, BORDER_BY_ID } from './tiles.js';

export const BOT_LEVELS = { easy: '쉬움', normal: '보통', hard: '어려움' };
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
  for (let i = 0; i < 7; i++) if (s.market[i] && MARKET_COSTS[i] <= budget) slots.push(i);
  return slots.sort((a, b) => MARKET_COSTS[a] - MARKET_COSTS[b] || b - a).slice(0, k);
}

function candidates(s, pi, level) {
  const p = s.players[pi];
  const cells = placementCells(s, pi);
  const out = [];
  for (let slot = 0; slot < 7; slot++) {
    if (!s.market[slot]) continue;
    const cost = tileCostAt(s, slot);
    if (p.money >= cost) for (const cell of cells) out.push({ type: 'buy', slot, cell });
    if (!cfgOf(level).greedy || p.money < 4) {
      if (p.money >= MARKET_COSTS[slot]) {
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
    if (p.money < TILE_BY_ID[kind].cost + MARKET_COSTS[disc]) continue;
    for (const cell of cells) out.push({ type: 'basic', kind, cell, discard: disc });
  }
  if (cfgOf(level).invest && p.investLeft > 0 && disc !== undefined) {
    for (const [cell, r] of Object.entries(p.tiles)) {
      if (r.inv || (!r.lake && TILE_BY_ID[r.id].noInvest)) continue;
      const cost = r.lake ? 0 : costOf(s, r.id);
      if (p.money >= cost + MARKET_COSTS[disc]) out.push({ type: 'invest', cell, discard: disc });
    }
    for (const b of p.borders || []) {
      if (b.inv) continue;
      const cost = b.lake ? 0 : BORDER_BY_ID[b.id].cost;
      if (p.money >= cost + MARKET_COSTS[disc]) out.push({ type: 'invest', cell: b.cells[0], discard: disc });
    }
  }
  // Suburbia Inc. borders: keep only the most promising positions of each open border
  if (s.exp?.inc && disc !== undefined && !cfgOf(level).greedy) {
    const resW = { income: 3, rep: 3, pop: 1, money: 0.3 };
    s.borderOpen.forEach((id, idx) => {
      if (!id) return; // unknown (hidden) border during look-ahead
      const def = BORDER_BY_ID[id];
      if (p.money >= def.cost + MARKET_COSTS[disc]) {
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
      if (p.money >= MARKET_COSTS[disc]) {
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
    const harm = gain + (MARKET_COSTS[slot] === 0 ? 0.5 : -MARKET_COSTS[slot] * 0.2);
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
  v.rng = 0; v.seed = 0;
  if (v.borderDeck) v.borderDeck = v.borderDeck.map(() => null);
  return v;
}

export function chooseBotAction(state, pi, level = 'normal') {
  const s = botView(state, pi);
  const T = estimateTurnsLeft(s);
  const total = { 2: 22, 3: 20, 4: 19 }[s.players.length] || 20;
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
  const slots = [0, 1, 2, 3, 4, 5, 6].filter((i) => s.market[i]).sort((x, y) => MARKET_COSTS[x] - MARKET_COSTS[y]);
  for (const slot of slots) for (const cell of cells) {
    const a = { type: 'lake', slot, cell };
    if (performAction(clone(s), pi, a).ok) return a;
  }
  return { type: 'pass', discard: slots[slots.length - 1] ?? 6 };
}
