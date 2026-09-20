/* Helpers, Datum, Speicher */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const DAYKEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_DE = { Mon: 'Mo', Tue: 'Di', Wed: 'Mi', Thu: 'Do', Fri: 'Fr', Sat: 'Sa', Sun: 'So' };
const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WD_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/* ---- Datum (immer lokale Tage, als YYYY-MM-DD) ---- */
const pad2 = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12, 0, 0); };
const addDays = (s, n) => { const d = parseIso(s); d.setDate(d.getDate() + n); return iso(d); };
const diffDays = (a, b) => Math.round((parseIso(a) - parseIso(b)) / 86400000); // a - b
const todayIso = () => (window.__TODAY__ || iso(new Date()));
const fmtDate = s => { const d = parseIso(s); return `${WD_SHORT[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`; };
const fmtDateLong = s => { const d = parseIso(s); return `${WD_LONG[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const fmtDM = s => { const d = parseIso(s); return `${d.getDate()}.${d.getMonth() + 1}.`; };
const wdShort = s => WD_SHORT[parseIso(s).getDay()];

/* ---- Zeit/Pace ---- */
const fmtMMSS = sec => { sec = Math.round(sec); const m = Math.floor(sec / 60), s = sec % 60; return `${m}:${pad2(s)}`; };
function parseMMSS(str) {
  if (str == null) return null;
  str = String(str).trim().replace(',', '.');
  if (!str) return null;
  if (/^\d+:\d{1,2}$/.test(str)) { const [m, s] = str.split(':').map(Number); return m * 60 + s; }
  if (/^\d+\.\d{2}$/.test(str)) { const [m, s] = str.split('.').map(Number); return m * 60 + s; } // 1.45 / 1,45 -> 1:45
  if (/^\d{3,4}$/.test(str)) { const n = Number(str); return Math.floor(n / 100) * 60 + n % 100; } // 145 -> 1:45
  if (/^\d+(\.\d+)?$/.test(str)) return Number(str) * 60;
  return null;
}
const fmtHM = min => { min = Math.round(min); const h = Math.floor(min / 60), m = min % 60; return h ? `${h}:${pad2(m)} h` : `${m} min`; };
const fmtH = min => (min / 60).toFixed(1).replace('.', ',');
const num = v => { if (v == null || v === '') return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

/* ---- Speicher ---- */
const KEY = 'tri70.v1';
const Store = {
  mem: null,
  load() {
    if (this.mem) return this.mem;
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* privat */ }
    try { this.mem = raw ? JSON.parse(raw) : null; } catch (e) { this.mem = null; }
    return this.mem;
  },
  save(state) {
    this.mem = state;
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
  },
  clear() { this.mem = null; try { localStorage.removeItem(KEY); } catch (e) { } }
};

const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* Plan-Texte: Deutsch (Standard) oder englisches PDF-Original */
const T = s => (typeof S !== 'undefined' && S && S.lang === 'en') ? s : ((window.DE && window.DE[s]) || s);
