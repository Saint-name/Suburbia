// Tile face renderer: layout modelled on the physical tiles
// (name banner on top, cost on the left, immediate effect top-right, conditional effect box at the bottom).
import { TILE_BY_ID, ICON_INFO, BORDER_BY_ID } from '../engine/tiles.js';

const TYPE_COLOR = { R: '#5fae4e', C: '#3f86c9', I: '#d9b43a', V: '#8f969c', X: '#3a3a42' };
const TYPE_DARK = { R: '#2f6b25', C: '#1f4f7f', I: '#8a6d12', V: '#4d5357', X: '#111114' };
const TYPE_EMBLEM = { R: '🏘️', C: '🏬', I: '🏭', V: '🏛️', X: '🚧' };
let PLAYERS_N = 4;
export const setPlayerCount = (n) => { PLAYERS_N = n || 4; };
let STARS_ON = true; // stars only do something when the 5★ Star Track is in play
export const setStarsActive = (on) => { STARS_ON = !!on; };
const costLabel = (tl) => (tl.costPerPlayer ? `$${tl.costPerPlayer * PLAYERS_N}` : `$${tl.cost}`);
const SPECIAL_ROW = {
  lawOffice: '⚖️ 동점 목표 1개 획득', planner: '🔁 다음 턴부터 무료 교체', redistrict: '상대마다 인구 5 뺏기',
  dollarPerPop: '내 인구 1당 $1', police: '🌙 부정 효과 무시', nightCourt: '🌙 부정 효과 되돌림+무시',
};
const REQ_ROW = { pop2: '인구 2↑ 필요', adjBorder: '보더 인접 필수', adjLake: '호수 인접 필수', essenUnique: '구역당 1개' };
const starPath = (x, y, r) => {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? r * 0.45 : r; pts.push(`${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`); }
  return pts.join(' ');
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sgn = (n) => (n > 0 ? `+${n}` : `${n}`);

function hexPts(cx, cy, r) {
  const p = [];
  for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i; p.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`); }
  return p.join(' ');
}

// ── resource icons (s = size scale) ──
export function resIcon(res, amt, x, y, s = 1) {
  const neg = amt < 0;
  const label = res === 'money' ? `${neg ? '-' : ''}$${Math.abs(amt)}` : sgn(amt);
  if (res === 'income') {
    return `<g class="ri"><circle cx="${x}" cy="${y}" r="${8.5 * s}" fill="${neg ? '#d93a3a' : '#fff'}" stroke="#222" stroke-width="${1.2 * s}"/>`
      + `<text x="${x}" y="${y + 3.4 * s}" font-size="${9.5 * s}" fill="${neg ? '#fff' : '#111'}">${label}</text></g>`;
  }
  if (res === 'star') {
    return `<g class="ri"><polygon points="${starPath(x, y, 10 * s)}" fill="#ffcf33" stroke="#7a5a00" stroke-width="${1 * s}"/>`
      + `<text x="${x}" y="${y + 3.2 * s}" font-size="${7.5 * s}" fill="#3b2a00">${label}</text></g>`;
  }
  if (res === 'rep') {
    return `<g class="ri"><rect x="${x - 8 * s}" y="${y - 8 * s}" width="${16 * s}" height="${16 * s}" rx="${2 * s}" fill="${neg ? '#d93a3a' : '#151515'}" stroke="#fff" stroke-width="${1 * s}"/>`
      + `<text x="${x}" y="${y + 3.4 * s}" font-size="${9.5 * s}" fill="#fff">${label}</text></g>`;
  }
  if (res === 'pop') {
    const k = s;
    const P = (dx, dy) => `${(x + dx * k).toFixed(1)},${(y + dy * k).toFixed(1)}`;
    const d = `M${P(-10, 11)} L${P(-5, 1)} Q${P(-11, 0)} ${P(-10.5, -3)} Q${P(-10, -6)} ${P(-4, -5.5)} `
      + `Q${P(-5.5, -12)} ${P(0, -12)} Q${P(5.5, -12)} ${P(4, -5.5)} Q${P(10, -6)} ${P(10.5, -3)} Q${P(11, 0)} ${P(5, 1)} `
      + `L${P(10, 11)} Q${P(0, 8)} ${P(-10, 11)} Z`;
    return `<g class="ri"><path d="${d}" fill="${neg ? '#d93a3a' : '#5d6270'}" stroke="#fff" stroke-width="${0.9 * k}" stroke-linejoin="round"/>`
      + `<text x="${x}" y="${y + 5.5 * k}" font-size="${8.5 * k}" fill="#fff">${label}</text></g>`;
  }
  // money
  return `<g class="ri"><circle cx="${x}" cy="${y}" r="${9 * s}" fill="${neg ? '#d93a3a' : '#f2c94c'}" stroke="${neg ? '#fff' : '#7a5a00'}" stroke-width="${1.2 * s}"/>`
    + `<text x="${x}" y="${y + 3.3 * s}" font-size="${(neg ? 7 : 8.5) * s}" fill="${neg ? '#fff' : '#3b2a00'}">${label}</text></g>`;
}

function miniHex(type, x, y, s = 1) {
  return `<polygon points="${hexPts(x, y, 6 * s)}" fill="${TYPE_COLOR[type]}" stroke="#fff" stroke-width="${0.8 * s}"/>`;
}

// targets of a condition, drawn left→right from x; returns [svg, width]
function targets(cn, x, y, s) {
  const glyph = (g, fill = '#fff') => [`<circle cx="${x + 7 * s}" cy="${y}" r="${7 * s}" fill="${fill}" stroke="#222" stroke-width="${0.8 * s}"/><text x="${x + 7 * s}" y="${y + 3.4 * s}" font-size="${8.5 * s}" font-weight="900">${g}</text>`, 15 * s];
  if (cn.star) return [`<polygon points="${starPath(x + 7 * s, y, 7.5 * s)}" fill="#222" stroke="#ffcf33" stroke-width="${1 * s}"/>`, 15 * s];
  if (cn.lakes) return [`<polygon points="${hexPts(x + 7 * s, y, 6.5 * s)}" fill="#4bb3e6" stroke="#fff" stroke-width="${0.8 * s}"/>`, 15 * s];
  if (cn.night) return glyph('🌙', '#2b2350');
  if (cn.con) return glyph('🎲');
  if (cn.essen) return glyph('E', '#ffe27a');
  if (cn.border) {
    return [`<rect x="${x + 1 * s}" y="${y - 5 * s}" width="${16 * s}" height="${10 * s}" rx="${2 * s}" fill="#8b5e34" stroke="#fff" stroke-width="${0.8 * s}"/><path d="M${x + 3 * s},${y - 5 * s} l3,4 l3,-4 l3,4 l3,-4" fill="none" stroke="#fff" stroke-width="${0.8 * s}"/>`, 19 * s];
  }
  if (cn.icon) {
    return [`<circle cx="${x + 7 * s}" cy="${y}" r="${7 * s}" fill="#fff" stroke="#222" stroke-width="${0.8 * s}"/><text x="${x + 7 * s}" y="${y + 3.6 * s}" font-size="${9 * s}">${ICON_INFO[cn.icon].glyph}</text>`, 15 * s];
  }
  if (cn.types) {
    let out = ''; let w = 0;
    cn.types.forEach((t, i) => { out += miniHex(t, x + 6.5 * s + i * 13 * s, y, s); w = 13 * s * (i + 1); });
    return [out, w];
  }
  return ['', 0];
}

const SCOPE_KO = { adj: '인접', own: '내', all: '모든', others: '상대' };

// One condition row centred at (cx, y). Returns svg.
function condRow(cn, cx, y, s) {
  const parts = [];
  let w = 0;
  const push = (svg, width) => { parts.push([svg, width]); w += width; };
  const text = (t, size = 7.5) => [`<text font-size="${size * s}" fill="#fff" class="ct" data-w="1">${esc(t)}</text>`, t.length * size * 0.92 * s + 2 * s];
  if (cn.special === 'redline') {
    push(...text('🚩마다'));
    push('', 3 * s);
    push(resIcon(cn.res, cn.amt, 0, 0, s * 0.85), 17 * s);
  } else if (cn.special === 'waterfront') {
    push(...text('호수 옆 내 건물'));
    push(resIcon('money', 2, 0, 0, s * 0.85), 17 * s);
  } else {
    push(resIcon(cn.res, cn.amt, 0, 0, s * (cn.res === 'pop' ? 0.62 : 0.85)), 18 * s);
    push(...text(cn.special === 'afterThis' ? '이후' : cn.excludeSelf ? '다른' : SCOPE_KO[cn.scope]));
    push(...targets(cn, 0, 0, s));
  }
  // lay out
  let x = cx - w / 2;
  let svg = '';
  for (const [p, pw] of parts) {
    if (!p) { x += pw; continue; }
    if (p.includes('class="ct"')) svg += p.replace('<text ', `<text x="${x + pw / 2 - 1 * s}" y="${y + 2.8 * s}" `);
    else svg += `<g transform="translate(${(x + (p.startsWith('<g class="ri"') ? pw / 2 : 0)).toFixed(1)},${y.toFixed(1)})">${p}</g>`;
    x += pw;
  }
  return svg;
}

// Full tile face. rec: {id, lake, inv}; R = hex radius.
export function tileFace(rec, cx, cy, R, opts = {}) {
  const s = R / 50;
  const H = Math.sqrt(3) / 2 * R;
  const out = [];
  if (rec.lake) {
    out.push(`<polygon points="${hexPts(cx, cy, R)}" class="tf-hex" fill="#4bb3e6"/>`);
    out.push(`<polygon points="${hexPts(cx, cy, R - 4 * s)}" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="${1.2 * s}"/>`);
    out.push(`<path d="M${cx - 24 * s},${cy - 14 * s} q12,-9 24,0 t24,0 M${cx - 18 * s},${cy - 2 * s} q9,-7 18,0 t18,0" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="${2 * s}"/>`);
    out.push(`<rect x="${cx - 0.62 * R}" y="${cy + 0.18 * R}" width="${1.24 * R}" height="${0.5 * R}" rx="${4 * s}" fill="rgba(10,30,60,.75)"/>`);
    out.push(`<g transform="translate(${cx - 14 * s},${cy + 0.43 * R})">${resIcon('money', 2, 0, 0, s * 0.85)}</g>`);
    out.push(`<text x="${cx + 10 * s}" y="${cy + 0.43 * R + 3 * s}" font-size="${7.5 * s}" fill="#fff" class="tf-t">인접 건물</text>`);
    out.push(`<text x="${cx}" y="${cy - 0.62 * R}" font-size="${10 * s}" fill="#fff" class="tf-t b">호수</text>`);
  } else {
    const tl = TILE_BY_ID[rec.id];
    out.push(`<polygon points="${hexPts(cx, cy, R)}" class="tf-hex" fill="${TYPE_COLOR[tl.type]}"/>`);
    out.push(`<polygon points="${hexPts(cx, cy, R - 4 * s)}" fill="rgba(255,255,255,.10)" stroke="rgba(255,255,255,.35)" stroke-width="${1 * s}"/>`);
    // name banner along the top edge
    const bh = 15 * s; const by = cy - H + 2.5 * s; const k3 = 1 / Math.sqrt(3);
    const tw = R - 4 * s; const bwB = tw + 2 * bh * k3;
    const bannerFill = tl.night ? '#3b1f6e' : tl.con ? '#7a1f3d' : TYPE_DARK[tl.type];
    out.push(`<polygon points="${cx - tw / 2},${by} ${cx + tw / 2},${by} ${cx + bwB / 2},${by + bh} ${cx - bwB / 2},${by + bh}" fill="${bannerFill}" stroke="${tl.night ? '#c9b8ff' : 'rgba(255,255,255,.5)'}" stroke-width="${(tl.night ? 1.4 : 0.8) * s}"/>`);
    const fs = 10 * s;
    const est = [...tl.ko].reduce((a, ch) => a + (ch === ' ' ? 0.35 : /[A-Za-z&]/.test(ch) ? 0.62 : 1), 0) * fs;
    const maxW = bwB - 8 * s;
    const fit = est > maxW ? ` textLength="${maxW.toFixed(1)}" lengthAdjust="spacingAndGlyphs"` : '';
    out.push(`<text x="${cx}" y="${by + bh / 2 + fs * 0.36}" font-size="${fs.toFixed(1)}" fill="#fff" class="tf-t b"${fit}>${esc(tl.ko)}</text>`);
    // cost (covered by the investment marker when invested)
    const rows = tl.cond.length;
    const cxL = cx - 0.66 * R; const cyL = rows >= 3 ? cy - 0.36 * R : cy - 0.12 * R;
    if (rec.inv) {
      out.push(`<polygon points="${hexPts(cxL, cyL, 13 * s)}" fill="#ffd447" stroke="#7a5a00" stroke-width="${1.4 * s}"/><text x="${cxL}" y="${cyL + 3.8 * s}" font-size="${10 * s}" fill="#3b2a00" class="tf-t b">2×</text>`);
    } else {
      out.push(`<text x="${cxL}" y="${cyL + 4 * s}" font-size="${12 * s}" fill="#fff" class="tf-t b cost">${costLabel(tl)}</text>`);
    }
    // immediate effect, top right
    const imm = ['income', 'rep', 'pop', 'money'].filter((k) => tl.imm[k]);
    imm.forEach((k, i) => out.push(`<g transform="translate(${cx + 0.6 * R - i * 20 * s},${cy - 0.3 * R})">${resIcon(k, tl.imm[k], 0, 0, s)}</g>`));
    // icon badge (restaurant / office / …)
    let emX = cx;
    if (tl.icon) {
      let bx = cx + 0.6 * R; let by2 = cy + 0.06 * R;
      if (rows >= 2) { bx = imm.length ? cx + 0.6 * R - 20 * s : cx + 0.6 * R; by2 = cy - 0.3 * R; emX = cx - 9 * s; }
      out.push(`<circle cx="${bx}" cy="${by2}" r="${8 * s}" fill="#fff" stroke="#222" stroke-width="${0.8 * s}"/><text x="${bx}" y="${by2 + 3.6 * s}" font-size="${9.5 * s}" class="tf-t">${ICON_INFO[tl.icon].glyph}</text>`);
    }
    if (tl.stars) {
      const sx = tl.req ? cx - 0.6 * R : cx - 0.36 * R; const sy = tl.req ? cy + 0.17 * R : cy - 0.36 * R;
      out.push(`<g opacity="${STARS_ON ? 1 : 0.35}"><polygon points="${starPath(sx, sy, 9.5 * s)}" fill="#ffcf33" stroke="#7a5a00" stroke-width="${1 * s}"/><text x="${sx}" y="${sy + 3.6 * s}" font-size="${8.5 * s}" fill="#3b2a00" class="tf-t b">${tl.stars}</text>${STARS_ON ? '' : `<title>5★ 없이는 효과 없음</title>`}</g>`);
    }
    if (tl.req) out.push(`<text x="${cx}" y="${by + bh + 9 * s}" font-size="${7.5 * s}" fill="#ffe27a" class="tf-t b cost">${REQ_ROW[tl.req]}</text>`);
    const specialRow = tl.special && SPECIAL_ROW[tl.special];
    // conditional box
    const emblemY = rows >= 3 ? cy - 0.42 * R : rows >= 2 ? cy - 0.3 * R : cy - 0.12 * R;
    out.push(`<text x="${emX}" y="${emblemY + 8 * s}" font-size="${(rows >= 2 ? 17 : 22) * s}" class="tf-t emblem">${TYPE_EMBLEM[tl.type]}</text>`);
    if (specialRow) {
      const boxH = 16 * s; const boxY = cy + H - boxH - 5 * s;
      out.push(`<rect x="${cx - 0.7 * R}" y="${boxY}" width="${1.4 * R}" height="${boxH}" rx="${4 * s}" fill="rgba(15,15,25,.82)" stroke="rgba(255,255,255,.35)" stroke-width="${0.7 * s}"/>`);
      out.push(`<text x="${cx}" y="${boxY + boxH / 2 + 3 * s}" font-size="${7.5 * s}" fill="#fff" class="tf-t b" textLength="${(1.3 * R).toFixed(1)}" lengthAdjust="spacingAndGlyphs">${esc(specialRow)}</text>`);
    }
    if (rows) {
      const rh = (rows >= 3 ? 13.5 : 15) * s;
      const boxH = rows * rh + 4 * s;
      const boxY = cy + H - boxH - 5 * s;
      out.push(`<rect x="${cx - 0.66 * R}" y="${boxY}" width="${1.32 * R}" height="${boxH}" rx="${4 * s}" fill="rgba(15,15,25,.82)" stroke="rgba(255,255,255,.35)" stroke-width="${0.7 * s}"/>`);
      const rs = rows >= 3 ? s * 0.9 : s;
      tl.cond.forEach((cn, i) => out.push(condRow(cn, cx, boxY + 2 * s + rh * i + rh / 2, rs)));
    }
  }
  if (opts.last) out.push(`<polygon points="${hexPts(cx, cy, R - 1)}" class="hex-last"/>`);
  return out.join('');
}

// Border label (name + effects), centred at (cx, cy)
export function borderLabel(id, lake, cx, cy, s = 1) {
  const def = BORDER_BY_ID[id];
  const out = [];
  if (lake) {
    out.push(`<text x="${cx}" y="${cy - 4 * s}" font-size="${11 * s}" fill="#fff" class="tf-t b cost">호수 보더</text>`);
    out.push(`<g transform="translate(${cx - 18 * s},${cy + 11 * s})">${resIcon('money', 2, 0, 0, s * 0.85)}</g><text x="${cx + 8 * s}" y="${cy + 14 * s}" font-size="${8 * s}" fill="#fff" class="tf-t b cost">홈마다</text>`);
    return out.join('');
  }
  out.push(`<text x="${cx}" y="${cy - 10 * s}" font-size="${11 * s}" fill="#fff" class="tf-t b cost">${esc(def.ko)}</text>`);
  for (let i = 0; i < (def.stars || 0); i++) out.push(`<polygon points="${starPath(cx - 40 * s - i * 12 * s, cy - 14 * s, 6 * s)}" fill="#ffcf33" stroke="#7a5a00" stroke-width="${0.8 * s}"/>`);
  const imm = ['income', 'rep', 'pop', 'money'].filter((k) => def.imm[k]);
  let x = cx - (imm.length ? 34 : 0) * s;
  imm.forEach((k) => { out.push(`<g transform="translate(${x},${cy + 8 * s})">${resIcon(k, def.imm[k], 0, 0, s * 0.85)}</g>`); x += 20 * s; });
  def.cond.forEach((cn) => out.push(condRow({ ...cn, scope: 'adj' }, cx + (imm.length ? 18 : 0) * s, cy + 8 * s, s)));
  return out.join('');
}

export function borderCardSvg(id, width = 150) {
  const W = 150; const Hh = 64;
  const def = BORDER_BY_ID[id];
  return `<svg viewBox="0 0 ${W} ${Hh}" width="${width}" class="border-svg">
    <path d="M0,10 L15,0 L30,10 L45,0 L60,10 L75,0 L90,10 L105,0 L120,10 L135,0 L150,10 L150,${Hh} L0,${Hh} Z" fill="#8b5e34" stroke="#3a2410" stroke-width="2"/>
    <text x="10" y="${Hh - 8}" font-size="13" fill="#ffe27a" class="tf-t b cost" style="text-anchor:start">$${def.cost}</text>
    ${borderLabel(id, false, W / 2 + 10, 32, 1)}</svg>`;
}

export function tileSvg(rec, size = 100, cls = 'tile-svg') {
  const R = 50;
  return `<svg viewBox="${-R - 2} ${-R * 0.87 - 2} ${2 * R + 4} ${R * 1.732 + 4}" class="${cls}" width="${size}">${tileFace(rec, 0, 0, R)}</svg>`;
}
