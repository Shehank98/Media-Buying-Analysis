const $ = (s, r = document) => r.querySelector(s);
const E = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const f0 = d3.format(',.0f'), f1 = d3.format(',.1f'), f2 = d3.format(',.2f');
const pct = (v) => f1(v) + '%';
const rs = (k) => k >= 1e6 ? 'Rs ' + f2(k / 1e6) + ' bn' : k >= 1e3 ? 'Rs ' + f1(k / 1e3) + ' mn' : 'Rs ' + f0(k) + ' k';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ORDER_KEYS = ['HIRU', 'DERANA', 'SIRASA', 'SWARNAVAHINI', 'ITN', 'SHAKTHI', 'SIYATHA'];
const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)', 'var(--c8)'];
const MUTED = 'var(--cds-chart-muted)';
const color = (k) => { const i = ORDER_KEYS.indexOf(MB.chKey(k)); return i >= 0 ? COLORS[i] : MUTED; };
const pretty = (k) => k === k.toUpperCase() ? k.split(' ').map((w) => ['TV', 'ITN'].includes(w) || /\d/.test(w) ? w : w[0] + w.slice(1).toLowerCase()).join(' ') : k;
const dpName = (s) => s.replace(/\s*\(.*$/, '');
const dpTime = (s) => { const m = s.match(/(\d{2})(\d{2}) - (\d{2})(\d{2})/); return m ? `${m[1]}:${m[2]}–${m[3]}:${m[4]}` : ''; };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtD = (iso) => { const [y, m, d] = iso.split('-'); return `${+d} ${MON[+m - 1]} ${y}`; };
const rangeLabel = (m) => m && m.from && m.to ? (m.from === m.to ? fmtD(m.from) : `${fmtD(m.from)} to ${fmtD(m.to)}`) : '';
const periodLabel = () => { const r = D && D.meta ? rangeLabel(D.meta) : ''; return (r ? r + ', ' : '') + 'target audience as set in the Channel Summary'; };
const ctl = (bar, label, input) => { const w = E('span', 'ctl'); w.append(label, input); bar.append(w); return w; };
const mix = (c, p) => `color-mix(in srgb, ${c} ${p}%, var(--color-panel))`;

const ST = { tab: 'data', sel: null, sorts: {}, q: '', detail: null, cat: '', adv: '', budget: 100, mix: null, ask: 10, shift: 20, guard: 40 };
let D = null;


const tip = $('#tip'), wrap = $('#mb');
function showTip(ev, title, lines) {
  tip.replaceChildren(E('div', 't', title));
  for (const [n, v, c] of lines) {
    const r = E('div', 'r');
    if (c) { const i = E('i'); i.style.background = c; r.append(i); }
    r.append(E('span', '', n), E('span', 'strong', v));
    tip.append(r);
  }
  tip.hidden = false;
  const b = wrap.getBoundingClientRect();
  let x = ev.clientX - b.left + 14, y = ev.clientY - b.top + 14;
  if (x + tip.offsetWidth > b.width - 6) x = ev.clientX - b.left - tip.offsetWidth - 14;
  tip.style.left = Math.max(4, x) + 'px'; tip.style.top = y + 'px';
}
const hideTip = () => { tip.hidden = true; };


function svgIn(host, h) {
  host.replaceChildren();
  const W = Math.max(host.clientWidth, 260);
  const s = d3.select(host).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${h}`).attr('role', 'img');
  return { s, W };
}
const legend = (host, items) => {
  const l = E('div', 'legend');
  for (const [n, c] of items) { const s = E('span'); const i = E('i'); i.style.background = c; s.append(i, n); l.append(s); }
  host.before(l);
};


function table(host, id, cols, rows, opt = {}) {
  const sort = ST.sorts[id] || (ST.sorts[id] = { c: opt.sortCol ?? 0, d: opt.sortDir ?? -1 });
  const col = cols[sort.c];
  const data = rows.slice().sort((a, b) => { const x = col.s(a), y = col.s(b); return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sort.d; });
  const t = E('table'), th = E('thead'), tr = E('tr');
  cols.forEach((c, i) => {
    const h = E('th', c.n ? 'n' : '', c.h); h.tabIndex = 0;
    if (i === sort.c) h.setAttribute('aria-sort', sort.d > 0 ? 'ascending' : 'descending');
    const go = () => { sort.d = sort.c === i ? -sort.d : (c.n ? -1 : 1); sort.c = i; opt.redraw(); };
    h.addEventListener('click', go); h.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    tr.append(h);
  });
  th.append(tr);
  const tb = E('tbody');
  for (const r of data.slice(0, opt.max || 500)) {
    const row = E('tr');
    if (opt.key) { row.dataset.k = opt.key(r); row.tabIndex = 0; }
    for (const c of cols) { const td = E('td', c.n ? 'n' : ''); const v = c.f ? c.f(r, td) : c.s(r); if (v instanceof Node) td.append(v); else td.textContent = v; row.append(td); }
    tb.append(row);
  }
  t.append(th, tb);
  host.replaceChildren(t);
  if (opt.onRow) host.querySelectorAll('tr[data-k]').forEach((r) => { r.addEventListener('click', () => opt.onRow(r.dataset.k)); r.addEventListener('keydown', (e) => { if (e.key === 'Enter') opt.onRow(r.dataset.k); }); });
}
const dotName = (ch) => { const s = E('span'); const d = E('i', 'dot'); d.style.background = color(ch); s.append(d, pretty(ch)); return s; };


function closeDetail() { ST.detail = null; $('#detail').hidden = true; }
function openDetail(d) { ST.detail = d; renderDetail(); const el = $('#detail'); el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
function stats(items) { const g = E('div', 'stats'); for (const [l, v] of items) { const d = E('div'); d.append(E('b', '', v), E('span', '', l)); g.append(d); } return g; }
function miniTable(cols, rows) { const box = E('div', 'box'); box.style.maxHeight = '16rem'; const h = E('div'); box.append(h); table(h, 'm' + Math.random(), cols, rows, { redraw: () => {}, sortCol: 0, sortDir: 1 }); return box; }
function plain(cols, rows) { // static small table, no sorting state
  const t = E('table'), th = E('thead'), tr = E('tr'); cols.forEach((c) => tr.append(E('th', c.n ? 'n' : '', c.h))); th.append(tr);
  const tb = E('tbody'); for (const r of rows) { const row = E('tr'); for (const c of cols) { const td = E('td', c.n ? 'n' : ''); const v = c.f(r); if (v instanceof Node) td.append(v); else td.textContent = v; row.append(td); } tb.append(row); }
  t.append(th, tb); const box = E('div', 'box'); box.style.maxHeight = '18rem'; box.append(t); return box;
}
function renderDetail() {
  const el = $('#detail'), d = ST.detail;
  if (!d || !D) { el.hidden = true; return; }
  el.hidden = false; el.replaceChildren();
  const head = E('div', 'head'); const hh = E('div'); hh.append(E('h2', '', d.title), E('p', 'sub', d.sub || '')); const cl = E('button', 'btn', 'Close'); cl.addEventListener('click', closeDetail); head.append(hh, cl); el.append(head);
  d.body(el);
}

function channelDetail(ch) {
  const r = D.chRow.get(ch), p = D.primeShare.get(ch);
  openDetail({ title: pretty(ch) + ' in full', sub: 'Every figure the Channel Summary holds for this channel, ' + periodLabel() + '', body: (el) => {
    el.append(stats([['Share of audience', pct(r.share)], ['Total ratings', f0(Math.round(r.ratings))], ['Avg daily minutes', f0(r.avg_minutes)], ['Individual reach', f0(r.reach)], ['Reach %', pct(r.reach_pct)], ['Prime share of ratings', p ? pct(p.share) : '–']]));
    const dows = D.dow.filter((x) => x.channel === ch).sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));
    el.append(E('h3', '', 'By day of week'));
    el.append(plain([{ h: 'Day', f: (x) => x.day }, { h: 'Days in period', n: 1, f: (x) => x.days_in_month }, { h: 'Ratings', n: 1, f: (x) => f0(Math.round(x.ratings)) }, { h: 'Avg per day', n: 1, f: (x) => f0(Math.round(x.ratings_per_day)) }, { h: 'Reach', n: 1, f: (x) => f0(x.reach) }, { h: 'Reach %', n: 1, f: (x) => pct(x.reach_pct) }], dows));
    const dps = D.dp.filter((x) => x.channel === ch).sort((a, b) => D.dpNames.indexOf(a.daypart) - D.dpNames.indexOf(b.daypart) || a.daytype.localeCompare(b.daytype));
    el.append(E('h3', '', 'By daypart'));
    el.append(plain([{ h: 'Daypart', f: (x) => dpName(x.daypart) + ' ' + dpTime(x.daypart) }, { h: 'Days', f: (x) => x.daytype }, { h: 'Ratings', n: 1, f: (x) => f0(Math.round(x.ratings)) }, { h: 'Per hour per day', n: 1, f: (x) => f0(Math.round(x.ratings_per_hour_day)) }, { h: 'Reach %', n: 1, f: (x) => pct(x.reach_pct) }, { h: 'Share of voice', n: 1, f: (x) => pct(D.sovPct(ch, x.daypart)) }], dps));
    const b = E('button', 'btn', 'Open channel profile'); b.style.marginTop = '.75rem'; b.addEventListener('click', () => { ST.sel = ch; go('profile'); }); el.append(b);
  } });
}
function cellDetail(ch, dpn) {
  const rows = D.dp.filter((x) => x.channel === ch && x.daypart === dpn);
  const all = D.channels.map((c) => ({ ch: c.channel, v: D.sovPct(c.channel, dpn) })).sort((a, b) => b.v - a.v);
  const rank = all.findIndex((x) => x.ch === ch) + 1;
  openDetail({ title: `${pretty(ch)} · ${dpName(dpn)}`, sub: dpTime(dpn) + ' · weekdays and weekends', body: (el) => {
    el.append(stats([['Share of voice', pct(D.sovPct(ch, dpn))], ['Rank in daypart', `${rank} of ${all.length}`], ['Leader', pretty(all[0].ch) + ' ' + pct(all[0].v)]]));
    el.append(plain([{ h: 'Days', f: (x) => x.daytype }, { h: 'Ratings', n: 1, f: (x) => f0(Math.round(x.ratings)) }, { h: 'Per hour per day', n: 1, f: (x) => f0(Math.round(x.ratings_per_hour_day)) }, { h: 'Reach', n: 1, f: (x) => f0(x.reach) }, { h: 'Reach %', n: 1, f: (x) => pct(x.reach_pct) }], rows));
    el.append(E('h3', '', 'All channels in this daypart'));
    el.append(plain([{ h: 'Channel', f: (x) => dotName(x.ch) }, { h: 'Share of voice', n: 1, f: (x) => pct(x.v) }], all));
  } });
}
function groupDetail(key, kind) { // kind: 'cat' | 'adv'
  const rows = D.spend.filter((r) => (kind === 'cat' ? r.product_group : r.advertiser) === key);
  const tot = d3.sum(rows, (r) => r.spend);
  const chs = [...d3.rollup(rows, (v) => d3.sum(v, (r) => r.spend), D.chKey)].map(([k, v]) => ({ k, v, mk: D.byCh.get(k) / D.totalSpend })).sort((a, b) => b.v - a.v);
  const other = [...d3.rollup(rows, (v) => d3.sum(v, (r) => r.spend), (r) => kind === 'cat' ? r.advertiser : r.product_group)].map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  const brands = [...d3.rollup(rows, (v) => d3.sum(v, (r) => r.spend), (r) => r.brand)].map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  openDetail({ title: key, sub: kind === 'cat' ? 'Product group, monitored TV spend in the period (Nielsen)' : 'Advertiser, monitored TV spend in the period (Nielsen)', body: (el) => {
    el.append(stats([['TV spend', rs(tot)], ['Share of all TV spend', pct(tot / D.totalSpend * 100)], [kind === 'cat' ? 'Advertisers' : 'Product groups', f0(other.length)], ['Brands', f0(brands.length)], ['Channels used', f0(chs.length)]]));
    el.append(E('h3', '', 'Where it is bought'));
    el.append(plain([{ h: 'Channel', f: (x) => dotName(x.k) }, { h: 'Spend', n: 1, f: (x) => rs(x.v) }, { h: 'Share of this spend', n: 1, f: (x) => pct(x.v / tot * 100) }, { h: 'Channel share of all TV', n: 1, f: (x) => pct(x.mk * 100) }, { h: 'Index', n: 1, f: (x) => f0(x.v / tot / x.mk * 100) }], chs));
    el.append(E('h3', '', kind === 'cat' ? 'Advertisers' : 'Product groups'));
    el.append(plain([{ h: kind === 'cat' ? 'Advertiser' : 'Product group', f: (x) => x.k }, { h: 'Spend', n: 1, f: (x) => rs(x.v) }, { h: 'Share', n: 1, f: (x) => pct(x.v / tot * 100) }], other.slice(0, 25)));
    el.append(E('h3', '', 'Brands'));
    el.append(plain([{ h: 'Brand', f: (x) => x.k }, { h: 'Spend', n: 1, f: (x) => rs(x.v) }, { h: 'Share', n: 1, f: (x) => pct(x.v / tot * 100) }], brands.slice(0, 25)));
  } });
}

