import { TILE_BY_ID, TYPE_INFO, ICON_INFO, GOAL_BY_ID, METRIC_KO, BASIC_IDS, RED_LINES, describeTile, BORDER_BY_ID, BONUS_BY_ID, describeImmediate, describeCond, EXPANSIONS, STAR_MAX, STAR_CAP, STAR_INCOME_AT, STAR_REP_AT } from '../engine/tiles.js';
import { placementCells, previewAction, metrics, goalLeaders, borderCandidates, borderAt, costOf, mc } from '../engine/engine.js';
import { setPlayerCount, borderCardSvg, setStarsActive } from './tileface.js';

// Tile description; stars are marked as inactive when the 5★ Star Track is not in play.
let starsOn = true;
function descTile(tl) {
  const d = describeTile(tl);
  if (tl.stars && !starsOn) d.imm = d.imm.replace(`★${tl.stars}`, `★${tl.stars}(5★ 없이는 효과 없음)`);
  return d;
}
import { BOT_LEVELS } from '../engine/bots.js';
import { HostSession, ClientSession, savedHostGame, clearSavedHostGame, MAX_SEATS } from '../net/session.js';
import { boroughSvg, miniTileSvg, populationBoardSvg } from './board.js';

const $root = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sign = (n) => (n > 0 ? `+${n}` : `${n}`);
const store = {
  get: (k, d = '') => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

let session = null;
const ui = {
  name: store.get('suburbia.name', ''), joinCode: '', sel: null, viewIdx: null, info: null, modal: null,
  lastToastAt: 0, toast: null, error: null, chatDraft: '', logOpen: false,
};

// ───────────────────────── session wiring ─────────────────────────
function startSession(s) {
  session?.close();
  session = s;
  ui.sel = null; ui.viewIdx = null; ui.error = null;
  session.on(() => {
    const snap = session.snapshot();
    if (snap.toast && snap.toast.at > ui.lastToastAt) { ui.lastToastAt = snap.toast.at; showToast(snap.toast.text); }
    if (session.error) { showToast(session.error, true); session.error = null; }
    // drop a stale selection when it's no longer my turn
    const v = snap.view;
    if (ui.sel && (!v || v.phase !== 'play' || v.players[v.current]?.id !== snap.myId)) ui.sel = null;
    render();
  });
  render();
}

let toastTimer = null;
function showToast(text, bad = false) {
  ui.toast = { text, bad };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { ui.toast = null; render(); }, 3500);
}

// ───────────────────────── render root ─────────────────────────
function render() {
  const snap = session?.snapshot();
  let html;
  if (!session) html = homeHtml();
  else if (snap.fatal) html = fatalHtml(snap.fatal);
  else if (!snap.view) html = lobbyHtml(snap);
  else html = gameHtml(snap);
  if (ui.modal) html += modalHtml(snap);
  if (ui.toast) html += `<div class="toast ${ui.toast.bad ? 'bad' : ''}">${esc(ui.toast.text)}</div>`;
  const chat = document.activeElement?.id === 'chat-input';
  const nameFocus = document.activeElement?.id;
  const scrollers = [...$root.querySelectorAll('[data-keep-scroll]')].map((el) => [el.dataset.keepScroll, el.scrollTop, el.scrollLeft]);
  $root.innerHTML = html;
  for (const [id, top, left] of scrollers) { const el = $root.querySelector(`[data-keep-scroll="${id}"]`); if (el) { el.scrollTop = top; el.scrollLeft = left; } }
  if (chat) { const el = document.getElementById('chat-input'); el?.focus(); el?.setSelectionRange(el.value.length, el.value.length); }
  else if (nameFocus && ['name-input', 'code-input', 'peer-input'].includes(nameFocus)) {
    const el = document.getElementById(nameFocus); el?.focus(); el?.setSelectionRange(el.value.length, el.value.length);
  }
}

// ───────────────────────── home ─────────────────────────
function homeHtml() {
  const saved = savedHostGame();
  return `
  <div class="home">
    <div class="logo">서버비아<small>SUBURBIA</small></div>
    <p class="tagline">작은 마을을 대도시로. 친구들과 온라인으로, 또는 봇과 함께.</p>
    <div class="panel home-panel">
      <label>내 이름<input id="name-input" maxlength="16" value="${esc(ui.name)}" placeholder="이름을 입력하세요" data-input="name"></label>
      <div class="home-actions">
        <button class="btn primary big" data-act="host-online">🌐 온라인 방 만들기</button>
        <div class="join-row">
          <input id="code-input" maxlength="5" value="${esc(ui.joinCode)}" placeholder="방 코드" data-input="code" autocapitalize="characters">
          <button class="btn big" data-act="join">참가하기</button>
        </div>
        <button class="btn big" data-act="host-offline">🤖 봇과 연습하기 (오프라인)</button>
        ${saved ? `<button class="btn ghost" data-act="resume">↩ 이전 게임 이어하기 (방 ${esc(saved.code)} · ${new Date(saved.savedAt).toLocaleString('ko-KR')})</button>` : ''}
      </div>
      <details class="adv"><summary>고급 설정</summary>
        <label>PeerJS 서버 (비워두면 기본 무료 서버)<input id="peer-input" value="${esc(store.get('suburbia.peerServer'))}" placeholder="예: my-server.com:443" data-input="peer"></label>
      </details>
    </div>
    <button class="btn link" data-act="rules">📖 규칙 요약 보기</button>
  </div>`;
}

function fatalHtml(msg) {
  return `<div class="home"><div class="panel home-panel"><h2>${esc(msg)}</h2><button class="btn primary" data-act="leave">처음으로</button></div></div>`;
}

// ───────────────────────── lobby ─────────────────────────
function netBadge(snap) {
  const m = { online: ['온라인', 'ok'], connecting: ['연결 중…', 'wait'], reconnecting: ['재연결 중…', 'wait'], error: ['연결 오류', 'bad'], offline: ['오프라인', 'off'] }[snap.netStatus] || ['?', 'off'];
  return `<span class="net ${m[1]}" title="${esc(snap.netError || '')}">● ${m[0]}</span>`;
}

function lobbyHtml(snap) {
  const isHost = snap.role === 'host';
  const seats = snap.lobby?.seats || [];
  return `
  <div class="lobby">
    <div class="panel">
      <div class="lobby-head">
        <h2>대기실</h2>${netBadge(snap)}
      </div>
      ${snap.online !== false ? `
      <div class="room-code">
        <span>방 코드</span><b>${esc(snap.code)}</b>
        <button class="btn small" data-act="copy-code">복사</button>
      </div>
      <p class="hint">친구에게 방 코드를 알려주세요. 친구는 첫 화면에서 코드를 입력하고 「참가하기」를 누르면 됩니다.</p>` : '<p class="hint">오프라인 연습 모드입니다. 봇을 추가해서 시작하세요.</p>'}
      ${snap.netError ? `<p class="err">${esc(snap.netError)}</p>` : ''}
      <ul class="seats">
        ${seats.map((s, i) => `
          <li class="seat">
            <span class="seat-no">${i + 1}</span>
            <span class="seat-name">${esc(s.name)}</span>
            <span class="tag ${s.type}">${s.type === 'host' ? '방장' : s.type === 'bot' ? `봇 · ${BOT_LEVELS[s.level]}` : '플레이어'}</span>
            ${isHost && s.type !== 'host' ? `<button class="btn small ghost" data-act="kick" data-id="${esc(s.id)}">✕</button>` : ''}
          </li>`).join('')}
        ${Array.from({ length: Math.max(0, maxSeatsOf(snap) - seats.length) }, () => '<li class="seat empty">빈 자리</li>').join('')}
      </ul>
      <div class="exp-list"><div class="exp-title">확장 ${isHost ? '<small class="muted">(방장이 선택)</small>' : ''}</div>
      ${EXPANSIONS.map((e) => `<label class="exp-toggle" data-act="${isHost ? 'toggle-exp' : 'noop'}" data-exp="${e.id}"><input type="checkbox" ${snap.lobby?.expansions?.[e.id] ? 'checked' : ''} ${isHost ? '' : 'disabled'}>
        <span><b>${esc(e.ko)}</b><br><small class="muted">${esc(e.desc)}</small></span></label>`).join('')}</div>
      ${isHost ? `
        <div class="bot-add">
          <span>봇 추가:</span>
          ${Object.entries(BOT_LEVELS).map(([k, v]) => `<button class="btn small" data-act="add-bot" data-level="${k}" ${seats.length >= maxSeatsOf(snap) ? 'disabled' : ''}>${v}</button>`).join('')}
        </div>
        <button class="btn primary big" data-act="start" ${seats.length < 2 ? 'disabled' : ''}>게임 시작 (${seats.length}명)</button>
        ${seats.length < 2 ? '<p class="hint">2명 이상이 필요합니다. 봇으로 채울 수 있어요.</p>' : ''}
      ` : '<p class="hint wait">방장이 게임을 시작하기를 기다리는 중…</p>'}
      <button class="btn link" data-act="leave">나가기</button>
    </div>
    ${chatHtml(snap)}
  </div>`;
}

const maxSeatsOf = (snap) => (snap.lobby?.expansions?.five ? 5 : MAX_SEATS);

function chatHtml(snap) {
  if (snap.online === false) return '';
  const msgs = snap.lobby?.chat || [];
  return `<div class="panel chat">
    <div class="chat-log" data-keep-scroll="chat">${msgs.map((m) => `<div><b>${esc(m.name)}</b> ${esc(m.text)}</div>`).join('') || '<div class="muted">채팅</div>'}</div>
    <form data-form="chat"><input id="chat-input" value="${esc(ui.chatDraft)}" data-input="chat" placeholder="메시지…" maxlength="200" autocomplete="off"><button class="btn small">전송</button></form>
  </div>`;
}

// ───────────────────────── game ─────────────────────────
const myIndex = (snap) => snap.view.players.findIndex((p) => p.id === snap.myId);

function selAction(snap) {
  const s = ui.sel;
  if (!s) return null;
  if (s.src === 'market' && s.mode && s.cell) return { type: s.mode === 'lake' ? 'lake' : 'buy', slot: s.slot, cell: s.cell };
  if (s.src === 'basic' && s.cell && s.discard != null) return { type: 'basic', kind: s.kind, cell: s.cell, discard: s.discard };
  if (s.src === 'invest' && s.cell && s.discard != null) return { type: 'invest', cell: s.cell, discard: s.discard };
  if (s.src === 'border' && s.cands?.length && s.discard != null) {
    const c = s.cands[s.ci]; return { type: 'border', idx: s.idx, c0: c.c0, orient: c.orient, lake: !!s.lake, discard: s.discard };
  }
  if (s.src === 'redevelop' && s.cell) {
    if (s.slot != null) return { type: 'redevelop', cell: s.cell, slot: s.slot, lake: s.mode === 'lake' };
    if (s.kind && s.discard != null) return { type: 'redevelop', cell: s.cell, kind: s.kind, discard: s.discard };
  }
  return null;
}
// action used only to preview effects (discard defaults to a free slot)
function previewActionFor(snap) {
  const s = ui.sel; const v = snap.view;
  if (!s || !s.cell) return null;
  const free = (() => { for (let i = v.market.length - 1; i >= 0; i--) if (v.market[i]) return i; return 0; })();
  if (s.src === 'border' && s.cands?.length) { const c = s.cands[s.ci]; return { type: 'border', idx: s.idx, c0: c.c0, orient: c.orient, lake: !!s.lake, discard: s.discard ?? free }; }
  if (s.src === 'redevelop' && s.kind) return { type: 'redevelop', cell: s.cell, kind: s.kind, discard: s.discard ?? free };
  if (s.src === 'basic') return { type: 'basic', kind: s.kind, cell: s.cell, discard: s.discard ?? free };
  if (s.src === 'invest') return { type: 'invest', cell: s.cell, discard: s.discard ?? free };
  return selAction(snap);
}
function needsDiscard() {
  const s = ui.sel;
  if (!s) return false;
  if (s.src === 'basic' || s.src === 'invest') return !!s.cell;
  if (s.src === 'border') return !!s.cands?.length;
  if (s.src === 'redevelop') return !!(s.cell && s.kind);
  return false;
}
const plannerCells = (v, me) => Object.entries(v.players[me].tiles).filter(([, r]) => r.id === 'planner' && !r.lake && r.turn !== v.turn).map(([k]) => k);

function gameHtml(snap) {
  const v = snap.view;
  const me = myIndex(snap);
  const n = v.players.length;
  const cur = v.players[v.current];
  const myTurn = v.phase === 'play' && me === v.current;
  if (ui.viewIdx === null || ui.viewIdx >= n) ui.viewIdx = me >= 0 ? me : 0;
  if (ui.sel && me >= 0) ui.viewIdx = me;
  const round = Math.floor(v.turn / n) + 1;
  const sc = v.stackCounts;
  setPlayerCount(n);
  starsOn = !!v.exp?.five; setStarsActive(starsOn);
  return `
  <div class="game">
    <header class="topbar">
      <div class="brand">서버비아</div>
      <div class="tb-item">라운드 <b>${round}</b></div>
      <div class="tb-item stacks">더미 <span class="sA">A ${sc.A}</span><span class="sB">B ${sc.B}</span><span class="sC">C ${sc.C}</span></div>
      ${v.moreRoundRevealed && v.phase !== 'over' ? '<div class="tb-item alert">⏰ 마지막 라운드 진행 중</div>' : ''}
      <div class="tb-item turn" style="--pc:${cur.color}">${v.phase === 'over' ? '게임 종료' : `<i></i>${esc(cur.name)}의 차례`}</div>
      <div class="tb-right">
        ${snap.online !== false ? `<span class="tb-item">방 <b>${esc(snap.code)}</b></span>${netBadge(snap)}` : ''}
        <button class="btn small ghost" data-act="rules">규칙</button>
        <button class="btn small ghost" data-act="ask-leave">나가기</button>
      </div>
    </header>
    <div class="layout">
      <section class="col-market">
        ${marketHtml(snap, myTurn)}
        ${v.exp?.inc ? incPanelHtml(snap, myTurn) : ''}
        ${goalsHtml(snap)}
      </section>
      <section class="col-board">
        ${actionBarHtml(snap, myTurn, me)}
        ${tabsHtml(snap)}
        <div class="board-wrap">${boardHtml(snap, me)}</div>
        <div class="panel popwrap"><h3>인구 보드 <small>모든 플레이어의 인구 위치 · 🚩레드라인</small></h3>${populationBoardSvg(v.players, RED_LINES)}</div>
      </section>
      <section class="col-side">
        ${v.exp?.five ? starTrackHtml(snap) : ''}
        ${playersHtml(snap)}
        ${logHtml(snap)}
        ${chatHtml(snap)}
      </section>
    </div>
  </div>`;
}

function cardHtml(id, opts = {}) {
  const tl = TILE_BY_ID[id];
  const d = descTile(tl);
  return `
    <div class="card-top"><span class="ctype">${TYPE_INFO[tl.type].ko}${tl.icon ? ` ${ICON_INFO[tl.icon].glyph}` : ''}</span><span class="ccost">$${tl.cost}</span></div>
    <div class="card-name">${esc(tl.ko)}</div>
    <div class="card-en">${esc(tl.en)}</div>
    ${d.imm ? `<div class="card-imm">즉시: ${esc(d.imm)}</div>` : ''}
    ${d.cond.map((x) => `<div class="card-cond">${esc(x)}</div>`).join('')}
    ${opts.extra || ''}`;
}

function marketHtml(snap, myTurn) {
  const v = snap.view;
  const me = v.players[myIndex(snap)];
  const s = ui.sel;
  const discardStep = myTurn && needsDiscard();
  let extraCost = 0;
  if (s?.src === 'basic') extraCost = TILE_BY_ID[s.kind].cost;
  else if (s?.src === 'border') extraCost = s.lake ? 0 : BORDER_BY_ID[v.borderOpen[s.idx]].cost;
  else if (s?.src === 'invest' && s.cell) {
    const r = me.tiles[s.cell] || borderAt(me, s.cell);
    extraCost = !r || r.lake ? 0 : r.border ? BORDER_BY_ID[r.id].cost : costOf(v, r.id);
  }
  const cards = v.market.map((id, i) => {
    if (!id) return '<div class="card empty">비어 있음</div>';
    const total = costOf(v, id) + mc(v)[i];
    const canBuy = me && me.money >= total;
    const selected = (s?.src === 'market' || s?.src === 'redevelop') && s.slot === i;
    const disc = discardStep ? `<button class="btn small warn" data-act="discard" data-slot="${i}" ${me.money < extraCost + mc(v)[i] ? 'disabled' : ''}>${s.discard === i ? '✔ 버림' : `버리기 $${mc(v)[i]}`}</button>` : '';
    return `<div class="card t-${TILE_BY_ID[id].type} ${selected ? 'selected' : ''} ${discardStep && s.discard === i ? 'discarding' : ''}" data-act="${discardStep ? 'discard' : 'pick-market'}" data-slot="${i}" title="${esc(TILE_BY_ID[id].ko + ' — ' + [descTile(TILE_BY_ID[id]).imm, ...descTile(TILE_BY_ID[id]).cond].filter(Boolean).join(' / '))}">
      <div class="slot-cost">+$${mc(v)[i]}</div>
      ${miniTileSvg(id, false, 'card-hex')}
      <div class="card-en">${esc(TILE_BY_ID[id].en)}</div>
      <div class="card-desc">${[descTile(TILE_BY_ID[id]).imm && `즉시 ${descTile(TILE_BY_ID[id]).imm}`, ...descTile(TILE_BY_ID[id]).cond].filter(Boolean).map(esc).join('<br>')}</div>
      <div class="card-price ${canBuy ? '' : 'no'}">총 $${total}</div>
      ${disc}
    </div>`;
  }).join('');
  const basics = BASIC_IDS.map((k) => {
    const tl = TILE_BY_ID[k];
    const left = v.basics[k];
    const selected = s?.src === 'basic' && s.kind === k;
    return `<div class="basic ${selected ? 'selected' : ''} ${left ? '' : 'out'}" data-act="pick-basic" data-kind="${k}">
      ${miniTileSvg(k, false, 'basic-hex')}<div><b>${tl.ko}</b> $${tl.cost}<br><small>${esc(descTile(tl).imm)}${tl.cond.length ? ` · ${esc(descTile(tl).cond[0])}` : ''}</small><br><small class="muted">남은 수 ${left}</small></div>
    </div>`;
  }).join('');
  return `<div class="panel market">
    <h3>부동산 시장 <small>왼쪽이 새 타일 · 오른쪽으로 갈수록 저렴</small></h3>
    <div class="cards" data-keep-scroll="market">${cards}</div>
    <h3>기본 타일 <small>사면 시장 타일 1장을 버려야 함</small></h3>
    <div class="basics">${basics}</div>
  </div>`;
}

function incPanelHtml(snap, myTurn) {
  const v = snap.view;
  const me = myIndex(snap);
  const s = ui.sel;
  const cards = v.borderOpen.map((id, i) => {
    const d = BORDER_BY_ID[id];
    const desc = [describeImmediate(d) && `즉시 ${describeImmediate(d)}`, ...d.cond.map(describeCond)].filter(Boolean).join(' / ');
    return `<div class="bcard ${s?.src === 'border' && s.idx === i ? 'selected' : ''}" data-act="pick-border" data-idx="${i}" title="${esc(d.ko + ' — ' + desc)}">${borderCardSvg(id)}<small>${esc(desc)}</small></div>`;
  }).join('') || '<div class="muted">남은 보더가 없습니다</div>';
  const bt = (which) => {
    const id = v[which]; if (!id) return '';
    const def = BONUS_BY_ID[id]; const spec = def[which];
    const mine = me >= 0 ? (def.metric === 'pop' ? v.players[me].pop : metrics(v.players[me])[def.metric]) : null;
    const done = v[`${which}Done`];
    return `<div class="bonus-tile ${which === 'challenge' ? 'ch' : ''} ${done ? 'done' : ''}">
      <b>${which === 'bonus' ? '보너스' : '챌린지'}</b> <small class="muted">${which === 'bonus' ? 'A 더미가 바닥나면' : 'B 더미가 바닥나면'}${done ? ' · 완료' : ''}</small><br>
      ${esc(def.ko)} ${spec.need} 이상 → <b>${which === 'bonus' ? `수입 +${spec.income}` : `평판 +${spec.rep}`}</b>
      ${mine !== null && !done ? `<br><small class="${mine >= spec.need ? 'ok' : 'muted'}">내 현재: ${mine}</small>` : ''}</div>`;
  };
  return `<div class="panel inc-panel">
    <h3>보더 타일 <small>Suburbia Inc. · 사면 시장 타일 1장을 버림 · 더미 ${v.borderDeckCount ?? 0}장</small></h3>
    <div class="bcards">${cards}</div>
    <div class="bonus-row">${bt('bonus')}${bt('challenge')}</div>
  </div>`;
}

function goalsHtml(snap) {
  const v = snap.view;
  const me = myIndex(snap);
  const goalRow = (gid, mine = false) => {
    const g = GOAL_BY_ID[gid];
    const L = goalLeaders(v, gid);
    const who = L.unique !== null ? v.players[L.unique].name : L.who.length === v.players.length ? '모두 동률' : `${L.who.map((i) => v.players[i].name).join(', ')} 동률`;
    const status = mine ? (L.unique === me ? '<span class="ok">달성 중</span>' : '<span class="no">미달성</span>') : `<span class="muted">${esc(who)}</span>`;
    return `<div class="goal ${mine ? 'mine' : ''}"><div><b>${esc(g.ko)}</b> <span class="bonus">+${g.bonus}</span></div>
      <div class="goal-cond">${METRIC_KO[g.metric]} ${g.dir === 'max' ? '가장 많음' : '가장 적음'} (현재 ${L.best})</div><div>${status}</div></div>`;
  };
  const mine = me >= 0 ? v.players[me].privateGoal : null;
  return `<div class="panel goals">
    <h3>공개 목표 <small>단독 1위만 보너스</small></h3>
    ${v.publicGoals.map((g) => goalRow(g)).join('')}
    ${mine && mine !== 'hidden' ? `<h3>내 비공개 목표</h3>${goalRow(mine, true)}` : ''}
  </div>`;
}

function deltaText(sum, pi, players) {
  const parts = [];
  const d = sum[pi];
  if (!d) return '';
  if (d.income) parts.push(`수입 ${sign(d.income)}`);
  if (d.rep) parts.push(`평판 ${sign(d.rep)}`);
  if (d.pop) parts.push(`인구 ${sign(d.pop)}`);
  if (d.money) parts.push(`$${sign(d.money)}`);
  return parts.join(', ');
}

function actionBarHtml(snap, myTurn, me) {
  const v = snap.view;
  if (v.phase === 'goals') return `<div class="panel actionbar"><b>비공개 목표를 고르는 중…</b></div>`;
  if (v.phase === 'over') return `<div class="panel actionbar"><b>게임이 끝났습니다.</b> <button class="btn small primary" data-act="show-final">결과 보기</button></div>`;
  const last = v.lastAction;
  const lastLine = last ? `<div class="last">최근: <b style="color:${v.players[last.pi].color}">${esc(v.players[last.pi].name)}</b> ${esc(last.text)} ${Object.keys(summarizeSum(last)).length ? `<span class="muted">(${esc(deltaText(summarizeSum(last), last.pi, v.players))})</span>` : ''}</div>` : '';
  if (!myTurn) {
    const cur = v.players[v.current];
    return `<div class="panel actionbar"><div><span class="dot" style="background:${cur.color}"></span><b>${esc(cur.name)}</b>${cur.bot ? ' 봇이 생각 중…' : '의 차례를 기다리는 중…'}</div>${lastLine}</div>`;
  }
  const s = ui.sel;
  const p = v.players[me];
  let body = '';
  if (!s) {
    const canRedev = plannerCells(v, me).length > 0;
    body = `<b>내 차례!</b> 시장 타일이나 기본 타일${v.exp?.inc ? '·보더' : ''}를 고르거나,
      <button class="btn small" data-act="pick-invest" ${p.investLeft ? '' : 'disabled'}>투자하기 (남은 ${p.investLeft})</button>
      ${canRedev ? '<button class="btn small" data-act="pick-redevelop">🔁 재개발</button>' : ''}`;
  } else if (s.src === 'border') {
    const d = BORDER_BY_ID[v.borderOpen[s.idx]];
    const n = s.cands?.length || 0;
    body = `<div class="sel-line"><b>보더: ${esc(d.ko)}</b>
      <button class="btn small ${!s.lake ? 'primary' : ''}" data-act="border-mode" data-lake="0" ${p.money >= d.cost ? '' : 'disabled'}>설치 $${d.cost}</button>
      <button class="btn small ${s.lake ? 'primary' : ''}" data-act="border-mode" data-lake="1">호수 보더로 (무료)</button>
      ${n > 1 ? `<button class="btn small" data-act="rotate">↻ 방향 바꾸기 (${s.ci + 1}/${n})</button>` : ''}
      <button class="btn small ghost" data-act="cancel">취소</button></div>
      <div class="hint">${!n ? '구역판에서 보더를 놓을 칸(▦)을 고르세요. 노란 선이 있는 쪽(홈 4칸)에 닿은 타일만 인접으로 칩니다.' : s.discard == null ? '시장 타일 1장을 버려야 합니다. 시장에서 「버리기」를 누르세요.' : ''}</div>`;
  } else if (s.src === 'redevelop') {
    body = `<div class="sel-line"><b>🔁 재개발</b>
      ${s.slot != null ? `<button class="btn small ${s.mode !== 'lake' ? 'primary' : ''}" data-act="mode" data-mode="build">건물로</button><button class="btn small ${s.mode === 'lake' ? 'primary' : ''}" data-act="mode" data-mode="lake">호수로</button>` : ''}
      <button class="btn small ghost" data-act="cancel">취소</button></div>
      <div class="hint">${!s.cell ? '교체할 재개발 예정지를 구역판에서 고르세요.' : s.slot == null && !s.kind ? '바꿔 넣을 시장 타일이나 기본 타일을 고르세요. 비용과 칸 추가 비용은 무료입니다.' : s.kind && s.discard == null ? '기본 타일로 바꾸면 시장 타일 1장을 버려야 합니다.' : ''}</div>`;
  } else if (s.src === 'market') {
    const id = v.market[s.slot];
    const tl = TILE_BY_ID[id];
    const total = costOf(v, id) + mc(v)[s.slot];
    body = `<div class="sel-line"><b>${esc(tl.ko)}</b>
      <button class="btn small ${s.mode === 'build' ? 'primary' : ''}" data-act="mode" data-mode="build" ${p.money >= total ? '' : 'disabled'}>건설 $${total}</button>
      <button class="btn small ${s.mode === 'lake' ? 'primary' : ''}" data-act="mode" data-mode="lake" ${p.money >= mc(v)[s.slot] ? '' : 'disabled'}>호수로 만들기 $${mc(v)[s.slot]}</button>
      <button class="btn small ghost" data-act="cancel">취소</button></div>
      ${s.mode ? `<div class="hint">${s.cell ? '' : '아래 내 구역에서 놓을 칸(+)을 고르세요.'}</div>` : '<div class="hint">건설할지, 뒤집어서 호수로 만들지 고르세요. 호수는 인접 건물마다 $2를 줍니다.</div>'}`;
  } else if (s.src === 'basic') {
    body = `<div class="sel-line"><b>${TILE_BY_ID[s.kind].ko}</b> $${TILE_BY_ID[s.kind].cost} <button class="btn small ghost" data-act="cancel">취소</button></div>
      <div class="hint">${!s.cell ? '놓을 칸(+)을 고르세요.' : s.discard == null ? '규칙상 시장 타일 1장을 버려야 합니다. 시장에서 「버리기」를 누르세요.' : ''}</div>`;
  } else if (s.src === 'invest') {
    body = `<div class="sel-line"><b>투자하기</b> <button class="btn small ghost" data-act="cancel">취소</button></div>
      <div class="hint">${!s.cell ? '투자할 내 타일을 고르세요. 타일 비용을 한 번 더 내면 효과가 2배가 됩니다.' : s.discard == null ? '시장 타일 1장을 버려야 합니다. 시장에서 「버리기」를 누르세요.' : ''}</div>`;
  }
  // preview
  const pa = previewActionFor(snap);
  let prev = '';
  if (pa) {
    const r = previewAction(v, me, pa);
    if (r.ok) {
      const others = v.players.map((pl, i) => (i !== me && r.sum[i] ? `${esc(pl.name)}: ${esc(deltaText(r.sum, i))}` : null)).filter(Boolean);
      prev = `<div class="preview"><div>예상 효과: <b>${esc(deltaText(r.sum, me) || '변화 없음')}</b> <span class="muted">(그 뒤 수입·평판 정산)</span></div>
        ${others.length ? `<div class="muted">다른 플레이어: ${others.join(' · ')}</div>` : ''}</div>`;
    } else prev = `<div class="err">${esc(r.error)}</div>`;
  }
  const ready = selAction(snap);
  return `<div class="panel actionbar mine">${body}${prev}
    ${ready ? '<button class="btn primary big confirm" data-act="confirm">✔ 확정</button>' : ''}
    ${lastLine}</div>`;
}
function summarizeSum(last) {
  const per = {};
  for (const d of last.deltas || []) { per[d.pi] ??= { income: 0, rep: 0, pop: 0, money: 0 }; per[d.pi][d.res] += d.amt; }
  return per;
}

function tabsHtml(snap) {
  const v = snap.view;
  return `<div class="tabs">${v.players.map((p, i) => `<button class="tab ${ui.viewIdx === i ? 'on' : ''}" style="--pc:${p.color}" data-act="view" data-idx="${i}">${esc(p.name)}${p.id === snap.myId ? ' (나)' : ''}</button>`).join('')}</div>`;
}

function boardHtml(snap, me) {
  const v = snap.view;
  const idx = ui.viewIdx;
  const p = v.players[idx];
  const s = ui.sel;
  const opts = {};
  const last = v.lastAction;
  if (last && last.pi === idx && last.action.cell) opts.lastCell = last.action.cell;
  if (s && idx === me) {
    if (s.src === 'invest') {
      opts.selectable = new Set([
        ...Object.entries(p.tiles).filter(([, r]) => !r.inv && (r.lake || !TILE_BY_ID[r.id].noInvest)).map(([k]) => k),
        ...(p.borders || []).filter((b) => !b.inv).flatMap((b) => b.cells),
      ]);
      opts.picked = s.cell;
    } else if (s.src === 'border') {
      opts.borderCells = new Set(borderCandidates(v, me, !!s.lake).flatMap((c) => c.cells));
      if (s.cands?.length) opts.borderGhost = { ...s.cands[s.ci], id: v.borderOpen[s.idx], lake: !!s.lake };
    } else if (s.src === 'redevelop') {
      opts.selectable = new Set(plannerCells(v, me));
      opts.picked = s.cell;
    } else if (s.src === 'basic' || s.mode) {
      opts.cells = new Set(placementCells(v, me));
      opts.picked = s.cell;
      opts.ghost = s.src === 'basic' ? { id: s.kind } : { id: v.market[s.slot], lake: s.mode === 'lake' };
    }
  }
  return boroughSvg(p, opts);
}

function starTrackHtml(snap) {
  const v = snap.view;
  const W = 340; const step = (W - 20) / (STAR_MAX + 1);
  const cells = [];
  for (let t = 0; t <= STAR_MAX; t++) {
    const x = 10 + t * step;
    cells.push(`<rect x="${x}" y="22" width="${step - 2}" height="40" rx="4" class="st-cell ${STAR_CAP[t] ? 'cap' : ''}"/>`);
    cells.push(`<text x="${x + step / 2 - 1}" y="17" class="st-num">${t}</text>`);
    if (STAR_CAP[t]) cells.push(`<text x="${x + step / 2 - 1}" y="76" class="st-cap">최대 ${STAR_CAP[t]}</text>`);
  }
  const line = (t, label, cls) => { const x = 10 + t * step - 2; return `<line x1="${x}" y1="18" x2="${x}" y2="66" class="st-line ${cls}"/><text x="${x}" y="90" class="st-lbl ${cls}">${label}</text>`; };
  const tokens = [];
  const byPos = {};
  v.players.forEach((p, i) => { (byPos[p.starPos || 0] ??= []).push([p, i]); });
  for (const [pos, list] of Object.entries(byPos)) {
    list.sort((a, b) => (b[0].starStamp || 0) - (a[0].starStamp || 0));
    list.forEach(([p], k) => {
      const x = 10 + Number(pos) * step + step / 2 - 1; const y = 30 + k * 7;
      tokens.push(`<polygon points="${starPts(x, y, 6)}" fill="${p.color}" stroke="#fff" stroke-width="1"><title>${esc(p.name)} ★${p.starPos}</title></polygon>`);
    });
  }
  const order = (v.order || v.players.map((_, i) => i)).map((i) => `<span class="ord" style="--pc:${v.players[i].color}">${esc(v.players[i].name)}</span>`).join('<span class="muted">→</span>');
  return `<div class="panel startrack"><h3>★ 스타 트랙 <small>라운드마다 최다 +1 인구 · 최소 -1 인구</small></h3>
    <svg viewBox="0 0 ${W} 96" class="st-svg">${cells.join('')}${line(STAR_INCOME_AT, '수입+1', 'inc')}${line(STAR_REP_AT, '평판+1', 'rep')}${tokens.join('')}</svg>
    <div class="order-row"><small class="muted">이번 라운드 턴 순서</small><div>${order}</div></div></div>`;
}
function starPts(x, y, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? r * 0.45 : r; pts.push(`${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`); }
  return pts.join(' ');
}

function playersHtml(snap) {
  const v = snap.view;
  const seats = snap.lobby?.seats || [];
  return `<div class="panel players">${v.players.map((p, i) => {
    const m = metrics(p);
    const nextRL = RED_LINES.find((x) => x > p.pop);
    const seat = seats.find((s) => s.id === p.id);
    const off = seat && seat.type !== 'bot' && seat.connected === false;
    return `<div class="pcard ${v.current === i && v.phase === 'play' ? 'active' : ''}" style="--pc:${p.color}" data-act="view" data-idx="${i}">
      <div class="pc-head"><span class="dot"></span><b>${esc(p.name)}</b>${p.bot ? `<span class="tag bot">봇 ${BOT_LEVELS[p.bot] || ''}</span>` : ''}${off ? '<span class="tag off">연결 끊김</span>' : ''}${(v.order?.[0] ?? 0) === i ? '<span class="tag sp">선</span>' : ''}${v.exp?.five ? `<span class="tag star">★${p.starPos || 0}</span>` : ''}${p.nightImmune ? '<span class="tag night" title="나이트라이프 부정 효과 무시">🌙면역</span>' : ''}</div>
      <div class="stats">
        <div><small>자금</small><b>$${p.money}</b></div>
        <div><small>수입</small><b class="${p.income < 0 ? 'neg' : ''}">${sign(p.income)}</b></div>
        <div><small>평판</small><b class="${p.rep < 0 ? 'neg' : ''}">${sign(p.rep)}</b></div>
        <div><small>인구</small><b class="pop">${p.pop}</b></div>
      </div>
      <div class="pc-foot"><span class="tR">주${m.R}</span><span class="tC">상${m.C}</span><span class="tI">산${m.I}</span><span class="tV">공${m.V}</span><span class="tL">호${m.lakes}</span>${v.exp?.inc ? `<span class="tB" title="보더">보더${m.borders}</span>` : ''}
        <span title="투자 마커">🪙${p.investLeft}</span><span class="muted" title="다음 레드라인">🚩${nextRL}</span></div>
      ${off && snap.role === 'host' && !p.bot ? `<button class="btn small" data-act="cover" data-id="${esc(p.id)}">봇이 대신 플레이</button>` : ''}
    </div>`;
  }).join('')}</div>`;
}

function logHtml(snap) {
  const v = snap.view;
  const items = v.log.slice(-40).reverse();
  return `<div class="panel log"><h3>기록</h3><div class="log-list" data-keep-scroll="log">${items.map((e) => {
    const p = e.pi !== null && e.pi !== undefined ? v.players[e.pi] : null;
    return `<div class="log-item">${p ? `<b style="color:${p.color}">${esc(p.name)}</b> ` : ''}${esc(e.text)}${e.sum && p ? ` <span class="muted">${esc(deltaText(e.sum, e.pi))}</span>` : ''}</div>`;
  }).join('')}</div></div>`;
}

// ───────────────────────── modals ─────────────────────────
function modalHtml(snap) {
  const m = ui.modal;
  let body = '';
  if (m === 'rules') body = rulesHtml();
  else if (m === 'final') body = finalHtml(snap);
  else if (m === 'leave') body = `<h2>게임에서 나갈까요?</h2><p>${snap?.role === 'host' ? '방장이 나가면 다른 사람들의 게임이 멈춥니다. 나중에 「이어하기」로 다시 열 수 있어요.' : '언제든 같은 방 코드로 다시 들어올 수 있어요.'}</p>
    <div class="row"><button class="btn primary" data-act="leave">나가기</button><button class="btn" data-act="close-modal">계속하기</button></div>`;
  else if (m?.border) {
    const d = BORDER_BY_ID[m.border];
    body = `<div class="info">${borderCardSvg(m.border, 220)}<div><h2>${esc(d.ko)} <small>${esc(d.en)} · 보더</small></h2>
      <p>비용 $${d.cost} · 노란 선이 있는 쪽 홈 4칸에 닿은 타일만 인접</p>
      ${describeImmediate(d) ? `<p><b>즉시 효과</b>: ${esc(describeImmediate(d))}</p>` : ''}${d.cond.map((x) => `<p><b>지속 효과</b>: ${esc(describeCond(x))}</p>`).join('')}</div></div>
      <button class="btn" data-act="close-modal">닫기</button>`;
  } else if (m?.tile) {
    const tl = TILE_BY_ID[m.tile];
    const d = descTile(tl);
    body = `<div class="info">${miniTileSvg(m.tile, false, 'info-hex')}<div><h2>${esc(tl.ko)} <small>${esc(tl.en)}</small></h2>
      <p>${TYPE_INFO[tl.type].ko}${tl.icon ? ` · ${ICON_INFO[tl.icon].ko} ${ICON_INFO[tl.icon].glyph}` : ''} · 비용 $${snap?.view ? costOf(snap.view, m.tile) : tl.cost}${tl.costPerPlayer ? ` (인원 × $${tl.costPerPlayer})` : ''} · ${tl.stack === 'basic' ? '기본 타일' : `${tl.stack} 타일`}${tl.exp ? ' · Suburbia Inc.' : ''}</p>
      ${d.imm ? `<p><b>즉시 효과</b>: ${esc(d.imm)}</p>` : ''}${d.cond.map((x) => `<p><b>지속 효과</b>: ${esc(x)}</p>`).join('')}</div></div>
      <button class="btn" data-act="close-modal">닫기</button>`;
  }
  return `<div class="modal-bg" data-act="close-modal"><div class="modal" data-stop>${body}</div></div>`;
}

function goalPickHtml(snap) {
  const v = snap.view;
  const me = v.players[myIndex(snap)];
  if (!me || me.privateGoal) return '';
  return `<div class="modal-bg"><div class="modal"><h2>비공개 목표를 하나 고르세요</h2>
    <p class="muted">게임이 끝날 때 이 목표를 <b>단독으로</b> 달성하면 인구 보너스를 받습니다.</p>
    <div class="goal-pick">${me.goalOptions.map((gid) => {
    const g = GOAL_BY_ID[gid];
    return `<button class="goal-opt" data-act="pick-goal" data-goal="${gid}"><b>${esc(g.ko)}</b><span class="bonus">+${g.bonus}</span><span>${METRIC_KO[g.metric]} ${g.dir === 'max' ? '가장 많음' : '가장 적음'}</span></button>`;
  }).join('')}</div>
    <h3>이번 게임의 공개 목표</h3><ul>${v.publicGoals.map((gid) => `<li>${esc(GOAL_BY_ID[gid].ko)} (+${GOAL_BY_ID[gid].bonus}) — ${METRIC_KO[GOAL_BY_ID[gid].metric]} ${GOAL_BY_ID[gid].dir === 'max' ? '가장 많음' : '가장 적음'}</li>`).join('')}</ul>
  </div></div>`;
}

function finalHtml(snap) {
  const v = snap.view;
  if (!v?.final) return '';
  const { rows, order } = v.final;
  return `<h2>🏆 최종 결과</h2>
  <table class="final"><thead><tr><th>순위</th><th>플레이어</th><th>인구</th><th>목표 보너스</th><th>돈→인구</th><th>최종</th></tr></thead><tbody>
  ${order.map((i, rank) => {
    const r = rows[i]; const p = v.players[i];
    const goals = r.goals.map((g) => `${GOAL_BY_ID[g.id].ko}${g.public ? '' : '(비공개)'} +${g.bonus}${g.law ? ' <span class="law-tag">⚖️동점</span>' : ''}`).join('<br>') || '-';
    return `<tr class="${rank === 0 ? 'win' : ''}"><td>${rank + 1}</td><td><span class="dot" style="background:${p.color}"></span>${esc(p.name)}</td><td>${r.basePop}</td><td>${goals}</td><td>+${r.moneyPop} <small class="muted">($${p.money})</small></td><td><b>${r.final}</b></td></tr>`;
  }).join('')}</tbody></table>
  <p class="muted">비공개 목표: ${v.players.map((p) => `${esc(p.name)} — ${p.privateGoal ? esc(GOAL_BY_ID[p.privateGoal].ko) : '-'}`).join(' · ')}</p>
  <div class="row"><button class="btn" data-act="close-modal">보드 보기</button><button class="btn primary" data-act="leave">처음으로</button></div>`;
}

function rulesHtml() {
  return `<h2>📖 서버비아 규칙 요약</h2><div class="rules">
  <p><b>목표:</b> 게임이 끝났을 때 <b>인구</b>가 가장 많은 사람이 이깁니다.</p>
  <p><b>내 차례:</b> 아래 넷 중 하나를 한 뒤, 자동으로 <b>수입만큼 돈</b>을 받고(음수면 냄) <b>평판만큼 인구</b>가 변합니다.</p>
  <ul>
    <li><b>시장 타일 건설</b>: 타일 비용 + 칸 추가 비용(왼쪽 $10 → 오른쪽 $0)</li>
    <li><b>호수 만들기</b>: 칸 추가 비용만 내고 타일을 뒤집어 놓기. 인접 건물마다 $2, 나중에 옆에 지어도 $2</li>
    <li><b>기본 타일</b>(주택가·공원·공장): 타일 비용만 내고, 대신 시장 타일 1장을 칸 비용을 내고 버림</li>
    <li><b>투자</b>: 내 타일의 비용을 한 번 더 내면 그 타일의 효과가 2배 (3번까지). 시장 타일 1장을 버림</li>
  </ul>
  <p><b>배치:</b> 새 타일은 내 타일과 한 변 이상 닿아야 합니다. 위쪽 구역판 자리에는 못 놓아요.</p>
  <p><b>효과 범위:</b> 「인접한」=맞닿은 타일, 「내 구역의」=내 타일 전부, 「모든 구역의」=모든 플레이어 타일, 「다른 구역의」=상대 타일만. 효과는 놓을 때 한 번 계산되고, 이후 조건에 맞는 타일이 지어질 때마다 다시 발동합니다.</p>
  <p><b>레드라인 🚩:</b> 인구가 레드라인을 넘을 때마다 수입과 평판이 1씩 줄어듭니다. 인구가 많을수록 레드라인이 촘촘해져요.</p>
  <p><b>Suburbia Inc. 확장 (켰을 때):</b> 보더 타일은 기본 타일처럼 사고 시장 타일 1장을 버립니다. 노란 선 쪽 홈 4칸에 닿은 타일에만 효과가 납니다. 뒷면으로 놓으면 무료 <b>호수 보더</b>가 됩니다. 보너스(수입)는 A 더미가, 챌린지(평판)는 B 더미가 바닥날 때 조건을 채운 모든 플레이어가 받습니다. 재개발 예정지는 다음 턴부터 시장·기본 타일로 무료 교체할 수 있습니다. 보더로 구역을 완전히 막을 수는 없습니다.</p>
  <p><b>Suburbia 5★ (켰을 때):</b> ★ 타일의 금색 별만큼 스타 트랙을 전진합니다(3칸을 넘으면 수입 +1, 7칸을 넘으면 평판 +1, 오른쪽 끝 칸은 인원 제한). 라운드가 끝날 때마다 별이 가장 많은 사람은 인구 +1, 가장 적은 사람은 인구 -1을 받고, 트랙 순서대로 다음 라운드 턴 순서가 정해집니다. 목표가 동점이면 트랙이 앞선 사람이 가져갑니다. 최대 5명까지 플레이할 수 있습니다(시장 8칸).</p>
  <p><b>Nightlife (켰을 때):</b> 🌙 타일의 부정 효과는 경찰서를 지으면 이후 무시하고, 야간 법원을 지으면 그동안 받은 부정 효과를 되돌립니다.</p>
  <p><b>프로모:</b> 컨벤션 타일(🎲)은 모든 컨벤션 타일마다 평판 +1, 에센 타일은 구역당 1개만 지을 수 있습니다.</p>
  <p><b>종료:</b> C 더미에서 「1 More Round」가 나오면 그 라운드를 마치고 한 라운드를 더 한 뒤 끝납니다. 공개·비공개 목표(단독 1위만), 그리고 남은 돈 $5당 인구 1을 더합니다.</p>
  </div><button class="btn" data-act="close-modal">닫기</button>`;
}

// ───────────────────────── events ─────────────────────────
function handleAct(act, el) {
  const snap = session?.snapshot();
  const v = snap?.view;
  const me = v ? myIndex(snap) : -1;
  const myTurn = v && v.phase === 'play' && me === v.current;
  switch (act) {
    case 'host-online': case 'host-offline': {
      if (!ui.name.trim()) { showToast('이름을 입력해 주세요', true); render(); return; }
      store.set('suburbia.name', ui.name.trim());
      startSession(new HostSession({ name: ui.name.trim(), online: act === 'host-online' }));
      return;
    }
    case 'join': {
      if (!ui.name.trim()) { showToast('이름을 입력해 주세요', true); render(); return; }
      if (ui.joinCode.trim().length < 5) { showToast('방 코드 5자리를 입력해 주세요', true); render(); return; }
      store.set('suburbia.name', ui.name.trim());
      startSession(new ClientSession({ name: ui.name.trim(), code: ui.joinCode }));
      return;
    }
    case 'resume': {
      const saved = savedHostGame();
      if (saved) startSession(new HostSession({ name: ui.name, online: saved.online !== false, resume: saved }));
      return;
    }
    case 'leave':
      session?.close(); session = null; ui.modal = null; render(); return;
    case 'ask-leave': ui.modal = 'leave'; break;
    case 'copy-code':
      navigator.clipboard?.writeText(snap.code).then(() => showToast('방 코드를 복사했어요'), () => showToast(snap.code));
      break;
    case 'add-bot': session.addBot(el.dataset.level); return;
    case 'kick': session.removeSeat(el.dataset.id); return;
    case 'start': session.start(); return;
    case 'cover': session.coverWithBot(el.dataset.id); return;
    case 'rules': ui.modal = 'rules'; break;
    case 'show-final': ui.modal = 'final'; break;
    case 'close-modal': ui.modal = null; break;
    case 'pick-goal': session.chooseGoal(el.dataset.goal); return;
    case 'view': ui.viewIdx = Number(el.dataset.idx); if (ui.sel) ui.sel = null; break;
    case 'noop': return;
    case 'toggle-inc': session.toggleExpansion?.('inc'); return;
    case 'toggle-exp': session.toggleExpansion?.(el.dataset.exp); return;
    case 'pick-border': {
      const idx = Number(el.dataset.idx);
      if (!myTurn) { ui.modal = { border: v.borderOpen[idx] }; break; }
      if (ui.sel?.src === 'border' && ui.sel.idx === idx) { ui.modal = { border: v.borderOpen[idx] }; break; }
      const p = v.players[me];
      ui.sel = { src: 'border', idx, lake: p.money < BORDER_BY_ID[v.borderOpen[idx]].cost, ci: 0 };
      break;
    }
    case 'border-mode': if (ui.sel?.src === 'border') { ui.sel.lake = el.dataset.lake === '1'; ui.sel.cands = null; ui.sel.cell = null; ui.sel.discard = null; } break;
    case 'rotate': if (ui.sel?.cands?.length) { ui.sel.ci = (ui.sel.ci + 1) % ui.sel.cands.length; } break;
    case 'pick-redevelop': {
      const cells = plannerCells(v, me);
      ui.sel = { src: 'redevelop', cell: cells.length === 1 ? cells[0] : null, slot: null, kind: null, mode: 'build' };
      break;
    }
    case 'pick-market': {
      const slot = Number(el.dataset.slot);
      if (!myTurn) { ui.modal = { tile: v.market[slot] }; break; }
      if (ui.sel?.src === 'redevelop') {
        if (!ui.sel.cell) { showToast('먼저 재개발 예정지를 고르세요', true); break; }
        Object.assign(ui.sel, { slot, kind: null, discard: null, mode: 'build' });
        break;
      }
      if (ui.sel?.src === 'market' && ui.sel.slot === slot) { ui.modal = { tile: v.market[slot] }; break; }
      const p = v.players[me];
      const total = costOf(v, v.market[slot]) + mc(v)[slot];
      ui.sel = { src: 'market', slot, mode: p.money >= total ? 'build' : (p.money >= mc(v)[slot] ? 'lake' : null) };
      break;
    }
    case 'pick-basic': {
      const kind = el.dataset.kind;
      if (!myTurn) { ui.modal = { tile: kind }; break; }
      if (!v.basics[kind]) { showToast('남은 타일이 없습니다', true); break; }
      if (ui.sel?.src === 'redevelop') {
        if (!ui.sel.cell) { showToast('먼저 재개발 예정지를 고르세요', true); break; }
        Object.assign(ui.sel, { kind, slot: null, discard: null });
        break;
      }
      ui.sel = { src: 'basic', kind };
      break;
    }
    case 'pick-invest': ui.sel = { src: 'invest' }; break;
    case 'mode': if (ui.sel) { ui.sel.mode = el.dataset.mode; } break;
    case 'cancel': ui.sel = null; break;
    case 'discard': if (needsDiscard()) ui.sel.discard = Number(el.dataset.slot); break;
    case 'confirm': {
      const a = selAction(snap);
      if (!a) return;
      const r = session.act(a);
      if (r && r.ok === false) showToast(r.error, true);
      ui.sel = null;
      break;
    }
    default: return;
  }
  render();
}

function handleCell(cellKey) {
  const snap = session?.snapshot();
  const v = snap?.view;
  if (!v) return;
  const me = myIndex(snap);
  const s = ui.sel;
  if (s && ui.viewIdx === me) {
    if (s.src === 'border') {
      const cands = borderCandidates(v, me, !!s.lake).filter((c) => c.cells.includes(cellKey));
      if (!cands.length) { showToast('여기에는 보더를 놓을 수 없습니다', true); render(); return; }
      Object.assign(s, { cell: cellKey, cands, ci: 0 });
      render();
      return;
    }
    if (s.src === 'redevelop') {
      if (!plannerCells(v, me).includes(cellKey)) { showToast('재개발 예정지를 골라야 합니다', true); render(); return; }
      s.cell = cellKey; render(); return;
    }
    s.cell = cellKey;
    if (s.src === 'invest') s.discard = null;
    render();
    return;
  }
  const pl = v.players[ui.viewIdx];
  const rec = pl?.tiles[cellKey];
  if (rec && !rec.lake) { ui.modal = { tile: rec.id }; render(); return; }
  const bd = pl && borderAt(pl, cellKey);
  if (bd && !bd.lake) { ui.modal = { border: bd.id }; render(); }
}

$root.addEventListener('click', (e) => {
  const cell = e.target.closest('[data-cell]');
  if (cell) { handleCell(cell.dataset.cell); return; }
  const stop = e.target.closest('[data-stop]');
  const el = e.target.closest('[data-act]');
  if (!el) return;
  if (stop && !stop.contains(el)) return;
  if (stop && el.classList.contains('modal-bg')) return;
  e.preventDefault();
  handleAct(el.dataset.act, el);
});
$root.addEventListener('input', (e) => {
  const k = e.target.dataset.input;
  if (k === 'name') ui.name = e.target.value;
  if (k === 'code') { ui.joinCode = e.target.value.toUpperCase(); e.target.value = ui.joinCode; }
  if (k === 'peer') store.set('suburbia.peerServer', e.target.value.trim());
  if (k === 'chat') ui.chatDraft = e.target.value;
});
$root.addEventListener('submit', (e) => {
  if (e.target.dataset.form === 'chat') {
    e.preventDefault();
    if (ui.chatDraft.trim()) session?.sendChat(ui.chatDraft.trim());
    ui.chatDraft = '';
    render();
  }
});
$root.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'code-input') handleAct('join');
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { ui.sel = null; ui.modal = null; render(); } });

// goal picker overlay must appear without a click
const baseRender = render;
// eslint-disable-next-line no-func-assign
render = function renderWithGoal() {
  baseRender();
  const snap = session?.snapshot();
  if (snap?.view?.phase === 'goals') {
    const html = goalPickHtml(snap);
    if (html) $root.insertAdjacentHTML('beforeend', html);
  }
  if (snap?.view?.phase === 'over' && !ui.finalShown) { ui.finalShown = true; ui.modal = 'final'; baseRender(); }
  if (snap?.view?.phase !== 'over') ui.finalShown = false;
};

window.__suburbia = { get session() { return session; }, ui };
render();
