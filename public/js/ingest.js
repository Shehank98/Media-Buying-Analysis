/* Reads the four Excel/CSV exports in the browser and turns them into plain row objects. */
window.MB = window.MB || {};
(() => {
  const clean = (s) => String(s == null ? '' : s).trim();
  const slug = (s) => clean(s).toLowerCase().replace(/%/g, 'pct').replace(/[^a-z0-9]/g, '');
  const num = (v) => { if (typeof v === 'number') return v; const n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
  const pad = (n) => String(n).padStart(2, '0');
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  // channel names differ between files ("Tv - Derana", "DERANA TV", "Derana"); this key makes them match
  MB.chKey = (n) => clean(n).toUpperCase().replace(/^TV\s*-\s*/, '').replace(/[^A-Z0-9 ]/g, ' ').replace(/\b(TV|LOCAL|CHANNEL)\b/g, ' ').replace(/\s+/g, ' ').trim();

  const isoFromParts = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  function toISO(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') { const d = XLSX.SSF.parse_date_code(v); return d ? isoFromParts(d.y, d.m, d.d) : null; }
    const s = clean(v).replace(/\//g, '-');
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return isoFromParts(m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/); if (m) return isoFromParts(m[3], +m[2], +m[1]);
    return null;
  }
  function toMin(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return v < 1 ? Math.round(v * 1440) % 1440 : null;
    const m = clean(v).match(/^(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : null;
  }

  // find the header row (the export has title rows above it) and return the rows as objects
  function table(ws, markers) {
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    let hi = -1;
    for (let i = 0; i < Math.min(grid.length, 25); i++) {
      const cells = (grid[i] || []).map(slug);
      if (markers.every((m) => cells.some((c) => c === m || c.includes(m)))) { hi = i; break; }
    }
    if (hi < 0) return null;
    const head = grid[hi].map(clean);
    const rows = [];
    for (let i = hi + 1; i < grid.length; i++) {
      const r = grid[i];
      if (!r || r.every((v) => v == null || v === '')) continue;
      const o = {}; head.forEach((h, j) => { if (h) o[h] = r[j] === undefined ? null : r[j]; }); rows.push(o);
    }
    return { head, rows };
  }
  const cols = (head, spec) => { const out = {}; for (const [f, al] of Object.entries(spec)) { out[f] = head.find((h) => al.includes(slug(h))) || null; } return out; };
  const need = (map, fields, what) => { const miss = fields.filter((f) => !map[f]); if (miss.length) throw new Error(`${what}: could not find the column${miss.length > 1 ? 's' : ''} ${miss.join(', ')}.`); };

  // ---------- Channel Summary workbook (sheets Target, A1, A2, A3) ----------
  function parseSummary(wb) {
    const get = (name, markers) => { const ws = wb.Sheets[name]; const t = ws && table(ws, markers); if (!t) throw new Error(`Channel Summary: sheet ${name} is missing or its header was not found.`); return t; };
    const a1 = get('A1', ['channel', 'shareofaudience']), a2 = get('A2', ['channel', 'dayofweek']), a3 = get('A3', ['channel', 'timeofday']);
    // reporting period and target description
    let from = null, to = null, demo = '';
    if (wb.Sheets.Target) {
      const g = XLSX.utils.sheet_to_json(wb.Sheets.Target, { header: 1, defval: null, raw: true });
      g.forEach((r, i) => {
        if (r && clean(r[0]).toLowerCase() === 'reporting from' && g[i + 1]) { from = parseSummaryDate(g[i + 1][0]); to = parseSummaryDate(g[i + 1][1]); }
        if (r && /^geography:/i.test(clean(r[0]))) demo = clean(r[0]);
      });
    }
    const counts = dayCounts(from, to);
    const c1 = cols(a1.head, { channel: ['channel'], share: ['shareofaudience'], ratings: ['totalratings'], avg_minutes: ['avgdailyminutes'], reach: ['individualreach'], reach_pct: ['individualreachpct'] });
    need(c1, Object.keys(c1), 'Channel Summary A1');
    const channels = a1.rows.map((r) => ({ channel: clean(r[c1.channel]), share: num(r[c1.share]), ratings: num(r[c1.ratings]), avg_minutes: num(r[c1.avg_minutes]), reach: num(r[c1.reach]), reach_pct: num(r[c1.reach_pct]) })).filter((r) => r.channel);
    const c2 = cols(a2.head, { channel: ['channel'], day: ['dayofweek'], ratings: ['ratings'], reach: ['reach'], reach_pct: ['reachpct'] });
    need(c2, Object.keys(c2), 'Channel Summary A2');
    const dow = a2.rows.map((r) => ({ channel: clean(r[c2.channel]), day: clean(r[c2.day]), ratings: num(r[c2.ratings]), reach: num(r[c2.reach]), reach_pct: num(r[c2.reach_pct]), days_in_month: counts.byName[clean(r[c2.day])] || 0 })).filter((r) => r.channel && r.day);
    const c3 = cols(a3.head, { channel: ['channel'], daytype: ['days'], daypart: ['timeofday'], ratings: ['ratings'], reach: ['reach'], reach_pct: ['reachpct'] });
    need(c3, Object.keys(c3), 'Channel Summary A3');
    const dayparts = [];
    for (const r of a3.rows) {
      const label = clean(r[c3.daypart]); const m = label.match(/^(.*?)\s*\((\d{2})(\d{2})\s*-\s*(\d{2})(\d{2})\)/);
      if (!m || m[1].trim().toLowerCase() === 'morning') continue; // skip the combined Morning row
      const s = (+m[2]) * 60 + (+m[3]), e = (+m[4]) * 60 + (+m[5]) + 1;
      const dt = clean(r[c3.daytype]);
      dayparts.push({ channel: clean(r[c3.channel]), daytype: dt, daypart: label, start: s, end: e, hours: (e - s) / 60, ratings: num(r[c3.ratings]), reach: num(r[c3.reach]), reach_pct: num(r[c3.reach_pct]), days_in_month: /weekend/i.test(dt) ? counts.weekend : counts.weekday });
    }
    return { channels, dow, dayparts, meta: { from, to, demo, counts: { weekday: counts.weekday, weekend: counts.weekend } } };
  }
  function parseSummaryDate(v) {
    const s = clean(v); const m = s.match(/^(\d{4})-([A-Za-z]{3})[a-z]*-(\d{1,2})$/);
    if (m) return isoFromParts(m[1], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[3]);
    return toISO(v);
  }
  function dayCounts(from, to) {
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], byName = {}; names.forEach((n) => { byName[n] = 0; });
    if (!from || !to) { names.forEach((n) => { byName[n] = 30 / 7; }); return { byName, weekday: 150 / 7, weekend: 60 / 7 }; }
    for (let t = Date.parse(from + 'T00:00:00Z'), end = Date.parse(to + 'T00:00:00Z'); t <= end; t += 864e5) byName[names[new Date(t).getUTCDay()]]++;
    return { byName, weekday: byName.Monday + byName.Tuesday + byName.Wednesday + byName.Thursday + byName.Friday, weekend: byName.Saturday + byName.Sunday };
  }

  // ---------- Nielsen spend ----------
  function parseSpend(wb) {
    for (const name of wb.SheetNames) {
      const t = table(wb.Sheets[name], ['advertiser', 'brand']); if (!t) continue;
      const c = cols(t.head, { productGroup: ['productgroup'], advertiser: ['advertiser'], brand: ['brand'], channel: ['channel'], month: ['month'] });
      c.tv = t.head.find((h) => /^tv/i.test(clean(h)) && /000|rs/i.test(h)) || t.head.find((h) => /^tv\b/i.test(clean(h)));
      need(c, ['productGroup', 'advertiser', 'brand', 'channel', 'tv'], 'Spend sheet');
      const rows = []; let lo = null, hi = null;
      for (const r of t.rows) {
        const v = num(r[c.tv]); if (!(v > 0)) continue;
        rows.push({ product_group: clean(r[c.productGroup]), advertiser: clean(r[c.advertiser]), brand: clean(r[c.brand]), channel: clean(r[c.channel]).replace(/^tv\s*-\s*/i, ''), spend: v });
        const m = c.month ? toISO(r[c.month]) : null; if (m) { if (!lo || m < lo) lo = m; if (!hi || m > hi) hi = m; }
      }
      return { rows, meta: { from: lo, to: hi } };
    }
    throw new Error('Spend sheet: no sheet with Advertiser, Brand and a TV (000Rs) column was found.');
  }

  // ---------- Programme TVR and Reach export ----------
  function parseProgrammes(wb) {
    for (const name of wb.SheetNames) {
      const t = table(wb.Sheets[name], ['program', 'tvr', 'start']); if (!t) continue;
      const c = cols(t.head, { rank: ['rank'], channel: ['channel'], date: ['date'], day: ['day'], start: ['start'], end: ['end'], program: ['program', 'programme'], duration: ['duration'], category: ['category'], tvr: ['tvr'], totalTvr: ['totaltvr'], share: ['tvrsharepct', 'tvrshare'], reach: ['reach'], reachPct: ['reachpct'] });
      need(c, ['channel', 'date', 'start', 'end', 'program', 'tvr'], 'Programme export');
      const rows = [];
      for (const r of t.rows) {
        const s = toMin(r[c.start]), e0 = toMin(r[c.end]), date = toISO(r[c.date]); if (s == null || e0 == null || !date) continue;
        rows.push({ rank: c.rank ? num(r[c.rank]) : null, channel: clean(r[c.channel]), date, day: clean(r[c.day]), start: s, end: e0 < s ? e0 + 1440 : e0, program: clean(r[c.program]).replace(/\s+/g, ' '), duration: c.duration ? num(r[c.duration]) : null, category: c.category ? clean(r[c.category]) : '', tvr: num(r[c.tvr]) || 0, totalTvr: c.totalTvr ? num(r[c.totalTvr]) : null, share: c.share ? num(r[c.share]) : null, reach: c.reach ? num(r[c.reach]) : null, reachPct: c.reachPct ? num(r[c.reachPct]) : null });
      }
      if (!rows.length) throw new Error('Programme export: the sheet was found but no usable rows (date, start, end).');
      const ds = rows.map((r) => r.date).sort();
      return { rows, meta: { from: ds[0], to: ds[ds.length - 1] } };
    }
    throw new Error('Programme export: no sheet with Program, TVR and Start columns was found.');
  }

  // ---------- LMRB spot file ----------
  function parseLmrb(wb) {
    for (const name of wb.SheetNames) {
      const t = table(wb.Sheets[name], ['advertiser', 'adpos']); if (!t) continue;
      const c = cols(t.head, { productGroup: ['productgroup'], advertiser: ['advertiser'], product: ['product'], theme: ['advttheme'], ads: ['ads'], channel: ['channel'], program: ['program', 'programme'], dd: ['dd'], mn: ['mn'], yr: ['yr'], day: ['day'], progTime: ['progtime'], advtTime: ['advttime'], adPos: ['adpos'], totAds: ['totads'], brkNo: ['brkno'], posInBrk: ['posinbrk'], adsInBrk: ['adsinbrk'], lng: ['lng'], dur: ['dur'], cost: ['cost'] });
      need(c, ['advertiser', 'channel', 'program', 'dd', 'mn', 'yr', 'advtTime', 'cost'], 'LMRB');
      const rows = [];
      for (const r of t.rows) {
        let mo = r[c.mn]; mo = typeof mo === 'number' ? mo : (MONTHS.indexOf(clean(mo).slice(0, 3).toLowerCase()) + 1) || num(mo);
        let yr = num(r[c.yr]); if (yr != null && yr < 100) yr += 2000; const dd = num(r[c.dd]);
        if (!mo || !yr || !dd) continue;
        const at = toMin(r[c.advtTime]); if (at == null) continue;
        rows.push({ product_group: clean(r[c.productGroup]), advertiser: clean(r[c.advertiser]), product: c.product ? clean(r[c.product]) : '', theme: c.theme ? clean(r[c.theme]) : '', ads: c.ads ? (num(r[c.ads]) ?? 1) : 1, channel: clean(r[c.channel]), program: clean(r[c.program]).replace(/\s+/g, ' '), date: isoFromParts(yr, mo, dd), day: c.day ? clean(r[c.day]) : '', progTime: c.progTime ? toMin(r[c.progTime]) : null, advtTime: at, adPos: c.adPos ? num(r[c.adPos]) : null, totAds: c.totAds ? num(r[c.totAds]) : null, brkNo: c.brkNo ? num(r[c.brkNo]) : null, posInBrk: c.posInBrk ? num(r[c.posInBrk]) : null, adsInBrk: c.adsInBrk ? num(r[c.adsInBrk]) : null, lng: c.lng ? clean(r[c.lng]) : '', dur: c.dur ? num(r[c.dur]) : null, cost: num(r[c.cost]) || 0 });
      }
      if (!rows.length) throw new Error('LMRB: the sheet was found but no usable rows (date, advert time, cost).');
      const ds = rows.map((r) => r.date).sort();
      return { rows, meta: { from: ds[0], to: ds[ds.length - 1] } };
    }
    throw new Error('LMRB: no sheet with Advertiser and AdPos columns was found.');
  }

  const LABEL = { summary: 'Channel Summary', spend: 'Nielsen spend', programmes: 'Programme TVR and Reach', lmrb: 'LMRB spots' };
  MB.kindLabel = LABEL;
  function detect(wb) {
    if (wb.SheetNames.includes('A1') && wb.SheetNames.includes('A3')) return 'summary';
    for (const n of wb.SheetNames) {
      const g = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: null, raw: true, sheetRows: 25 });
      const cells = g.flat().map(slug);
      if (cells.includes('adpos') || cells.includes('posinbrk')) return 'lmrb';
      if (cells.some((c) => c.startsWith('tv000rs')) || (cells.includes('advertiser') && cells.includes('brand'))) return 'spend';
      if (cells.includes('tvr') && (cells.includes('program') || cells.includes('programme'))) return 'programmes';
    }
    return null;
  }
  const PARSE = { summary: parseSummary, spend: parseSpend, programmes: parseProgrammes, lmrb: parseLmrb };

  MB.ingestFile = async (file) => {
    const buf = await file.arrayBuffer();
    await new Promise((r) => setTimeout(r, 20));
    const wb = XLSX.read(buf, { type: 'array', cellDates: false });
    const kind = detect(wb);
    if (!kind) throw new Error(`${file.name}: could not tell which export this is. Check the column names against the templates.`);
    await new Promise((r) => setTimeout(r, 20));
    const out = PARSE[kind](wb);
    return { kind, fileName: file.name, savedAt: new Date().toISOString(), ...out };
  };
})();
