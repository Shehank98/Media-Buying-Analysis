function tabChannels(p) {
  p.replaceChildren();
  const g = E('div', 'grid wide');
  const c1 = E('div', 'card');
  c1.append(E('h2', '', 'Reach against share of audience'), E('p', 'note', 'Reach says how many people a channel touches in the month. Share says how much of all viewing it holds. Bubble size is average daily minutes per viewer. Click a bubble for every number.'));
  const host = E('div', 'chart'); host.dataset.source = 'channels'; c1.append(host);
  const c2 = E('div', 'card');
  c2.append(E('h2', '', 'Who a channel is built for'), E('p', 'note', 'Ratings earned in prime time (19:00–20:59) as a share of its 05:00–23:59 ratings, beside average daily minutes. Heavy prime reliance means the premium slot is the whole product.'));
  const t1 = E('div', 'box'); t1.style.maxHeight = '28rem'; c2.append(t1);
  g.append(c1, c2); p.append(g);
  // scatter
  const rows = D.channels, h = 380; const { s, W } = svgIn(host, h);
  const m = { l: 44, r: 14, t: 10, b: 38 }, x = d3.scaleLinear([10, 58], [m.l, W - m.r]), y = d3.scaleLinear([0, 25], [h - m.b, m.t]), r = d3.scaleSqrt([30, 300], [5, 17]);
  const gg = s.append('g').attr('class', 'grid');
  y.ticks(5).forEach((t) => { gg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)); s.append('text').attr('x', m.l - 8).attr('y', y(t) + 4).attr('text-anchor', 'end').text(t + '%'); });
  x.ticks(6).forEach((t) => s.append('text').attr('x', x(t)).attr('y', h - m.b + 16).attr('text-anchor', 'middle').text(t + '%'));
  s.append('line').attr('class', 'axis').attr('x1', m.l).attr('x2', W - m.r).attr('y1', h - m.b).attr('y2', h - m.b);
  s.append('text').attr('x', (m.l + W - m.r) / 2).attr('y', h - 4).attr('text-anchor', 'middle').text('Individual reach % (breadth)');
  s.append('text').attr('transform', `translate(12 ${(m.t + h - m.b) / 2}) rotate(-90)`).attr('text-anchor', 'middle').text('Share of audience % (weight)');
  const pts = rows.slice().sort((a, b) => b.avg_minutes - a.avg_minutes);
  s.append('g').selectAll('circle').data(pts).join('circle').attr('class', 'hit').attr('cx', (d) => x(d.reach_pct)).attr('cy', (d) => y(d.share)).attr('r', (d) => r(d.avg_minutes))
    .style('fill', (d) => color(d.channel)).attr('fill-opacity', 0.82).style('stroke', 'var(--color-panel)').attr('stroke-width', 2)
    .on('pointermove', (ev, d) => showTip(ev, pretty(d.channel), [['Reach %', pct(d.reach_pct)], ['Share of audience', pct(d.share)], ['Avg daily minutes', f0(d.avg_minutes)], ['Total ratings', f0(Math.round(d.ratings))]]))
    .on('pointerleave', hideTip).on('click', (ev, d) => channelDetail(d.channel));
  const lab = rows.filter((d) => d.share >= 3.5).map((d) => ({ d, x: x(d.reach_pct) + r(d.avg_minutes) + 5, y: y(d.share) + 4 })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < lab.length; i++) for (let j = 0; j < i; j++) if (Math.abs(lab[i].y - lab[j].y) < 13 && Math.abs(lab[i].x - lab[j].x) < 110) lab[i].y = lab[j].y + 13;
  for (const l of lab) { const t = s.append('text').attr('class', 'strong').attr('y', l.y).text(pretty(l.d.channel)); const w = t.node().getComputedTextLength(); const left = l.x + w > W - 4; t.attr('x', left ? l.x - 2 * (r(l.d.avg_minutes) + 5) : l.x).attr('text-anchor', left ? 'end' : 'start'); }
  // table
  const cols = [
    { h: 'Channel', s: (r) => r.channel, f: (r) => dotName(r.channel) },
    { h: 'Share', n: 1, s: (r) => r.share, f: (r, td) => { const w = E('span'); w.append(pct(r.share)); const b = E('i', 'bar'); b.style.width = r.share / 24 * 60 + 'px'; b.style.background = color(r.channel); w.append(b); return w; } },
    { h: 'Reach %', n: 1, s: (r) => r.reach_pct, f: (r) => pct(r.reach_pct) },
    { h: 'Avg min', n: 1, s: (r) => r.avg_minutes, f: (r) => f0(r.avg_minutes) },
    { h: 'Prime share', n: 1, s: (r) => D.primeShare.get(r.channel)?.share ?? 0, f: (r) => D.primeShare.has(r.channel) ? pct(D.primeShare.get(r.channel).share) : '–' },
    { h: 'Ratings', n: 1, s: (r) => r.ratings, f: (r) => f0(Math.round(r.ratings)) },
  ];
  const draw = () => table(t1, 'channels', cols, rows, { key: (r) => r.channel, onRow: channelDetail, sortCol: 1, redraw: draw });
  draw();
}


function tabProfile(p) {
  p.replaceChildren();
  const tools = E('div', 'tools'); const lab = E('label', 'sub', 'Channel'); lab.htmlFor = 'chsel';
  if (!ST.sel || !D.chRow.has(ST.sel)) ST.sel = d3.greatest(D.channels, (r) => r.share).channel;
  const sel = E('select'); sel.id = 'chsel';
  for (const r of D.channels.slice().sort((a, b) => b.share - a.share)) sel.append(new Option(pretty(r.channel), r.channel));
  sel.value = ST.sel; sel.addEventListener('change', () => { ST.sel = sel.value; tabProfile(p); });
  const full = E('button', 'btn', 'Full details'); full.addEventListener('click', () => channelDetail(ST.sel));
  ctl(tools, lab, sel); tools.append(full); p.append(tools);
  const ch = ST.sel, col = color(ch), c = D.chRow.get(ch);
  const dows = DAYS.map((d) => D.dow.find((x) => x.channel === ch && x.day === d)).filter(Boolean);
  const dps = D.dpNames.map((n) => ({ n, wd: D.dp.find((x) => x.channel === ch && x.daypart === n && x.daytype === 'Weekdays'), we: D.dp.find((x) => x.channel === ch && x.daypart === n && x.daytype === 'Weekends') })).filter((x) => x.wd && x.we);
  // read-out
  const best = d3.greatest(dows, (x) => x.ratings_per_day), worst = d3.least(dows, (x) => x.ratings_per_day);
  const peak = d3.greatest(dps, (x) => x.wd.ratings_per_hour_day), pr = D.primeShare.get(ch);
  const sovs = dps.map((x) => ({ n: x.n, v: D.sovPct(ch, x.n) })), bs = d3.greatest(sovs, (x) => x.v), ws = d3.least(sovs, (x) => x.v);
  const primeSov = d3.sum(D.dp.filter((x) => x.channel === ch && x.prime), (x) => x.ratings) / d3.sum(D.dp.filter((x) => x.prime), (x) => x.ratings) * 100;
  const kp = E('div', 'kpis');
  for (const [l, v] of [['Share of audience', pct(c.share)], ['Individual reach', pct(c.reach_pct)], ['Avg daily minutes', f0(c.avg_minutes)], ['Prime share of ratings', pr ? pct(pr.share) : '–'], ['Share of all prime ratings', pct(primeSov)]]) { const k = E('div', 'kpi'); k.append(E('div', 'v', v), E('div', 'l', l)); kp.append(k); }
  p.append(kp);
  const rd = E('div', 'card'); rd.style.marginBottom = 'var(--cds-gap-md)';
  rd.append(E('h2', '', 'Buying read'));
  rd.append(E('p', 'note', 'Plain statements from the numbers below. Use them as negotiation openers, then confirm with programme data.'));
  const ul = E('ul', 'read');
  const li = (t) => ul.append(E('li', '', t));
  li(`${best.day} is the strongest day at ${f0(Math.round(best.ratings_per_day))} ratings per day. ${worst.day} is the weakest at ${f0(Math.round(worst.ratings_per_day))}, ${f0(Math.round((best.ratings_per_day / worst.ratings_per_day - 1) * 100))}% lower. Ask for a lower rate or bonus spots on the weak days.`);
  li(`On weekdays the busiest hours are ${dpName(peak.n)} (${dpTime(peak.n)}) at ${f0(Math.round(peak.wd.ratings_per_hour_day))} ratings per hour per day.`);
  li(`Its best share of voice against rivals is ${dpName(bs.n)} at ${pct(bs.v)}. Its weakest is ${dpName(ws.n)} at ${pct(ws.v)}. Overall share of audience is ${pct(c.share)}.`);
  li(primeSov >= c.share ? `It holds ${pct(primeSov)} of all prime-time ratings, above its ${pct(c.share)} overall share, so prime time is where it wins. Expect firm prime rates; trade for volume off-peak.` : `It holds ${pct(primeSov)} of all prime-time ratings, below its ${pct(c.share)} overall share, so prime time is not where it is strongest. Push for a prime discount or added value.`);
  rd.append(ul); p.append(rd);
  const g = E('div', 'grid wide'); p.append(g);
  const a = E('div', 'card'); a.append(E('h2', '', 'Which days deliver'), E('p', 'note', 'Average ratings per day. Some weekdays occur more often than others in the reporting period, so totals are divided by the number of days.'));
  const ha = E('div', 'chart'); ha.dataset.source = 'dow'; a.append(ha);
  const b = E('div', 'card'); b.append(E('h2', '', 'Which hours deliver'), E('p', 'note', 'Average ratings per hour per day, so a one-hour slot and a three-hour slot compare fairly.'));
  const hb = E('div', 'chart'); hb.dataset.source = 'dayparts'; b.append(hb);
  g.append(a, b);
  // day bars
  { const h = 300, { s, W } = svgIn(ha, h), m = { l: 46, r: 10, t: 14, b: 30 };
    const x = d3.scaleBand(DAYS, [m.l, W - m.r]).padding(0.3), y = d3.scaleLinear([0, d3.max(dows, (d) => d.ratings_per_day) * 1.12], [h - m.b, m.t]).nice();
    const gg = s.append('g').attr('class', 'grid');
    y.ticks(5).forEach((t) => { gg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)); s.append('text').attr('x', m.l - 8).attr('y', y(t) + 4).attr('text-anchor', 'end').text(f0(t)); });
    s.append('line').attr('class', 'axis').attr('x1', m.l).attr('x2', W - m.r).attr('y1', h - m.b).attr('y2', h - m.b);
    s.selectAll('.bar').data(dows).join('rect').attr('class', 'hit').attr('x', (d) => x(d.day)).attr('width', x.bandwidth()).attr('y', (d) => y(d.ratings_per_day)).attr('height', (d) => y(0) - y(d.ratings_per_day)).attr('rx', 4)
      .style('fill', (d) => d.day === best.day ? col : mix(col, 45))
      .on('pointermove', (ev, d) => showTip(ev, d.day, [['Avg ratings per day', f0(Math.round(d.ratings_per_day))], ['Total ratings', f0(Math.round(d.ratings))], ['Days in period', d.days_in_month], ['Reach %', pct(d.reach_pct)]])).on('pointerleave', hideTip);
    s.selectAll('.xl').data(dows).join('text').attr('x', (d) => x(d.day) + x.bandwidth() / 2).attr('y', h - m.b + 16).attr('text-anchor', 'middle').text((d) => d.day.slice(0, 3));
    s.append('text').attr('class', 'strong').attr('x', x(best.day) + x.bandwidth() / 2).attr('y', y(best.ratings_per_day) - 6).attr('text-anchor', 'middle').text(f0(Math.round(best.ratings_per_day))); }
  // daypart bars
  { const rowH = 46, h = dps.length * rowH + 30, { s, W } = svgIn(hb, h), nar = W < 460, m = { l: nar ? 92 : 124, r: 44, t: 6, b: 24 };
    const max = d3.max(dps, (d) => Math.max(d.wd.ratings_per_hour_day, d.we.ratings_per_hour_day));
    const x = d3.scaleLinear([0, max], [m.l, W - m.r]), y = d3.scaleBand(dps.map((d) => d.n), [m.t, h - m.b]).padding(0.22), y2 = d3.scaleBand(['wd', 'we'], [0, y.bandwidth()]).padding(0.12);
    const gg = s.append('g').attr('class', 'grid'); x.ticks(4).forEach((t) => { gg.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', m.t).attr('y2', h - m.b); s.append('text').attr('x', x(t)).attr('y', h - m.b + 14).attr('text-anchor', 'middle').text(f0(t)); });
    const cw = COLORS[0], ce = COLORS[1];
    for (const d of dps) {
      const t = s.append('text').attr('class', 'strong').attr('x', m.l - 8).attr('y', y(d.n) + y.bandwidth() / 2 - 2).attr('text-anchor', 'end').text(dpName(d.n));
      s.append('text').attr('x', m.l - 8).attr('y', y(d.n) + y.bandwidth() / 2 + 11).attr('text-anchor', 'end').text(dpTime(d.n));
      for (const [k, r, cc] of [['wd', d.wd, cw], ['we', d.we, ce]]) {
        s.append('rect').attr('class', 'hit').attr('x', m.l).attr('y', y(d.n) + y2(k)).attr('height', y2.bandwidth()).attr('width', Math.max(2, x(r.ratings_per_hour_day) - m.l)).attr('rx', 3).style('fill', cc)
          .on('pointermove', (ev) => showTip(ev, `${dpName(d.n)} · ${r.daytype}`, [['Per hour per day', f0(Math.round(r.ratings_per_hour_day))], ['Total ratings', f0(Math.round(r.ratings))], ['Reach %', pct(r.reach_pct)], ['Share of voice', pct(D.sovPct(ch, d.n))]])).on('pointerleave', hideTip);
        s.append('text').attr('x', x(r.ratings_per_hour_day) + 5).attr('y', y(d.n) + y2(k) + y2.bandwidth() / 2 + 4).text(f0(Math.round(r.ratings_per_hour_day)));
      } }
    legend(hb, [['Weekdays', cw], ['Weekends', ce]]); }
}


function tabDayparts(p) {
  p.replaceChildren();
  const g = E('div', 'grid'); p.append(g);
  const a = E('div', 'card'); a.append(E('h2', '', 'Prime-time dependence'), E('p', 'note', 'Share of each channel’s ratings earned in prime time (Evening Peak, 19:00–20:59) against all other dayparts. Night (21:00–23:59) is counted as non-prime because it delivers far fewer ratings per hour. Click a bar for the channel in full.'));
  const ha = E('div', 'chart'); ha.dataset.source = 'dayparts'; a.append(ha);
  const b = E('div', 'card'); b.append(E('h2', '', 'Share of voice by daypart'), E('p', 'note', 'Each column adds to 100%. A cell shows the share of that daypart’s viewing a channel holds, so a dark cell is where it beats its rivals. Outlined cells are the daypart leader. Click a cell for the detail.'));
  const hb = E('div', 'chart'); hb.dataset.source = 'dayparts'; b.append(hb); b.style.gridColumn = '1 / -1';
  g.append(a, b);
  const list = D.channels.filter((r) => D.primeShare.has(r.channel)).map((r) => ({ ch: r.channel, ...D.primeShare.get(r.channel), share_aud: r.share })).sort((x, y) => y.share - x.share);
  { const rowH = 28, h = list.length * rowH + 14, { s, W } = svgIn(ha, h), nar = W < 460, m = { l: nar ? 100 : 150, r: 12, t: 4, b: 10 };
    const x = d3.scaleLinear([0, 100], [m.l, W - m.r]), y = d3.scaleBand(list.map((d) => d.ch), [m.t, h - m.b]).padding(0.22);
    const c1 = COLORS[0], c2 = mix(COLORS[0], 28);
    for (const d of list) {
      s.append('text').attr('class', 'strong').attr('x', m.l - 8).attr('y', y(d.ch) + y.bandwidth() / 2 + 4).attr('text-anchor', 'end').text(pretty(d.ch));
      const hit = s.append('g').attr('class', 'hit').on('pointermove', (ev) => showTip(ev, pretty(d.ch), [['Prime', pct(d.share), c1], ['Other dayparts', pct(100 - d.share), c2], ['Prime ratings', f0(Math.round(d.pr))]])).on('pointerleave', hideTip).on('click', () => channelDetail(d.ch));
      hit.append('rect').attr('x', m.l).attr('y', y(d.ch)).attr('height', y.bandwidth()).attr('width', Math.max(1, x(d.share) - m.l - 1)).attr('rx', 3).style('fill', c1);
      hit.append('rect').attr('x', x(d.share) + 1).attr('y', y(d.ch)).attr('height', y.bandwidth()).attr('width', Math.max(1, x(100) - x(d.share) - 1)).attr('rx', 3).style('fill', c2);
      hit.append('text').attr('x', m.l + 6).attr('y', y(d.ch) + y.bandwidth() / 2 + 4).style('fill', 'var(--color-bg)').text(pct(d.share));
    }
    legend(ha, [['Prime time (19:00–20:59)', c1], ['All other dayparts', c2]]); }
  { const chs = D.channels.slice().sort((x, y) => y.share - x.share).map((r) => r.channel), dpn = D.dpNames, nar = (hb.clientWidth || 600) < 560;
    const h = chs.length * 30 + 60, { s, W } = svgIn(hb, h), m = { l: nar ? 104 : 150, r: 4, t: 46, b: 4 };
    const x = d3.scaleBand(dpn, [m.l, W - m.r]).padding(0.06), y = d3.scaleBand(chs, [m.t, h - m.b]).padding(0.1);
    const lead = new Map(dpn.map((n) => [n, d3.greatest(chs, (c) => D.sovPct(c, n))]));
    for (const n of dpn) { const cx = x(n) + x.bandwidth() / 2; s.append('text').attr('class', 'strong').attr('x', cx).attr('y', 16).attr('text-anchor', 'middle').style('font-size', nar ? '10px' : '11px').text(nar ? dpName(n).split(' ')[0] : dpName(n)); s.append('text').attr('x', cx).attr('y', 30).attr('text-anchor', 'middle').style('font-size', '10px').text(dpTime(n).replace(/:00/g, '').replace(/:/g, '')); }
    for (const c of chs) {
      s.append('text').attr('class', 'strong').attr('x', m.l - 8).attr('y', y(c) + y.bandwidth() / 2 + 4).attr('text-anchor', 'end').text(pretty(c));
      for (const n of dpn) {
        const v = D.sovPct(c, n), isLead = lead.get(n) === c;
        const gcell = s.append('g').attr('class', 'hit').on('pointermove', (ev) => showTip(ev, `${pretty(c)} · ${dpName(n)}`, [['Share of voice', pct(v)], ['Daypart leader', pretty(lead.get(n)) + ' ' + pct(D.sovPct(lead.get(n), n))]])).on('pointerleave', hideTip).on('click', () => cellDetail(c, n));
        gcell.append('rect').attr('x', x(n)).attr('y', y(c)).attr('width', x.bandwidth()).attr('height', y.bandwidth()).attr('rx', 3).style('fill', mix(COLORS[0], Math.min(62, v * 2.6))).style('stroke', isLead ? 'var(--color-fg)' : 'none').attr('stroke-width', 1.5);
        if (!nar || v >= 5) gcell.append('text').attr('x', x(n) + x.bandwidth() / 2).attr('y', y(c) + y.bandwidth() / 2 + 4).attr('text-anchor', 'middle').style('fill', 'var(--color-fg)').text(f0(Math.round(v)));
      } } }
}

