// Host-authoritative sessions over PeerJS (WebRTC data channels).
import { Peer } from 'peerjs';
import { createGame, chooseGoal, applyAction, viewFor, playerIndex } from '../engine/engine.js';
import { chooseBotAction, chooseBotGoal, botName } from '../engine/bots.js';

const PREFIX = 'suburbia-kr-v1-';
const SAVE_KEY = 'suburbia.hostSave';
export const MAX_SEATS = 4;

const rid = (n = 8) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
export const newRoomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');

export function myPlayerId() {
  let id = null;
  try { id = localStorage.getItem('suburbia.pid'); } catch { /* ignore */ }
  if (!id) { id = `u-${rid(10)}`; try { localStorage.setItem('suburbia.pid', id); } catch { /* ignore */ } }
  return id;
}

export function peerOptions() {
  // ?peer=host:port[/path] lets you point at your own PeerJS server (used for testing)
  const opts = { debug: 1, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] } };
  let custom = null;
  try { custom = new URLSearchParams(location.search).get('peer') || localStorage.getItem('suburbia.peerServer'); } catch { /* ignore */ }
  if (custom) {
    const m = custom.match(/^(https?:\/\/)?([^:/]+)(?::(\d+))?(\/.*)?$/);
    if (m) {
      opts.host = m[2]; opts.port = Number(m[3] || (m[1] === 'http://' || m[2] === 'localhost' ? 9000 : 443));
      opts.path = m[4] || '/'; opts.secure = m[1] ? m[1] === 'https://' : m[2] !== 'localhost';
    }
  }
  return opts;
}

class Emitter {
  constructor() { this.listeners = new Set(); }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(); }
}

// ───────────────────────── Host ─────────────────────────
export class HostSession extends Emitter {
  constructor({ name, online = true, resume = null }) {
    super();
    this.role = 'host';
    this.myId = myPlayerId();
    this.online = online;
    this.conns = new Map(); // playerId -> conn
    this.netStatus = online ? 'connecting' : 'offline';
    this.netError = null;
    this.botTimer = null;
    this.toast = null;
    if (resume) {
      Object.assign(this, { code: resume.code, lobby: resume.lobby, state: resume.state });
      for (const s of this.lobby.seats) if (s.type === 'human') s.connected = false;
      this.lobby.seats.find((s) => s.id === this.myId).connected = true;
    } else {
      this.code = newRoomCode();
      this.lobby = { seats: [{ id: this.myId, name, type: 'host', connected: true }] };
      this.state = null;
    }
    if (online) this.openPeer();
    this.lastSeen = new Map();
    this.hb = setInterval(() => this.sweep(), 4000);
    this.scheduleBots();
  }

  sweep() {
    const now = Date.now();
    for (const [pid, conn] of this.conns) {
      try { conn.send({ t: 'ping' }); } catch { /* ignore */ }
      if (now - (this.lastSeen.get(pid) || now) > 14000) {
        this.conns.delete(pid);
        try { conn.close(); } catch { /* ignore */ }
        this.dropped(pid);
      }
    }
  }

  dropped(pid) {
    const seat = this.lobby.seats.find((x) => x.id === pid);
    if (!seat) return;
    if (!this.state) { this.lobby.seats = this.lobby.seats.filter((x) => x !== seat); this.notify(`${seat.name} 님이 나갔습니다`); }
    else if (seat.connected) { seat.connected = false; this.notify(`${seat.name} 님의 연결이 끊겼습니다`); }
    this.changed();
  }

  openPeer(attempt = 0) {
    this.peer = new Peer(PREFIX + this.code, peerOptions());
    this.peer.on('open', () => { this.netStatus = 'online'; this.netError = null; this.emit(); });
    this.peer.on('connection', (conn) => this.attach(conn));
    this.peer.on('disconnected', () => {
      this.netStatus = 'reconnecting'; this.emit();
      setTimeout(() => { try { if (!this.closed && this.peer && !this.peer.destroyed) this.peer.reconnect(); } catch { /* ignore */ } }, 2000);
    });
    this.peer.on('error', (e) => {
      if (e.type === 'unavailable-id' && !this.state && attempt < 3) {
        this.peer.destroy(); this.code = newRoomCode(); this.openPeer(attempt + 1); return;
      }
      if (e.type === 'peer-unavailable') return;
      this.netStatus = 'error'; this.netError = `${e.type || ''} ${e.message || ''}`.trim(); this.emit();
    });
  }

  attach(conn) {
    let pid = null;
    conn.on('data', (msg) => {
      if (pid) this.lastSeen.set(pid, Date.now());
      if (msg?.t === 'ping') return;
      if (msg?.t === 'bye') { if (pid && this.conns.get(pid) === conn) { this.conns.delete(pid); this.dropped(pid); } try { conn.close(); } catch { /* ignore */ } return; }
      if (msg?.t === 'hello') {
        pid = msg.id;
        const seats = this.lobby.seats;
        let seat = seats.find((s) => s.id === pid);
        if (!seat) {
          if (this.state) { conn.send({ t: 'error', msg: '이미 게임이 시작된 방입니다' }); setTimeout(() => conn.close(), 500); return; }
          if (seats.length >= MAX_SEATS) { conn.send({ t: 'error', msg: '방이 가득 찼습니다' }); setTimeout(() => conn.close(), 500); return; }
          seat = { id: pid, name: String(msg.name || '손님').slice(0, 16), type: 'human', connected: true };
          seats.push(seat);
          this.notify(`${seat.name} 님이 들어왔습니다`);
        } else {
          seat.connected = true;
          if (msg.name) seat.name = String(msg.name).slice(0, 16);
          // give control back if a bot was covering
          if (this.state && seat.botCover) {
            const pi = playerIndex(this.state, pid);
            if (pi >= 0) this.state.players[pi].bot = null;
            seat.botCover = false;
            this.notify(`${seat.name} 님이 돌아왔습니다`);
          }
        }
        const old = this.conns.get(pid);
        if (old && old !== conn) try { old.close(); } catch { /* ignore */ }
        this.conns.set(pid, conn);
        this.lastSeen.set(pid, Date.now());
        this.changed();
        return;
      }
      if (!pid) return;
      this.handle(pid, msg, conn);
    });
    conn.on('close', () => {
      if (pid && this.conns.get(pid) === conn) { this.conns.delete(pid); this.dropped(pid); }
    });
  }

  handle(pid, msg, conn) {
    let r = { ok: true };
    if (msg.t === 'action') r = this.state ? applyAction(this.state, pid, msg.action) : { ok: false, error: '게임 시작 전' };
    else if (msg.t === 'goal') r = this.state ? chooseGoal(this.state, pid, msg.goal) : { ok: false };
    else if (msg.t === 'chat') { this.chat(pid, msg.text); return; }
    if (!r.ok && conn) conn.send({ t: 'error', msg: r.error });
    this.changed();
  }

  chat(pid, text) {
    if (!this.lobby.chat) this.lobby.chat = [];
    const seat = this.lobby.seats.find((s) => s.id === pid);
    this.lobby.chat.push({ name: seat?.name || '?', text: String(text).slice(0, 200), at: Date.now() });
    this.lobby.chat = this.lobby.chat.slice(-50);
    this.changed();
  }

  notify(text) { this.toast = { text, at: Date.now() }; }

  // ── local host-player API (same as client) ──
  act(action) { const r = applyAction(this.state, this.myId, action); if (!r.ok) this.error = r.error; this.changed(); return r; }
  chooseGoal(g) { chooseGoal(this.state, this.myId, g); this.changed(); }
  sendChat(text) { this.chat(this.myId, text); }

  addBot(level) {
    if (this.state || this.lobby.seats.length >= MAX_SEATS) return;
    const n = this.lobby.seats.filter((s) => s.type === 'bot').length;
    this.lobby.seats.push({ id: `bot-${rid(6)}`, name: botName(n, level), type: 'bot', level, connected: true });
    this.changed();
  }
  removeSeat(id) {
    if (this.state || id === this.myId) return;
    const conn = this.conns.get(id);
    if (conn) { conn.send({ t: 'error', msg: '방장이 내보냈습니다' }); setTimeout(() => conn.close(), 300); }
    this.lobby.seats = this.lobby.seats.filter((s) => s.id !== id);
    this.changed();
  }
  coverWithBot(id, level = 'normal') {
    const pi = playerIndex(this.state, id);
    const seat = this.lobby.seats.find((s) => s.id === id);
    if (pi < 0 || !seat) return;
    this.state.players[pi].bot = level; seat.botCover = true;
    this.notify(`${seat.name} 님 자리를 봇이 대신합니다`);
    this.changed();
  }
  start() {
    if (this.state || this.lobby.seats.length < 2) return;
    this.state = createGame({
      players: this.lobby.seats.map((s) => ({ id: s.id, name: s.name, bot: s.type === 'bot' ? s.level : null })),
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
    });
    this.state.players.forEach((p, i) => { if (p.bot) chooseGoal(this.state, p.id, chooseBotGoal(this.state, i, p.bot)); });
    this.changed();
  }

  scheduleBots() {
    clearTimeout(this.botTimer);
    const s = this.state;
    if (!s || s.phase === 'over') return;
    if (s.phase === 'goals') {
      s.players.forEach((p, i) => { if (p.bot && !p.privateGoal) chooseGoal(s, p.id, chooseBotGoal(s, i, p.bot)); });
      return;
    }
    const p = s.players[s.current];
    if (!p.bot) return;
    this.botThinking = p.id;
    this.botTimer = setTimeout(() => {
      if (this.state !== s || s.players[s.current] !== p || !p.bot) return;
      const a = chooseBotAction(s, s.current, p.bot);
      const r = applyAction(s, p.id, a);
      if (!r.ok) console.warn('bot action failed', r.error, a);
      this.botThinking = null;
      this.changed();
    }, this.botDelay ?? 900);
  }

  changed() {
    for (const [pid, conn] of this.conns) {
      try { conn.send({ t: 'sync', lobby: this.lobby, code: this.code, view: this.state ? viewFor(this.state, pid) : null, toast: this.toast }); } catch { /* ignore */ }
    }
    try {
      if (this.state?.phase === 'over') localStorage.removeItem(SAVE_KEY);
      else if (this.state) localStorage.setItem(SAVE_KEY, JSON.stringify({ code: this.code, lobby: this.lobby, state: this.state, online: this.online, savedAt: Date.now() }));
    } catch { /* ignore */ }
    this.scheduleBots();
    this.emit();
  }

  snapshot() {
    return {
      role: 'host', myId: this.myId, code: this.code, online: this.online, netStatus: this.netStatus, netError: this.netError,
      lobby: this.lobby, view: this.state ? viewFor(this.state, this.myId) : null, toast: this.toast,
      botThinking: this.botThinking,
    };
  }

  close() { this.closed = true; clearTimeout(this.botTimer); clearInterval(this.hb); try { this.peer?.destroy(); } catch { /* ignore */ } }
}

export function savedHostGame() {
  try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function clearSavedHostGame() { try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ } }

// ───────────────────────── Client ─────────────────────────
export class ClientSession extends Emitter {
  constructor({ name, code }) {
    super();
    this.role = 'client';
    this.myId = myPlayerId();
    this.name = name;
    this.code = code.toUpperCase().trim();
    this.lobby = null; this.view = null; this.toast = null;
    this.netStatus = 'connecting'; this.netError = null;
    this.retries = 0;
    this.peer = new Peer(peerOptions());
    this.peer.on('open', () => this.connect());
    this.peer.on('error', (e) => {
      if (e.type === 'peer-unavailable') {
        this.netStatus = this.lobby ? 'reconnecting' : 'error';
        this.netError = this.lobby ? '방장과의 연결이 끊겼습니다. 다시 연결하는 중…' : '방을 찾을 수 없습니다. 코드를 확인해 주세요.';
        if (this.lobby) this.retryLater();
      } else { this.netStatus = 'error'; this.netError = `${e.type || ''} ${e.message || ''}`.trim(); this.retryLater(); }
      this.emit();
    });
    this.peer.on('disconnected', () => { setTimeout(() => { try { if (!this.closed && !this.peer.destroyed) this.peer.reconnect(); } catch { /* ignore */ } }, 2000); });
    this.hostSeen = Date.now();
    this.hb = setInterval(() => {
      if (this.netStatus !== 'online') return;
      this.send({ t: 'ping' });
      if (Date.now() - this.hostSeen > 15000) {
        this.netStatus = 'reconnecting'; this.netError = '방장과의 연결이 끊겼습니다. 다시 연결하는 중…';
        const c = this.conn; this.conn = null;
        try { c?.close(); } catch { /* ignore */ }
        this.emit(); this.retryLater();
      }
    }, 4000);
    this.onHide = () => { try { this.conn?.send({ t: 'bye' }); } catch { /* ignore */ } };
    window.addEventListener('pagehide', this.onHide);
  }

  connect() {
    if (this.closed) return;
    const conn = this.peer.connect(PREFIX + this.code, { reliable: true, serialization: 'json' });
    this.conn = conn;
    conn.on('open', () => { this.hostSeen = Date.now(); this.retries = 0; this.netStatus = 'online'; this.netError = null; conn.send({ t: 'hello', id: this.myId, name: this.name }); this.emit(); });
    conn.on('data', (msg) => {
      this.hostSeen = Date.now();
      if (msg.t === 'ping') return;
      if (msg.t === 'sync') { this.lobby = msg.lobby; this.view = msg.view; this.toast = msg.toast; this.code = msg.code; }
      else if (msg.t === 'error') { this.error = msg.msg; if (/가득|시작된|내보냈/.test(msg.msg)) { this.fatal = msg.msg; } }
      this.emit();
    });
    conn.on('close', () => {
      if (this.closed || this.fatal || this.conn !== conn) return;
      this.netStatus = 'reconnecting'; this.netError = '방장과의 연결이 끊겼습니다. 다시 연결하는 중…'; this.emit();
      this.retryLater();
    });
  }

  retryLater() {
    if (this.closed || this.fatal || this.retryTimer) return;
    this.retries++;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.peer.disconnected) { try { this.peer.reconnect(); } catch { /* ignore */ } }
      if (this.peer.open) this.connect();
      else this.retryLater();
    }, Math.min(10000, 1500 * this.retries));
  }

  send(msg) { try { this.conn?.send(msg); } catch { this.error = '전송 실패'; this.emit(); } }
  act(action) { this.send({ t: 'action', action }); return { ok: true }; }
  chooseGoal(g) { this.send({ t: 'goal', goal: g }); }
  sendChat(text) { this.send({ t: 'chat', text }); }

  snapshot() {
    return { role: 'client', myId: this.myId, code: this.code, netStatus: this.netStatus, netError: this.netError, lobby: this.lobby, view: this.view, toast: this.toast, fatal: this.fatal };
  }

  close() {
    this.closed = true; clearTimeout(this.retryTimer); clearInterval(this.hb);
    window.removeEventListener('pagehide', this.onHide);
    try { this.conn?.send({ t: 'bye' }); } catch { /* ignore */ }
    setTimeout(() => { try { this.peer?.destroy(); } catch { /* ignore */ } }, 200);
  }
}
