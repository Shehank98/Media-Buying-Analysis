/* Negotiation desk: joins LMRB spots to programme ratings, prices every programme against its channel,
   and works out where a client can push on rate. Needs the programme export and the LMRB file. */
const NG = { cat: '', adv: '', ch: '', over: 25, ask: 15, minSpots: 2, basis: '30' };
const BUCKETS = { 'Overpriced': 1, 'Must buy': 0, 'Value': 2, 'Cut': 7, 'Fair': null, 'Unpriced': null };
const bColor = (b) => BUCKETS[b] == null ? MUTED : COLORS[BUCKETS[b]];
const costMul = () => (SET.lmrbUnit === 'k' ? 1000 : 1);
const R = (c) => rs(c * costMul() / 1000);
const price = (s) => NG.basis === '30' && s.dur > 0 ? s.cost / s.dur * 30 : s.cost;
const posClass = (s) => { if (!s.posInBrk || !s.adsInBrk) return null; if (s.adsInBrk <= 1) return 'Only'; if (s.posInBrk === 1) return 'First'; if (s.posInBrk >= s.adsInBrk) return 'Last'; return 'Middle'; };
const airKey = (a) => a.channel + '|' + a.program;

function joinSpots() {
  if (D._join) return D._join;
  const idx = new Map();
  for (const a of D.prog) { const k = a.channel + '|' + a.date; if (!idx.has(k)) idx.set(k, []); idx.get(k).push(a); }
  const spots = [], miss = new Map(); let missed = 0;
  for (const s of D.lmrb) {
    const list = idx.get(s.channel + '|' + s.date); let a = null; const t = s.advtTime;
    if (list) a = list.find((x) => t >= x.start && t < x.end) || list.find((x) => t + 1440 >= x.start && t + 1440 < x.end) || list.find((x) => x.program === s.program);
    if (a) spots.push({ ...s, air: a, tvr: a.tvr, prime: a.prime, daypart: a.daypart }); else { missed++; miss.set(s.channel, (miss.get(s.channel) || 0) + 1); }
  }
  return (D._join = { spots, total: D.lmrb.length, matched: spots.length, missed, miss: [...miss].sort((a, b) => b[1] - a[1]).slice(0, 6) });
}
function benchmarks() {
  D._bench = D._bench || {};
  if (D._bench[NG.basis]) return D._bench[NG.basis];
  const by = new Map(), byCh = new Map(), all = [];
  for (const s of joinSpots().spots) {
    if (!(s.cost > 0 && s.tvr > 0)) continue; const c = price(s) / s.tvr; all.push(c);
    const k = s.channel + '|' + (s.prime ? 1 : 0); if (!by.has(k)) by.set(k, []); by.get(k).push(c);
    if (!byCh.has(s.channel)) byCh.set(s.channel, []); byCh.get(s.channel).push(c);
  }
  const mBy = new Map([...by].map(([k, v]) => [k, v.length >= 15 ? d3.median(v) : null])), mCh = new Map([...byCh].map(([k, v]) => [k, d3.median(v)])), g = d3.median(all);
  return (D._bench[NG.basis] = { fn: (ch, prime) => mBy.get(ch + '|' + (prime ? 1 : 0)) || mCh.get(ch) || g, g });
}
function tvrQuant() {
  if (D._q) return D._q;
  const a = progAgg(D.prog.filter((r) => (r.duration ?? (r.end - r.start)) >= 10)), by = d3.group(a, (x) => x.channel), q = new Map();
  const mk = (v) => { const t = v.map((x) => x.tvr).sort(d3.ascending); return { q25: d3.quantileSorted(t, 0.25), q50: d3.quantileSorted(t, 0.5), q75: d3.quantileSorted(t, 0.75) }; };
  for (const [c, v] of by) q.set(c, v.length >= 8 ? mk(v) : null);
  const all = mk(a); for (const [c, v] of q) if (!v) q.set(c, all);
  q.set('*', all); return (D._q = q);
}
function breaks() {
  if (D._brk) return D._brk;
  const m = new Map();
  for (const s of D.lmrb) { if (s.brkNo == null) continue; const k = s.channel + '|' + s.date + '|' + s.brkNo; if (!m.has(k)) m.set(k, []); m.get(k).push(s); }
  return (D._brk = m);
}

function programmeRows(spots) {
  const B = benchmarks(), Q = tvrQuant(), out = [];
  for (const v of d3.group(spots, (s) => airKey(s.air)).values()) {
    const a = v[0].air; let pSum = 0, bSum = 0, save = 0, costP = 0;
    for (const s of v) { if (!(s.cost > 0 && s.tvr > 0)) continue; const pr = price(s), b = B.fn(s.channel, s.prime) * s.tvr; pSum += pr; bSum += b; costP += s.cost; save += s.cost * Math.min(NG.ask / 100, Math.max(0, 1 - b / pr)); }
    const idx = bSum ? pSum / bSum * 100 : null, tvr = d3.mean(v, (s) => s.tvr), q = Q.get(a.channel) || Q.get('*');
    let bucket = 'Fair';
    if (idx == null) bucket = 'Unpriced';
    else if (tvr <= q.q25 && idx >= 100) bucket = 'Cut';
    else if (idx >= 100 + NG.over) bucket = 'Overpriced';
    else if (tvr >= q.q75 && idx <= 110) bucket = 'Must buy';
    else if (idx <= 85) bucket = 'Value';
    const cost = d3.sum(v, (s) => s.cost);
    const actions = { 'Overpriced': `Ask for up to ${f0(costP ? save / costP * 100 : 0)}% off, or bonus spots to match`, 'Must buy': 'Lock it in a package and ask for first or last position', 'Value': `Buy more: ${f0(100 - idx)}% below the channel norm`, 'Cut': 'Drop it, or demand free spots to compensate for weak delivery', 'Fair': 'Hold at this rate', 'Unpriced': 'No cost recorded' };
    out.push({ key: airKey(a), channel: a.channel, program: a.program, category: a.category, n: v.length, cost, tvr, idx, save, bucket, action: actions[bucket], daypart: modeOf(v.map((s) => s.daypart)), spots: v });
  }
  return out;
}

MB.neg = {
  programmeSummary(key) {
    const v = joinSpots().spots.filter((s) => airKey(s.air) === key); if (!v.length) return null;
    const r = programmeRows(v)[0];
    return { n: v.length, cost: r.cost, idx: r.idx ?? 100, advertisers: [...d3.rollup(v, (x) => ({ n: x.length, cost: d3.sum(x, (s) => s.cost) }), (s) => s.advertiser)].map(([k, o]) => ({ k, ...o })).sort((a, b) => b.cost - a.cost) };
  },
};

function negDetail(r) {
  const gems = marketGems().filter((g) => g.channel === r.channel && g.key !== r.key).slice(0, 5);
  openDetail({ title: r.program, sub: `${pretty(r.channel)} · ${r.bucket} · ${r.action}`, body: (el) => {
    el.append(stats([['Spots', f0(r.n)], ['Monitored cost', R(r.cost)], ['Average TVR', f2(r.tvr)], ['Cost per point index', r.idx != null ? f0(r.idx) : '–'], ['Estimated saving', R(r.save)], ['Main slot', dpName(r.daypart)]]));
    el.append(E('p', 'sub', 'Cost per point index compares the price per rating point with the median for this channel and slot. 100 is the norm. Saving is capped by the largest ask you set.'));
    el.append(E('h3', '', 'Every spot'));
    el.append(plain([{ h: 'Date', f: (s) => fmtD(s.date) }, { h: 'Time', f: (s) => MB.hhmm(s.advtTime) }, { h: 'Advertiser', f: (s) => trunc(s.advertiser, 28) }, { h: 'Secs', n: 1, f: (s) => s.dur ?? '–' }, { h: 'Break', n: 1, f: (s) => s.brkNo ?? '–' }, { h: 'Position', n: 1, f: (s) => s.posInBrk != null ? `${s.posInBrk} of ${s.adsInBrk ?? '?'}` : '–' }, { h: 'Cost', n: 1, f: (s) => R(s.cost) }, { h: 'TVR', n: 1, f: (s) => f2(s.tvr) }], r.spots.slice().sort((a, b) => a.date.localeCompare(b.date) || a.advtTime - b.advtTime).slice(0, 300)));
    if (gems.length) { el.append(E('h3', '', 'Better-value programmes on the same channel')); el.append(plain([{ h: 'Programme', f: (g) => g.program }, { h: 'Avg TVR', n: 1, f: (g) => f2(g.tvr) }, { h: 'Cost index', n: 1, f: (g) => f0(g.idx) }, { h: 'Spots', n: 1, f: (g) => g.n }], gems)); }
  } });
}
function marketGems() {
  const rows = programmeRows(joinSpots().spots), Q = tvrQuant();
  return rows.filter((r) => r.n >= Math.max(3, NG.minSpots) && r.idx != null && r.idx <= 85 && r.tvr >= (Q.get(r.channel) || Q.get('*')).q50).sort((a, b) => b.tvr / b.idx - a.tvr / a.idx);
}

function tabNegotiate(p) {
  p.replaceChildren();
  const J = joinSpots();
  const dg = E('div', 'card'); dg.style.marginBottom = 'var(--cds-gap-md)';
  const pctM = J.total ? J.matched / J.total * 100 : 0;
  dg.append(E('h2', '', 'How well the files line up'), E('p', 'note', `${f0(J.matched)} of ${f0(J.total)} spots (${f0(pctM)}%) were matched to a programme airing by channel, date and the time the advert aired. ${J.missed ? 'Unmatched spots are left out. The channels with most misses: ' + J.miss.map((d) => `${pretty(d[0])} ${f0(d[1])}`).join(', ') + '.' : ''}`));
  if (pctM < 70) dg.append(E('p', 'msg err', 'Fewer than 70% matched. Check the two files cover the same dates and that the channel names are alike.'));
  p.append(dg);
  if (!J.matched) return;
  const cats = [...d3.rollup(J.spots, (v) => d3.sum(v, (s) => s.cost), (s) => s.product_group)].sort((a, b) => b[1] - a[1]).map((d) => d[0]).filter(Boolean);
  const bar = E('div', 'tools'); p.append(bar);
  const sel = (id, label, key) => { const l = E('label', 'sub', label); l.htmlFor = id; const s = E('select'); s.id = id; ctl(bar, l, s); s.addEventListener('change', () => { NG[key] = s.value; if (key === 'cat') NG.adv = ''; fill(); draw(); }); return s; };
  const sc = sel('ngcat', 'Category', 'cat'), sa = sel('ngadv', 'Advertiser', 'adv'), sh = sel('ngch', 'Channel', 'ch');
  const fill = () => {
    sc.replaceChildren(new Option('All categories', '')); for (const c of cats) sc.append(new Option(c, c)); sc.value = NG.cat;
    const advs = [...d3.rollup(J.spots.filter((s) => !NG.cat || s.product_group === NG.cat), (v) => d3.sum(v, (s) => s.cost), (s) => s.advertiser)].sort((a, b) => b[1] - a[1]).map((d) => d[0]);
    sa.replaceChildren(new Option('All advertisers', '')); for (const a of advs) sa.append(new Option(a, a)); if (!advs.includes(NG.adv)) NG.adv = ''; sa.value = NG.adv;
    const chs = [...new Set(J.spots.map((s) => s.channel))].sort(); sh.replaceChildren(new Option('All channels', '')); for (const c of chs) sh.append(new Option(pretty(c), c)); sh.value = NG.ch;
  }; fill();
  const rng = (id, label, key, min, max, step, unit) => { const l = E('label', 'sub'); l.htmlFor = id; const o = E('b', '', NG[key] + unit); l.append(label + ' ', o); const r = E('input'); r.type = 'range'; r.id = id; r.min = min; r.max = max; r.step = step; r.value = NG[key]; r.style.width = '7rem'; r.addEventListener('input', () => { NG[key] = +r.value; o.textContent = r.value + unit; draw(); }); ctl(bar, l, r); };
  rng('ngover', 'Call it overpriced above', 'over', 5, 60, 5, '% over norm'); rng('ngask', 'Largest ask', 'ask', 0, 40, 1, '%'); rng('ngmin', 'Show programmes with at least', 'minSpots', 1, 10, 1, ' spots');
  const lb = E('label', 'sub', 'Price basis'); lb.htmlFor = 'ngbasis'; const sb = E('select'); sb.id = 'ngbasis'; sb.append(new Option('Per 30 seconds', '30'), new Option('Per spot as booked', 'spot')); sb.value = NG.basis; sb.addEventListener('change', () => { NG.basis = sb.value; draw(); }); ctl(bar, lb, sb);
  const out = E('div'); p.append(out);

  function draw() {
    out.replaceChildren();
    const scope = J.spots.filter((s) => (!NG.cat || s.product_group === NG.cat) && (!NG.adv || s.advertiser === NG.adv) && (!NG.ch || s.channel === NG.ch));
    if (!scope.length) { out.append(E('p', 'sub', 'No matched spots for this selection.')); return; }
    const rows = programmeRows(scope), shown = rows.filter((r) => r.n >= NG.minSpots);
    const cost = d3.sum(scope, (s) => s.cost), save = d3.sum(rows, (r) => r.save), brk = breaks();
    const withBrk = scope.filter((s) => s.brkNo != null), clash = withBrk.filter((s) => (brk.get(s.channel + '|' + s.date + '|' + s.brkNo) || []).some((o) => o.advertiser !== s.advertiser && o.product_group === s.product_group)).length;
    const kp = E('div', 'kpis');
    for (const [l, v] of [['Monitored spend', R(cost)], ['Spots', f0(scope.length)], ['Programmes', f0(rows.length)], ['Possible saving', R(save) + ' · ' + pct(cost ? save / cost * 100 : 0)], ['Spots next to a rival', withBrk.length ? pct(clash / withBrk.length * 100) : '–']]) { const k = E('div', 'kpi'); k.append(E('div', 'v', v), E('div', 'l', l)); kp.append(k); }
    out.append(kp);
    const g1 = E('div', 'grid wide'); out.append(g1);
    const a = E('div', 'card'); a.append(E('h2', '', 'Where the overpayment sits'), E('p', 'note', 'Spend by channel, with the part that could come off at your largest ask. Click a bar for the programmes on that channel.'));
    const ha = E('div', 'chart'); a.append(ha);
    const b = E('div', 'card'); b.append(E('h2', '', 'Price against delivery'), E('p', 'note', 'Each bubble is a programme. Left to right is how many watch it. Bottom to top is how dear it is against its channel norm, where 100 is normal. Above the line you overpay. Bubble size is spend. Click for the spots.'));
    const hb = E('div', 'chart'); b.append(hb); g1.append(a, b);
    { const by = [...d3.rollup(rows, (v) => ({ cost: d3.sum(v, (r) => r.cost), save: d3.sum(v, (r) => r.save) }), (r) => r.channel)].map(([k, o]) => ({ k, ...o })).sort((x, y) => y.cost - x.cost).slice(0, 10);
      const rowH = 30, h = by.length * rowH + 14, { s, W } = svgIn(ha, h), nar = W < 480, m = { l: nar ? 92 : 130, r: nar ? 84 : 120, t: 4, b: 8 };
      const x = d3.scaleLinear([0, d3.max(by, (d) => d.cost)], [m.l, W - m.r]), y = d3.scaleBand(by.map((d) => d.k), [m.t, h - m.b]).padding(0.22);
      for (const d of by) {
        s.append('text').attr('class', 'strong').attr('x', m.l - 8).attr('y', y(d.k) + y.bandwidth() / 2 + 4).attr('text-anchor', 'end').text(pretty(d.k));
        const gr = s.append('g').attr('class', 'hit').on('pointermove', (ev) => showTip(ev, pretty(d.k), [['Monitored spend', R(d.cost)], ['Possible saving', R(d.save), COLORS[1]], ['Saving share', pct(d.cost ? d.save / d.cost * 100 : 0)]])).on('pointerleave', hideTip).on('click', () => openDetail({ title: pretty(d.k) + ' programmes', sub: 'For the selection above', body: (el) => el.append(plain([{ h: 'Programme', f: (r) => r.program }, { h: 'Spots', n: 1, f: (r) => r.n }, { h: 'Spend', n: 1, f: (r) => R(r.cost) }, { h: 'Cost index', n: 1, f: (r) => r.idx != null ? f0(r.idx) : '–' }, { h: 'Saving', n: 1, f: (r) => R(r.save) }, { h: 'Verdict', f: (r) => r.bucket }], rows.filter((r) => r.channel === d.k).sort((p1, p2) => p2.save - p1.save))) }));
        const w1 = x(d.cost - d.save) - m.l, w2 = x(d.cost) - x(d.cost - d.save);
        gr.append('rect').attr('x', m.l).attr('y', y(d.k)).attr('height', y.bandwidth()).attr('width', Math.max(1, w1 - 2)).attr('rx', 3).style('fill', mix(COLORS[0], 45));
        if (d.save > 0) gr.append('rect').attr('x', x(d.cost - d.save)).attr('y', y(d.k)).attr('height', y.bandwidth()).attr('width', Math.max(2, w2)).attr('rx', 3).style('fill', COLORS[1]);
        s.append('text').attr('x', x(d.cost) + 6).attr('y', y(d.k) + y.bandwidth() / 2 + 4).text(R(d.cost) + (d.save > 0 ? ' · ' + f0(d.save / d.cost * 100) + '%' : ''));
      }
      legend(ha, [['Spend at today’s rate', mix(COLORS[0], 45)], ['Could come off', COLORS[1]]]); }
    { const pts = rows.filter((r) => r.idx != null), h = 360, { s, W } = svgIn(hb, h), m = { l: 44, r: 14, t: 10, b: 38 };
      if (pts.length) {
        const x = d3.scaleLinear([0, d3.max(pts, (d) => d.tvr) * 1.08], [m.l, W - m.r]).nice(), cap = Math.max(200, Math.min(300, d3.quantile(pts.map((d) => d.idx).sort(d3.ascending), 0.95) * 1.1)), y = d3.scaleLinear([Math.min(40, d3.min(pts, (d) => d.idx)), cap], [h - m.b, m.t]).nice(), r = d3.scaleSqrt([0, d3.max(pts, (d) => d.cost)], [3, 16]);
        const gg = s.append('g').attr('class', 'grid'); y.ticks(5).forEach((t) => { gg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)); s.append('text').attr('x', m.l - 8).attr('y', y(t) + 4).attr('text-anchor', 'end').text(t); });
        x.ticks(6).forEach((t) => s.append('text').attr('x', x(t)).attr('y', h - m.b + 16).attr('text-anchor', 'middle').text(t));
        s.append('line').attr('class', 'axis').attr('x1', m.l).attr('x2', W - m.r).attr('y1', h - m.b).attr('y2', h - m.b);
        s.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(100)).attr('y2', y(100)).style('stroke', 'var(--cds-chart-axis)').attr('stroke-dasharray', '4 4');
        s.append('text').attr('x', W - m.r).attr('y', y(100) - 5).attr('text-anchor', 'end').text('Channel norm');
        s.append('text').attr('x', (m.l + W - m.r) / 2).attr('y', h - 4).attr('text-anchor', 'middle').text('Average TVR (delivery)');
        s.append('text').attr('transform', `translate(12 ${(m.t + h - m.b) / 2}) rotate(-90)`).attr('text-anchor', 'middle').text('Cost per point index');
        s.append('g').selectAll('circle').data(pts.slice().sort((p1, p2) => p2.cost - p1.cost)).join('circle').attr('class', 'hit').attr('cx', (d) => x(d.tvr)).attr('cy', (d) => y(Math.min(cap, d.idx))).attr('r', (d) => r(d.cost)).style('fill', (d) => bColor(d.bucket)).attr('fill-opacity', 0.75).style('stroke', 'var(--color-panel)').attr('stroke-width', 1)
          .on('pointermove', (ev, d) => showTip(ev, d.program, [['Channel', pretty(d.channel), color(d.channel)], ['Verdict', d.bucket, bColor(d.bucket)], ['Average TVR', f2(d.tvr)], ['Cost index', f0(d.idx)], ['Spend', R(d.cost)], ['Spots', d.n]])).on('pointerleave', hideTip).on('click', (ev, d) => negDetail(d));
        legend(hb, ['Overpriced', 'Must buy', 'Value', 'Cut', 'Fair'].map((k) => [k, bColor(k)]));
      } }
    // position and clutter
    const g2 = E('div', 'grid wide'); out.append(g2);
    const c = E('div', 'card'); c.append(E('h2', '', 'Break position and clutter'), E('p', 'note', 'Where the selected spots sit in the break, by channel, and how crowded those breaks are against the whole market. First and last positions are the ones worth asking for. Crowded breaks dilute a spot, so ask for a lower rate.'));
    const hc = E('div', 'chart'); c.append(hc);
    const d2 = E('div', 'card'); d2.append(E('h2', '', 'Better value on the same channels'), E('p', 'note', 'Programmes across the whole file that cost less than the channel norm for each rating point and rate at or above the channel median. Move budget here.'));
    const hd = E('div', 'box'); d2.append(hd); g2.append(c, d2);
    { const POS = ['First', 'Middle', 'Last', 'Only'], pc = [COLORS[0], mix(COLORS[0], 38), COLORS[1], MUTED];
      const chs = [...d3.rollup(scope.filter((s) => posClass(s)), (v) => v.length, (s) => s.channel)].sort((x, y) => y[1] - x[1]).slice(0, 8).map((d) => d[0]);
      if (!chs.length) hc.append(E('p', 'sub', 'The LMRB file has no position or break size columns for these spots.'));
      else {
        const mk = J.spots.filter((s) => s.adsInBrk != null);
        const rowH = 32, h = chs.length * rowH + 10, { s, W } = svgIn(hc, h), nar = W < 480, m = { l: nar ? 92 : 130, r: nar ? 100 : 170, t: 4, b: 6 };
        const x = d3.scaleLinear([0, 100], [m.l, W - m.r]), y = d3.scaleBand(chs, [m.t, h - m.b]).padding(0.22);
        for (const ch of chs) {
          const v = scope.filter((q) => q.channel === ch && posClass(q)), n = v.length, cnt = d3.rollup(v, (z) => z.length, posClass);
          s.append('text').attr('class', 'strong').attr('x', m.l - 8).attr('y', y(ch) + y.bandwidth() / 2 + 4).attr('text-anchor', 'end').text(pretty(ch));
          let acc = 0; const gr = s.append('g').attr('class', 'hit').on('pointermove', (ev) => showTip(ev, pretty(ch), POS.map((k, i) => [k, pct((cnt.get(k) || 0) / n * 100), pc[i]]))).on('pointerleave', hideTip);
          POS.forEach((k, i) => { const w = (cnt.get(k) || 0) / n * 100; if (w > 0) gr.append('rect').attr('x', x(acc)).attr('y', y(ch)).attr('height', y.bandwidth()).attr('width', Math.max(0, x(acc + w) - x(acc) - 2)).attr('rx', 3).style('fill', pc[i]); acc += w; });
          const mine = d3.mean(v, (q) => q.adsInBrk), all = d3.mean(mk.filter((q) => q.channel === ch), (q) => q.adsInBrk);
          s.append('text').attr('x', W - m.r + 8).attr('y', y(ch) + y.bandwidth() / 2 + 4).text(`${f1(mine)} per break` + (all ? ` · market ${f1(all)}` : ''));
        }
        legend(hc, POS.map((k, i) => [k, pc[i]])); } }
    { const gems = marketGems().filter((r) => !NG.ch || r.channel === NG.ch).slice(0, 12);
      if (!gems.length) hd.append(E('p', 'sub', 'No programme clears the bar yet. Lower the spots floor or load more LMRB days.'));
      else { const cols = [{ h: 'Programme', s: (r) => r.program, f: (r) => trunc(r.program, 30) }, { h: 'Channel', s: (r) => r.channel, f: (r) => dotName(r.channel) }, { h: 'Avg TVR', n: 1, s: (r) => r.tvr, f: (r) => f2(r.tvr) }, { h: 'Cost index', n: 1, s: (r) => r.idx, f: (r) => f0(r.idx) }, { h: 'Spots', n: 1, s: (r) => r.n, f: (r) => r.n }]; const dg2 = () => table(hd, 'gems', cols, gems, { key: (r) => r.key, onRow: (k) => negDetail(gems.find((x) => x.key === k)), sortCol: 2, redraw: dg2 }); dg2(); } }
    // negotiation list
    const tc = E('div', 'card'); tc.append(E('h2', '', 'Negotiation list'), E('p', 'note', 'Every programme in the selection with a verdict and what to ask for. Overpriced means dearer per rating point than its channel norm by more than your threshold. Must buy delivers in the top quarter of its channel at a fair price. Cut delivers in the bottom quarter and is not cheap.'));
    const bx = E('div', 'box'); bx.style.maxHeight = '32rem'; tc.append(bx); out.append(tc);
    const cols = [
      { h: 'Programme', s: (r) => r.program, f: (r) => trunc(r.program, 34) },
      { h: 'Channel', s: (r) => r.channel, f: (r) => dotName(r.channel) },
      { h: 'Verdict', s: (r) => r.bucket, f: (r) => { const sp = E('span'); const d = E('i', 'dot'); d.style.background = bColor(r.bucket); sp.append(d, r.bucket); return sp; } },
      { h: 'Spots', n: 1, s: (r) => r.n, f: (r) => r.n },
      { h: 'Spend', n: 1, s: (r) => r.cost, f: (r) => R(r.cost) },
      { h: 'Avg TVR', n: 1, s: (r) => r.tvr, f: (r) => f2(r.tvr) },
      { h: 'Cost index', n: 1, s: (r) => r.idx ?? 0, f: (r) => r.idx != null ? f0(r.idx) : '–' },
      { h: 'Saving', n: 1, s: (r) => r.save, f: (r) => R(r.save) },
      { h: 'What to ask', s: (r) => r.action, f: (r) => r.action },
    ];
    const dt = () => table(bx, 'neg', cols, shown, { key: (r) => r.key, onRow: (k) => negDetail(rows.find((x) => x.key === k)), sortCol: 7, redraw: dt, max: 300 }); dt();
  }
  draw();
}
