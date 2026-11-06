/* Pulse — markets, music & news. */
(() => {
'use strict';

// ---------- Storage ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('pulse.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('pulse.' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('pulse.' + k); } catch {} },
};

const DEFAULT_WATCH = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA'];
const INDICES = [
  { s: '^GSPC', n: 'S&P 500' }, { s: '^IXIC', n: 'Nasdaq' },
  { s: '^DJI', n: 'Dow Jones' }, { s: 'BTC-USD', n: 'Bitcoin' },
  { s: 'GC=F', n: 'Gold' }, { s: 'EURUSD=X', n: 'EUR / USD' },
];
const NEWS_CATS = [
  ['top', 'Top'], ['markets', 'Markets'], ['business', 'Business'], ['world', 'World'],
  ['tech', 'Tech'], ['sport', 'Sport'], ['science', 'Science'],
];

const state = {
  view: 'today',
  watch: store.get('watch', DEFAULT_WATCH),
  quotes: {},
  editing: false,
  newsCat: store.get('newsCat', 'top'),
  unit: store.get('unit', 'celsius'),
  loc: store.get('loc', null),
  np: null,
  picks: [],
  saved: new Set(store.get('savedIds', [])),
};

// ---------- Helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cls = (v) => (v == null || Math.abs(v) < 0.005 ? 'flat' : v > 0 ? 'up' : 'down');
const sign = (v) => (v > 0 ? '+' : v < 0 ? '−' : '');
function money(v, cur = 'USD', compact = false) {
  if (v == null || isNaN(v)) return '—';
  const digits = Math.abs(v) >= 1000 ? 2 : Math.abs(v) < 2 ? 4 : 2;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD', maximumFractionDigits: compact ? 0 : digits, minimumFractionDigits: compact ? 0 : Math.min(2, digits) }).format(v);
  } catch { return v.toFixed(2); }
}
const plain = (v, d = 2) => (v == null || isNaN(v) ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }).format(v));
const pct = (v) => (v == null || isNaN(v) ? '—' : sign(v) + Math.abs(v).toFixed(2) + '%');
const big = (v) => (v == null ? '—' : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v));
function ago(t) {
  if (!t) return '';
  const s = Math.max(0, Date.now() / 1000 - t);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}
const mmss = (ms) => { const s = Math.floor((ms || 0) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200); }
async function api(params) {
  const r = await fetch('api.php?' + new URLSearchParams(params));
  if (!r.ok) throw new Error('api ' + r.status);
  return r.json();
}
const displayPrice = (q) => (q.symbol && /=X$/.test(q.symbol) ? plain(q.price, 4) : money(q.price, q.currency));

const ICON = {
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 12h12"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-9.3-9.2C1.5 7.6 3.6 4.5 7 4.5c2 0 3.6 1.2 5 3 1.4-1.8 3-3 5-3 3.4 0 5.5 3.1 4.3 6.3C19.5 15.4 12 20 12 20z"/></svg>',
  heartFill: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20s-7.5-4.6-9.3-9.2C1.5 7.6 3.6 4.5 7 4.5c2 0 3.6 1.2 5 3 1.4-1.8 3-3 5-3 3.4 0 5.5 3.1 4.3 6.3C19.5 15.4 12 20 12 20z"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 6.2v11.6a1 1 0 0 0 1.55.83L15 13v4.5a1 1 0 0 0 2 0v-11a1 1 0 0 0-2 0V11L6.55 5.37A1 1 0 0 0 5 6.2z"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.2v11.6a1 1 0 0 1-1.55.83L9 13v4.5a1 1 0 0 1-2 0v-11a1 1 0 0 1 2 0V11l8.45-5.63A1 1 0 0 1 19 6.2z"/></svg>',
  spotify: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.6 14.4a.62.62 0 0 1-.86.2c-2.35-1.43-5.3-1.76-8.79-.96a.62.62 0 1 1-.28-1.22c3.81-.87 7.09-.5 9.73 1.12.3.18.39.57.2.86zm1.22-2.73a.78.78 0 0 1-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 1 1-.45-1.49c3.63-1.1 8.15-.57 11.23 1.33.37.22.48.7.26 1.07zm.1-2.84C14.7 8.92 9.37 8.75 6.29 9.68a.94.94 0 1 1-.54-1.8c3.53-1.07 9.42-.86 13.13 1.34a.94.94 0 0 1-.96 1.61z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
};

// ---------- Header ----------
function renderHeader() {
  const d = new Date();
  const h = d.getHours();
  const part = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  $('#today-date').textContent = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#greeting').innerHTML = esc(part) + '<em>.</em>';
}

// ---------- Navigation ----------
function go(view) {
  if (!['today', 'markets', 'music', 'news'].includes(view)) view = 'today';
  state.view = view;
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.go === view));
  $('.topbar').classList.toggle('hidden', view !== 'today');
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
  if (view === 'markets') { loadQuotes(); loadNews('markets', '#markets-news', 8); }
  if (view === 'news') renderNewsView();
  if (view === 'music') renderMusic();
}
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v && v !== state.view) go(v); });
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); go(g.dataset.go); }
});

// ---------- Sparkline & chart ----------
function sparkPath(points, w, h, pad = 2) {
  const ys = points.map((p) => p[1]);
  const min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const step = (w - pad * 2) / Math.max(1, points.length - 1);
  return points.map((p, i) => (i ? 'L' : 'M') + (pad + i * step).toFixed(1) + ' ' + (h - pad - ((p[1] - min) / span) * (h - pad * 2)).toFixed(1)).join(' ');
}
function spark(q, w = 64, h = 30) {
  const pts = q?.points || [];
  if (pts.length < 2) return `<svg class="spark" viewBox="0 0 ${w} ${h}"></svg>`;
  const c = cls(q.changePct) === 'down' ? 'var(--down)' : cls(q.changePct) === 'up' ? 'var(--up)' : 'var(--muted)';
  // baseline at previous close
  const ys = pts.map((p) => p[1]); const min = Math.min(...ys, q.prev ?? Infinity), max = Math.max(...ys, q.prev ?? -Infinity);
  const span = max - min || 1;
  const step = (w - 4) / (pts.length - 1);
  const y = (v) => (h - 2 - ((v - min) / span) * (h - 4)).toFixed(1);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + (2 + i * step).toFixed(1) + ' ' + y(p[1])).join(' ');
  const base = q.prev != null ? `<line x1="2" x2="${w - 2}" y1="${y(q.prev)}" y2="${y(q.prev)}" stroke="rgba(255,255,255,.18)" stroke-dasharray="2 3" stroke-width="1"/>` : '';
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${base}<path d="${d}" fill="none" stroke="${c}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
}

function drawChart(el, data, range) {
  const pts = data.points || [];
  if (pts.length < 2) { el.innerHTML = '<div class="empty">No chart data</div>'; return; }
  const W = el.clientWidth || 340, H = el.clientHeight || 200, padY = 14;
  const ys = pts.map((p) => p[1]);
  const ref = range === '1d' ? data.prev : pts[0][1];
  const min = Math.min(...ys, range === '1d' && ref ? ref : Infinity), max = Math.max(...ys, range === '1d' && ref ? ref : -Infinity);
  const span = max - min || 1;
  const X = (i) => (i / (pts.length - 1)) * W;
  const Y = (v) => padY + (1 - (v - min) / span) * (H - padY * 2);
  const up = pts[pts.length - 1][1] >= (ref ?? pts[0][1]);
  const col = up ? 'var(--up)' : 'var(--down)';
  const line = pts.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' ');
  const area = line + ` L${W} ${H} L0 ${H} Z`;
  const gid = 'g' + Math.random().toString(36).slice(2, 7);
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".28"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
    ${ref ? `<line x1="0" x2="${W}" y1="${Y(ref)}" y2="${Y(ref)}" stroke="rgba(255,255,255,.16)" stroke-dasharray="3 4"/>` : ''}
    <path d="${area}" fill="url(#${gid})"/>
    <path d="${line}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <line class="cx" x1="0" x2="0" y1="0" y2="${H}" stroke="rgba(255,255,255,.35)" stroke-width="1" opacity="0"/>
    <circle class="cd" r="5" fill="${col}" stroke="var(--bg-2)" stroke-width="2.5" opacity="0"/>
  </svg><div class="chart-tip hidden"></div>`;
  const svg = el.querySelector('svg'), cx = svg.querySelector('.cx'), cd = svg.querySelector('.cd'), tip = el.querySelector('.chart-tip');
  const priceEl = $('#d-price'), chEl = $('#d-change');
  const orig = { p: priceEl?.innerHTML, c: chEl?.innerHTML, cc: chEl?.className };
  const fmtT = (t) => { const d = new Date(t * 1000); return range === '1d' || range === '5d' ? d.toLocaleString('en-GB', { weekday: range === '5d' ? 'short' : undefined, hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: range === '5y' || range === '1y' ? '2-digit' : undefined }); };
  const move = (ev) => {
    const r = el.getBoundingClientRect();
    const x = Math.min(Math.max(0, (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left), r.width);
    const i = Math.round((x / r.width) * (pts.length - 1));
    const p = pts[i];
    const px = X(i), py = Y(p[1]);
    cx.setAttribute('x1', px); cx.setAttribute('x2', px); cx.setAttribute('opacity', 1);
    cd.setAttribute('cx', px); cd.setAttribute('cy', py); cd.setAttribute('opacity', 1);
    tip.classList.remove('hidden'); tip.style.left = Math.min(Math.max(50, (px / W) * r.width), r.width - 50) + 'px'; tip.textContent = fmtT(p[0]);
    if (priceEl) {
      const base = ref ?? pts[0][1]; const ch = p[1] - base; const cp = (ch / base) * 100;
      priceEl.innerHTML = displayPrice({ ...data, price: p[1] });
      chEl.className = 'd-change num ' + cls(cp); chEl.textContent = `${sign(ch)}${plain(Math.abs(ch))} (${pct(cp)})`;
    }
  };
  const end = () => {
    cx.setAttribute('opacity', 0); cd.setAttribute('opacity', 0); tip.classList.add('hidden');
    if (priceEl) { priceEl.innerHTML = orig.p; chEl.innerHTML = orig.c; chEl.className = orig.cc; }
  };
  el.addEventListener('pointermove', move); el.addEventListener('touchmove', move, { passive: true });
  el.addEventListener('pointerleave', end); el.addEventListener('touchend', end);
}

// ---------- Quotes ----------
async function loadQuotes() {
  const syms = [...new Set([...INDICES.map((i) => i.s), ...state.watch])];
  try {
    const { quotes } = await api({ a: 'quotes', s: syms.join(',') });
    quotes.forEach((q) => { if (!q.error) state.quotes[q.symbol] = q; });
    renderIndices(); renderWatch(); renderMarketState();
    $('#quotes-updated').textContent = 'Updated ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    $('#quotes-updated').textContent = 'Offline — retrying';
    if (!Object.keys(state.quotes).length) { $('#watchlist').innerHTML = '<div class="empty">Couldn’t load prices right now.</div>'; }
  }
}

function idxCard(i) {
  const q = state.quotes[i.s];
  return `<button class="idx" data-sym="${esc(i.s)}" data-name="${esc(i.n)}">
    <span class="idx-name">${esc(i.n)}</span>
    <span class="idx-price num">${q ? (i.s.startsWith('^') ? plain(q.price) : displayPrice(q)) : '<span class="skel" style="display:block;height:20px;width:70%"></span>'}</span>
    <span class="pct num ${q ? cls(q.changePct) : ''}">${q ? pct(q.changePct) : '&nbsp;'}</span>
    ${spark(q, 120, 28)}
  </button>`;
}
function renderIndices() {
  $('#indices').innerHTML = INDICES.map(idxCard).join('');
  $('#today-indices').innerHTML = INDICES.slice(0, 2).map(idxCard).join('') + state.watch.slice(0, 2).map((s) => idxCard({ s, n: s })).join('');
}

function tickerRow(s) {
  const q = state.quotes[s];
  const c = q ? cls(q.changePct) : 'flat';
  return `<div class="row" role="button" tabindex="0" data-sym="${esc(s)}">
    <span class="tk-logo">${esc(s.replace(/[-=^].*$/, '').slice(0, 4))}</span>
    <span class="tk-main"><div class="tk-sym">${esc(s)}</div><div class="tk-name">${esc(q?.name || '')}</div></span>
    <span class="tk-spark">${spark(q)}</span>
    <span class="tk-right"><div class="tk-price num">${q ? displayPrice(q) : '—'}</div><span class="pill num ${c}">${q ? pct(q.changePct) : '…'}</span></span>
    <button class="rm-btn" data-rm="${esc(s)}" aria-label="Remove ${esc(s)}">${ICON.minus}</button>
  </div>`;
}
function renderWatch() {
  const el = $('#watchlist');
  el.classList.toggle('editing', state.editing);
  el.innerHTML = state.watch.length ? state.watch.map(tickerRow).join('') : '<div class="empty">Your watchlist is empty. Search above to add something.</div>';
}
function renderMarketState() {
  const q = state.quotes['^GSPC'];
  const reg = q?.state?.regular; const now = Date.now() / 1000;
  const open = reg && now >= reg.start && now < reg.end;
  $('#market-state').innerHTML = `<span class="dot ${open ? 'live' : ''}"></span><span>${open ? 'US market open' : 'US market closed'}</span>`;
}

$('#edit-watch').addEventListener('click', () => {
  state.editing = !state.editing; $('#edit-watch').textContent = state.editing ? 'Done' : 'Edit'; renderWatch();
});
document.addEventListener('click', (e) => {
  const rm = e.target.closest('[data-rm]');
  if (rm) { e.stopPropagation(); state.watch = state.watch.filter((s) => s !== rm.dataset.rm); store.set('watch', state.watch); renderWatch(); renderIndices(); toast(rm.dataset.rm + ' removed'); return; }
  const t = e.target.closest('[data-sym]');
  if (t && !state.editing) openDetail(t.dataset.sym, t.dataset.name);
});

// Symbol search
let searchT;
$('#sym-search').addEventListener('input', (e) => {
  clearTimeout(searchT);
  const q = e.target.value.trim();
  const box = $('#sym-results');
  if (!q) { box.classList.add('hidden'); return; }
  searchT = setTimeout(async () => {
    try {
      const { results } = await api({ a: 'search', q });
      box.classList.remove('hidden');
      box.innerHTML = results.length ? results.map((r) => {
        const has = state.watch.includes(r.symbol);
        return `<div class="row"><span class="tk-logo">${esc(r.symbol.slice(0, 4))}</span>
        <span class="tk-main"><div class="tk-sym">${esc(r.symbol)}</div><div class="tk-name">${esc(r.name)} · ${esc(r.exchange || r.type)}</div></span>
        <button class="small-act ${has ? 'on' : ''}" data-add="${esc(r.symbol)}" aria-label="Add">${has ? ICON.check : ICON.plus}</button></div>`;
      }).join('') : '<div class="empty">No matches</div>';
    } catch { box.innerHTML = '<div class="empty">Search unavailable</div>'; }
  }, 280);
});
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-add]');
  if (!a) return;
  const s = a.dataset.add;
  if (!state.watch.includes(s)) { state.watch.push(s); store.set('watch', state.watch); toast(s + ' added'); }
  $('#sym-search').value = ''; $('#sym-results').classList.add('hidden');
  renderWatch(); loadQuotes();
});

// ---------- Detail sheet ----------
function openSheet(html) {
  $('#sheet-body').innerHTML = html; $('#sheet-body').scrollTop = 0;
  $('#sheet').classList.add('open'); $('#scrim').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSheet() { $('#sheet').classList.remove('open'); $('#scrim').classList.remove('open'); document.body.style.overflow = ''; }
$('#scrim').addEventListener('click', closeSheet);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
// swipe down to close
(() => {
  let y0 = null; const sh = $('#sheet');
  sh.addEventListener('touchstart', (e) => { if ($('#sheet-body').scrollTop <= 0 && !e.target.closest('.chart-wrap')) y0 = e.touches[0].clientY; }, { passive: true });
  sh.addEventListener('touchmove', (e) => { if (y0 == null) return; const dy = e.touches[0].clientY - y0; if (dy > 0) sh.style.transform = `translate(-50%, ${dy}px)`; }, { passive: true });
  sh.addEventListener('touchend', (e) => { if (y0 == null) return; const dy = e.changedTouches[0].clientY - y0; sh.style.transform = ''; y0 = null; if (dy > 110) closeSheet(); });
})();

async function openDetail(sym, label) {
  const q = state.quotes[sym] || {};
  const inWatch = state.watch.includes(sym);
  openSheet(`
    <div class="sheet-head">
      <div><div class="d-sym">${esc(sym)} · ${esc(q.exchange || '')}</div><h3 class="d-name">${esc(label && label !== sym ? label : q.name || sym)}</h3></div>
      <button class="icon-btn" id="d-close" aria-label="Close">${ICON.x}</button>
    </div>
    <div class="d-price num" id="d-price">${q.price != null ? displayPrice(q) : '—'}</div>
    <div class="d-change num ${cls(q.changePct)}" id="d-change">${q.change != null ? `${sign(q.change)}${plain(Math.abs(q.change))} (${pct(q.changePct)}) today` : '&nbsp;'}</div>
    <div class="chart-wrap" id="d-chart"><div class="skel" style="height:100%"></div></div>
    <div class="ranges" id="d-ranges">${['1d', '5d', '1mo', '6mo', '1y', '5y'].map((r) => `<button data-r="${r}" class="${r === '1d' ? 'on' : ''}">${r.replace('mo', 'M').toUpperCase()}</button>`).join('')}</div>
    <div class="stats" id="d-stats"></div>
    <div class="row-gap" style="margin-top:16px">
      <button class="btn ${inWatch ? 'ghost' : ''} small" id="d-watch">${inWatch ? 'Remove from watchlist' : 'Add to watchlist'}</button>
    </div>
    <div class="section"><div class="section-head"><h4 class="section-title">News</h4></div><div class="news-list" id="d-news"><div class="skel" style="height:120px"></div></div></div>
  `);
  $('#d-close').onclick = closeSheet;
  $('#d-watch').onclick = () => {
    if (state.watch.includes(sym)) state.watch = state.watch.filter((s) => s !== sym); else state.watch.push(sym);
    store.set('watch', state.watch); renderWatch(); renderIndices(); closeSheet();
    toast(state.watch.includes(sym) ? sym + ' added' : sym + ' removed'); loadQuotes();
  };
  const load = async (r) => {
    $('#d-ranges').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.r === r));
    try {
      const d = await api({ a: 'chart', s: sym, r });
      if (r === '1d') {
        $('#d-stats').innerHTML = [
          ['Previous close', plain(d.prev)], ['Day range', d.dayLow != null ? `${plain(d.dayLow)} – ${plain(d.dayHigh)}` : '—'],
          ['52-week low', plain(d.low52)], ['52-week high', plain(d.high52)],
          ['Volume', big(d.volume)], ['Currency', esc(d.currency || '—')],
        ].map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v num">${v}</div></div>`).join('');
      } else {
        const f = d.points[0]?.[1], l = d.points[d.points.length - 1]?.[1];
        if (f && l) { const ch = l - f; $('#d-change').className = 'd-change num ' + cls(ch); $('#d-change').textContent = `${sign(ch)}${plain(Math.abs(ch))} (${pct((ch / f) * 100)}) over ${r.replace('mo', ' months').replace('1 months', '1 month').replace('d', ' days').replace('1y', '1 year').replace('5y', '5 years')}`; }
      }
      drawChart($('#d-chart'), d, r);
    } catch { $('#d-chart').innerHTML = '<div class="empty">Chart unavailable</div>'; }
  };
  $('#d-ranges').addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) load(b.dataset.r); });
  load('1d');
  try {
    const { items } = await api({ a: 'snews', s: sym });
    $('#d-news').innerHTML = items.length ? items.slice(0, 6).map(newsRow).join('') : '<div class="empty">No recent headlines</div>';
  } catch { $('#d-news').innerHTML = '<div class="empty">News unavailable</div>'; }
}

// ---------- News ----------
function newsRow(it) {
  return `<a class="news-row" href="${esc(it.link)}" target="_blank" rel="noopener">
    <div class="nr-body"><div class="src"><b>${esc(it.source)}</b> · ${ago(it.time)}</div><div class="nr-title">${esc(it.title)}</div></div>
    ${it.image ? `<div class="nr-img" style="background-image:url('${esc(it.image)}')"></div>` : ''}
  </a>`;
}
function newsHero(it) {
  return `<a class="hero-news" href="${esc(it.link)}" target="_blank" rel="noopener">
    ${it.image ? `<div class="hero-img" style="background-image:url('${esc(it.image)}')"></div>` : ''}
    <div class="hero-body"><div class="src"><b>${esc(it.source)}</b> · ${ago(it.time)}</div>
    <h3 class="hero-title">${esc(it.title)}</h3>${it.summary ? `<p class="hero-sum">${esc(it.summary)}</p>` : ''}</div></a>`;
}
const newsCache = {};
async function getNews(c) {
  if (newsCache[c] && Date.now() - newsCache[c].t < 300000) return newsCache[c].items;
  const { items } = await api({ a: 'news', c });
  newsCache[c] = { t: Date.now(), items }; return items;
}
async function loadNews(c, sel, n = 10, hero = false) {
  const el = $(sel);
  try {
    const items = await getNews(c);
    if (!items.length) { el.innerHTML = '<div class="empty">No stories right now.</div>'; return; }
    const h = hero ? items.find((i) => i.image) || items[0] : null;
    const rest = items.filter((i) => i !== h).slice(0, n);
    el.innerHTML = (h ? newsHero(h) : '') + `<div class="news-list" ${h ? 'style="margin-top:6px"' : ''}>${rest.map(newsRow).join('')}</div>`;
  } catch { el.innerHTML = '<div class="empty">Couldn’t load news.</div>'; }
}
function renderNewsView() {
  $('#news-chips').innerHTML = NEWS_CATS.map(([k, n]) => `<button class="chip ${k === state.newsCat ? 'on' : ''}" data-cat="${k}">${n}</button>`).join('');
  $('#news-body').innerHTML = '<div class="skel" style="height:300px"></div>';
  loadNews(state.newsCat, '#news-body', 30, true);
}
$('#news-chips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]'); if (!b) return;
  state.newsCat = b.dataset.cat; store.set('newsCat', state.newsCat); renderNewsView();
  b.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
});

// ---------- Weather ----------
const WMO = (c) => {
  if (c === 0) return ['Clear', 'clear'];
  if (c <= 2) return ['Partly cloudy', 'partly'];
  if (c === 3) return ['Overcast', 'cloud'];
  if (c <= 48) return ['Fog', 'fog'];
  if (c <= 57) return ['Drizzle', 'rain'];
  if (c <= 67) return ['Rain', 'rain'];
  if (c <= 77) return ['Snow', 'snow'];
  if (c <= 82) return ['Showers', 'rain'];
  if (c <= 86) return ['Snow showers', 'snow'];
  return ['Thunderstorm', 'storm'];
};
function wIcon(kind, day = true) {
  const s = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  const cloud = '<path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.6 4.2 4.2 0 0 0 7 18z"/>';
  const sun = '<circle cx="12" cy="12" r="4"/><path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.6 5.6l1 1M17.4 17.4l1 1M5.6 18.4l1-1M17.4 6.6l1-1"/>';
  const moon = '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>';
  const m = {
    clear: day ? sun : moon,
    partly: (day ? '<g transform="translate(-3 -4) scale(.8)"><circle cx="12" cy="12" r="4"/><path d="M12 4v1.5M4 12h1.5M6.3 6.3l1 1M17.7 6.3l-1 1"/></g>' : '<g transform="translate(-4 -5) scale(.75)">' + moon + '</g>') + '<path d="M9 19h8a3.5 3.5 0 0 0 .5-6.96A4.8 4.8 0 0 0 9 12.6 3.3 3.3 0 0 0 9 19z"/>',
    cloud,
    fog: '<path d="M4 9h16M6 13h12M4 17h16"/>',
    rain: '<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 6.6 4.2 4.2 0 0 0 7 15z"/><path d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5"/>',
    snow: '<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 6.6 4.2 4.2 0 0 0 7 15z"/><path d="M9 19h.01M12 21h.01M15 19h.01"/>',
    storm: '<path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 6.6 4.2 4.2 0 0 0 7 15z"/><path d="m12 15-2 4h3l-2 3"/>',
  };
  return `<svg viewBox="0 0 24 24" ${s}>${m[kind] || cloud}</svg>`;
}
function askLocation() {
  if (!navigator.geolocation) { toast('Location not available'); return; }
  navigator.geolocation.getCurrentPosition(async (p) => {
    const loc = { lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3), name: '' };
    try {
      const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${loc.lat}&longitude=${loc.lon}&localityLanguage=en`).then((r) => r.json());
      loc.name = r.city || r.locality || r.principalSubdivision || '';
    } catch {}
    state.loc = loc; store.set('loc', loc); loadWeather();
  }, () => toast('Location permission denied — set a city in settings'), { timeout: 10000, maximumAge: 3600000 });
}
async function loadWeather() {
  const el = $('#weather-card');
  if (!state.loc) {
    el.className = 'card weather';
    el.innerHTML = `<div class="w-empty"><div class="eyebrow">Weather</div><div style="font-size:17px">See the forecast where you are.</div>
      <div class="row-gap"><button class="btn small" id="w-loc">${ICON.pin} Use my location</button><button class="btn ghost small" id="w-city">Choose a city</button></div></div>`;
    $('#w-loc').onclick = askLocation; $('#w-city').onclick = openSettings; return;
  }
  const { lat, lon, name } = state.loc;
  try {
    const u = new URL('https://api.open-meteo.com/v1/forecast');
    Object.entries({ latitude: lat, longitude: lon, current: 'temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,relative_humidity_2m', hourly: 'temperature_2m,weather_code,precipitation_probability,is_day', daily: 'temperature_2m_max,temperature_2m_min', timezone: 'auto', forecast_days: 2, temperature_unit: state.unit, wind_speed_unit: state.unit === 'fahrenheit' ? 'mph' : 'kmh' }).forEach(([k, v]) => u.searchParams.set(k, v));
    const w = await fetch(u).then((r) => r.json());
    const c = w.current; const [label, kind] = WMO(c.weather_code);
    const nowIdx = Math.max(0, w.hourly.time.findIndex((t) => t >= c.time.slice(0, 13)));
    const hours = w.hourly.time.slice(nowIdx, nowIdx + 12).map((t, i) => {
      const j = nowIdx + i; const [, k] = WMO(w.hourly.weather_code[j]); const pp = w.hourly.precipitation_probability[j];
      return `<div class="hour"><div class="h-t">${i === 0 ? 'Now' : t.slice(11, 13)}</div>${wIcon(k, !!w.hourly.is_day[j])}<div class="num">${Math.round(w.hourly.temperature_2m[j])}°</div><div class="h-p">${pp >= 20 ? pp + '%' : ''}</div></div>`;
    }).join('');
    el.className = 'card weather ' + (kind === 'rain' || kind === 'storm' ? 'rain' : c.is_day ? 'day' : '');
    el.innerHTML = `<div class="weather-top"><div>
        <div class="w-place">${ICON.pin}${esc(name || `${lat}, ${lon}`)}</div>
        <div class="w-temp num">${Math.round(c.temperature_2m)}°</div>
        <div class="w-cond">${label}</div>
        <div class="w-meta num">H ${Math.round(w.daily.temperature_2m_max[0])}°  ·  L ${Math.round(w.daily.temperature_2m_min[0])}°  ·  Feels ${Math.round(c.apparent_temperature)}°</div>
      </div><div class="w-icon">${wIcon(kind, !!c.is_day)}</div></div>
      <div class="hourly">${hours}</div>`;
  } catch { el.innerHTML = '<div class="empty">Weather unavailable right now.</div>'; }
}

// ---------- Settings ----------
function openSettings() {
  const sp = Spotify.connected();
  openSheet(`
    <div class="sheet-head"><h3 class="d-name">Settings</h3><button class="icon-btn" id="s-close">${ICON.x}</button></div>
    <div class="set-group"><h4>Weather location</h4>
      <div class="row-gap" style="margin-bottom:10px"><button class="btn small" id="s-loc">${ICON.pin} Use my location</button>${state.loc ? `<span class="src">Now: <b>${esc(state.loc.name || 'custom')}</b></span>` : ''}</div>
      <div class="field">${ICON.search}<input id="s-city" placeholder="Search a city"></div>
      <div class="list search-results hidden" id="s-city-res"></div>
    </div>
    <div class="set-group"><h4>Temperature</h4>
      <div class="seg" id="s-unit"><button data-u="celsius" class="${state.unit === 'celsius' ? 'on' : ''}">°C</button><button data-u="fahrenheit" class="${state.unit === 'fahrenheit' ? 'on' : ''}">°F</button></div>
    </div>
    <div class="set-group"><h4>Spotify</h4>
      ${sp ? `<div class="row-gap"><span class="src">Connected</span><button class="btn ghost small" id="s-sp-out">Disconnect</button></div>`
           : `<div class="row-gap"><button class="btn spotify small" data-go="music" id="s-sp-go">${ICON.spotify} Set up Spotify</button></div>`}
    </div>
    <div class="set-group"><h4>Watchlist</h4>
      <button class="btn ghost small" id="s-reset">Reset to defaults</button>
    </div>
    <div class="set-group"><h4>Install</h4>
      <p class="page-sub">On iPhone: tap Share, then <b>Add to Home Screen</b>. On Android: tap ⋮, then <b>Install app</b>.</p>
    </div>
  `);
  $('#s-close').onclick = closeSheet;
  $('#s-loc').onclick = () => { closeSheet(); askLocation(); };
  $('#s-unit').onclick = (e) => { const b = e.target.closest('[data-u]'); if (!b) return; state.unit = b.dataset.u; store.set('unit', state.unit); $('#s-unit').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); loadWeather(); };
  $('#s-reset').onclick = () => { state.watch = [...DEFAULT_WATCH]; store.set('watch', state.watch); renderWatch(); renderIndices(); loadQuotes(); toast('Watchlist reset'); };
  if ($('#s-sp-out')) $('#s-sp-out').onclick = () => { Spotify.logout(); closeSheet(); renderMusic(); renderTodayMusic(); toast('Spotify disconnected'); };
  if ($('#s-sp-go')) $('#s-sp-go').addEventListener('click', closeSheet);
  let t;
  $('#s-city').addEventListener('input', (e) => {
    clearTimeout(t); const q = e.target.value.trim(); const box = $('#s-city-res');
    if (q.length < 2) { box.classList.add('hidden'); return; }
    t = setTimeout(async () => {
      try {
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en`).then((r) => r.json());
        box.classList.remove('hidden');
        box.innerHTML = (r.results || []).map((c) => `<button class="row" data-city='${esc(JSON.stringify({ lat: c.latitude, lon: c.longitude, name: c.name }))}'><span class="tk-main"><div class="tk-sym">${esc(c.name)}</div><div class="tk-name">${esc([c.admin1, c.country].filter(Boolean).join(', '))}</div></span></button>`).join('') || '<div class="empty">No matches</div>';
      } catch { box.innerHTML = '<div class="empty">Search unavailable</div>'; }
    }, 300);
  });
  $('#s-city-res').addEventListener('click', (e) => {
    const b = e.target.closest('[data-city]'); if (!b) return;
    state.loc = JSON.parse(b.dataset.city); store.set('loc', state.loc); closeSheet(); loadWeather(); toast('Weather set to ' + state.loc.name);
  });
}
$('#open-settings').addEventListener('click', openSettings);

// ---------- Spotify (PKCE, runs entirely in your browser) ----------
const Spotify = (() => {
  const SCOPES = 'user-read-currently-playing user-read-playback-state user-modify-playback-state user-library-read user-library-modify user-read-recently-played playlist-modify-private playlist-modify-public';
  const redirect = () => location.origin + location.pathname.replace(/index\.html$/, '');
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const rand = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, (x) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[x % 62]).join(''); };
  let tok = store.get('sp.tok', null);
  const clientId = () => store.get('sp.client', '');

  async function login() {
    const id = clientId(); if (!id) return;
    const verifier = rand(64);
    const challenge = b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    const st = rand(16);
    sessionStorage.setItem('sp.verifier', verifier); sessionStorage.setItem('sp.state', st);
    const u = new URL('https://accounts.spotify.com/authorize');
    Object.entries({ response_type: 'code', client_id: id, scope: SCOPES, redirect_uri: redirect(), code_challenge_method: 'S256', code_challenge: challenge, state: st }).forEach(([k, v]) => u.searchParams.set(k, v));
    location.href = u.toString();
  }
  async function tokenReq(body) {
    const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error_description || j.error || 'token');
    tok = { access: j.access_token, refresh: j.refresh_token || tok?.refresh, exp: Date.now() + (j.expires_in - 60) * 1000 };
    store.set('sp.tok', tok);
  }
  async function handleRedirect() {
    const p = new URLSearchParams(location.search);
    if (!p.has('code') && !p.has('error')) return false;
    const code = p.get('code'), st = p.get('state');
    history.replaceState(null, '', redirect() + '#music');
    if (p.get('error')) { toast('Spotify sign-in cancelled'); return true; }
    if (st !== sessionStorage.getItem('sp.state')) { toast('Spotify sign-in expired, try again'); return true; }
    try {
      await tokenReq({ grant_type: 'authorization_code', code, redirect_uri: redirect(), client_id: clientId(), code_verifier: sessionStorage.getItem('sp.verifier') });
      toast('Spotify connected');
    } catch (e) { toast('Spotify: ' + e.message); }
    return true;
  }
  async function token() {
    if (!tok) return null;
    if (Date.now() > tok.exp) {
      try { await tokenReq({ grant_type: 'refresh_token', refresh_token: tok.refresh, client_id: clientId() }); }
      catch { logout(); return null; }
    }
    return tok.access;
  }
  async function call(path, opts = {}) {
    const t = await token(); if (!t) throw Object.assign(new Error('not connected'), { status: 401 });
    const r = await fetch('https://api.spotify.com/v1' + path, { ...opts, headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    if (r.status === 204 || r.status === 202) return null;
    const text = await r.text(); const j = text ? JSON.parse(text) : null;
    if (!r.ok) throw Object.assign(new Error(j?.error?.message || 'Spotify ' + r.status), { status: r.status, reason: j?.error?.reason });
    return j;
  }
  // try a list of endpoint variants (Spotify has been migrating some of these)
  async function callAny(variants) {
    let last;
    for (const [p, o] of variants) { try { return await call(p, o); } catch (e) { last = e; if (e.status !== 404 && e.status !== 403 && e.status !== 410 && e.status !== 405) throw e; } }
    throw last;
  }
  function logout() { tok = null; store.del('sp.tok'); }
  return {
    connected: () => !!tok, clientId, setClientId: (v) => store.set('sp.client', v.trim()), login, logout, handleRedirect, redirect, call,
    nowPlaying: () => call('/me/player?additional_types=track,episode'),
    recent: () => call('/me/player/recently-played?limit=12'),
    search: (q) => call('/search?type=track&limit=12&q=' + encodeURIComponent(q)),
    me: () => call('/me'),
    control: (a) => call('/me/player/' + a, { method: a === 'next' || a === 'previous' ? 'POST' : 'PUT' }),
    save: (id) => callAny([[`/me/tracks?ids=${id}`, { method: 'PUT' }], [`/me/library?uris=spotify:track:${id}`, { method: 'PUT' }]]),
    unsave: (id) => callAny([[`/me/tracks?ids=${id}`, { method: 'DELETE' }], [`/me/library?uris=spotify:track:${id}`, { method: 'DELETE' }]]),
    async makePlaylist(name, uris) {
      const body = JSON.stringify({ name, public: false, description: 'Made with Pulse' });
      let pl;
      try { pl = await call('/me/playlists', { method: 'POST', body }); }
      catch (e) { const me = await call('/me'); pl = await call(`/users/${encodeURIComponent(me.id)}/playlists`, { method: 'POST', body }); }
      await callAny([[`/playlists/${pl.id}/items`, { method: 'POST', body: JSON.stringify({ uris }) }], [`/playlists/${pl.id}/tracks`, { method: 'POST', body: JSON.stringify({ uris }) }]]);
      return pl;
    },
  };
})();

const img = (item) => (item?.album?.images?.[0]?.url || item?.images?.[0]?.url || item?.show?.images?.[0]?.url || '');
const artists = (item) => (item?.artists ? item.artists.map((a) => a.name).join(', ') : item?.show?.name || '');

function renderTodayMusic() {
  const el = $('#today-music');
  if (!Spotify.connected()) {
    el.innerHTML = `<button class="card np" data-go="music" style="width:100%;text-align:left"><div class="np-inner"><div class="np-art" style="display:grid;place-items:center;color:var(--spotify)">${ICON.spotify}</div><div class="np-meta"><div class="np-title">Connect Spotify</div><div class="np-artist">See what’s playing, save songs, make playlists</div></div></div></button>`;
    return;
  }
  const np = state.np; const it = np?.item;
  el.innerHTML = it
    ? `<button class="card np ${np.is_playing ? '' : 'paused'}" data-go="music" style="width:100%;text-align:left"><div class="np-bg" style="background-image:url('${esc(img(it))}')"></div>
        <div class="np-inner"><div class="np-art" style="background-image:url('${esc(img(it))}')"></div>
        <div class="np-meta"><div class="np-label"><span class="eq"><i></i><i></i><i></i></span>${np.is_playing ? 'Now playing' : 'Paused'}</div>
        <div class="np-title">${esc(it.name)}</div><div class="np-artist">${esc(artists(it))}</div></div></div></button>`
    : `<button class="card np" data-go="music" style="width:100%;text-align:left"><div class="np-inner"><div class="np-art" style="display:grid;place-items:center;color:var(--muted)">${ICON.spotify}</div><div class="np-meta"><div class="np-title">Nothing playing</div><div class="np-artist">Start something in Spotify</div></div></div></button>`;
}

async function pollNowPlaying() {
  if (!Spotify.connected() || document.hidden) return;
  try { state.np = await Spotify.nowPlaying(); }
  catch (e) { if (e.status === 401) { Spotify.logout(); } state.np = null; }
  renderTodayMusic();
  if (state.view === 'music') renderPlayer();
}

function renderMusic() {
  const body = $('#music-body');
  if (!Spotify.connected()) {
    const id = Spotify.clientId();
    $('#music-sub').textContent = 'Connect your Spotify account';
    body.innerHTML = `<div class="card setup">
      <div style="display:flex;gap:12px;align-items:center"><span style="color:var(--spotify);width:34px;height:34px;display:block">${ICON.spotify}</span><div style="font-size:17px;font-weight:600">One-time setup</div></div>
      <ol>
        <li>Open <a class="link" href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener">developer.spotify.com/dashboard</a> and create an app (any name).</li>
        <li>Add this as a <b>Redirect URI</b> and tick <b>Web API</b>:</li>
      </ol>
      <div class="code" id="redir">${esc(Spotify.redirect())}</div>
      <ol start="3"><li>Copy the app’s <b>Client ID</b> and paste it here.</li></ol>
      <div class="field"><input id="sp-id" placeholder="Spotify Client ID" value="${esc(id)}" autocomplete="off" spellcheck="false"></div>
      <div><button class="btn spotify" id="sp-connect">${ICON.spotify} Connect Spotify</button></div>
      <p class="page-sub" style="font-size:13px">Your sign-in stays in this browser. Pulse’s server never sees your Spotify account. Play / pause / skip need Spotify Premium.</p>
    </div>`;
    $('#redir').onclick = () => navigator.clipboard?.writeText(Spotify.redirect()).then(() => toast('Copied'));
    $('#sp-connect').onclick = () => {
      const v = $('#sp-id').value.trim();
      if (!/^[a-f0-9]{32}$/i.test(v)) { toast('That doesn’t look like a Client ID'); return; }
      Spotify.setClientId(v); Spotify.login();
    };
    return;
  }
  $('#music-sub').textContent = 'From your Spotify';
  body.innerHTML = `<div class="card player" id="player"></div>
    <section class="section"><div class="field">${ICON.search}<input id="sp-q" placeholder="Search songs or artists" autocomplete="off"></div>
      <div class="list search-results hidden" id="sp-res"></div></section>
    <div id="picks"></div>
    <section class="section"><div class="section-head"><h2 class="section-title">Recently played</h2></div><div class="list" id="sp-recent"><div class="skel" style="height:200px"></div></div></section>`;
  renderPlayer(); renderPicks();
  pollNowPlaying();
  Spotify.recent().then((r) => {
    const seen = new Set();
    const items = (r?.items || []).filter((x) => !seen.has(x.track.id) && seen.add(x.track.id));
    $('#sp-recent').innerHTML = items.length ? items.map((x) => trackRow(x.track)).join('') : '<div class="empty">Nothing yet</div>';
  }).catch(() => { $('#sp-recent').innerHTML = '<div class="empty">Couldn’t load history</div>'; });
  let t;
  $('#sp-q').addEventListener('input', (e) => {
    clearTimeout(t); const q = e.target.value.trim(); const box = $('#sp-res');
    if (!q) { box.classList.add('hidden'); return; }
    t = setTimeout(async () => {
      try { const r = await Spotify.search(q); box.classList.remove('hidden'); box.innerHTML = (r.tracks?.items || []).map(trackRow).join('') || '<div class="empty">No results</div>'; }
      catch (err) { box.classList.remove('hidden'); box.innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
    }, 300);
  });
}

function trackRow(t) {
  if (!t) return '';
  const saved = state.saved.has(t.id); const picked = state.picks.some((p) => p.id === t.id);
  return `<div class="row track-row"><a class="tk-logo" style="background-image:url('${esc(t.album?.images?.[2]?.url || img(t))}')" href="${esc(t.external_urls?.spotify || '#')}" target="_blank" rel="noopener" aria-label="Open in Spotify"></a>
    <span class="tk-main"><div class="tk-sym" style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.name)}</div><div class="tk-name">${esc(artists(t))}</div></span>
    <button class="small-act ${saved ? 'on' : ''}" data-save="${esc(t.id)}" aria-label="Save">${saved ? ICON.heartFill : ICON.heart}</button>
    <button class="small-act ${picked ? 'on' : ''}" data-pick='${esc(JSON.stringify({ id: t.id, uri: t.uri, name: t.name }))}' aria-label="Add to playlist">${picked ? ICON.check : ICON.plus}</button></div>`;
}

function renderPlayer() {
  const el = $('#player'); if (!el) return;
  const np = state.np; const it = np?.item;
  if (!it) { el.innerHTML = `<div class="player-art" style="display:grid;place-items:center;color:var(--faint)"><span style="width:60px;height:60px;display:block">${ICON.spotify}</span></div><div class="player-title">Nothing playing</div><div class="player-artist">Start something in the Spotify app${np?.device ? '' : ' on any device'}.</div>`; return; }
  const saved = state.saved.has(it.id);
  const pctDone = it.duration_ms ? (np.progress_ms / it.duration_ms) * 100 : 0;
  el.innerHTML = `<div class="player-art" style="background-image:url('${esc(img(it))}')"></div>
    <div class="player-title">${esc(it.name)}</div><div class="player-artist">${esc(artists(it))}</div>
    <div class="progress"><i style="width:${pctDone.toFixed(1)}%"></i></div>
    <div class="times num"><span>${mmss(np.progress_ms)}</span><span>${np.device?.name ? esc(np.device.name) : ''}</span><span>${mmss(it.duration_ms)}</span></div>
    <div class="controls">
      <button class="ctl heart ${saved ? 'on' : ''}" data-save="${esc(it.id)}" aria-label="Save">${saved ? ICON.heartFill : ICON.heart}</button>
      <button class="ctl" data-ctl="previous" aria-label="Previous">${ICON.prev}</button>
      <button class="ctl play" data-ctl="${np.is_playing ? 'pause' : 'play'}" aria-label="Play/Pause">${np.is_playing ? ICON.pause : ICON.play}</button>
      <button class="ctl" data-ctl="next" aria-label="Next">${ICON.next}</button>
      <button class="ctl" data-pick='${esc(JSON.stringify({ id: it.id, uri: it.uri, name: it.name }))}' aria-label="Add to playlist">${ICON.plus}</button>
    </div>`;
}

function renderPicks() {
  const el = $('#picks'); if (!el) return;
  if (!state.picks.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="picks-bar"><div class="grow"><b>${state.picks.length}</b> song${state.picks.length > 1 ? 's' : ''} picked</div>
    <button class="btn ghost small" id="pk-clear">Clear</button><button class="btn spotify small" id="pk-make">Make playlist</button></div>`;
  $('#pk-clear').onclick = () => { state.picks = []; renderPicks(); renderMusic(); };
  $('#pk-make').onclick = async () => {
    const name = prompt('Playlist name', 'Pulse picks · ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
    if (!name) return;
    try { const pl = await Spotify.makePlaylist(name, state.picks.map((p) => p.uri)); toast('Playlist created'); state.picks = []; renderMusic(); if (pl?.external_urls?.spotify) setTimeout(() => window.open(pl.external_urls.spotify, '_blank'), 400); }
    catch (e) { toast('Couldn’t create playlist: ' + e.message); }
  };
}

document.addEventListener('click', async (e) => {
  const s = e.target.closest('[data-save]');
  if (s) {
    e.stopPropagation(); const id = s.dataset.save; const was = state.saved.has(id);
    try { was ? await Spotify.unsave(id) : await Spotify.save(id); was ? state.saved.delete(id) : state.saved.add(id); store.set('savedIds', [...state.saved].slice(-500)); s.classList.toggle('on', !was); s.innerHTML = was ? ICON.heart : ICON.heartFill; toast(was ? 'Removed from Liked Songs' : 'Saved to Liked Songs'); }
    catch (err) { toast('Couldn’t save: ' + err.message); }
    return;
  }
  const p = e.target.closest('[data-pick]');
  if (p) {
    e.stopPropagation(); const t = JSON.parse(p.dataset.pick);
    const i = state.picks.findIndex((x) => x.id === t.id);
    if (i >= 0) { state.picks.splice(i, 1); } else { state.picks.push(t); toast('Added to picks'); }
    if (!p.classList.contains('ctl')) { p.classList.toggle('on', i < 0); p.innerHTML = i < 0 ? ICON.check : ICON.plus; }
    renderPicks(); return;
  }
  const c = e.target.closest('[data-ctl]');
  if (c) {
    try { await Spotify.control(c.dataset.ctl); setTimeout(pollNowPlaying, 450); }
    catch (err) { toast(err.status === 403 ? 'Playback control needs Spotify Premium' : err.status === 404 ? 'Open Spotify on a device first' : err.message); }
  }
});

// ---------- Boot ----------
async function boot() {
  renderHeader();
  const fromSpotify = await Spotify.handleRedirect();
  renderIndices(); renderWatch(); renderTodayMusic();
  loadWeather(); loadQuotes();
  loadNews('top', '#today-news', 5, true);
  go(fromSpotify ? 'music' : (location.hash || '#today').slice(1));
  pollNowPlaying();
  setInterval(() => { if (!document.hidden) loadQuotes(); }, 30000);
  setInterval(pollNowPlaying, 8000);
  setInterval(() => { if (!document.hidden) loadWeather(); }, 15 * 60000);
  setInterval(renderHeader, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { loadQuotes(); pollNowPlaying(); renderHeader(); } });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
boot();
})();
