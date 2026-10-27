(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const root = $('#lr');
  const YEARS = d3.range(1996, 2026);
  const f1 = d3.format(',.1f'), f2 = d3.format(',.2f'), f3 = d3.format(',.3f');
  const mt = (v) => (v == null ? '—' : v >= 100 ? f1(v) : v >= 1 ? f2(v) : v > 0 ? f3(v) : '0');
  const COUNTRY_VAR = { USA: '--lr-usa', Brazil: '--lr-bra', Canada: '--lr-can', Norway: '--lr-nor', Australia: '--lr-aus', China: '--lr-chn', 'Saudi Arabia': '--lr-sau', 'United Arab Emirates': '--lr-are', Croatia: '--lr-hrv', Algeria: '--lr-dza', Qatar: '--lr-qat', Japan: '--lr-jpn', 'New Zealand': '--lr-nzl', Hungary: '--lr-hun', Iceland: '--lr-isl', Italy: '--lr-ita', Oman: '--lr-omn', Other: '--lr-oth' };
  const cvar = (c) => `var(${COUNTRY_VAR[c] || '--lr-oth'})`;
  const GROUP6 = ['USA', 'Brazil', 'Canada', 'Norway', 'Australia', 'China', 'Other'];
  const COHORTS = [['1996–2004', '--lr-nor'], ['2005–2014', '--lr-usa'], ['2015–2019', '--lr-bra'], ['2020 onwards', '--lr-aus']];
  const isOil = (t) => /oil/i.test(t || '');
  const typeLabel = (t) => (isOil(t) ? 'Geological storage with oil recovery' : 'Geological storage');
  const ok = (id) => { const d = dash.data(id); return d.status === 'ok' ? d.data : null; };

  /* ---------- theme, mark, images ---------- */
  const probe = document.createElement('canvas'); probe.width = probe.height = 1;
  function syncTheme() {
    const bg = getComputedStyle(root).getPropertyValue('--color-bg').trim();
    let dark = false;
    try {
      const ctx = probe.getContext('2d', { willReadFrequently: true }); ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = '#ffffff'; ctx.fillStyle = bg || '#ffffff'; ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data; dark = (0.2126 * r + 0.7152 * g + 0.0722 * b) < 110;
    } catch (e) { dark = false; }
    root.classList.toggle('lr-dark', dark);
  }
  $('#lr-mark').innerHTML = '<svg width="40" height="40" viewBox="0 0 48 48" role="img" aria-label="London Register mark"><rect x="4" y="6.5" width="40" height="7" style="fill:var(--lr-mark-top)"/><rect x="10" y="17.5" width="28" height="7" fill="#2e6da4"/><rect x="16" y="28.5" width="16" height="7" fill="#8eb6e3"/><rect x="20.5" y="39.5" width="7" height="7" fill="#c7812a"/></svg>';
  if (window.LR_IMG) $('#dev-photo').src = window.LR_IMG.photo;

  /* ---------- tooltip ---------- */
  const tip = $('#tip');
  function showTip(e, html) {
    tip.innerHTML = html; tip.style.opacity = 1;
    const r = root.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
    if (x + w > r.width) x = e.clientX - r.left - w - 14;
    if (x < 0) x = 4;
    if (e.clientY + h + 14 > window.innerHeight) y = e.clientY - r.top - h - 14;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  const hideTip = () => { tip.style.opacity = 0; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- tabs ---------- */
  let page = 'overview';
  const pages = ['overview', 'analysis', 'projects', 'quality', 'data', 'about'];
  function showPage(p, link = true) {
    if (!pages.includes(p)) return;
    page = p;
    $$('.lr-page').forEach((s) => (s.hidden = s.dataset.page !== p));
    $$('.lr-tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === p));
    if (link) dash.setLink(p);
    draw();
  }
  $$('.lr-tabs button').forEach((b) => b.addEventListener('click', () => showPage(b.dataset.tab)));

  /* ---------- shared svg helpers ---------- */
  function svgIn(el, H) {
    el.innerHTML = '';
    const W = Math.max(280, el.clientWidth);
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    el.style.minHeight = H + 'px';
    return { svg, W };
  }
  const grid = (svg, y, x0, x1, ticks, fmt = d3.format(',')) => y.ticks(ticks).forEach((t) => {
    svg.append('line').attr('x1', x0).attr('x2', x1).attr('y1', y(t)).attr('y2', y(t)).attr('style', `stroke:var(${t ? '--lr-line' : '--lr-control'})`);
    svg.append('text').attr('x', x0 - 8).attr('y', y(t) + 4).attr('text-anchor', 'end').text(fmt(t));
  });

  /* ---------- register rows ---------- */
  function projectsFromRegister() {
    const reg = ok('register'); if (!reg) return null;
    return reg.map((r) => ({ n: r.project, o: r.operator, c: r.country, t: r.storage_type, v: YEARS.map((y) => (r[String(y)] === '' || r[String(y)] == null ? null : Number(r[String(y)]))) }));
  }

  /* ================= OVERVIEW ================= */
  function fillKpis() {
    const k = ok('kpis'), f = ok('findings'), c = ok('countries_2024');
    const set = (id, v) => { const el = $(id); el.textContent = v; el.classList.remove('dash-skeleton'); };
    if (k) {
      const r = k[0];
      set('#k-cum', f1(r.cumulative_mt)); set('#k-24', f1(r.total_2024_mt)); set('#k-25', f1(r.total_2025_mt)); set('#k-np', r.projects_2024);
      const d = $('#k-24d'); d.textContent = `${r.change_2024_pct >= 0 ? '+' : '-'}${Math.abs(r.change_2024_pct).toFixed(1)}%`; d.className = 'lr-delta ' + (r.change_2024_pct >= 0 ? 'up' : 'down');
      $('#f-np24').textContent = r.projects_2024; $('#f-np23').textContent = r.projects_2023;
    }
    if (c) $('#k-nc').textContent = c[0].countries_2024;
    if (f) {
      const r = f[0];
      $('#k-all').textContent = r.project_count;
      $('#f-cagr').textContent = r.cagr_10y_pct.toFixed(1); $('#f-oil').textContent = r.oil_recovery_share_2024_pct; $('#f-geo').textContent = r.geological_2024_mt.toFixed(1);
      $('#f-top5').textContent = r.top5_share_2024_pct; $('#f-lead').textContent = r.lead_project_2024; $('#f-leadmt').textContent = r.lead_project_2024_mt.toFixed(1);
      $('#f-coh').textContent = r.top_cohort_share_pct; $('#f-cohk').textContent = r.top_cohort_2024; $('#f-coh20').textContent = r.cohort_2020_share_pct;
      $('#n-rep').textContent = r.repeated_projects;
    }
  }

  let f1m = 'annual', f1g = 'type';
  function fig1() {
    const el = $('#fig1'), A = ok('annual'), C = ok('annual_country');
    if (!A || !C) return;
    const narrow = el.clientWidth < 600, H = narrow ? 280 : 380;
    const { svg, W } = svgIn(el, H);
    const m = { t: 22, r: 8, b: 28, l: narrow ? 36 : 46 };
    let keys, colors, rows;
    if (f1g === 'type') {
      keys = ['geological', 'oil_recovery'];
      colors = { geological: 'var(--lr-geo)', oil_recovery: 'var(--lr-oil)' };
      rows = A.map((r) => ({ year: r.year, geological: r.geological, oil_recovery: r.oil_recovery }));
    } else {
      keys = GROUP6; colors = Object.fromEntries(GROUP6.map((k) => [k, cvar(k)]));
      rows = C.map((r) => ({ ...r }));
    }
    if (f1m === 'cum') { const run = Object.fromEntries(keys.map((k) => [k, 0])); rows = rows.map((r) => { const o = { year: r.year }; keys.forEach((k) => { run[k] += r[k]; o[k] = run[k]; }); return o; }); }
    const tot = rows.map((r) => d3.sum(keys, (k) => r[k]));
    const x = d3.scaleBand(YEARS, [m.l, W - m.r]).paddingInner(narrow ? 0.2 : 0.28).paddingOuter(0.1);
    const y = d3.scaleLinear([0, d3.max(tot)], [H - m.b, m.t]).nice(5);
    const hl = svg.append('rect').attr('y', m.t).attr('height', H - m.b - m.t).attr('width', x.step()).attr('style', 'fill:var(--lr-sunken);opacity:0');
    grid(svg, y, m.l, W - m.r, 5);
    const step = narrow ? 5 : W < 900 ? 4 : 2;
    YEARS.forEach((yr) => { if ((yr - 1996) % step === 0 || yr === 2025) svg.append('text').attr('x', x(yr) + x.bandwidth() / 2).attr('y', H - 8).attr('text-anchor', 'middle').text(narrow ? '’' + String(yr).slice(2) : yr); });
    d3.stack().keys(keys)(rows).forEach((s) => s.forEach((d, i) => {
      const h = y(d[0]) - y(d[1]); if (h <= 0) return;
      svg.append('rect').attr('x', x(YEARS[i])).attr('y', y(d[1])).attr('width', x.bandwidth()).attr('height', h).attr('style', `fill:${colors[s.key]};opacity:${YEARS[i] === 2025 ? 0.42 : 1}`);
    }));
    const i24 = 28;
    svg.append('text').attr('x', x(2024) + x.bandwidth() / 2).attr('y', y(tot[i24]) - 7).attr('text-anchor', 'middle').attr('style', 'fill:var(--lr-ink);font-weight:600').text(f1(tot[i24]));
    const names = { geological: 'Geological storage', oil_recovery: 'Geological storage with oil recovery' };
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
      .on('mousemove', (e) => {
        const [mx] = d3.pointer(e); const i = Math.max(0, Math.min(29, Math.floor((mx - m.l) / x.step()))); const r = rows[i];
        hl.attr('x', x(YEARS[i]) - x.step() * x.paddingInner() / 2).style('opacity', 1);
        const lines = keys.slice().sort((a, b) => r[b] - r[a]).filter((k) => r[k] > 0.0005).map((k) => `<div class="row"><span><i style="background:${colors[k]}"></i>${esc(names[k] || k)}</span><b>${mt(r[k])}</b></div>`).join('');
        showTip(e, `<div class="k">${YEARS[i]}${YEARS[i] === 2025 ? ' · reporting incomplete' : ''}</div>${lines}<div class="row"><span class="k">Total</span><b>${mt(tot[i])} Mt</b></div>`);
      })
      .on('mouseleave', () => { hideTip(); hl.style('opacity', 0); });
    $('#f1sub').textContent = `${f1m === 'cum' ? 'Cumulative million tonnes since 1996' : 'Million tonnes per year'}, by ${f1g === 'type' ? 'storage type' : 'country'}`;
    $('#fig1-legend').innerHTML = keys.map((k) => `<span><i style="background:${colors[k]}"></i>${esc(names[k] || k)}</span>`).join('');
  }
  $$('[data-f1m]').forEach((b) => b.addEventListener('click', () => { f1m = b.dataset.f1m; $$('[data-f1m]').forEach((o) => o.setAttribute('aria-pressed', o === b)); fig1(); }));
  $$('[data-f1g]').forEach((b) => b.addEventListener('click', () => { f1g = b.dataset.f1g; $$('[data-f1g]').forEach((o) => o.setAttribute('aria-pressed', o === b)); fig1(); }));

  function minis() {
    const A = ok('annual'), K = ok('annual_cohort');
    const mini = (sel, build) => { const el = $(sel); el.innerHTML = ''; const W = Math.max(160, el.clientWidth), H = 56; const s = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('height', H); build(s, W, H); };
    if (A) {
      mini('#mini-total', (s, W, H) => { const ys = d3.range(2005, 2025), x = d3.scaleBand(ys, [0, W]).padding(0.18), y = d3.scaleLinear([0, d3.max(A, (r) => (r.year < 2025 ? r.total : 0))], [H - 14, 0]);
        ys.forEach((yy) => { const r = A.find((d) => d.year === yy); s.append('rect').attr('x', x(yy)).attr('y', y(r.total)).attr('width', x.bandwidth()).attr('height', H - 14 - y(r.total)).attr('style', `fill:var(${yy === 2024 ? '--lr-geo' : '--lr-line'})`); });
        s.append('text').attr('x', 0).attr('y', H - 1).text('2005'); s.append('text').attr('x', W).attr('y', H - 1).attr('text-anchor', 'end').text('2024'); });
      const line = (sel, key, color) => mini(sel, (s, W, H) => { const d = A.filter((r) => r.year >= 2005 && r.year <= 2024), x = d3.scaleLinear([2005, 2024], [0, W]), y = d3.scaleLinear([0, 100], [H - 14, 0]);
        s.append('line').attr('x1', 0).attr('x2', W).attr('y1', y(50)).attr('y2', y(50)).attr('style', 'stroke:var(--lr-line)').attr('stroke-dasharray', '3 3');
        s.append('path').attr('d', d3.line((r) => x(r.year), (r) => y(r[key]))(d)).attr('style', `fill:none;stroke:${color};stroke-width:2;stroke-linejoin:round`);
        s.append('circle').attr('cx', x(2024)).attr('cy', y(d[d.length - 1][key])).attr('r', 3).attr('style', `fill:${color}`);
        s.append('text').attr('x', 0).attr('y', H - 1).text('2005'); s.append('text').attr('x', W).attr('y', H - 1).attr('text-anchor', 'end').text('2024'); });
      line('#mini-oil', 'oil_recovery_share_pct', 'var(--lr-oil)');
      line('#mini-top5', 'top5_share_pct', 'var(--lr-ink)');
    }
    if (K && A) mini('#mini-cohort', (s, W, H) => { const r = K.find((d) => d.year === 2024), t = A.find((d) => d.year === 2024).total; let x0 = 0;
      COHORTS.forEach(([k, v]) => { const w = r[k] / t * W; if (w <= 0) return; s.append('rect').attr('x', x0).attr('y', 10).attr('width', Math.max(0, w - 2)).attr('height', 22).attr('rx', 2).attr('style', `fill:var(${v})`); if (w > 44) s.append('text').attr('x', x0 + 2).attr('y', H - 1).text(k.replace(' onwards', '+')); x0 += w; }); });
  }

  /* ================= ANALYSIS ================= */
  // map
  function topoFeatures(topo, name) {
    const tf = topo.transform, arcs = topo.arcs.map((arc) => { let x = 0, y = 0; return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * tf.scale[0] + tf.translate[0], y * tf.scale[1] + tf.translate[1]]; }); });
    const ring = (ids) => { const out = []; ids.forEach((i, k) => { const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i]; (k ? a.slice(1) : a).forEach((p) => out.push(p)); }); return out; };
    return topo.objects[name].geometries.map((g) => ({ type: 'Feature', properties: g.properties || {}, geometry: g.type === 'Polygon' ? { type: 'Polygon', coordinates: g.arcs.map(ring) } : g.type === 'MultiPolygon' ? { type: 'MultiPolygon', coordinates: g.arcs.map((p) => p.map(ring)) } : null })).filter((f) => f.geometry);
  }
  const WORLD = window.LR_WORLD ? topoFeatures(window.LR_WORLD, 'countries') : [];
  const WNAME = { USA: 'United States of America' };
  const ANCHOR = { USA: [-99, 38], Norway: [8, 61], Canada: [-106, 53] };
  let selCountry = '', rankAll = false;
  function mapChart() {
    const el = $('#map'), C = ok('countries'); if (!C) return;
    const W0 = Math.max(280, el.clientWidth), H = Math.round(W0 * 0.5);
    const { svg, W } = svgIn(el, H);
    const proj = d3.geoNaturalEarth1().fitExtent([[2, 2], [W - 2, H - 2]], { type: 'Sphere' }), path = d3.geoPath(proj);
    svg.append('path').attr('d', path({ type: 'Sphere' })).attr('style', 'fill:var(--lr-sunken);stroke:var(--lr-line)');
    svg.append('path').attr('d', path(d3.geoGraticule10())).attr('style', 'fill:none;stroke:var(--lr-line);stroke-width:.5');
    const have = new Set(C.map((c) => WNAME[c.country] || c.country));
    svg.append('g').selectAll('path').data(WORLD).join('path').attr('d', path).attr('style', (d) => `fill:var(${have.has(d.properties.name) ? '--lr-line' : '--lr-panel'});stroke:var(--lr-line);stroke-width:.5`);
    const r = d3.scaleSqrt([0, d3.max(C, (c) => c.cumulative)], [0, Math.max(14, W * 0.05)]), arc = d3.arc();
    C.forEach((c) => {
      const f = WORLD.find((w) => w.properties.name === (WNAME[c.country] || c.country));
      const xy = proj(ANCHOR[c.country] || (f ? d3.geoCentroid(f) : [0, 0])); if (!xy) return;
      const R = Math.max(3, r(c.cumulative)), a = 2 * Math.PI * (c.geological / (c.cumulative || 1));
      const g = svg.append('g').attr('transform', `translate(${xy})`).style('cursor', 'pointer');
      g.append('circle').attr('r', R + 1.5).attr('style', `fill:var(--lr-panel);stroke:${selCountry === c.country ? 'var(--lr-ink)' : 'none'};stroke-width:1.5`);
      if (c.geological > 0) g.append('path').attr('d', arc({ innerRadius: 0, outerRadius: R, startAngle: 0, endAngle: a })).attr('style', 'fill:var(--lr-geo)');
      if (c.oil_recovery > 0) g.append('path').attr('d', arc({ innerRadius: 0, outerRadius: R, startAngle: a, endAngle: 2 * Math.PI })).attr('style', 'fill:var(--lr-oil)');
      g.on('mousemove', (e) => showTip(e, `<div class="k">${esc(c.country)} · ${c.projects} project${c.projects > 1 ? 's' : ''}</div><div class="row"><span><i class="sw-geo"></i>Geological storage</span><b>${mt(c.geological)}</b></div><div class="row"><span><i class="sw-oil"></i>With oil recovery</span><b>${mt(c.oil_recovery)}</b></div><div class="row"><span class="k">Cumulative</span><b>${mt(c.cumulative)} Mt</b></div>`))
        .on('mouseleave', hideTip).on('click', () => pickCountry(c.country));
    });
  }
  function rankTable() {
    const C = ok('countries'), tb = $('#rank tbody'); if (!C) return;
    const max = C[0].cumulative, list = rankAll || selCountry ? C : C.slice(0, 10);
    tb.replaceChildren(...list.map((c) => {
      const tr = document.createElement('tr'); tr.dataset.key = c.country; if (c.country === selCountry) tr.className = 'on';
      const td1 = document.createElement('td'); td1.textContent = c.country;
      const td2 = document.createElement('td'); td2.className = 'bar';
      td2.innerHTML = `<div class="barw" style="width:${Math.max(1.5, 100 * c.cumulative / max)}%"><span style="width:${100 * c.geological / (c.cumulative || 1)}%;background:var(--lr-geo)"></span><span style="flex:1;background:var(--lr-oil)"></span></div>`;
      const td3 = document.createElement('td'); td3.className = 'n'; td3.textContent = f2(c.cumulative);
      tr.append(td1, td2, td3); return tr;
    }));
    $('#rank-more').hidden = rankAll || !!selCountry;
  }
  $('#rank').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-key]'); if (tr) pickCountry(tr.dataset.key); });
  $('#rank-more').addEventListener('click', () => { rankAll = true; rankTable(); });
  function pickCountry(c) { selCountry = selCountry === c ? '' : c; $('#fc').value = selCountry; mapChart(); rankTable(); if (selCountry) showPage('projects'); }

  // composition
  let cm = 'abs', cg = 'country';
  function comp() {
    const el = $('#comp'), A = ok('annual'), C = ok('annual_country'), K = ok('annual_cohort'); if (!A || !C || !K) return;
    const narrow = el.clientWidth < 600, H = narrow ? 260 : 340, { svg, W } = svgIn(el, H), m = { t: 12, r: 10, b: 26, l: narrow ? 36 : 46 };
    let keys, colors, rows;
    if (cg === 'country') { keys = GROUP6; colors = Object.fromEntries(keys.map((k) => [k, cvar(k)])); rows = C; }
    else if (cg === 'cohort') { keys = COHORTS.map((c) => c[0]); colors = Object.fromEntries(COHORTS.map(([k, v]) => [k, `var(${v})`])); rows = K; }
    else { keys = ['geological', 'oil_recovery']; colors = { geological: 'var(--lr-geo)', oil_recovery: 'var(--lr-oil)' }; rows = A; }
    const names = { geological: 'Geological storage', oil_recovery: 'Geological storage with oil recovery' };
    if (cm === 'share') rows = rows.map((r) => { const t = d3.sum(keys, (k) => r[k]) || 1, o = { year: r.year }; keys.forEach((k) => (o[k] = r[k] / t * 100)); return o; });
    const x = d3.scaleLinear([1996, 2025], [m.l, W - m.r]), y = d3.scaleLinear([0, cm === 'share' ? 100 : d3.max(rows, (r) => d3.sum(keys, (k) => r[k]))], [H - m.b, m.t]).nice(5);
    grid(svg, y, m.l, W - m.r, 5, cm === 'share' ? (t) => t + '%' : d3.format(','));
    x.ticks(narrow ? 5 : 10).forEach((t) => svg.append('text').attr('x', x(t)).attr('y', H - 6).attr('text-anchor', 'middle').text(t));
    svg.append('rect').attr('x', x(2024.5)).attr('y', m.t).attr('width', x(2025) - x(2024.5)).attr('height', H - m.b - m.t).attr('style', 'fill:var(--lr-sunken)');
    const area = d3.area().x((d) => x(d.data.year)).y0((d) => y(d[0])).y1((d) => y(d[1]));
    svg.append('g').selectAll('path').data(d3.stack().keys(keys)(rows)).join('path').attr('d', area).attr('style', (d) => `fill:${colors[d.key]};stroke:var(--lr-panel);stroke-width:.6`);
    const v = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).attr('style', 'stroke:var(--lr-ink);opacity:0');
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
      .on('mousemove', (e) => { const yr = Math.round(x.invert(d3.pointer(e)[0])), r = rows[yr - 1996]; if (!r) return; v.attr('x1', x(yr)).attr('x2', x(yr)).style('opacity', 0.4);
        showTip(e, `<div class="k">${yr}${yr === 2025 ? ' · reporting incomplete' : ''}</div>` + keys.slice().reverse().filter((k) => r[k] > 0.0005).map((k) => `<div class="row"><span><i style="background:${colors[k]}"></i>${esc(names[k] || k)}</span><b>${cm === 'share' ? r[k].toFixed(1) + '%' : mt(r[k])}</b></div>`).join('')); })
      .on('mouseleave', () => { hideTip(); v.style('opacity', 0); });
    $('#compsub').textContent = `${cm === 'share' ? 'Share of each year' : 'Mt per year'} by ${cg === 'country' ? 'country' : cg === 'cohort' ? 'start cohort' : 'storage type'}`;
    $('#comp-legend').innerHTML = keys.map((k) => `<span><i style="background:${colors[k]}"></i>${esc(names[k] || k)}</span>`).join('');
  }
  $$('[data-cm]').forEach((b) => b.addEventListener('click', () => { cm = b.dataset.cm; $$('[data-cm]').forEach((o) => o.setAttribute('aria-pressed', o === b)); comp(); }));
  $$('[data-cg]').forEach((b) => b.addEventListener('click', () => { cg = b.dataset.cg; $$('[data-cg]').forEach((o) => o.setAttribute('aria-pressed', o === b)); comp(); }));

  // bridge
  const bsel = $('#byear');
  YEARS.slice(1).reverse().forEach((y) => bsel.add(new Option(`${y - 1} to ${y}${y === 2025 ? ' (partial)' : ''}`, y)));
  let bYear = 2024; bsel.value = bYear;
  function bridge() {
    const el = $('#bridge'), CH = ok('changes'), S = ok('change_summary'); if (!CH || !S) return;
    const s = S.find((r) => r.year === bYear), d = CH.filter((r) => r.year === bYear).sort((a, b) => b.change - a.change);
    const narrow = el.clientWidth < 600, n = narrow ? 4 : 5;
    const ups = d.filter((o) => o.change > 0), downs = d.filter((o) => o.change < 0).reverse();
    const shownU = ups.slice(0, n), shownD = downs.slice(0, n), restN = d.length - shownU.length - shownD.length;
    const rest = d3.sum(d, (o) => o.change) - d3.sum(shownU, (o) => o.change) - d3.sum(shownD, (o) => o.change);
    const steps = [{ lab: `${bYear - 1} total`, kind: 'tot', v: s.previous_total }];
    shownU.forEach((o) => steps.push({ lab: o.project, kind: 'up', v: o.change, o }));
    shownD.forEach((o) => steps.push({ lab: o.project, kind: 'down', v: o.change, o }));
    if (restN > 0) steps.push({ lab: `${restN} other projects, net`, kind: rest >= 0 ? 'up' : 'down', v: rest, other: true });
    steps.push({ lab: `${bYear} total`, kind: 'tot', v: s.total });
    let run = s.previous_total; steps.forEach((st, k) => { if (st.kind === 'tot') { st.a = 0; st.b = st.v; } else { st.a = run; st.b = run + st.v; run = st.b; } });
    const rowH = 30, labW = narrow ? 128 : 240, H = 8 + steps.length * rowH + 24;
    const { svg, W } = svgIn(el, H), m = { t: 8, r: 56, b: 24, l: labW };
    const lo = d3.min(steps.filter((st) => st.kind !== 'tot'), (st) => Math.min(st.a, st.b)) ?? Math.min(s.previous_total, s.total), hi = d3.max(steps, (st) => Math.max(st.a, st.b));
    const span = Math.max(hi - lo, 0.5), x = d3.scaleLinear([Math.max(0, lo - span * 0.35), hi + span * 0.05], [m.l, W - m.r]);
    x.ticks(narrow ? 3 : 6).forEach((t) => { svg.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', m.t).attr('y2', H - m.b).attr('style', 'stroke:var(--lr-line)'); svg.append('text').attr('x', x(t)).attr('y', H - 6).attr('text-anchor', 'middle').text(d3.format(',')(t)); });
    steps.forEach((st, k) => {
      const yy = m.t + k * rowH, col = st.kind === 'tot' ? 'var(--lr-ink-2)' : st.kind === 'up' ? 'var(--lr-up)' : 'var(--lr-down)';
      const xa = x(Math.max(x.domain()[0], Math.min(st.a, st.b))), xb = x(Math.max(st.a, st.b));
      const max = narrow ? 17 : 34, lab = st.lab.length > max ? st.lab.slice(0, max - 1) + '…' : st.lab;
      svg.append('text').attr('x', m.l - 10).attr('y', yy + rowH / 2 + 4).attr('text-anchor', 'end').attr('style', st.kind === 'tot' ? 'fill:var(--lr-ink);font-weight:600;font-size:12.5px' : 'fill:var(--lr-ink-2);font-size:12.5px').text(lab);
      svg.append('rect').attr('x', xa).attr('y', yy + 6).attr('width', Math.max(2, xb - xa)).attr('height', rowH - 12).attr('rx', 2).attr('style', `fill:${col};opacity:${st.other ? 0.55 : 1}`);
      svg.append('text').attr('x', xb + 6).attr('y', yy + rowH / 2 + 4).attr('style', `fill:${st.kind === 'tot' ? 'var(--lr-ink)' : col};font-weight:600`).text(st.kind === 'tot' ? f2(st.v) : (st.v > 0 ? '+' : '−') + f2(Math.abs(st.v)));
      svg.append('rect').attr('x', 0).attr('y', yy).attr('width', W).attr('height', rowH).attr('fill', 'transparent')
        .on('mousemove', (e) => showTip(e, st.o ? `<div class="k">${esc(st.o.country)} · ${esc(typeLabel(st.o.storage_type))}</div><b>${esc(st.o.project)}</b><div class="row"><span class="k">${bYear - 1} → ${bYear}</span><b>${mt(st.o.previous)} → ${mt(st.o.current)} Mt</b></div>` : `<b>${esc(st.lab)}</b><div class="row"><span class="k">Mt</span><b>${f2(st.v)}</b></div>`)).on('mouseleave', hideTip);
    });
    const w = `year=${bYear}`;
    ['#b-chg', '#b-pct', '#b-up', '#b-down', '#b-new', '#b-stop'].forEach((id) => $(id).setAttribute('data-where', w));
    $('#bsum-label').textContent = `${bYear - 1} to ${bYear}`;
    $('#b-chg').textContent = (s.change >= 0 ? '+' : '-') + f2(Math.abs(s.change));
    $('#b-chg').parentElement.style.color = s.change >= 0 ? 'var(--lr-up)' : 'var(--lr-down)';
    $('#b-pct').textContent = (s.change_pct >= 0 ? '+' : '-') + Math.abs(s.change_pct).toFixed(1);
    $('#b-up').textContent = s.increased; $('#b-down').textContent = s.decreased; $('#b-new').textContent = s.began; $('#b-stop').textContent = s.stopped;
    $('#b-note').textContent = bYear === 2025 ? '2025 reporting is incomplete, so falls here mostly reflect projects that have not yet reported.' : 'Changes reflect reported values. A fall can mean lower injection, a reporting change or a pause.';
    $('#bprev').disabled = bYear <= 1997; $('#bnext').disabled = bYear >= 2025;
  }
  bsel.addEventListener('change', () => { bYear = +bsel.value; bridge(); });
  $('#bprev').addEventListener('click', () => { bYear = Math.max(1997, bYear - 1); bsel.value = bYear; bridge(); });
  $('#bnext').addEventListener('click', () => { bYear = Math.min(2025, bYear + 1); bsel.value = bYear; bridge(); });

  // waffle
  const wsel = $('#wyear');
  YEARS.slice().reverse().forEach((y) => wsel.add(new Option(y === 2025 ? '2025 (partial)' : y, y)));
  let wYear = 2024, wHi = '', wOpen = new Set(['USA']); wsel.value = wYear;
  function waffle() {
    const SH = ok('shares'), A = ok('annual'); if (!SH || !A) return;
    const items = SH.filter((r) => r.year === wYear), tot = A.find((r) => r.year === wYear).total;
    const byC = d3.rollups(items, (a) => ({ mt: d3.sum(a, (d) => d.mt), items: a.sort((p, q) => q.mt - p.mt) }), (d) => d.country).map(([c, o]) => ({ c, ...o })).sort((a, b) => b.mt - a.mt);
    const ordered = byC.flatMap((c) => c.items);
    const raw = ordered.map((d) => d.mt / tot * 400), cells = raw.map(Math.floor); let left = 400 - d3.sum(cells);
    raw.map((r, k) => [r - cells[k], k]).sort((a, b) => b[0] - a[0]).slice(0, left).forEach(([, k]) => cells[k]++);
    const el = $('#waffle'); const frag = document.createDocumentFragment();
    ordered.forEach((d, k) => { for (let n = 0; n < cells[k]; n++) { const s = document.createElement('div'); s.style.background = cvar(d.country); s.dataset.c = d.country; s.dataset.k = k; if (wHi && wHi !== d.country) s.className = 'dim'; frag.appendChild(s); } });
    el.replaceChildren(frag);
    el.onmousemove = (e) => { const s = e.target.closest('[data-k]'); if (!s) return hideTip(); const d = ordered[+s.dataset.k]; showTip(e, `<div class="k">${esc(d.country)} · ${esc(typeLabel(d.storage_type))}</div><b>${esc(d.project)}</b><div class="row"><span class="k">${wYear}</span><b>${mt(d.mt)} Mt · ${d.share_pct.toFixed(2)}%</b></div>`); };
    el.onmouseleave = hideTip;
    el.onclick = (e) => { const s = e.target.closest('[data-k]'); if (s) { wHi = wHi === s.dataset.c ? '' : s.dataset.c; if (wHi) wOpen.add(wHi); waffle(); } };
    $('#wsub').textContent = `${wYear}${wYear === 2025 ? ', reporting incomplete' : ''} · ${f2(tot)} Mt · ${items.length} project${items.length === 1 ? '' : 's'} · ${byC.length} countr${byC.length === 1 ? 'y' : 'ies'}`;
    const cl = $('#clist');
    cl.replaceChildren(...byC.map((c) => {
      const open = wOpen.has(c.c), it = document.createElement('div'); it.className = 'lr-citem' + (open ? ' open' : '') + (wHi === c.c ? ' on' : '');
      const head = document.createElement('button'); head.className = 'lr-chead'; head.setAttribute('aria-expanded', open);
      head.innerHTML = `<span class="sw" style="background:${cvar(c.c)}"></span><b></b><span class="np">${c.items.length} project${c.items.length > 1 ? 's' : ''}</span><span class="pct">${(c.mt / tot * 100).toFixed(1)}%</span><span class="car">›</span>`;
      head.querySelector('b').textContent = c.c;
      head.addEventListener('click', () => { open ? wOpen.delete(c.c) : wOpen.add(c.c); wHi = open && wHi === c.c ? '' : c.c; waffle(); });
      head.addEventListener('mouseenter', () => $$('#waffle div').forEach((s) => s.classList.toggle('dim', s.dataset.c !== c.c)));
      head.addEventListener('mouseleave', () => $$('#waffle div').forEach((s) => s.classList.toggle('dim', !!wHi && s.dataset.c !== wHi)));
      it.appendChild(head);
      if (open) { const body = document.createElement('div'); body.className = 'lr-cbody'; c.items.forEach((d) => { const r = document.createElement('div'); const a = document.createElement('span'); a.textContent = d.project; a.title = d.project; const b1 = document.createElement('b'); b1.textContent = mt(d.mt) + ' Mt'; const b2 = document.createElement('b'); b2.textContent = d.share_pct < 0.25 ? '<0.25%' : d.share_pct.toFixed(1) + '%'; r.append(a, b1, b2); body.appendChild(r); }); it.appendChild(body); }
      return it;
    }));
    $('#wprev').disabled = wYear <= 1996; $('#wnext').disabled = wYear >= 2025;
  }
  wsel.addEventListener('change', () => { wYear = +wsel.value; waffle(); });
  $('#wprev').addEventListener('click', () => { wYear = Math.max(1996, wYear - 1); wsel.value = wYear; waffle(); });
  $('#wnext').addEventListener('click', () => { wYear = Math.min(2025, wYear + 1); wsel.value = wYear; waffle(); });

  // outlook
  let gScen = null;
  function outlook() {
    const el = $('#proj'), A = ok('annual'), G = ok('growth'), SC = ok('scenarios'); if (!A || !G || !SC) return;
    const g = G[0];
    if (gScen == null) gScen = Math.round(g.rate_pct * 2) / 2;
    $('#g').value = gScen;
    $('#o-fit').textContent = g.rate_pct.toFixed(1); $('#o-r2').textContent = g.r2.toFixed(2); $('#o-dbl').textContent = g.doubling_years.toFixed(1);
    const sc = SC.find((r) => Math.abs(r.rate_pct - gScen) < 1e-6);
    ['#o-g', '#o-gt', '#o-50'].forEach((id) => $(id).setAttribute('data-where', `rate_pct=${sc.rate_pct}`));
    $('#o-g').textContent = sc.rate_pct.toFixed(1); $('#o-gt').textContent = sc.gt_year; $('#o-50').textContent = d3.format(',')(sc.rate_2050_mt);
    const narrow = el.clientWidth < 600, H = narrow ? 260 : 340, { svg, W } = svgIn(el, H), m = { t: 14, r: narrow ? 14 : 64, b: 26, l: 46 };
    const x = d3.scaleLinear([1996, 2050], [m.l, W - m.r]), y = d3.scaleLog([0.05, 4000], [H - m.b, m.t]);
    const clipId = 'lr-proj-clip'; svg.append('clipPath').attr('id', clipId).append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b);
    [0.1, 1, 10, 100, 1000].forEach((t) => { svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)).attr('style', 'stroke:var(--lr-line)'); svg.append('text').attr('x', m.l - 8).attr('y', y(t) + 4).attr('text-anchor', 'end').text(t >= 1000 ? '1 Gt' : t); });
    [2000, 2010, 2020, 2030, 2040, 2050].forEach((t) => svg.append('text').attr('x', x(t)).attr('y', H - 6).attr('text-anchor', 'middle').text(t));
    svg.append('rect').attr('x', m.l).attr('y', y(4000)).attr('width', W - m.l - m.r).attr('height', y(1000) - y(4000)).attr('style', 'fill:var(--lr-oil);opacity:.08');
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(1000)).attr('y2', y(1000)).attr('style', 'stroke:var(--lr-oil)').attr('stroke-dasharray', '4 3');
    svg.append('text').attr('x', m.l + 6).attr('y', y(1000) - 6).attr('style', 'fill:var(--lr-ink-2)').text('Gigatonne scale, 1,000 Mt a year');
    svg.append('line').attr('x1', x(2024.5)).attr('x2', x(2024.5)).attr('y1', m.t).attr('y2', H - m.b).attr('style', 'stroke:var(--lr-control)').attr('stroke-dasharray', '2 3');
    svg.append('text').attr('x', x(2024.5) + 5).attr('y', H - m.b - 6).text('Scenario');
    svg.append('path').attr('d', d3.line((t) => x(t), (t) => y(Math.exp(g.intercept + g.slope * (t - 2005))))(d3.range(2005, 2024.01, 0.5))).attr('style', 'fill:none;stroke:var(--lr-geo);stroke-width:2');
    const r = gScen / 100, pr = d3.range(2024, 2050.01, 0.25).map((t) => [t, g.base_2024_mt * Math.pow(1 + r, t - 2024)]);
    svg.append('path').attr('d', d3.line((d) => x(d[0]), (d) => y(d[1]))(pr)).attr('style', 'fill:none;stroke:var(--lr-oil);stroke-width:2.2').attr('stroke-dasharray', '6 4').attr('clip-path', `url(#${clipId})`);
    A.filter((a) => a.year < 2025).forEach((a) => svg.append('circle').attr('cx', x(a.year)).attr('cy', y(a.total)).attr('r', 3).attr('style', 'fill:var(--lr-ink)')
      .on('mousemove', (e) => showTip(e, `<div class="k">${a.year}</div><b>${mt(a.total)} Mt</b> reported`)).on('mouseleave', hideTip));
    if (sc.gt_year <= 2050) svg.append('circle').attr('cx', x(sc.gt_year)).attr('cy', y(1000)).attr('r', 5).attr('style', 'fill:var(--lr-panel);stroke:var(--lr-oil);stroke-width:2');
  }
  $('#g').addEventListener('input', (e) => { gScen = +e.target.value; outlook(); });

  /* ================= PROJECTS ================= */
  const fc = $('#fc'), tc = $('#tc');
  let sortKey = 'cumulative', sortDir = -1, selProject = '', cmpSet = [], cmpMode = 'annual';
  function fillCountrySelects() {
    const C = ok('countries'); if (!C || fc.options.length > 1) return;
    C.slice().sort((a, b) => a.country.localeCompare(b.country)).forEach((c) => { fc.add(new Option(`${c.country} (${c.projects})`, c.country)); tc.add(new Option(c.country, c.country)); });
    fc.value = selCountry;
  }
  function spark(v, oil) {
    const w = 120, h = 22, mx = d3.max(v, (d) => d || 0) || 1, x = (i) => i / 29 * w, y = (d) => h - 2 - (d || 0) / mx * (h - 4);
    const d = v.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join('');
    const c = oil ? 'var(--lr-oil)' : 'var(--lr-geo)';
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}L${w},${h}L0,${h}Z" style="fill:${c};opacity:.15"/><path d="${d}" style="fill:none;stroke:${c};stroke-width:1.4"/></svg>`;
  }
  function projectsTable() {
    const PR = ok('projects'), REG = projectsFromRegister(); if (!PR || !REG) return;
    fillCountrySelects();
    const q = $('#q').value.trim().toLowerCase(), c = fc.value, t = $('#ft').value;
    let rows = PR.filter((p) => (!c || p.country === c) && (!t || (t === 'oil') === isOil(p.storage_type)) && (!q || (p.project + ' ' + p.operator + ' ' + p.country).toLowerCase().includes(q)));
    rows.sort((a, b) => { const A = a[sortKey], B = b[sortKey]; if (typeof A === 'number' || typeof B === 'number') return ((A ?? -1) - (B ?? -1)) * sortDir; return String(A ?? '').localeCompare(String(B ?? '')) * sortDir; });
    const tb = $('#ptable tbody');
    tb.replaceChildren(...rows.map((p) => {
      const tr = document.createElement('tr'); if (p.project === selProject) tr.className = 'on';
      const reg = REG.find((r) => r.n === p.project);
      const cells = [
        ['project', p.project, ''], ['country', p.country, 'hide-sm'], ['storage_type', typeLabel(p.storage_type), 'hide-md'],
        ['first_year', p.first_year ?? '', 'n hide-md'], ['last_year', p.last_year ?? '', 'n hide-md'],
        ['mt_2024', p.mt_2024.toFixed(3), 'n hide-sm'], ['cumulative', f2(p.cumulative), 'n'], ['share_pct', p.share_pct < 0.1 ? '<0.1' : p.share_pct.toFixed(1), 'n hide-sm'], ['status', p.status, 'hide-md'],
      ];
      cells.forEach(([k, v, cls]) => {
        const td = document.createElement('td'); if (cls) td.className = cls;
        if (k === 'project') { const s = document.createElement('span'); s.textContent = v; td.appendChild(s); if (reg) td.insertAdjacentHTML('beforeend', spark(reg.v, isOil(p.storage_type))); }
        else if (k === 'status') { const s = document.createElement('span'); s.className = 'pill' + (v === 'Reporting' ? ' ok' : ''); s.textContent = v; td.appendChild(s); }
        else td.textContent = v;
        tr.appendChild(td);
      });
      tr.addEventListener('click', () => { selProject = p.project; detail(); projectsTable(); $('#detail-card').scrollIntoView({ block: 'nearest' }); });
      return tr;
    }));
    $$('#ptable th').forEach((th) => { if (th.dataset.sort === sortKey) th.setAttribute('aria-sort', sortDir > 0 ? 'ascending' : 'descending'); else th.removeAttribute('aria-sort'); });
    $('#pcount').textContent = `${rows.length} of ${PR.length} projects${c ? ' · ' + c : ''}`;
  }
  $$('#ptable th').forEach((th) => th.addEventListener('click', () => { const k = th.dataset.sort; if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = ['project', 'country', 'storage_type', 'status'].includes(k) ? 1 : -1; } projectsTable(); }));
  ['#q', '#ft'].forEach((s) => $(s).addEventListener('input', projectsTable));
  fc.addEventListener('change', () => { selCountry = fc.value; projectsTable(); });

  function detail() {
    const card = $('#detail-card'), PR = ok('projects'), REG = projectsFromRegister();
    if (!selProject || !PR || !REG) { card.hidden = true; return; }
    const p = PR.find((r) => r.project === selProject), reg = REG.find((r) => r.n === selProject); if (!p || !reg) { card.hidden = true; return; }
    card.hidden = false;
    $('#d-name').textContent = p.project; $('#d-sub').textContent = `${p.operator} · ${p.country} · ${typeLabel(p.storage_type)}`;
    const w = 'project=' + p.project.replace(/[%&=]/g, (ch) => encodeURIComponent(ch));
    ['#d-yrs', '#d-py', '#d-pk', '#d-24', '#d-cum', '#d-coh', '#d-run'].forEach((id) => $(id).setAttribute('data-where', w));
    $('#d-yrs').textContent = p.years_reporting; $('#d-py').textContent = p.peak_year ?? '—'; $('#d-pk').textContent = mt(p.peak_mt); $('#d-24').textContent = mt(p.mt_2024);
    $('#d-cum').textContent = f2(p.cumulative); $('#d-coh').textContent = p.cohort ?? '—'; $('#d-run').textContent = p.repeated_run; $('#d-run-u').textContent = p.repeated_run === 1 ? 'year' : 'years';
    const inCmp = cmpSet.includes(p.project); const b = $('#d-cmp'); b.textContent = inCmp ? 'In comparison' : 'Add to comparison'; b.setAttribute('aria-pressed', inCmp);
    const el = $('#d-chart'), H = 170, { svg, W } = svgIn(el, H), m = { t: 10, r: 6, b: 22, l: 40 };
    const x = d3.scaleBand(YEARS, [m.l, W - m.r]).paddingInner(0.2), y = d3.scaleLinear([0, d3.max(reg.v, (d) => d || 0) || 1], [H - m.b, m.t]).nice(3);
    grid(svg, y, m.l, W - m.r, 3, d3.format(','));
    const col = isOil(p.storage_type) ? 'var(--lr-oil)' : 'var(--lr-geo)';
    reg.v.forEach((v, i) => { const yr = YEARS[i];
      if (v > 0) svg.append('rect').attr('x', x(yr)).attr('y', y(v)).attr('width', x.bandwidth()).attr('height', y(0) - y(v)).attr('style', `fill:${col};opacity:${yr === 2025 ? 0.45 : 1}`);
      svg.append('rect').attr('x', x(yr)).attr('y', m.t).attr('width', x.bandwidth()).attr('height', H - m.b - m.t).attr('fill', 'transparent').on('mousemove', (e) => showTip(e, `<div class="k">${yr}${yr === 2025 ? ' · reporting incomplete' : ''}</div><b>${v == null ? 'Not reported' : mt(v) + ' Mt'}</b>`)).on('mouseleave', hideTip); });
    [1996, 2005, 2015, 2025].forEach((t) => svg.append('text').attr('x', x(t) + x.bandwidth() / 2).attr('y', H - 6).attr('text-anchor', 'middle').text(t));
  }
  $('#d-close').addEventListener('click', () => { selProject = ''; detail(); projectsTable(); });
  $('#d-cmp').addEventListener('click', () => { if (cmpSet.includes(selProject)) cmpSet = cmpSet.filter((n) => n !== selProject); else if (cmpSet.length < 4) cmpSet.push(selProject); detail(); compare(); });

  const CMPC = ['var(--lr-ink)', 'var(--lr-geo)', 'var(--lr-oil)', 'var(--lr-nor)'];
  function compare() {
    const card = $('#cmp-card'), REG = projectsFromRegister(); card.hidden = !cmpSet.length || !REG; if (card.hidden) return;
    const ser = cmpSet.map((n, k) => { const r = REG.find((p) => p.n === n); let c = 0; return { n, col: CMPC[k], vals: r.v.map((v) => (cmpMode === 'cum' ? (c += v || 0) : v || 0)) }; });
    const el = $('#cmp'), narrow = el.clientWidth < 600, H = narrow ? 220 : 260, { svg, W } = svgIn(el, H), m = { t: 12, r: 12, b: 26, l: 44 };
    const x = d3.scaleLinear([1996, 2025], [m.l, W - m.r]), y = d3.scaleLinear([0, d3.max(ser, (s) => d3.max(s.vals)) || 1], [H - m.b, m.t]).nice(4);
    grid(svg, y, m.l, W - m.r, 4, d3.format(','));
    x.ticks(narrow ? 5 : 10).forEach((t) => svg.append('text').attr('x', x(t)).attr('y', H - 6).attr('text-anchor', 'middle').text(t));
    ser.forEach((s) => svg.append('path').attr('d', d3.line((v, i) => x(1996 + i), (v) => y(v))(s.vals)).attr('style', `fill:none;stroke:${s.col};stroke-width:2;stroke-linejoin:round;stroke-linecap:round`));
    const v = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).attr('style', 'stroke:var(--lr-control);opacity:0');
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
      .on('mousemove', (e) => { const yr = Math.round(x.invert(d3.pointer(e)[0])); if (yr < 1996 || yr > 2025) return; v.attr('x1', x(yr)).attr('x2', x(yr)).style('opacity', 1);
        showTip(e, `<div class="k">${yr}${yr === 2025 ? ' · reporting incomplete' : ''}</div>` + ser.map((s) => `<div class="row"><span><i style="background:${s.col}"></i>${esc(s.n.length > 30 ? s.n.slice(0, 29) + '…' : s.n)}</span><b>${mt(s.vals[yr - 1996])}</b></div>`).join('')); })
      .on('mouseleave', () => { hideTip(); v.style('opacity', 0); });
    $('#cmpsub').textContent = cmpMode === 'cum' ? 'Cumulative Mt CO₂ since first report' : 'Mt CO₂ per year';
    $('#cmp-leg').replaceChildren(...ser.map((s) => { const b = document.createElement('button'); b.setAttribute('aria-label', 'Remove ' + s.n); b.innerHTML = `<i style="background:${s.col}"></i><span></span><span aria-hidden="true">×</span>`; b.querySelector('span').textContent = s.n; b.addEventListener('click', () => { cmpSet = cmpSet.filter((n) => n !== s.n); compare(); detail(); }); return b; }));
  }
  $$('[data-cmpm]').forEach((b) => b.addEventListener('click', () => { cmpMode = b.dataset.cmpm; $$('[data-cmpm]').forEach((o) => o.setAttribute('aria-pressed', o === b)); compare(); }));
  $('#cmp-clear').addEventListener('click', () => { cmpSet = []; compare(); detail(); });

  /* ================= DATA ================= */
  function reports() {
    const R = ok('reports'); if (!R) return;
    ['2026', '2025'].forEach((ed) => {
      const host = $('#r' + ed);
      host.replaceChildren(...R.filter((r) => String(r.edition) === ed).map((r) => {
        const a = document.createElement('a'); a.className = 'lr-rcard'; a.href = r.url; a.target = '_blank'; a.rel = 'noopener';
        a.setAttribute('aria-label', `Open ${r.title} (PDF, ${r.size_mb} MB) in a new tab`);
        const img = (window.LR_IMG && window.LR_IMG[r.id]) || '';
        a.innerHTML = `<div class="lr-rcover">${img ? `<img alt="" src="${img}">` : ''}</div><div class="lr-rbody"><span class="lr-eyebrow"></span><b></b><div class="lr-rmeta"><span>PDF · <span class="sz"></span> MB</span><span class="go">Open PDF</span></div></div>`;
        a.querySelector('.lr-eyebrow').textContent = r.kind; a.querySelector('b').textContent = r.title; a.querySelector('.sz').textContent = r.size_mb;
        return a;
      }));
    });
  }
  function heatTable() {
    const REG = ok('register'), A = ok('annual'); if (!REG || !A) return;
    fillCountrySelects();
    const c = tc.value, rows = REG.filter((r) => !c || r.country === c).sort((a, b) => a.country.localeCompare(b.country) || a.project.localeCompare(b.project));
    const mx = d3.max(REG, (r) => d3.max(YEARS, (y) => Number(r[String(y)]) || 0)), sc = d3.scaleSqrt([0, mx], [0, 70]);
    const th = (f, label, cls) => { const e = document.createElement('th'); e.dataset.field = f; e.textContent = label; if (cls) e.className = cls; return e; };
    const tr0 = document.createElement('tr'); tr0.append(th('project', 'Project'), th('country', 'Country'), ...YEARS.map((y) => th(String(y), String(y), 'n')));
    $('#heat thead').replaceChildren(tr0);
    $('#heat tbody').replaceChildren(...rows.map((r) => {
      const tr = document.createElement('tr'); const oil = isOil(r.storage_type);
      const a = document.createElement('td'); a.textContent = r.project; a.title = `${r.project} · ${r.operator}`;
      const b = document.createElement('td'); b.textContent = r.country; tr.append(a, b);
      YEARS.forEach((y) => { const td = document.createElement('td'); const raw = r[String(y)]; td.textContent = raw; const v = Number(raw) || 0; if (v > 0) { const p = sc(v); td.style.background = `color-mix(in srgb, var(${oil ? '--lr-oil' : '--lr-geo'}) ${p.toFixed(0)}%, transparent)`; if (p > 42) td.style.color = 'var(--lr-panel)'; } tr.appendChild(td); });
      return tr;
    }));
  }
  tc.addEventListener('change', heatTable);
  $('#copybib').addEventListener('click', async () => { const b = $('#copybib'); try { await navigator.clipboard.writeText($('#bib').textContent); b.textContent = 'Copied'; } catch (e) { const r = document.createRange(); r.selectNodeContents($('#bib')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'Selected, press Ctrl+C'; } setTimeout(() => (b.textContent = 'Copy BibTeX'), 1800); });

  window.LR = { svgIn, grid, showTip, hideTip, mt, f1, f2, esc, ok, isOil, typeLabel, YEARS };

  /* ================= DRAW ================= */
  function draw() {
    syncTheme(); fillKpis();
    if (page === 'overview') { fig1(); minis(); }
    if (page === 'analysis') { mapChart(); rankTable(); comp(); bridge(); waffle(); outlook(); }
    if (page === 'projects') { projectsTable(); detail(); compare(); }
    if (page === 'data') { reports(); heatTable(); }
    if (window.LR_EXTRA) window.LR_EXTRA(page);
  }
  let first = true;
  dash.onData(() => {
    draw();
    if (first && ok('annual')) {
      first = false;
      const h = location.hash.slice(1); if (pages.includes(h)) showPage(h, false);
    }
  });
})();
