/* Programme analysis: which programmes deliver, and how steadily. Needs the programme TVR and Reach export. */
const PF = { channel: '', category: '', slot: '', minDur: 10, minN: 2, q: '' };
const trunc = (t, n) => t.length > n ? t.slice(0, n - 1) + '…' : t;
const modeOf = (arr) => d3.greatest(d3.rollups(arr, (v) => v.length, (x) => x), (d) => d[1])[0];

function progAgg(rows) {
  return [...d3.group(rows, (r) => r.channel + '|' + r.program)].map(([key, v]) => {
    const tv = v.map((r) => r.tvr), mean = d3.mean(tv), sd = v.length > 1 ? d3.deviation(tv) : 0;
    return {
      key, channel: v[0].channel, program: v[0].program, category: modeOf(v.map((r) => r.category || 'Other')), n: v.length, tvr: mean, peak: d3.max(tv), low: d3.min(tv),
      reach: d3.mean(v, (r) => r.reach), reachPct: d3.mean(v, (r) => r.reachPct), share: d3.mean(v, (r) => r.share),
      dur: d3.mean(v, (r) => r.duration ?? (r.end - r.start)), cv: mean ? sd / mean * 100 : 0, daypart: modeOf(v.map((r) => r.daypart)),
      primeShare: v.filter((r) => r.prime).length / v.length * 100, repeat: v[0].repeat, rows: v,
    };
  });
}
function filteredAirings() {
  const q = PF.q.trim().toLowerCase();
  return D.prog.filter((r) => (r.duration ?? (r.end - r.start)) >= PF.minDur && (!PF.channel || r.channel === PF.channel) && (!PF.category || r.category === PF.category)
    && (!PF.slot || (PF.slot === 'prime' ? r.prime : PF.slot === 'non' ? !r.prime : r.daypart === PF.slot)) && (!q || r.program.toLowerCase().includes(q)));
}

function progDetail(key) {
  const rows = D.prog.filter((r) => r.channel + '|' + r.program === key); if (!rows.length) return;
  const a = progAgg(rows)[0];
  openDetail({ title: a.program, sub: `${pretty(a.channel)} · ${a.category || 'No category'} · ${rangeLabel(D.progMeta)}`, body: (el) => {
    const st = [['Airings', f0(a.n)], ['Average TVR', f2(a.tvr)], ['Peak TVR', f2(a.peak)], ['Lowest TVR', f2(a.low)], ['Avg reach %', a.reachPct != null ? pct(a.reachPct) : '–'], ['Avg TVR share', a.share != null ? pct(a.share) : '–'], ['Swing (CV)', f0(a.cv) + '%'], ['Main slot', dpName(a.daypart)], ['Airings in prime', f0(a.primeShare) + '%']];
    el.append(stats(st));
    el.append(E('p', 'sub', 'Swing is how much the rating moves between airings, as a share of the average. Above 30% means the delivery is unreliable, so ask for a make-good clause.'));
    if (D.lmrb && MB.neg) { const n = MB.neg.programmeSummary(key); if (n) { el.append(E('h3', '', 'What it costs and who buys it')); el.append(stats([['Spots', f0(n.n)], ['Monitored spend', rs(n.cost / 1000)], ['Cost per rating point index', f0(n.idx) + ' (100 = channel norm)'], ['Advertisers', f0(n.advertisers.length)]])); el.append(plain([{ h: 'Advertiser', f: (x) => x.k }, { h: 'Spots', n: 1, f: (x) => f0(x.n) }, { h: 'Spend', n: 1, f: (x) => rs(x.cost / 1000) }, { h: 'Share', n: 1, f: (x) => pct(x.cost / n.cost * 100) }], n.advertisers.slice(0, 12))); } }
    el.append(E('h3', '', 'Every airing'));
    el.append(plain([{ h: 'Date', f: (x) => fmtD(x.date) }, { h: 'Day', f: (x) => x.day }, { h: 'Time', f: (x) => MB.hhmm(x.start) + '–' + MB.hhmm(x.end) }, { h: 'Min', n: 1, f: (x) => f0(x.duration ?? (x.end - x.start)) }, { h: 'TVR', n: 1, f: (x) => f2(x.tvr) }, { h: 'Share', n: 1, f: (x) => x.share != null ? pct(x.share) : '–' }, { h: 'Reach', n: 1, f: (x) => x.reach != null ? f0(x.reach) : '–' }, { h: 'Reach %', n: 1, f: (x) => x.reachPct != null ? pct(x.reachPct) : '–' }], rows.slice().sort((x, y) => x.date.localeCompare(y.date) || x.start - y.start)));
  } });
}

function tabProgrammes(p) {
  p.replaceChildren();
  const chans = [...new Set(D.prog.map((r) => r.channel))].sort(), cats = [...new Set(D.prog.map((r) => r.category).filter(Boolean))].sort();
  const bar = E('div', 'tools');
  const sel = (id, label, opts, key) => { const l = E('label', 'sub', label); l.htmlFor = id; const s = E('select'); s.id = id; for (const [v, t] of opts) s.append(new Option(t, v)); s.value = PF[key]; s.addEventListener('change', () => { PF[key] = s.value; draw(); }); ctl(bar, l, s); };
  sel('pfch', 'Channel', [['', 'All channels'], ...chans.map((c) => [c, pretty(c)])], 'channel');
  sel('pfcat', 'Category', [['', 'All categories'], ...cats.map((c) => [c, c])], 'category');
  sel('pfslot', 'Slot', [['', 'All day'], ['prime', 'Prime time'], ['non', 'Non-prime'], ...['Early Morning', 'Morning Rush', 'Morning Off-Peak', 'Noon', 'Afternoon', 'Early Evening', 'Evening Peak', 'Night', 'Late Night'].map((n) => [n, n])], 'slot');
  const rng = (id, label, key, min, max, step, unit) => { const l = E('label', 'sub'); l.htmlFor = id; const o = E('b', '', PF[key] + unit); l.append(label + ' ', o); const r = E('input'); r.type = 'range'; r.id = id; r.min = min; r.max = max; r.step = step; r.value = PF[key]; r.style.width = '7rem'; r.addEventListener('input', () => { PF[key] = +r.value; o.textContent = r.value + unit; draw(); }); ctl(bar, l, r); };
  rng('pfdur', 'Shortest programme', 'minDur', 0, 60, 5, ' min'); rng('pfn', 'At least', 'minN', 1, 8, 1, ' airings');
  const qi = E('input'); qi.type = 'search'; qi.placeholder = 'Search programme'; qi.id = 'pfq'; qi.value = PF.q; qi.setAttribute('aria-label', 'Search programme'); qi.addEventListener('input', () => { PF.q = qi.value; draw(); }); bar.append(qi);
  p.append(bar);
  const out = E('div'); p.append(out);

  function draw() {
    out.replaceChildren();
    const air = filteredAirings(), all = progAgg(air), progs = all.filter((a) => a.n >= PF.minN);
    if (!progs.length) { out.append(E('p', 'sub', 'No programme matches these filters. Lower the shortest programme or the airings floor.')); return; }
    const top = d3.greatest(progs, (a) => a.tvr), catRank = [...d3.rollup(air, (v) => d3.mean(v, (r) => r.tvr), (r) => r.category || 'Other')].filter((d) => air.filter((r) => (r.category || 'Other') === d[0]).length >= 3).sort((a, b) => b[1] - a[1]);
    const kp = E('div', 'kpis');
    for (const [l, v] of [['Programmes', f0(progs.length)], ['Airings', f0(air.length)], ['Best average TVR', f2(top.tvr)], ['Strongest category', catRank.length ? trunc(catRank[0][0], 22) : '–'], ['Airings in prime', f0(air.filter((r) => r.prime).length / air.length * 100) + '%']]) { const k = E('div', 'kpi'); k.append(E('div', 'v', v), E('div', 'l', l)); kp.append(k); }
    out.append(kp);
    const g = E('div', 'grid wide'); out.append(g);
    const c1 = E('div', 'card'); c1.append(E('h2', '', 'Programme league'), E('p', 'note', 'Top 15 by average TVR across airings. The number after the name is the airings behind it. Click a bar for every airing.'));
    const h1 = E('div', 'chart'); c1.append(h1);
    const c2 = E('div', 'card'); c2.append(E('h2', '', 'Depth against breadth'), E('p', 'note', 'Average TVR is how many watch at once. Reach % is how many different people see it at least once. High reach with modest TVR suits cover. High TVR with modest reach suits frequency. Bubble size is airings.'));
    const h2 = E('div', 'chart'); c2.append(h2); g.append(c1, c2);
    { const rows = progs.slice().sort((a, b) => b.tvr - a.tvr).slice(0, 15), rowH = 28, h = rows.length * rowH + 10, { s, W } = svgIn(h1, h), nar = W < 480, m = { l: nar ? 120 : 200, r: 44, t: 4, b: 6 };
      const x = d3.scaleLinear([0, d3.max(rows, (d) => d.tvr)], [m.l, W - m.r]), y = d3.scaleBand(rows.map((d) => d.key), [m.t, h - m.b]).padding(0.22);
      for (const d of rows) {
        s.append('text').attr('class', 'strong').attr('x', m.l - 8).attr('y', y(d.key) + y.bandwidth() / 2 + 4).attr('text-anchor', 'end').text(trunc(d.program, nar ? 16 : 28) + ' · ' + d.n);
        s.append('rect').attr('class', 'hit').attr('x', m.l).attr('y', y(d.key)).attr('height', y.bandwidth()).attr('width', Math.max(2, x(d.tvr) - m.l)).attr('rx', 4).style('fill', color(d.channel))
          .on('pointermove', (ev) => showTip(ev, d.program, [['Channel', pretty(d.channel), color(d.channel)], ['Average TVR', f2(d.tvr)], ['Peak TVR', f2(d.peak)], ['Avg reach %', d.reachPct != null ? pct(d.reachPct) : '–'], ['Airings', d.n], ['Main slot', dpName(d.daypart)]])).on('pointerleave', hideTip).on('click', () => progDetail(d.key));
        s.append('text').attr('x', x(d.tvr) + 5).attr('y', y(d.key) + y.bandwidth() / 2 + 4).text(f2(d.tvr));
      }
      const chs = [...new Set(rows.map((d) => d.channel))]; legend(h1, chs.map((c) => [pretty(c), color(c)])); }
    { const rows = progs.filter((a) => a.reachPct != null), h = 360, { s, W } = svgIn(h2, h), m = { l: 44, r: 14, t: 10, b: 38 };
      if (rows.length) {
        const x = d3.scaleLinear([0, d3.max(rows, (d) => d.tvr) * 1.08], [m.l, W - m.r]).nice(), y = d3.scaleLinear([0, d3.max(rows, (d) => d.reachPct) * 1.1], [h - m.b, m.t]).nice(), r = d3.scaleSqrt([1, d3.max(rows, (d) => d.n)], [3.5, 12]);
        const gg = s.append('g').attr('class', 'grid'); y.ticks(5).forEach((t) => { gg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)); s.append('text').attr('x', m.l - 8).attr('y', y(t) + 4).attr('text-anchor', 'end').text(t + '%'); });
        x.ticks(6).forEach((t) => s.append('text').attr('x', x(t)).attr('y', h - m.b + 16).attr('text-anchor', 'middle').text(t));
        s.append('line').attr('class', 'axis').attr('x1', m.l).attr('x2', W - m.r).attr('y1', h - m.b).attr('y2', h - m.b);
        s.append('text').attr('x', (m.l + W - m.r) / 2).attr('y', h - 4).attr('text-anchor', 'middle').text('Average TVR (depth)');
        s.append('text').attr('transform', `translate(12 ${(m.t + h - m.b) / 2}) rotate(-90)`).attr('text-anchor', 'middle').text('Average reach % (breadth)');
        s.append('g').selectAll('circle').data(rows).join('circle').attr('class', 'hit').attr('cx', (d) => x(d.tvr)).attr('cy', (d) => y(d.reachPct)).attr('r', (d) => r(d.n)).style('fill', (d) => color(d.channel)).attr('fill-opacity', 0.7).style('stroke', 'var(--color-panel)').attr('stroke-width', 1)
          .on('pointermove', (ev, d) => showTip(ev, d.program, [['Channel', pretty(d.channel), color(d.channel)], ['Average TVR', f2(d.tvr)], ['Avg reach %', pct(d.reachPct)], ['Airings', d.n]])).on('pointerleave', hideTip).on('click', (ev, d) => progDetail(d.key));
        const lab = rows.slice().sort((a, b) => b.tvr - a.tvr).slice(0, 6).map((d) => ({ d, x: x(d.tvr) + r(d.n) + 4, y: y(d.reachPct) + 4 })).sort((a, b) => a.y - b.y);
        for (let i = 1; i < lab.length; i++) for (let j = 0; j < i; j++) if (Math.abs(lab[i].y - lab[j].y) < 12 && Math.abs(lab[i].x - lab[j].x) < 120) lab[i].y = lab[j].y + 12;
        for (const l of lab) { const t = s.append('text').attr('class', 'strong').attr('y', l.y).text(trunc(l.d.program, 22)); const w = t.node().getComputedTextLength(); const left = l.x + w > W - 4; t.attr('x', left ? l.x - 10 : l.x).attr('text-anchor', left ? 'end' : 'start'); }
      } else h2.append(E('p', 'sub', 'The export has no reach column, so this view is empty.')); }
    // category x channel heat
    const hc = E('div', 'card'); hc.style.marginBottom = 'var(--cds-gap-md)';
    hc.append(E('h2', '', 'Which categories beat a channel’s own average'), E('p', 'note', 'Average TVR of a category on a channel, as an index of that channel’s average across everything. 100 means the category rates like the channel overall. Dark cells are the programme types a channel does best, so that is where it can defend a premium. The number in a cell is the average TVR. Click a cell for the programmes.'));
    const hh = E('div', 'chart'); hc.append(hh); out.append(hc);
    { const chN = [...d3.rollup(air, (v) => v.length, (r) => r.channel)].sort((a, b) => b[1] - a[1]).slice(0, 8).map((d) => d[0]);
      const catN = [...d3.rollup(air, (v) => v.length, (r) => r.category || 'Other')].sort((a, b) => b[1] - a[1]).slice(0, 12).map((d) => d[0]);
      const chAvg = new Map(chN.map((c) => [c, d3.mean(air.filter((r) => r.channel === c), (r) => r.tvr)]));
      const nar = (hh.clientWidth || 600) < 560, h = catN.length * 28 + 44, { s, W } = svgIn(hh, h), m = { l: nar ? 110 : 190, r: 4, t: 34, b: 4 };
      const x = d3.scaleBand(chN, [m.l, W - m.r]).padding(0.06), y = d3.scaleBand(catN, [m.t, h - m.b]).padding(0.1);
      for (const c of chN) s.append('text').attr('class', 'strong').attr('x', x(c) + x.bandwidth() / 2).attr('y', 20).attr('text-anchor', 'middle').style('font-size', nar ? '10px' : '11px').text(nar ? pretty(c).split(' ')[0] : pretty(c));
      for (const k of catN) {
        s.append('text').attr('class', 'strong').attr('x', m.l - 8).attr('y', y(k) + y.bandwidth() / 2 + 4).attr('text-anchor', 'end').text(trunc(k, nar ? 16 : 30));
        for (const c of chN) {
          const v = air.filter((r) => r.channel === c && (r.category || 'Other') === k); if (!v.length) { s.append('rect').attr('x', x(c)).attr('y', y(k)).attr('width', x.bandwidth()).attr('height', y.bandwidth()).attr('rx', 3).style('fill', 'none').style('stroke', 'var(--cds-chart-grid)'); continue; }
          const avg = d3.mean(v, (r) => r.tvr), idx = avg / chAvg.get(c) * 100;
          const fill = idx >= 100 ? mix(COLORS[0], Math.min(62, 8 + (idx - 100) * 0.35)) : mix(MUTED, Math.min(40, (100 - idx) * 0.5));
          const gc = s.append('g').attr('class', 'hit').on('pointermove', (ev) => showTip(ev, `${k} · ${pretty(c)}`, [['Average TVR', f2(avg)], ['Index vs channel average', f0(idx)], ['Airings', v.length]])).on('pointerleave', hideTip)
            .on('click', () => { const list = progAgg(v).sort((a, b) => b.tvr - a.tvr); openDetail({ title: `${k} on ${pretty(c)}`, sub: `${v.length} airings, average TVR ${f2(avg)}, index ${f0(idx)}`, body: (el) => el.append(plain([{ h: 'Programme', f: (x2) => x2.program }, { h: 'Airings', n: 1, f: (x2) => x2.n }, { h: 'Avg TVR', n: 1, f: (x2) => f2(x2.tvr) }, { h: 'Reach %', n: 1, f: (x2) => x2.reachPct != null ? pct(x2.reachPct) : '–' }, { h: 'Main slot', f: (x2) => dpName(x2.daypart) }], list)) }); });
          gc.append('rect').attr('x', x(c)).attr('y', y(k)).attr('width', x.bandwidth()).attr('height', y.bandwidth()).attr('rx', 3).style('fill', fill);
          gc.append('text').attr('x', x(c) + x.bandwidth() / 2).attr('y', y(k) + y.bandwidth() / 2 + 4).attr('text-anchor', 'middle').style('fill', 'var(--color-fg)').text(f2(avg));
        } } }
    // table
    const tc = E('div', 'card'); tc.append(E('h2', '', 'All programmes'), E('p', 'note', 'Sort any column. Swing is how much the rating moves between airings. Click a row for every airing.'));
    const bx = E('div', 'box'); tc.append(bx); out.append(tc);
    const cols = [
      { h: 'Programme', s: (a) => a.program, f: (a) => trunc(a.program, 40) },
      { h: 'Channel', s: (a) => a.channel, f: (a) => dotName(a.channel) },
      { h: 'Category', s: (a) => a.category, f: (a) => trunc(a.category, 24) },
      { h: 'Airings', n: 1, s: (a) => a.n, f: (a) => a.n },
      { h: 'Avg TVR', n: 1, s: (a) => a.tvr, f: (a) => f2(a.tvr) },
      { h: 'Peak', n: 1, s: (a) => a.peak, f: (a) => f2(a.peak) },
      { h: 'Reach %', n: 1, s: (a) => a.reachPct ?? 0, f: (a) => a.reachPct != null ? pct(a.reachPct) : '–' },
      { h: 'TVR share', n: 1, s: (a) => a.share ?? 0, f: (a) => a.share != null ? pct(a.share) : '–' },
      { h: 'Swing', n: 1, s: (a) => a.cv, f: (a) => f0(a.cv) + '%' },
      { h: 'Main slot', s: (a) => a.daypart, f: (a) => dpName(a.daypart) },
      { h: 'Prime airings', n: 1, s: (a) => a.primeShare, f: (a) => f0(a.primeShare) + '%' },
    ];
    const dt = () => table(bx, 'progs', cols, progs, { key: (a) => a.key, onRow: progDetail, sortCol: 4, redraw: dt, max: 300 }); dt();
  }
  draw();
}
