/* App shell: data loading, tabs, the Data tab. */
const SET = { prime: 'peak', lmrbUnit: 'rs' };
try { Object.assign(SET, JSON.parse(localStorage.getItem('mb-settings') || '{}')); } catch (e) { /* storage blocked */ }
const saveSettings = () => { try { localStorage.setItem('mb-settings', JSON.stringify(SET)); } catch (e) { /* ignore */ } };
const KINDS = ['summary', 'spend', 'programmes', 'lmrb'];
const SETS = { summary: null, spend: null, programmes: null, lmrb: null };
const NEEDS = {
  channels: ['summary'], profile: ['summary'], dayparts: ['summary'], industry: ['summary', 'spend'], planner: ['summary', 'spend'], programmes: ['programmes'], negotiate: ['programmes', 'lmrb'],
};
const TABS = { data: tabData, channels: tabChannels, profile: tabProfile, dayparts: tabDayparts, industry: tabIndustry, planner: tabPlanner, programmes: tabProgrammes, negotiate: tabNegotiate };

function rebuild() { D = MB.buildModel(SETS, SET); }
async function loadStored() {
  for (const k of KINDS) { try { SETS[k] = (await MB.db.get(k)) || null; } catch (e) { SETS[k] = null; } }
  rebuild(); render();
}
function go(t) { closeDetail(); ST.tab = t; try { history.replaceState(null, '', '#' + t); } catch (e) { /* ignore */ } render(); window.scrollTo?.({ top: 0 }); }

function periodOf(k) {
  const s = SETS[k]; if (!s) return '';
  const m = s.meta || {}; return m.from ? rangeLabel(m) : '';
}

function render() {
  document.querySelectorAll('#tabs button').forEach((b) => {
    const need = NEEDS[b.dataset.tab] || [], ok = need.every((k) => SETS[k]);
    b.setAttribute('aria-selected', String(b.dataset.tab === ST.tab)); b.style.opacity = ok ? '' : '.55';
  });
  const chips = $('#chips'); chips.replaceChildren();
  for (const k of KINDS) { const c = E('button', 'chip' + (SETS[k] ? ' on' : ''), MB.kindLabel[k]); c.title = SETS[k] ? `${SETS[k].fileName}` : 'Not loaded. Open the Data tab.'; c.addEventListener('click', () => go('data')); chips.append(c); }
  $('#sub').textContent = SETS.summary && D.meta ? periodLabel() : 'Load your four exports to begin. Everything stays in this browser.';
  const panel = $('#panel'), lede = $('#lede');
  const need = NEEDS[ST.tab] || [], miss = need.filter((k) => !SETS[k]);
  if (D.channels && D.byCh) {
    const top = d3.greatest(D.channels, (r) => r.share), sp = [...D.byCh].map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v)[0];
    lede.textContent = `${pretty(top.channel)} holds the largest audience share at ${pct(top.share)}. ${pretty(sp.k)} takes the most TV spend, ${pct(sp.v / D.totalSpend * 100)} of ${rs(D.totalSpend)}.`;
  } else if (D.channels) { const top = d3.greatest(D.channels, (r) => r.share); lede.textContent = `${pretty(top.channel)} holds the largest audience share at ${pct(top.share)}.`; } else lede.textContent = '';
  if (miss.length) {
    panel.replaceChildren(); closeDetail();
    const c = E('div', 'card'); c.append(E('h2', '', 'This view needs more data'), E('p', 'note', `Load the ${miss.map((k) => MB.kindLabel[k]).join(' and ')} export${miss.length > 1 ? 's' : ''} in the Data tab.`));
    const b = E('button', 'btn', 'Open Data tab'); b.addEventListener('click', () => go('data')); c.append(b); panel.append(c); return;
  }
  TABS[ST.tab]($('#panel'));
  renderDetail();
}

// ---------- Data tab ----------
let flash = null;
async function handleFiles(files) {
  const msgs = [];
  for (const f of files) {
    flash = { text: `Reading ${f.name}…`, err: false }; render();
    try {
      const out = await MB.ingestFile(f);
      await MB.db.put(out.kind, out); SETS[out.kind] = out; D = null; rebuild();
      const n = (out.rows || out.channels || []).length;
      msgs.push(`${f.name}: loaded as ${MB.kindLabel[out.kind]} (${f0(n)} rows).`);
    } catch (e) { msgs.push(`${f.name}: ${e.message || e}`); flash = { text: msgs.join(' '), err: true }; render(); return; }
  }
  flash = { text: msgs.join(' '), err: false }; render();
}
function tabData(p) {
  p.replaceChildren();
  const drop = E('div', 'drop'); drop.tabIndex = 0; drop.setAttribute('role', 'button');
  drop.append(E('strong', '', 'Drop your Excel or CSV exports here, or click to choose'), E('span', '', 'Channel Summary, Nielsen spend, Programme TVR and Reach, and LMRB. Any mix, in any order. Each file is recognised from its columns.'));
  const fi = E('input'); fi.type = 'file'; fi.multiple = true; fi.accept = '.xlsx,.xls,.csv'; fi.hidden = true; fi.id = 'fileinput'; fi.addEventListener('change', () => { if (fi.files.length) handleFiles([...fi.files]); fi.value = ''; });
  drop.addEventListener('click', () => fi.click()); drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); } });
  for (const ev of ['dragenter', 'dragover']) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); });
  for (const ev of ['dragleave', 'drop']) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); });
  drop.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) handleFiles([...e.dataTransfer.files]); });
  p.append(drop, fi);
  if (flash) p.append(E('p', 'msg' + (flash.err ? ' err' : ''), flash.text));
  if (!MB.db.persistent) p.append(E('p', 'msg err', 'This browser is blocking storage, so loaded data will be lost when the page is closed.'));
  p.append(E('p', 'note sub', 'Files are read and stored in this browser only (IndexedDB). Nothing is sent to the server, and clearing site data removes them.'));
  const g = E('div', 'grid'); g.style.marginTop = 'var(--cds-gap-md)'; p.append(g);
  const info = {
    summary: ['Channel Summary', 'Workbook with sheets Target, A1, A2 and A3 from the audience measurement export. Sets the target audience and period.', null],
    spend: ['Nielsen spend', 'Monthly TV spend by product group, advertiser, brand and channel (Tv (000Rs) column).', null],
    programmes: ['Programme TVR and Reach', 'Rank, Data Set, Channel, Date, Day, Start, End, Program, Duration, Category, TVR, Total TVR, TVR Share %, Reach, Reach %, Avg Time.', '/templates/programmes-template.csv'],
    lmrb: ['LMRB spots', 'Product_Group, Advertiser, Product, Advt_Theme, Ads, Channel, Program, Dd, Mn, Yr, Day, Prog_time, Advt_time, AdPos, TotAds, BrkNo, PosinBrk, AdsinBrk, Lng, Dur, Cost.', '/templates/lmrb-template.csv'],
  };
  for (const k of KINDS) {
    const c = E('div', 'card setcard'); const [t, d, tpl] = info[k];
    c.append(E('h2', '', t), E('p', 'note', d));
    const s = SETS[k];
    if (s) {
      const dl = E('dl'); const n = (s.rows || s.channels || []).length;
      for (const [a, b] of [['File', s.fileName], ['Rows', f0(n) + (k === 'summary' ? ' channels' : '')], ['Period', periodOf(k) || 'not stated'], ['Saved', new Date(s.savedAt).toLocaleString()]]) { dl.append(E('dt', '', a), E('dd', '', b)); }
      if (k === 'summary' && s.meta.demo) { dl.append(E('dt', '', 'Target'), E('dd', '', s.meta.demo.replace(/^Geography:\s*/i, ''))); }
      c.append(dl);
      const rm = E('button', 'btn', 'Remove'); rm.style.marginTop = '.6rem'; rm.addEventListener('click', async () => { await MB.db.del(k); SETS[k] = null; D = null; rebuild(); flash = null; render(); }); c.append(rm);
    } else {
      c.append(E('span', 'pill', 'Not loaded'));
      if (tpl) { const a = E('a', '', 'Column template (CSV)'); a.href = tpl; a.download = ''; a.style.cssText = 'display:block;margin-top:.5rem;font-size:var(--cds-font-size-caption)'; c.append(a); }
    }
    g.append(c);
  }
  const sc = E('div', 'card setcard'); sc.append(E('h2', '', 'Settings'), E('p', 'note', 'These change the numbers immediately.'));
  const row = E('div', 'tools');
  const l1 = E('label', 'sub', 'Prime time'); l1.htmlFor = 'setprime'; const s1 = E('select'); s1.id = 'setprime';
  for (const [k, v] of Object.entries(MB.PRIME_PRESETS)) s1.append(new Option(v.label, k)); s1.value = SET.prime; s1.addEventListener('change', () => { SET.prime = s1.value; saveSettings(); rebuild(); render(); });
  const l2 = E('label', 'sub', 'LMRB cost is in'); l2.htmlFor = 'setunit'; const s2 = E('select'); s2.id = 'setunit'; s2.append(new Option('Rupees', 'rs'), new Option('Rupees 000', 'k')); s2.value = SET.lmrbUnit; s2.addEventListener('change', () => { SET.lmrbUnit = s2.value; saveSettings(); render(); });
  ctl(row, l1, s1); ctl(row, l2, s2); sc.append(row);
  const clr = E('button', 'btn', 'Clear all stored data'); let armed = false; clr.addEventListener('click', async () => { if (!armed) { armed = true; clr.textContent = 'Click again to confirm'; return; } for (const k of KINDS) { await MB.db.del(k); SETS[k] = null; } D = null; rebuild(); flash = null; render(); }); sc.append(clr);
  g.append(sc);
}

document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => go(b.dataset.tab)));
const hash = location.hash.slice(1); if (TABS[hash]) ST.tab = hash;
window.addEventListener('resize', (() => { let t; return () => { clearTimeout(t); t = setTimeout(() => { if (D && ST.tab !== 'data') render(); }, 150); }; })());
D = MB.buildModel(SETS, SET);
loadStored().then(() => { if (ST.tab === 'data' && !hash && SETS.summary) go('channels'); });
