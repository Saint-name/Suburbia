// SVG rendering of a borough (flat-top hexes, axial coordinates)
import { TILE_BY_ID, TYPE_INFO, ICON_INFO } from '../engine/tiles.js';
import { parseKey } from '../engine/engine.js';
import { tileFace, tileSvg, borderLabel } from './tileface.js';

const R = 52;
const H = Math.sqrt(3) * R;
export const center = (k) => { const [q, r] = parseKey(k); return [1.5 * R * q, H * (r + q / 2)]; };
function corners(cx, cy, rr = R) {
  const pts = [];
  for (let i = 0; i < 6; i++) { const a = (Math.PI / 180) * (60 * i); pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`); }
  return pts.join(' ');
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function splitName(name) {
  if (name.length <= 5) return [name];
  const sp = name.indexOf(' ');
  if (sp > 0) return [name.slice(0, sp), name.slice(sp + 1)];
  const mid = Math.ceil(name.length / 2);
  return [name.slice(0, mid), name.slice(mid)];
}

export function tileHexSvg(rec, cx, cy, opts = {}) {
  const tl = TILE_BY_ID[rec.id];
  const out = [];
  if (rec.lake) {
    out.push(`<polygon points="${corners(cx, cy)}" class="hex lake"/>`);
    out.push(`<path d="M${cx - 20},${cy - 4} q10,-8 20,0 t20,0 M${cx - 16},${cy + 8} q8,-7 16,0 t16,0" class="wave"/>`);
    out.push(`<text x="${cx}" y="${cy + 26}" class="hex-sub">호수</text>`);
  } else {
    out.push(`<polygon points="${corners(cx, cy)}" class="hex t-${tl.type}" />`);
    out.push(`<polygon points="${corners(cx, cy, R - 5)}" class="hex-inner"/>`);
    const lines = splitName(tl.ko);
    const y0 = cy - (lines.length - 1) * 7 + 2;
    lines.forEach((ln, i) => out.push(`<text x="${cx}" y="${y0 + i * 14}" class="hex-name">${esc(ln)}</text>`));
    if (tl.icon) out.push(`<text x="${cx}" y="${cy - 20}" class="hex-icon">${ICON_INFO[tl.icon].glyph}</text>`);
    out.push(`<text x="${cx}" y="${cy + 30}" class="hex-sub">${TYPE_INFO[tl.type].ko}</text>`);
  }
  if (rec.inv) out.push(`<g class="inv"><circle cx="${cx - 24}" cy="${cy - 22}" r="10"/><text x="${cx - 24}" y="${cy - 18}">×2</text></g>`);
  if (opts.last) out.push(`<polygon points="${corners(cx, cy, R - 1)}" class="hex-last"/>`);
  return out.join('');
}

// A border strip: 4 hexes + accent lines along the notched edge facing its slots
function borderSvg(b, opts = {}) {
  const out = [];
  const cls = `${b.lake ? 'bd lake' : 'bd'} ${opts.ghost ? 'ghost' : ''}`;
  out.push(`<g class="border-strip ${opts.selectable ? 'selectable' : ''}">`);
  for (const c of b.cells) { const [x, y] = center(c); out.push(`<polygon points="${corners(x, y, R)}" class="${cls}" data-cell="${c}"/>`); }
  b.cells.forEach((c, i) => {
    const [x1, y1] = center(c); const [x2, y2] = center(b.slots[i]);
    const mx = (x1 + x2) / 2; const my = (y1 + y2) / 2; const dx = (y2 - y1) / H * R * 0.45; const dy = -(x2 - x1) / H * R * 0.45;
    out.push(`<line x1="${(mx - dx).toFixed(1)}" y1="${(my - dy).toFixed(1)}" x2="${(mx + dx).toFixed(1)}" y2="${(my + dy).toFixed(1)}" class="bd-notch"/>`);
  });
  const cx = b.cells.reduce((a, c) => a + center(c)[0], 0) / 4; const cy = b.cells.reduce((a, c) => a + center(c)[1], 0) / 4;
  out.push(`<g pointer-events="none">${borderLabel(b.id, b.lake, cx, cy, 1.15)}</g>`);
  if (b.inv) out.push(`<g class="inv" pointer-events="none"><circle cx="${cx - 48}" cy="${cy - 14}" r="11"/><text x="${cx - 48}" y="${cy - 10}">×2</text></g>`);
  if (opts.selectable || opts.picked) for (const c of b.cells) { const [x, y] = center(c); out.push(`<polygon points="${corners(x, y, R - 2)}" class="hex-sel" />`); }
  out.push('</g>');
  return out.join('');
}

// player: view player; opts: { cells:Set (placeable), picked, selectable:Set (invest targets), lastCell, ghost,
//   borderCells:Set (cells that can start a border), borderGhost: {id, lake, cells, slots} }
export function boroughSvg(player, opts = {}) {
  const keys = Object.keys(player.tiles);
  const cells = opts.cells ? [...opts.cells] : [];
  const bcells = opts.borderCells ? [...opts.borderCells] : [];
  const all = [...keys, ...cells, ...bcells, ...(player.borders || []).flatMap((b) => b.cells), ...(opts.borderGhost?.cells || [])];
  const yTop = -H / 2 - 100;
  let minX = -5.2 * R; let maxX = 5.2 * R; let minY = yTop - 34; let maxY = H * 3;
  for (const k of all) {
    const [x, y] = center(k);
    minX = Math.min(minX, x - R - 6); maxX = Math.max(maxX, x + R + 6);
    minY = Math.min(minY, y - H / 2 - 6); maxY = Math.max(maxY, y + H / 2 + 6);
  }
  const w = maxX - minX; const h = maxY - minY;
  const out = [`<svg class="borough" viewBox="${minX.toFixed(0)} ${minY.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="xMidYMin meet" xmlns="http://www.w3.org/2000/svg">`];
  out.push(boroughBoardSvg(player, yTop));
  for (const b of player.borders || []) out.push(borderSvg(b, { selectable: opts.selectable?.has(b.cells[0]), picked: opts.picked && b.cells.includes(opts.picked) }));
  for (const k of bcells) {
    if (opts.borderGhost?.cells.includes(k)) continue;
    const [x, y] = center(k);
    out.push(`<g class="slot" data-cell="${k}"><polygon points="${corners(x, y, R - 3)}" class="hex-slot bslot"/><text x="${x}" y="${y + 5}" class="slot-plus b">▦</text></g>`);
  }
  if (opts.borderGhost) out.push(borderSvg(opts.borderGhost, { ghost: true }));
  for (const k of keys) {
    const [x, y] = center(k);
    const sel = opts.selectable?.has(k);
    out.push(`<g class="tile ${sel ? 'selectable' : ''} ${opts.picked === k ? 'picked' : ''}" data-cell="${k}">${tileFace(player.tiles[k], x, y, R - 1, { last: opts.lastCell === k })}${sel || opts.picked === k ? `<polygon points="${corners(x, y, R - 2)}" class="hex-sel"/>` : ''}</g>`);
  }
  for (const k of cells) {
    const [x, y] = center(k);
    const picked = opts.picked === k;
    out.push(`<g class="slot ${picked ? 'picked' : ''}" data-cell="${k}">`);
    if (picked && opts.ghost) out.push(`<g opacity="0.85">${tileFace(opts.ghost, x, y, R - 1)}</g><polygon points="${corners(x, y, R - 2)}" class="hex-pick"/>`);
    else out.push(`<polygon points="${corners(x, y, R - 3)}" class="hex-slot"/><text x="${x}" y="${y + 5}" class="slot-plus">+</text>`);
    out.push('</g>');
  }
  out.push('</svg>');
  return out.join('');
}

// The player's Borough Board: Income (circles) and Reputation (squares) tracks from -5 to 15,
// with three hex notches along the bottom edge; the middle notch holds the Suburbs tile.
function boroughBoardSvg(player, yT) {
  const xL = -5 * R; const xR = 5 * R;
  let d = `M${xL},${yT} L${xR},${yT} L${xR},0`;
  for (const cx of [3 * R, 0, -3 * R]) d += ` L${cx + R},0 L${cx + R / 2},${-H / 2} L${cx - R / 2},${-H / 2} L${cx - R},0`;
  d += ` L${xL},0 Z`;
  const out = [];
  out.push(`<text x="0" y="${yT - 12}" class="bb-title">${esc(player.name)} <tspan class="bb-sub">· $${player.money} · 인구 ${player.pop} · 투자 마커 ${player.investLeft}</tspan></text>`);
  out.push(`<path d="${d}" class="bb" style="fill:${player.color}"/>`);
  out.push(`<path d="${d}" class="bb-shade"/>`);
  const x0 = xL + 0.42 * R; const step = (xR - xL - 0.84 * R) / 20;
  const yC = yT + 30; const yN = yT + 56; const yS = yT + 70;
  out.push(`<text x="${xL + 8}" y="${yT + 14}" class="bb-label">수입 INCOME</text>`);
  out.push(`<text x="${xL + 8}" y="${yS + 26}" class="bb-label">평판 REPUTATION</text>`);
  for (let v = -5; v <= 15; v++) {
    const x = x0 + (v + 5) * step;
    out.push(`<circle cx="${x.toFixed(1)}" cy="${yC}" r="7.5" class="bb-slot"/>`);
    out.push(`<text x="${x.toFixed(1)}" y="${yN}" class="bb-num ${v < 0 ? 'neg' : ''} ${v === 0 ? 'zero' : ''}">${v}</text>`);
    out.push(`<rect x="${(x - 6).toFixed(1)}" y="${yS}" width="12" height="12" rx="2" class="bb-slot sq"/>`);
  }
  const xi = x0 + (player.income + 5) * step;
  const xr = x0 + (player.rep + 5) * step;
  out.push(`<g class="bb-marker"><circle cx="${xi.toFixed(1)}" cy="${yC}" r="10"/><circle cx="${xi.toFixed(1)}" cy="${yC - 3}" r="6" class="top"/></g>`);
  out.push(`<g class="bb-marker"><rect x="${(xr - 9).toFixed(1)}" y="${yS - 3}" width="18" height="18" rx="3"/></g>`);
  return out.join('');
}

// ───────── Population Board (0–150 snake track, like the printed board) ─────────
// Row r (0 = bottom) holds 15r+1 … 15r+14; even rows run left→right, odd rows right→left.
// Multiples of 15 are tall turn cells joining two rows (right side after even rows, left after odd).
const PB = { W: 624, cw: 36, side: 52, rh: 26, gap: 8, pad: 8 };
function popCell(n) {
  const { cw, side, rh, gap, pad } = PB;
  const rowY = (r) => pad + (9 - r) * (rh + gap);
  const xLeft = pad; const xFirst = pad + side; const xRight = pad + side + 14 * cw;
  if (n === 0) return { x: xLeft, y: rowY(0), w: side, h: rh, row: 0 };
  if (n === 150) return { x: xLeft, y: rowY(9), w: side, h: rh, row: 9 };
  if (n % 15 === 0) {
    const r = n / 15 - 1; // joins row r and r+1
    const x = r % 2 === 0 ? xRight : xLeft;
    return { x, y: rowY(r + 1), w: side, h: 2 * rh + gap, turn: true };
  }
  const r = Math.floor(n / 15); const i = n % 15 - 1;
  const col = r % 2 === 0 ? i : 13 - i;
  return { x: xFirst + col * cw, y: rowY(r), w: cw, h: rh, row: r };
}

export function populationBoardSvg(players, redLines) {
  const { W, rh, gap, pad } = PB;
  const Ht = pad * 2 + 10 * rh + 9 * gap + 24;
  const out = [`<svg class="popboard" viewBox="0 0 ${W} ${Ht}" xmlns="http://www.w3.org/2000/svg">`];
  out.push(`<rect x="0" y="0" width="${W}" height="${Ht}" rx="10" class="pb-bg"/>`);
  for (let n = 0; n <= 150; n++) {
    const c = popCell(n);
    const big = n % 5 === 0;
    out.push(`<rect x="${c.x + 1}" y="${c.y}" width="${c.w - 2}" height="${c.h}" rx="3" class="pb-cell ${big ? 'big' : ''} ${c.turn || n === 0 || n === 150 ? 'turn' : ''}"/>`);
    out.push(`<text x="${c.x + c.w / 2}" y="${c.y + c.h / 2 + 4}" class="pb-num ${big ? 'big' : ''}">${n}</text>`);
  }
  // red lines: between cell N-1 and N
  for (const N of redLines) {
    if (N > 150) break;
    const a = popCell(N - 1); const b = popCell(N);
    let x; let row;
    if (b.turn) { row = a; x = b.x > a.x ? a.x + a.w : a.x; }
    else if (a.turn) { row = b; x = a.x > b.x ? b.x + b.w : b.x; }
    else { row = a; x = Math.max(a.x, b.x); }
    out.push(`<rect x="${x - 3}" y="${row.y - 3}" width="6" height="${row.h + 6}" rx="2" class="pb-red"/>`);
  }
  // pawns
  const groups = {};
  players.forEach((p, i) => { const n = Math.min(150, Math.max(0, p.pop)); (groups[n] ??= []).push([p, i]); });
  for (const [n, list] of Object.entries(groups)) {
    const c = popCell(Number(n));
    list.forEach(([p], k) => {
      const s = 13; const ox = c.x + 3 + (k % 2) * (c.w - s - 6); const oy = c.y + 2 + Math.floor(k / 2) * (c.h - s - 4);
      out.push(`<rect x="${ox}" y="${oy}" width="${s}" height="${s}" rx="2" class="pb-pawn" style="fill:${p.color}"><title>${esc(p.name)}: ${p.pop}</title></rect>`);
    });
  }
  const ly = Ht - 10;
  out.push(`<rect x="${pad}" y="${ly - 10}" width="5" height="13" class="pb-red"/><text x="${pad + 10}" y="${ly}" class="pb-legend">= 넘으면 수입·평판 −1</text>`);
  let lx = W - pad;
  [...players].reverse().forEach((p) => {
    const label = `${p.name} ${p.pop}${p.pop > 150 ? '(150+)' : ''}`;
    const tw = label.length * 9 + 22;
    lx -= tw;
    out.push(`<rect x="${lx}" y="${ly - 10}" width="12" height="12" rx="2" class="pb-pawn" style="fill:${p.color}"/><text x="${lx + 16}" y="${ly}" class="pb-legend">${esc(label)}</text>`);
  });
  out.push('</svg>');
  return out.join('');
}

export function miniTileSvg(id, lake = false, cls = 'mini-hex') {
  return tileSvg({ id, lake }, 100, cls);
}
