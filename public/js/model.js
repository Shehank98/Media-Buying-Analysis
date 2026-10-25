/* Turns the stored sheets into the shapes the views read. Rebuilt whenever data or settings change. */
window.MB = window.MB || {};
(() => {
  const BINS = [[300, 420, 'Early Morning'], [420, 480, 'Morning Rush'], [480, 660, 'Morning Off-Peak'], [660, 780, 'Noon'], [780, 960, 'Afternoon'], [960, 1140, 'Early Evening'], [1140, 1260, 'Evening Peak'], [1260, 1440, 'Night']];
  MB.PRIME_PRESETS = {
    peak: { label: 'Evening Peak only (19:00–20:59)', start: 1140, end: 1260 },
    peaknight: { label: 'Evening Peak and Night (19:00–23:59)', start: 1140, end: 1440 },
    early: { label: 'Early Evening and Evening Peak (16:00–20:59)', start: 960, end: 1260 },
  };
  MB.daypartOf = (min) => { const m = min % 1440; const b = BINS.find((x) => m >= x[0] && m < x[1]); return b ? b[2] : 'Late Night'; };
  MB.hhmm = (m) => { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

  MB.buildModel = (sets, settings) => {
    const prime = MB.PRIME_PRESETS[settings.prime] || MB.PRIME_PRESETS.peak;
    const isPrime = (startMin) => startMin >= prime.start && startMin < prime.end;
    const M = { has: {}, prime, isPrime, settings };
    for (const k of Object.keys(sets)) M.has[k] = !!sets[k];

    // display name for a channel: the Channel Summary name when there is one
    const names = new Map();
    if (sets.summary) for (const r of sets.summary.channels) names.set(MB.chKey(r.channel), r.channel);
    if (sets.programmes) for (const r of sets.programmes.rows) { const k = MB.chKey(r.channel); if (!names.has(k)) names.set(k, String(r.channel).trim().toUpperCase()); }
    const disp = (n) => names.get(MB.chKey(n)) || (String(n).trim().toUpperCase() || n);
    M.disp = disp;

    if (sets.summary) {
      const s = sets.summary;
      M.meta = s.meta; M.channels = s.channels;
      M.dow = s.dow.map((r) => ({ ...r, ratings_per_day: r.days_in_month ? Math.round(r.ratings / r.days_in_month * 10) / 10 : 0 }));
      M.dp = s.dayparts.map((r) => ({ ...r, prime: r.start >= prime.start && r.end <= prime.end, ratings_per_hour_day: r.days_in_month && r.hours ? Math.round(r.ratings / r.hours / r.days_in_month * 10) / 10 : 0 }));
      M.chRow = new Map(M.channels.map((r) => [r.channel, r]));
      M.primeShare = new Map();
      for (const [ch, rows] of d3.group(M.dp, (r) => r.channel)) {
        const tot = d3.sum(rows, (r) => r.ratings), pr = d3.sum(rows.filter((r) => r.prime), (r) => r.ratings);
        M.primeShare.set(ch, { tot, pr, share: tot ? pr / tot * 100 : 0 });
      }
      M.dpNames = [...new Set(M.dp.map((r) => r.daypart))].sort((a, b) => M.dp.find((x) => x.daypart === a).start - M.dp.find((x) => x.daypart === b).start);
      const sov = new Map(), dpTot = new Map();
      for (const n of M.dpNames) dpTot.set(n, d3.sum(M.dp.filter((r) => r.daypart === n), (r) => r.ratings));
      for (const r of M.dp) { const k = r.channel + '|' + r.daypart; sov.set(k, (sov.get(k) || 0) + r.ratings); }
      M.sovPct = (ch, n) => dpTot.get(n) ? (sov.get(ch + '|' + n) || 0) / dpTot.get(n) * 100 : 0;
    }
    if (sets.spend) {
      M.spend = sets.spend.rows.map((r) => ({ ...r, audience_channel: names.get(MB.chKey(r.channel)) || null }));
      M.spendMeta = sets.spend.meta;
      M.chKey = (r) => r.audience_channel || r.channel;
      M.totalSpend = d3.sum(M.spend, (r) => r.spend);
      M.byCh = d3.rollup(M.spend, (v) => d3.sum(v, (r) => r.spend), M.chKey);
    }
    if (sets.programmes) {
      M.prog = sets.programmes.rows.map((r) => ({ ...r, channel: disp(r.channel), daypart: MB.daypartOf(r.start), dayType: /^(sat|sun)/i.test(r.day) ? 'Weekends' : 'Weekdays', prime: isPrime(r.start), repeat: /\brepeat\b/i.test(r.program) }));
      M.progMeta = sets.programmes.meta;
    }
    if (sets.lmrb) {
      M.lmrb = sets.lmrb.rows.map((r) => ({ ...r, channel: disp(r.channel) }));
      M.lmrbMeta = sets.lmrb.meta;
    }
    return M;
  };
})();
