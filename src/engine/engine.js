// Suburbia rules engine. Pure JS, JSON-serialisable state, no DOM.
import {
  TILE_BY_ID, BASIC_IDS, GOALS, GOAL_BY_ID, RED_LINES, MARKET_COSTS, TILES,
} from './tiles.js';

export const PLAYER_COLORS = ['#e2504c', '#f2c230', '#9b5fc0', '#3fb0a8'];
export const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
const MORE_ROUND = '1MR';

// ───────────────────────── utilities ─────────────────────────
export const key = (q, r) => `${q},${r}`;
export const parseKey = (k) => k.split(',').map(Number);
export const neighborsOf = (k) => { const [q, r] = parseKey(k); return NEIGHBORS.map(([dq, dr]) => key(q + dq, r + dr)); };
const clamp = (v) => Math.max(-5, Math.min(15, v));

function rand(s) { // mulberry32, state stored in s.rng
  s.rng = (s.rng + 0x6D2B79F5) >>> 0;
  let x = s.rng;
  x = Math.imul(x ^ (x >>> 15), x | 1);
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}
function shuffle(s, arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
export const clone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

// The Borough Board sits above the tiles. Its bottom edge is level with the centre of the
// starting Suburbs tile and has three hex-shaped notches (q = -2, 0, 2). Within the board's
// width a tile centre may not be above that edge; beyond it tiles may wrap around the board.
export function cellAllowed(k) {
  const [q, r] = parseKey(k);
  if (Math.abs(q) > 3) return true;
  return r + q / 2 >= 0;
}

// ───────────────────────── setup ─────────────────────────
export function createGame({ players, seed = (Date.now() >>> 0) }) {
  const n = players.length;
  if (n < 2 || n > 4) throw new Error('플레이어는 2~4명이어야 합니다');
  const s = {
    version: 1, seed, rng: seed >>> 0, phase: 'goals', players: [], market: [],
    basics: { suburbs: 4, park: 4, factory: 4 }, stacks: { A: [], B: [], C: [] },
    publicGoals: [], placeCounter: 0, turn: 0, current: 0, endAfterTurn: null,
    log: [], lastAction: null, final: null, moreRoundRevealed: false,
  };
  const per = { 2: 15, 3: 18, 4: 21 }[n];
  const pools = { A: [], B: [], C: [] };
  for (const tl of TILES) if (tl.stack !== 'basic') for (let i = 0; i < tl.count; i++) pools[tl.stack].push(tl.id);
  for (const L of ['A', 'B', 'C']) shuffle(s, pools[L]);
  s.stacks.A = pools.A.slice(0, per);
  s.stacks.B = pools.B.slice(0, per);
  const cMain = pools.C.slice(0, per);
  const cExtra = pools.C.slice(per, per + 4);
  const mixN = { 2: 6, 3: 9, 4: 12 }[n];
  const top = cMain.slice(0, per - mixN);
  const mixed = shuffle(s, [...cMain.slice(per - mixN), MORE_ROUND]);
  s.stacks.C = [...top, ...mixed, ...cExtra]; // index 0 = top of stack

  for (let i = 0; i < 7; i++) s.market.push(s.stacks.A.shift());
  const goals = shuffle(s, GOALS.map((g) => g.id));
  s.publicGoals = goals.splice(0, n);

  // random start player: rotate seating so that start player is index 0
  const order = players.map((p, i) => ({ ...p, _i: i }));
  const startIdx = Math.floor(rand(s) * n);
  const seated = [...order.slice(startIdx), ...order.slice(0, startIdx)];
  seated.forEach((p, i) => {
    const tiles = {};
    s.placeCounter++; tiles[key(0, 0)] = { id: 'suburbs', inv: false, order: 0 };
    tiles[key(0, 1)] = { id: 'park', inv: false, order: 0 };
    tiles[key(0, 2)] = { id: 'factory', inv: false, order: 0 };
    s.players.push({
      id: p.id, name: p.name, bot: p.bot || null, color: PLAYER_COLORS[p._i % 4],
      money: 15, income: 0, rep: 1, pop: 2, investLeft: 3, tiles,
      goalOptions: goals.splice(0, 2), privateGoal: null,
    });
  });
  s.placeCounter = 0;
  addLog(s, null, `게임 시작! 시작 플레이어: ${s.players[0].name}`);
  return s;
}

export function chooseGoal(s, pid, goalId) {
  const p = s.players.find((x) => x.id === pid);
  if (!p || s.phase !== 'goals') return { ok: false, error: '지금은 목표를 고를 수 없습니다' };
  if (!p.goalOptions.includes(goalId)) return { ok: false, error: '잘못된 목표' };
  p.privateGoal = goalId;
  if (s.players.every((x) => x.privateGoal)) { s.phase = 'play'; addLog(s, null, '모든 플레이어가 비공개 목표를 골랐습니다.'); }
  return { ok: true };
}

// ───────────────────────── queries ─────────────────────────
export const playerIndex = (s, pid) => s.players.findIndex((p) => p.id === pid);
const isBuilding = (rec) => rec && !rec.lake;
const tileOf = (rec) => TILE_BY_ID[rec.id];
const mult = (rec) => (rec.inv ? 2 : 1);

export function placementCells(s, pi) {
  const tiles = s.players[pi].tiles;
  const out = new Set();
  for (const k of Object.keys(tiles)) for (const nk of neighborsOf(k)) if (!tiles[nk] && cellAllowed(nk)) out.add(nk);
  return [...out];
}

export function tileCostAt(s, slot) {
  const id = s.market[slot];
  if (!id) return null;
  return TILE_BY_ID[id].cost + MARKET_COSTS[slot];
}

function matches(rec, cn) {
  if (!isBuilding(rec)) return false;
  const tl = tileOf(rec);
  if (cn.icon) return tl.icon === cn.icon;
  if (cn.types) return cn.types.includes(tl.type);
  return false;
}

function lakeAdjBuildings(tiles, k) {
  return neighborsOf(k).filter((nk) => isBuilding(tiles[nk])).length;
}
function lakesAdjacent(tiles, k) {
  return neighborsOf(k).filter((nk) => tiles[nk] && tiles[nk].lake);
}

// Number of matching things for condition cn of tile rec (owner oi at key k)
function countMatches(s, oi, k, rec, cn) {
  const own = s.players[oi].tiles;
  if (cn.special === 'redline') return 0;
  if (cn.special === 'afterThis') {
    let c = 0;
    for (const p of s.players) for (const r of Object.values(p.tiles)) if (r !== rec && matches(r, cn) && r.order > rec.order) c++;
    return c;
  }
  if (cn.special === 'waterfront') {
    let c = 0;
    for (const [lk, r] of Object.entries(own)) if (r.lake) c += lakeAdjBuildings(own, lk);
    return c;
  }
  if (cn.scope === 'adj') return neighborsOf(k).filter((nk) => matches(own[nk], cn)).length;
  let c = 0;
  s.players.forEach((p, i) => {
    if (cn.scope === 'own' && i !== oi) return;
    if (cn.scope === 'others' && i === oi) return;
    for (const r of Object.values(p.tiles)) if (matches(r, cn) && !(cn.excludeSelf && r === rec)) c++;
  });
  return c;
}

// ───────────────────────── effect application ─────────────────────────
function apply(s, ctx, pi, res, amt, src) {
  if (!amt) return;
  const p = s.players[pi];
  if (res === 'income' || res === 'rep') {
    const before = p[res];
    p[res] = clamp(before + amt);
    if (p[res] !== before) ctx.deltas.push({ pi, res, amt: p[res] - before, src });
  } else if (res === 'money') {
    p.money += amt;
    ctx.deltas.push({ pi, res, amt, src });
  } else if (res === 'pop') {
    changePop(s, ctx, pi, amt, src);
  }
}

export function redLinesBetween(lo, hi) { // count lines N with lo < N <= hi
  let c = 0;
  for (const n of RED_LINES) { if (n > hi) break; if (n > lo) c++; }
  return c;
}

function changePop(s, ctx, pi, delta, src) {
  const p = s.players[pi];
  const old = p.pop;
  let nw = old + delta;
  if (nw < 0) {
    const pay = Math.min(p.money, -nw);
    if (pay) { p.money -= pay; ctx.deltas.push({ pi, res: 'money', amt: -pay, src: 'popdebt' }); }
    nw = 0;
  }
  p.pop = nw;
  if (nw !== old) ctx.deltas.push({ pi, res: 'pop', amt: nw - old, src });
  if (s.scoring) return;
  const up = redLinesBetween(old, nw);
  const down = redLinesBetween(nw, old);
  for (let i = 0; i < up; i++) {
    apply(s, ctx, pi, 'income', -1, 'redline');
    apply(s, ctx, pi, 'rep', -1, 'redline');
    for (const r of Object.values(p.tiles)) {
      if (!isBuilding(r)) continue;
      for (const cn of tileOf(r).cond) if (cn.special === 'redline') apply(s, ctx, pi, cn.res, cn.amt * mult(r), r.id);
    }
  }
  for (let i = 0; i < down; i++) {
    apply(s, ctx, pi, 'income', 1, 'redline');
    apply(s, ctx, pi, 'rep', 1, 'redline');
  }
}

function applyImmediate(s, ctx, pi, rec, times = 1) {
  const tl = tileOf(rec);
  for (const res of ['income', 'rep', 'money', 'pop']) if (tl.imm[res]) apply(s, ctx, pi, res, tl.imm[res] * times, rec.id);
}

function applyOwnConditions(s, ctx, pi, k, rec, times = 1) {
  for (const cn of tileOf(rec).cond) {
    const n = countMatches(s, pi, k, rec, cn);
    if (n) apply(s, ctx, pi, cn.res, cn.amt * n * times, rec.id);
  }
}

// Other tiles reacting to a newly placed building rec (owner pi at key kt)
function applyReactions(s, ctx, pi, kt, rec) {
  const placerTiles = s.players[pi].tiles;
  const adjKeys = new Set(neighborsOf(kt));
  const react = (oi, ku, u) => {
    if (u === rec) return;
    if (u.lake) {
      if (oi === pi && adjKeys.has(ku)) apply(s, ctx, oi, 'money', 2 * mult(u), 'lake');
      return;
    }
    for (const cn of tileOf(u).cond) {
      const m = mult(u);
      if (cn.special === 'redline') continue;
      if (cn.special === 'afterThis') { if (matches(rec, cn) && rec.order > u.order) apply(s, ctx, oi, cn.res, cn.amt * m, u.id); continue; }
      if (cn.special === 'waterfront') {
        if (oi === pi) { const k = lakesAdjacent(placerTiles, kt).length; if (k) apply(s, ctx, oi, cn.res, cn.amt * k * m, u.id); }
        continue;
      }
      if (!matches(rec, cn)) continue;
      if (cn.scope === 'adj' && !(oi === pi && adjKeys.has(ku))) continue;
      if (cn.scope === 'own' && oi !== pi) continue;
      if (cn.scope === 'others' && oi === pi) continue;
      apply(s, ctx, oi, cn.res, cn.amt * m, u.id);
    }
  };
  // own adjacent, own non-adjacent, then other boroughs in turn order
  const ownEntries = Object.entries(placerTiles);
  for (const [ku, u] of ownEntries) if (adjKeys.has(ku)) react(pi, ku, u);
  for (const [ku, u] of ownEntries) if (!adjKeys.has(ku)) react(pi, ku, u);
  const n = s.players.length;
  for (let d = 1; d < n; d++) {
    const oi = (pi + d) % n;
    for (const [ku, u] of Object.entries(s.players[oi].tiles)) react(oi, ku, u);
  }
}

// ───────────────────────── actions ─────────────────────────
// action forms:
//  {type:'buy', slot, cell}  {type:'lake', slot, cell}
//  {type:'basic', kind, cell, discard}  {type:'invest', cell, discard}
export function validateAction(s, pi, a) {
  if (s.phase !== 'play') return '게임이 진행 중이 아닙니다';
  if (pi !== s.current) return '당신의 차례가 아닙니다';
  const p = s.players[pi];
  const cells = () => placementCells(s, pi);
  const marketOk = (slot) => Number.isInteger(slot) && slot >= 0 && slot < 7 && s.market[slot];
  switch (a?.type) {
    case 'buy': {
      if (!marketOk(a.slot)) return '시장에 없는 타일입니다';
      if (p.money < tileCostAt(s, a.slot)) return '자금이 부족합니다';
      if (!cells().includes(a.cell)) return '놓을 수 없는 위치입니다';
      return null;
    }
    case 'lake': {
      if (!marketOk(a.slot)) return '시장에 없는 타일입니다';
      if (p.money < MARKET_COSTS[a.slot]) return '자금이 부족합니다';
      if (!cells().includes(a.cell)) return '놓을 수 없는 위치입니다';
      return null;
    }
    case 'basic': {
      if (!BASIC_IDS.includes(a.kind) || s.basics[a.kind] <= 0) return '기본 타일이 남아있지 않습니다';
      if (!marketOk(a.discard)) return '버릴 시장 타일을 골라야 합니다';
      if (p.money < TILE_BY_ID[a.kind].cost + MARKET_COSTS[a.discard]) return '자금이 부족합니다';
      if (!cells().includes(a.cell)) return '놓을 수 없는 위치입니다';
      return null;
    }
    case 'invest': {
      const rec = p.tiles[a.cell];
      if (p.investLeft <= 0) return '투자 마커가 없습니다';
      if (!rec) return '내 타일을 골라야 합니다';
      if (rec.inv) return '이미 투자한 타일입니다';
      if (!marketOk(a.discard)) return '버릴 시장 타일을 골라야 합니다';
      const cost = rec.lake ? 0 : tileOf(rec).cost;
      if (p.money < cost + MARKET_COSTS[a.discard]) return '자금이 부족합니다';
      return null;
    }
    default: return '알 수 없는 행동';
  }
}

function placeBuilding(s, ctx, pi, cell, tileId) {
  const rec = { id: tileId, inv: false, order: ++s.placeCounter };
  s.players[pi].tiles[cell] = rec;
  applyImmediate(s, ctx, pi, rec);
  applyOwnConditions(s, ctx, pi, cell, rec);
  applyReactions(s, ctx, pi, cell, rec);
}

function placeLake(s, ctx, pi, cell, tileId) {
  const p = s.players[pi];
  const rec = { id: tileId, lake: true, inv: false, order: 0 };
  p.tiles[cell] = rec;
  const b = lakeAdjBuildings(p.tiles, cell);
  if (b) apply(s, ctx, pi, 'money', 2 * b, 'lake');
  for (const u of Object.values(p.tiles)) {
    if (!isBuilding(u)) continue;
    for (const cn of tileOf(u).cond) if (cn.special === 'waterfront' && b) apply(s, ctx, pi, 'money', cn.amt * b * mult(u), u.id);
  }
}

function pay(s, ctx, pi, amt, src) {
  if (!amt) return;
  s.players[pi].money -= amt;
  ctx.deltas.push({ pi, res: 'money', amt: -amt, src });
}

// Performs the action phase only (no income/reputation/refill). Returns ctx.
export function performAction(s, pi, a) {
  const err = validateAction(s, pi, a);
  if (err) return { ok: false, error: err };
  const ctx = { deltas: [], removedSlot: null, text: '' };
  const p = s.players[pi];
  if (a.type === 'buy') {
    const id = s.market[a.slot];
    pay(s, ctx, pi, tileCostAt(s, a.slot), 'cost');
    s.market[a.slot] = null; ctx.removedSlot = a.slot;
    placeBuilding(s, ctx, pi, a.cell, id);
    ctx.text = `${TILE_BY_ID[id].ko} 건설`;
    ctx.tile = id;
  } else if (a.type === 'lake') {
    const id = s.market[a.slot];
    pay(s, ctx, pi, MARKET_COSTS[a.slot], 'cost');
    s.market[a.slot] = null; ctx.removedSlot = a.slot;
    placeLake(s, ctx, pi, a.cell, id);
    ctx.text = `호수 조성 (${TILE_BY_ID[id].ko} 뒤집음)`;
  } else if (a.type === 'basic') {
    pay(s, ctx, pi, TILE_BY_ID[a.kind].cost, 'cost');
    s.basics[a.kind]--;
    placeBuilding(s, ctx, pi, a.cell, a.kind);
    const dId = s.market[a.discard];
    pay(s, ctx, pi, MARKET_COSTS[a.discard], 'discard');
    s.market[a.discard] = null; ctx.removedSlot = a.discard;
    ctx.text = `${TILE_BY_ID[a.kind].ko} 건설, 시장에서 ${TILE_BY_ID[dId].ko} 제거`;
    ctx.tile = a.kind;
  } else if (a.type === 'invest') {
    const rec = p.tiles[a.cell];
    pay(s, ctx, pi, rec.lake ? 0 : tileOf(rec).cost, 'cost');
    rec.inv = true; p.investLeft--;
    if (rec.lake) {
      const b = lakeAdjBuildings(p.tiles, a.cell);
      if (b) apply(s, ctx, pi, 'money', 2 * b, 'lake');
    } else {
      applyImmediate(s, ctx, pi, rec);
      applyOwnConditions(s, ctx, pi, a.cell, rec);
    }
    const dId = s.market[a.discard];
    pay(s, ctx, pi, MARKET_COSTS[a.discard], 'discard');
    s.market[a.discard] = null; ctx.removedSlot = a.discard;
    ctx.text = `${rec.lake ? '호수' : tileOf(rec).ko}에 투자, 시장에서 ${TILE_BY_ID[dId].ko} 제거`;
  }
  return { ok: true, ctx };
}

function draw(s) {
  for (const L of ['A', 'B', 'C']) {
    while (s.stacks[L].length) {
      const id = s.stacks[L].shift();
      if (id === MORE_ROUND) {
        if (s.endAfterTurn === null) {
          const n = s.players.length;
          s.endAfterTurn = (Math.floor(s.turn / n) + 2) * n - 1;
          s.moreRoundRevealed = true;
          addLog(s, null, '「1 More Round」 타일 공개! 이번 라운드를 마치고 한 라운드를 더 진행합니다.');
        }
        continue;
      }
      return id;
    }
  }
  return null;
}

// Income, reputation, market refill, advance turn.
export function endTurn(s, pi, ctx) {
  const p = s.players[pi];
  if (p.income >= 0) apply(s, ctx, pi, 'money', p.income, 'income');
  else {
    const owe = -p.income;
    const paid = Math.min(p.money, owe);
    if (paid) apply(s, ctx, pi, 'money', -paid, 'income');
    if (owe > paid) changePop(s, ctx, pi, -(owe - paid), 'income');
  }
  changePop(s, ctx, pi, p.rep, 'rep');
  if (ctx.removedSlot !== null) {
    s.market.splice(ctx.removedSlot, 1);
    s.market.unshift(draw(s));
  }
  if (s.endAfterTurn !== null && s.turn >= s.endAfterTurn) { finishGame(s); return; }
  s.turn++;
  s.current = s.turn % s.players.length;
}

export function applyAction(s, pid, a) {
  const pi = playerIndex(s, pid);
  const res = performAction(s, pi, a);
  if (!res.ok) return res;
  const ctx = res.ctx;
  const mainDeltas = ctx.deltas.slice();
  endTurn(s, pi, ctx);
  s.lastAction = { pi, action: a, deltas: mainDeltas, text: ctx.text, turn: s.turn };
  addLog(s, pi, ctx.text, summarize(mainDeltas));
  return { ok: true };
}

export function summarize(deltas) {
  const per = {};
  for (const d of deltas) {
    per[d.pi] ??= { income: 0, rep: 0, pop: 0, money: 0 };
    per[d.pi][d.res] += d.amt;
  }
  return per;
}

function addLog(s, pi, text, sum = null) {
  s.log.push({ t: s.turn, pi, text, sum });
  if (s.log.length > 300) s.log.splice(0, s.log.length - 300);
}

// Preview: what would this action do (action phase only)?
export function previewAction(s, pi, a) {
  const c = clone(s);
  const r = performAction(c, pi, a);
  if (!r.ok) return r;
  return { ok: true, sum: summarize(r.ctx.deltas), state: c };
}

// ───────────────────────── scoring ─────────────────────────
function cluster(tiles, pred) {
  const seen = new Set(); let best = 0;
  for (const k of Object.keys(tiles)) {
    if (seen.has(k) || !pred(tiles[k])) continue;
    let size = 0; const st = [k]; seen.add(k);
    while (st.length) {
      const c = st.pop(); size++;
      for (const nk of neighborsOf(c)) if (!seen.has(nk) && tiles[nk] && pred(tiles[nk])) { seen.add(nk); st.push(nk); }
    }
    best = Math.max(best, size);
  }
  return best;
}

export function metrics(p) {
  const m = { R: 0, C: 0, I: 0, V: 0, airports: 0, lakes: 0 };
  for (const r of Object.values(p.tiles)) {
    if (r.lake) { m.lakes++; continue; }
    const tl = tileOf(r);
    m[tl.type]++;
    if (tl.icon === 'airport') m.airports++;
  }
  m.money = p.money; m.income = p.income; m.rep = p.rep; m.investments = 3 - p.investLeft;
  m.civicCluster = cluster(p.tiles, (r) => isBuilding(r) && tileOf(r).type === 'V');
  m.lakeCluster = cluster(p.tiles, (r) => r.lake);
  return m;
}

export function goalLeaders(s, goalId) {
  const g = GOAL_BY_ID[goalId];
  const vals = s.players.map((p) => metrics(p)[g.metric]);
  const best = g.dir === 'max' ? Math.max(...vals) : Math.min(...vals);
  const who = vals.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0);
  return { vals, best, who, unique: who.length === 1 ? who[0] : null };
}

function finishGame(s) {
  s.scoring = true;
  const rows = s.players.map((p) => ({ pi: 0, basePop: p.pop, goals: [], moneyPop: 0 }));
  s.players.forEach((p, i) => { rows[i].pi = i; });
  for (const gid of s.publicGoals) {
    const L = goalLeaders(s, gid);
    if (L.unique !== null) rows[L.unique].goals.push({ id: gid, bonus: GOAL_BY_ID[gid].bonus, public: true });
  }
  s.players.forEach((p, i) => {
    if (!p.privateGoal) return;
    const L = goalLeaders(s, p.privateGoal);
    if (L.unique === i) rows[i].goals.push({ id: p.privateGoal, bonus: GOAL_BY_ID[p.privateGoal].bonus, public: false });
  });
  s.players.forEach((p, i) => {
    for (const g of rows[i].goals) p.pop += g.bonus;
    rows[i].moneyPop = Math.floor(p.money / 5);
    p.pop += rows[i].moneyPop;
    rows[i].final = p.pop;
  });
  const order = s.players.map((p, i) => i).sort((a, b) => {
    const A = s.players[a]; const B = s.players[b];
    return B.pop - A.pop || B.rep - A.rep || B.income - A.income || B.money - A.money;
  });
  s.final = { rows, order };
  s.phase = 'over';
  addLog(s, null, `게임 종료! 우승: ${s.players[order[0]].name} (인구 ${s.players[order[0]].pop})`);
}

// Rough number of turns left for the current player (incl. this one).
export function estimateTurnsLeft(s) {
  const n = s.players.length;
  if (s.endAfterTurn !== null) return Math.max(1, Math.floor((s.endAfterTurn - s.turn) / n) + 1);
  const mixN = { 2: 6, 3: 9, 4: 12 }[n];
  const draws = s.stacks.A.length + s.stacks.B.length + s.stacks.C.length - 4 - (mixN + 1) / 2;
  return Math.max(1, Math.round(draws / n) + 2);
}

// Sanitised view for one viewer (hides stacks and others' private goals).
export function viewFor(s, viewerId) {
  const v = clone(s);
  v.stackCounts = { A: s.stacks.A.length, B: s.stacks.B.length, C: s.stacks.C.filter((x) => x !== MORE_ROUND).length + (s.moreRoundRevealed ? 0 : 1) };
  delete v.stacks; delete v.rng; delete v.seed;
  if (s.phase !== 'over') {
    for (const p of v.players) if (p.id !== viewerId) { p.goalOptions = []; p.privateGoal = p.privateGoal ? 'hidden' : null; }
  }
  return v;
}
