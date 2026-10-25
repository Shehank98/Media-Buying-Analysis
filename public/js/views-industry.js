function tabIndustry(p) {
  p.replaceChildren();
  const tot = D.totalSpend, sp = D.spend;
  const cats = [...d3.rollup(sp, (v) => d3.sum(v, (r) => r.spend), (r) => r.product_group)].map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  const chRank = [...D.byCh].map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
  const named = [...D.byCh].sort((a, b) => b[1] - a[1]).map((d) => d[0]);
  const both = D.channels.map((r) => r.channel).filter((k) => D.byCh.has(k));
  const kp = E('div', 'kpis');
  for (const [l, v] of [['TV spend in period', rs(tot)], ['Product groups', f0(cats.length)], ['Advertisers', f0(new Set(sp.map((r) => r.advertiser)).size)], ['Brands', f0(new Set(sp.map((r) => r.brand)).size)], ['Top 10 groups’ share', pct(d3.sum(cats.slice(0, 10), (c) => c.v) / tot * 100)]]) { const k = E('div', 'kpi'); k.append(E('div', 'v', v), E('div', 'l', l)); kp.append(k); }
  p.append(kp);
  const g1 = E('div', 'grid wide'); p.append(g1);
  const a = E('div', 'card'); a.append(E('h2', '', 'Biggest categories and where they are bought'), E('p', 'note', 'TV spend by product group, split by channel. Click a bar for every advertiser, brand and channel behind it.'));
  const ha = E('div', 'chart'); ha.dataset.source = 'tv_spend'; a.append(ha);
  const b = E('div', 'card'); b.append(E('h2', '', 'Spend share against audience share'), E('p', 'note', 'For the channels in both files: share of TV spend beside share of audience. An index above 100 means a channel takes more spend than its audience share, which signals demand and premium pricing. Below 100 means audience is cheaper to get. Nielsen spend is monitored spend, an estimate of value rather than the price paid.'));
  const hb = E('div', 'chart'); hb.dataset.source = 'tv_spend channels'; b.append(hb);
  g1.append(a, b);
  const topCats = cats.slice(0, 12), others = 'Other channels';
  { const rowH = 30, h = topCats.length * rowH + 28, { s, W } = svgIn(ha, h), nar = W < 480, m = { l: nar ? 100 : 168, r: 56, t: 4, b: 22 };
    const keyOf = (k) => named.slice(0, 6).includes(k) ? k : others;
    const series = [...named.slice(0, 6), others];
    const maxV = topCats[0].v, x = d3.scaleLinear([0, maxV], [m.l, W - m.r]), y = d3.scaleBand(topCats.map((c) => c.k), [m.t, h - m.b]).padding(0.2);
    const gg = s.append('g').attr('class', 'grid'); x.ticks(4).forEach((t) => { gg.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', m.t).attr('y2', h - m.b); s.append('text').attr('x', x(t)).attr('y', h - 6).attr('text-anchor', 'middle').text(t / 1e6 + ' bn'); });
    const short = (t) => { const mx = nar ? 14 : 24; return t.length > mx ? t.slice(0, mx - 1) + '…' : t; };
    for (const c of topCats) {
      s.append('text').attr('class', 'strong').attr('x', m.l - 8).attr('y', y(c.k) + y.bandwidth() / 2 + 4).attr('text-anchor', 'end').text(short(c.k));
      const by = d3.rollup(sp.filter((r) => r.product_group === c.k), (v) => d3.sum(v, (r) => r.spend), (r) => keyOf(D.chKey(r)));
      let acc = 0; const gr = s.append('g').attr('class', 'hit').on('click', () => groupDetail(c.k, 'cat')).on('pointerleave', hideTip)
        .on('pointermove', (ev) => showTip(ev, c.k, [['Total TV spend', rs(c.v)], ['Share of all TV', pct(c.v / tot * 100)], ...series.filter((k) => by.get(k)).map((k) => [pretty(k), rs(by.get(k)) + ' · ' + f0(by.get(k) / c.v * 100) + '%', color(k)])]));
      for (const k of series) { const v = by.get(k); if (!v) continue; const x0 = x(acc), x1 = x(acc + v); gr.append('rect').attr('x', x0).attr('y', y(c.k)).attr('height', y.bandwidth()).attr('width', Math.max(0, x1 - x0 - 2)).attr('rx', 2).style('fill', color(k)); acc += v; }
      s.append('text').attr('x', x(c.v) + 6).attr('y', y(c.k) + y.bandwidth() / 2 + 4).text(rs(c.v).replace('Rs ', ''));
    }
    legend(ha, series.map((k) => [pretty(k), color(k)])); }
  { const rows = both;
    const sTot = d3.sum(rows, (k) => D.byCh.get(k)), aTot = d3.sum(rows, (k) => D.chRow.get(k).share);
    const data = rows.map((k) => ({ k, sp: D.byCh.get(k) / sTot * 100, au: D.chRow.get(k).share / aTot * 100 })).map((d) => ({ ...d, idx: d.sp / d.au * 100 })).sort((a2, b2) => b2.idx - a2.idx);
    const rowH = 38, h = data.length * rowH + 40, { s, W } = svgIn(hb, h), nar = W < 460, m = { l: nar ? 96 : 120, r: nar ? 54 : 70, t: 8, b: 30 };
    const x = d3.scaleLinear([0, Math.ceil(d3.max(data, (d) => Math.max(d.sp, d.au)) / 5) * 5], [m.l, W - m.r]), y = d3.scaleBand(data.map((d) => d.k), [m.t, h - m.b]).padding(0);
    const gg = s.append('g').attr('class', 'grid'); x.ticks(5).forEach((t) => { gg.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', m.t).attr('y2', h - m.b); s.append('text').attr('x', x(t)).attr('y', h - 14).attr('text-anchor', 'middle').text(t + '%'); });
    s.append('text').attr('x', W - m.r).attr('y', m.t + 8).attr('text-anchor', 'end').text('');
    for (const d of data) {
      const cy = y(d.k) + rowH / 2;
      s.append('text').attr('class', 'strong').attr('x', m.l - 8).attr('y', cy + 4).attr('text-anchor', 'end').text(pretty(d.k));
      const gr = s.append('g').attr('class', 'hit').on('pointermove', (ev) => showTip(ev, pretty(d.k), [['Share of TV spend', pct(d.sp), color(d.k)], ['Share of audience', pct(d.au)], ['Spend index', f0(d.idx)]])).on('pointerleave', hideTip).on('click', () => channelDetail(d.k));
      gr.append('rect').attr('x', m.l - 4).attr('y', cy - rowH / 2).attr('width', W - m.l - m.r + 8).attr('height', rowH).style('fill', 'transparent');
      gr.append('line').attr('x1', x(Math.min(d.sp, d.au))).attr('x2', x(Math.max(d.sp, d.au))).attr('y1', cy).attr('y2', cy).style('stroke', 'var(--cds-chart-axis)').attr('stroke-width', 2);
      gr.append('circle').attr('cx', x(d.au)).attr('cy', cy).attr('r', 5).style('fill', 'var(--color-panel)').style('stroke', 'var(--color-fg-muted)').attr('stroke-width', 2);
      gr.append('circle').attr('cx', x(d.sp)).attr('cy', cy).attr('r', 6).style('fill', color(d.k)).style('stroke', 'var(--color-panel)').attr('stroke-width', 2);
      s.append('text').attr('class', 'strong').attr('x', W - m.r + 8).attr('y', cy + 4).style('fill', d.idx >= 100 ? 'var(--color-fg)' : 'var(--color-fg-muted)').text(f0(d.idx));
    }
    s.append('text').attr('x', W - m.r + 8).attr('y', 6 + 4).style('font-size', '10px').text('Index');
    const lg = E('div', 'legend'); const l1 = E('span'); const i1 = E('i'); i1.style.background = 'var(--color-fg)'; i1.style.borderRadius = '50%'; l1.append(i1, 'Share of TV spend (channel colour)'); const l2 = E('span'); const i2 = E('i'); i2.style.border = '2px solid var(--color-fg-muted)'; i2.style.borderRadius = '50%'; i2.style.width = '.6rem'; l2.append(i2, 'Share of audience (target 16–50)'); lg.append(l1, l2); hb.before(lg); }
  // heatmap
  const g2 = E('div', 'grid'); p.append(g2);
  const hc = E('div', 'card'); hc.style.gridColumn = '1 / -1';
  hc.append(E('h2', '', 'Which channels a category leans on'), E('p', 'note', 'Index of a category’s spend on a channel against that channel’s share of all TV spend. 100 is market average. Dark cells over-index, so the category uses that channel more than usual. Click a cell for the category in full.'));
  const hh = E('div', 'chart'); hh.dataset.source = 'tv_spend'; hc.append(hh); g2.append(hc);
  { const top = cats.slice(0, 14), cols = named.slice(0, 7), nar = (hh.clientWidth || 600) < 560, h = top.length * 30 + 44, { s, W } = svgIn(hh, h), m = { l: nar ? 100 : 170, r: 4, t: 34, b: 4 };
    const x = d3.scaleBand(cols, [m.l, W - m.r]).padding(0.06), y = d3.scaleBand(top.map((c) => c.k), [m.t, h - m.b]).padding(0.1);
    for (const c of cols) s.append('text').attr('class', 'strong').attr('x', x(c) + x.bandwidth() / 2).attr('y', 20).attr('text-anchor', 'middle').style('font-size', nar ? '10px' : '11px').text(nar ? pretty(c).split(' ')[0] : pretty(c));
    const short = (t) => { const mx = nar ? 14 : 28; return t.length > mx ? t.slice(0, mx - 1) + '…' : t; };
    for (const c of top) {
      s.append('text').attr('class', 'strong').attr('x', m.l - 8).attr('y', y(c.k) + y.bandwidth() / 2 + 4).attr('text-anchor', 'end').text(short(c.k));
      const by = d3.rollup(sp.filter((r) => r.product_group === c.k), (v) => d3.sum(v, (r) => r.spend), D.chKey);
      for (const k of cols) {
        const v = by.get(k) || 0, idx = v / c.v / (D.byCh.get(k) / tot) * 100;
        const fill = idx >= 100 ? mix(COLORS[0], Math.min(62, 8 + (idx - 100) * 0.22)) : mix(MUTED, Math.min(40, (100 - idx) * 0.4));
        const gc = s.append('g').attr('class', 'hit').on('pointermove', (ev) => showTip(ev, `${c.k} · ${pretty(k)}`, [['Spend', rs(v)], ['Share of category', pct(v / c.v * 100)], ['Channel share of all TV', pct(D.byCh.get(k) / tot * 100)], ['Index', f0(idx)]])).on('pointerleave', hideTip).on('click', () => groupDetail(c.k, 'cat'));
        gc.append('rect').attr('x', x(k)).attr('y', y(c.k)).attr('width', x.bandwidth()).attr('height', y.bandwidth()).attr('rx', 3).style('fill', fill);
        gc.append('text').attr('x', x(k) + x.bandwidth() / 2).attr('y', y(c.k) + y.bandwidth() / 2 + 4).attr('text-anchor', 'middle').style('fill', 'var(--color-fg)').text(f0(idx));
      } } }
  // advertiser table
  const ac = E('div', 'card'); ac.append(E('h2', '', 'Advertisers'), E('p', 'note', 'Every advertiser buying TV in the period. Search, sort, and click a row for its brands, channels and categories.'));
  const tools = E('div', 'tools'); const si = E('input'); si.type = 'search'; si.placeholder = 'Search advertiser or category'; si.id = 'advq'; si.value = ST.q; si.setAttribute('aria-label', 'Search advertisers'); tools.append(si); ac.append(tools);
  const box = E('div', 'box'); ac.append(box); p.append(ac);
  const adv = [...d3.group(sp, (r) => r.advertiser)].map(([k, v]) => {
    const cat = d3.greatest(d3.rollups(v, (x) => d3.sum(x, (r) => r.spend), (r) => r.product_group), (d) => d[1]);
    const ch = d3.greatest(d3.rollups(v, (x) => d3.sum(x, (r) => r.spend), D.chKey), (d) => d[1]); const t = d3.sum(v, (r) => r.spend);
    return { k, tot: t, cat: cat[0], brands: new Set(v.map((r) => r.brand)).size, nch: new Set(v.map(D.chKey)).size, top: ch[0], topShare: ch[1] / t * 100 };
  });
  const cols = [
    { h: 'Advertiser', s: (r) => r.k, f: (r) => r.k },
    { h: 'Main category', s: (r) => r.cat, f: (r) => r.cat },
    { h: 'TV spend', n: 1, s: (r) => r.tot, f: (r) => rs(r.tot) },
    { h: 'Share', n: 1, s: (r) => r.tot, f: (r) => pct(r.tot / tot * 100) },
    { h: 'Brands', n: 1, s: (r) => r.brands, f: (r) => r.brands },
    { h: 'Channels', n: 1, s: (r) => r.nch, f: (r) => r.nch },
    { h: 'Main channel', s: (r) => r.top, f: (r) => dotName(r.top) },
    { h: 'Its share', n: 1, s: (r) => r.topShare, f: (r) => f0(r.topShare) + '%' },
  ];
  const draw = () => { const q = ST.q.trim().toLowerCase(); const rows = q ? adv.filter((r) => r.k.toLowerCase().includes(q) || r.cat.toLowerCase().includes(q)) : adv; table(box, 'adv', cols, rows, { key: (r) => r.k, onRow: (k) => groupDetail(k, 'adv'), sortCol: 2, redraw: draw, max: 200 }); };
  si.addEventListener('input', () => { ST.q = si.value; draw(); }); draw();
}


function tabPlanner(p) {
  p.replaceChildren();
  const chs = D.channels.slice().sort((a, b) => b.share - a.share).map((r) => r.channel).filter((k) => D.byCh.has(k));
  const cost = Object.fromEntries(chs.map((k) => [k, D.byCh.get(k) * 1000 / D.chRow.get(k).ratings]));
  const med = d3.median(chs, (k) => cost[k]);
  const cats = [...d3.rollup(D.spend, (v) => d3.sum(v, (r) => r.spend), (r) => r.product_group)].sort((a, b) => b[1] - a[1]).map((d) => d[0]);
  const selRows = () => D.spend.filter((r) => (!ST.cat || r.product_group === ST.cat) && (!ST.adv || r.advertiser === ST.adv));
  const defMix = () => { const by = d3.rollup(selRows(), (v) => d3.sum(v, (r) => r.spend), D.chKey); const t = d3.sum(chs, (k) => by.get(k) || 0); return Object.fromEntries(chs.map((k) => [k, t ? Math.round((by.get(k) || 0) / t * 1000) / 10 : Math.round(1000 / chs.length) / 10])); };
  if (!ST.mix) ST.mix = defMix();
  const rsMn = (m) => m >= 1000 ? 'Rs ' + f2(m / 1000) + ' bn' : 'Rs ' + f1(m) + ' mn';

  const setup = E('div', 'card'); setup.style.marginBottom = 'var(--cds-gap-md)';
  setup.append(E('h2', '', 'Set up the client'), E('p', 'note', 'Pick the client’s category, and the advertiser if you know it. The channel mix starts from what that spend looks like in the Nielsen data. Change any number to match the real plan. Cost per rating point uses Nielsen’s monitored spend, which estimates media value and is not what a client paid, so read the gaps as negotiating leverage and replace with real rates when you have them.'));
  const row = E('div', 'tools');
  const mkSel = (id, label) => { const l = E('label', 'sub', label); l.htmlFor = id; const s = E('select'); s.id = id; ctl(row, l, s); return s; };
  const sc = mkSel('plcat', 'Category'), sa = mkSel('pladv', 'Advertiser');
  sc.append(new Option('All categories', '')); for (const c of cats) sc.append(new Option(c, c)); sc.value = ST.cat;
  const fillAdv = () => { sa.replaceChildren(new Option('All advertisers', '')); const by = [...d3.rollup(D.spend.filter((r) => !ST.cat || r.product_group === ST.cat), (v) => d3.sum(v, (r) => r.spend), (r) => r.advertiser)].sort((a, b) => b[1] - a[1]); for (const [k] of by) sa.append(new Option(k, k)); sa.value = by.some((d) => d[0] === ST.adv) ? ST.adv : ''; ST.adv = sa.value; };
  fillAdv();
  const lb = E('label', 'sub', 'Budget (Rs mn)'); lb.htmlFor = 'plbud'; const bi = E('input'); bi.type = 'number'; bi.id = 'plbud'; bi.min = '1'; bi.step = '5'; bi.value = ST.budget; bi.style.width = '7rem'; ctl(row, lb, bi);
  setup.append(row);
  const row2 = E('div', 'tools');
  const mkRange = (id, label, key, min, max, step, unit) => { const l = E('label', 'sub'); l.htmlFor = id; const out = E('b', '', ST[key] + unit); l.append(label + ' ', out); const r = E('input'); r.type = 'range'; r.id = id; r.min = min; r.max = max; r.step = step; r.value = ST[key]; r.style.width = '9rem'; r.addEventListener('input', () => { ST[key] = +r.value; out.textContent = r.value + unit; results(); }); ctl(row2, l, r); };
  mkRange('plask', 'Largest rate ask', 'ask', 0, 30, 1, '%'); mkRange('plshift', 'Money moved from dear channels', 'shift', 0, 50, 5, '%'); mkRange('plguard', 'Only move to channels reaching at least', 'guard', 0, 55, 5, '%');
  setup.append(row2);
  const mixBox = E('div'); setup.append(mixBox);
  p.append(setup);
  const out = E('div'); p.append(out);

  function drawMix() {
    mixBox.replaceChildren(E('h3', '', 'Channel mix, % of budget'));
    const g = E('div', 'tools'); g.style.marginTop = '.35rem';
    for (const k of chs) { const l = E('label', 'sub'); l.htmlFor = 'mx-' + k; const d = E('i', 'dot'); d.style.cssText = `display:inline-block;width:.6rem;height:.6rem;border-radius:50%;margin-right:.35rem;background:${color(k)}`; l.append(d, pretty(k) + ' '); const i = E('input'); i.type = 'number'; i.min = '0'; i.max = '100'; i.step = '1'; i.id = 'mx-' + k; i.value = ST.mix[k]; i.style.width = '4.5rem'; i.addEventListener('input', () => { ST.mix[k] = Math.max(0, +i.value || 0); results(); }); g.append(l, i); }
    const rs0 = E('button', 'btn', 'Reset to Nielsen mix'); rs0.addEventListener('click', () => { ST.mix = defMix(); drawMix(); results(); }); g.append(rs0);
    mixBox.append(g);
  }
  function results() {
    out.replaceChildren();
    const tw = d3.sum(chs, (k) => ST.mix[k]) || 1, B = ST.budget || 0;
    const w = Object.fromEntries(chs.map((k) => [k, ST.mix[k] / tw]));
    const rows = chs.map((k) => { const gap = cost[k] > med ? 1 - med / cost[k] : 0; const ask = Math.min(gap, ST.ask / 100); const b = B * w[k]; return { k, w: w[k], b, gap, ask, save: b * ask, idx: cost[k] / med * 100, au: D.chRow.get(k).share, reach: D.chRow.get(k).reach_pct }; });
    const donors = rows.filter((r) => cost[r.k] > med && r.b > 0), recips = rows.filter((r) => cost[r.k] < med && r.reach >= ST.guard);
    const moved = donors.length && recips.length ? d3.sum(donors, (r) => r.b) * ST.shift / 100 : 0;
    const rw = d3.sum(recips, (r) => 1 / cost[r.k]);
    for (const r of rows) { r.after = r.b - (moved ? (cost[r.k] > med ? r.b * ST.shift / 100 : 0) : 0) + (moved && recips.includes(r) ? moved * (1 / cost[r.k]) / rw : 0); }
    const rBefore = d3.sum(rows, (r) => r.b * 1e6 / cost[r.k]), rAfter = d3.sum(rows, (r) => r.after * 1e6 / cost[r.k]);
    const gain = rBefore ? (rAfter / rBefore - 1) : 0, saved = d3.sum(rows, (r) => r.save), blended = d3.sum(rows, (r) => r.w * cost[r.k]) / med * 100;
    const kp = E('div', 'kpis');
    for (const [l, v] of [['Budget', rsMn(B)], ['Plan cost per point vs median', f0(blended) + ' (100 = median)'], ['Saved by rate asks', rsMn(saved) + ' · ' + pct(B ? saved / B * 100 : 0)], ['More ratings from re-mixing', '+' + pct(gain * 100)], ['Worth about', rsMn(B * gain)]]) { const k = E('div', 'kpi'); k.append(E('div', 'v', v), E('div', 'l', l)); kp.append(k); }
    out.append(kp);
    const c1 = E('div', 'card'); c1.style.marginBottom = 'var(--cds-gap-md)';
    c1.append(E('h2', '', 'Channel by channel'), E('p', 'note', 'Cost index compares each channel’s monitored spend per rating point with the median of the channels in the plan. The ask is the gap to the median, capped at your largest rate ask. The suggested mix moves money only from channels above the median to cheaper channels that pass your reach floor.'));
    const bx = E('div', 'box'); bx.dataset.source = 'tv_spend channels'; c1.append(bx); out.append(c1);
    const cols = [
      { h: 'Channel', s: (r) => r.k, f: (r) => dotName(r.k) },
      { h: 'Plan mix', n: 1, s: (r) => r.w, f: (r) => pct(r.w * 100) },
      { h: 'Budget', n: 1, s: (r) => r.b, f: (r) => rsMn(r.b) },
      { h: 'Reach %', n: 1, s: (r) => r.reach, f: (r) => pct(r.reach) },
      { h: 'Cost index', n: 1, s: (r) => r.idx, f: (r) => f0(r.idx) },
      { h: 'Rate ask', n: 1, s: (r) => r.ask, f: (r) => r.ask ? pct(r.ask * 100) : '–' },
      { h: 'Saving', n: 1, s: (r) => r.save, f: (r) => r.save ? rsMn(r.save) : '–' },
      { h: 'Suggested budget', n: 1, s: (r) => r.after, f: (r) => rsMn(r.after) },
      { h: 'Change', n: 1, s: (r) => r.after - r.b, f: (r) => { const d = r.after - r.b; return Math.abs(d) < 0.05 ? '–' : (d > 0 ? '+' : '−') + rsMn(Math.abs(d)); } },
    ];
    const draw = () => table(bx, 'plan', cols, rows, { key: (r) => r.k, onRow: channelDetail, sortCol: 2, redraw: draw });
    draw();
    if (!donors.length) out.append(E('p', 'sub', 'No money is moved because none of the budget sits on channels above the median cost.'));
    else if (!recips.length) out.append(E('p', 'sub', 'No money is moved because no cheaper channel reaches the floor you set. Lower the reach floor to allow a move.'));
    // asks
    const a = E('div', 'card'); a.style.marginBottom = 'var(--cds-gap-md)';
    a.append(E('h2', '', 'What to ask each channel for'), E('p', 'note', 'Channels with at least 5% of the plan. Every line comes from the day and daypart numbers in the Channel Summary.'));
    const grid = E('div', 'grid'); a.append(grid);
    for (const r of rows.filter((x) => x.w >= 0.05).sort((x, y) => y.b - x.b)) {
      const k = r.k, dws = D.dow.filter((x) => x.channel === k), best = d3.greatest(dws, (x) => x.ratings_per_day), worst = d3.least(dws, (x) => x.ratings_per_day);
      const dps = D.dp.filter((x) => x.channel === k);
      const wd = d3.sum(dps.filter((x) => x.daytype === 'Weekdays'), (x) => x.ratings) / 21, we = d3.sum(dps.filter((x) => x.daytype === 'Weekends'), (x) => x.ratings) / 10;
      const ep = dps.find((x) => x.daypart.startsWith('Evening') && x.daytype === 'Weekdays'), ni = dps.find((x) => x.daypart.startsWith('Night') && x.daytype === 'Weekdays');
      const np = dps.filter((x) => x.daytype === 'Weekdays' && !x.prime && !x.daypart.startsWith('Night'));
      const bv = d3.greatest(np, (x) => x.ratings_per_hour_day);
      const box = E('div'); box.style.cssText = 'border:1px solid var(--color-border-line);border-radius:var(--cds-radius);padding:var(--cds-pad-md)';
      const h = E('h3', ''); h.style.marginTop = '0'; h.append(dotName(k)); box.append(h);
      const u = E('ul', 'read');
      u.append(E('li', '', r.ask ? `Ask for about ${pct(r.ask * 100)} off. Its monitored cost per point is ${f0(r.idx)} against a median of 100.` : `Its cost per point is ${f0(r.idx)} against a median of 100, so there is little to win on rate. Ask for added value instead.`));
      u.append(E('li', '', `${worst.day} delivers ${f0(Math.round((1 - worst.ratings_per_day / best.ratings_per_day) * 100))}% less than ${best.day}. Ask for a lower rate or bonus spots on ${worst.day}.`));
      u.append(E('li', '', `Weekends deliver ${f0(Math.round(we / wd * 100))}% of a weekday per day.${we / wd < 0.8 ? ' Ask for a weekend discount.' : ' A weekend discount is a harder ask here.'}`));
      if (ep && ni) u.append(E('li', '', `After 21:00 it delivers ${f0(Math.round(ni.ratings_per_hour_day))} per hour against ${f0(Math.round(ep.ratings_per_hour_day))} at 19:00–20:59. Price 21:00 onwards as non-prime.`));
      if (bv) u.append(E('li', '', `Best non-prime value: ${dpName(bv.daypart)} (${dpTime(bv.daypart)}) at ${f0(Math.round(bv.ratings_per_hour_day))} per hour.`));
      box.append(u); grid.append(box);
    }
    out.append(a);
    // competitors
    const rowsC = selRows(); const cmp = E('div', 'card');
    cmp.append(E('h2', '', ST.cat ? `Who else buys ${ST.cat}` : 'Biggest TV advertisers'), E('p', 'note', 'Where competitors place their money. Click a row for the full picture.'));
    const cb = E('div', 'box'); cmp.append(cb); out.append(cmp);
    const tot = d3.sum(rowsC, (r) => r.spend);
    const adv = [...d3.group(rowsC, (r) => r.advertiser)].map(([k, v]) => { const t = d3.sum(v, (r) => r.spend); const ch = d3.greatest(d3.rollups(v, (x) => d3.sum(x, (r) => r.spend), D.chKey), (d) => d[1]); return { k, t, top: ch[0], ts: ch[1] / t * 100 }; });
    const ccols = [{ h: 'Advertiser', s: (r) => r.k, f: (r) => r.k }, { h: 'TV spend', n: 1, s: (r) => r.t, f: (r) => rs(r.t) }, { h: 'Share', n: 1, s: (r) => r.t, f: (r) => pct(r.t / tot * 100) }, { h: 'Main channel', s: (r) => r.top, f: (r) => dotName(r.top) }, { h: 'Its share', n: 1, s: (r) => r.ts, f: (r) => f0(r.ts) + '%' }];
    const dc = () => table(cb, 'cmp', ccols, adv, { key: (r) => r.k, onRow: (k) => groupDetail(k, 'adv'), sortCol: 1, redraw: dc, max: 100 }); dc();
  }
  sc.addEventListener('change', () => { ST.cat = sc.value; ST.adv = ''; fillAdv(); ST.mix = defMix(); drawMix(); results(); });
  sa.addEventListener('change', () => { ST.adv = sa.value; ST.mix = defMix(); drawMix(); results(); });
  bi.addEventListener('input', () => { ST.budget = Math.max(0, +bi.value || 0); results(); });
  drawMix(); results();
}

