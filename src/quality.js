(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const L = window.LR;
  const pct = (v) => (v >= 0 ? '+' : '-') + Math.abs(v).toFixed(1);
  let rowsMode = 'all';

  function stats() {
    const c = L.ok('completeness'), q = L.ok('quality');
    if (c) {
      const r = c[0];
      $('#q-both').textContent = r.reported_both; $('#q-24').textContent = r.reported_2024;
      $('#q-wmt').textContent = r.awaiting_mt.toFixed(1); $('#q-wpct').textContent = r.awaiting_share_pct.toFixed(1); $('#q-wn').textContent = r.awaiting;
      $('#q-like').textContent = pct(r.like_change_pct); $('#q-l24').textContent = r.like_2024_mt.toFixed(1); $('#q-l25').textContent = r.like_2025_mt.toFixed(1);
      $('#q-cf').textContent = r.carry_forward_2025_mt.toFixed(1);
      $('#q-new').textContent = r.new_2025; $('#q-newmt').textContent = r.new_2025_mt.toFixed(3);
    }
    if (q) { const r = q[0]; $('#q-rep').textContent = r.repeated_share_pct.toFixed(1); $('#q-repmt').textContent = r.repeated_mt.toFixed(1); $('#q-repn').textContent = r.repeated_projects; }
  }

  function awaitTable() {
    const A = L.ok('awaiting_2025'); if (!A) return;
    $('#await tbody').replaceChildren(...A.slice(0, 10).map((r) => {
      const tr = document.createElement('tr'); tr.dataset.key = r.project;
      const a = document.createElement('td'); a.textContent = r.project; a.style.whiteSpace = 'normal';
      const b = document.createElement('td'); b.textContent = r.country;
      const c = document.createElement('td'); c.className = 'n'; c.textContent = r.mt_2024.toFixed(3);
      tr.append(a, b, c); return tr;
    }));
  }

  function track() {
    const REG = L.ok('register'); if (!REG) return;
    const v = (r, y) => Number(r[String(y)]) || 0;
    const rows = REG.filter((r) => v(r, 2024) > 0).sort((a, b) => v(b, 2024) - v(a, 2024)).slice(0, 16);
    const el = $('#track'), narrow = el.clientWidth < 600, rowH = 26, labW = narrow ? 120 : 230;
    const H = 8 + rows.length * rowH + 24, { svg, W } = L.svgIn(el, H), m = { t: 8, r: 54, b: 24, l: labW };
    const x = d3.scaleLinear([0, d3.max(rows, (r) => Math.max(v(r, 2024), v(r, 2025)))], [m.l, W - m.r]).nice();
    x.ticks(narrow ? 3 : 5).forEach((t) => { svg.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', m.t).attr('y2', H - m.b).attr('style', 'stroke:var(--lr-line)'); svg.append('text').attr('x', x(t)).attr('y', H - 6).attr('text-anchor', 'middle').text(t); });
    rows.forEach((r, k) => {
      const y = m.t + k * rowH, a = v(r, 2024), b = v(r, 2025), has = b > 0, max = narrow ? 16 : 32;
      const lab = r.project.length > max ? r.project.slice(0, max - 1) + '…' : r.project;
      svg.append('text').attr('x', m.l - 10).attr('y', y + rowH / 2 + 4).attr('text-anchor', 'end').attr('style', 'fill:var(--lr-ink-2);font-size:12.5px').text(lab);
      svg.append('rect').attr('x', m.l).attr('y', y + 5).attr('width', Math.max(1, x(a) - m.l)).attr('height', 7).attr('style', 'fill:var(--lr-ink-2)');
      svg.append('rect').attr('x', m.l).attr('y', y + 13).attr('width', has ? Math.max(1, x(b) - m.l) : Math.max(1, x(a) - m.l)).attr('height', 7)
        .attr('style', has ? 'fill:var(--lr-geo)' : 'fill:none;stroke:var(--lr-control);stroke-dasharray:3 2');
      svg.append('text').attr('x', x(Math.max(a, has ? b : a)) + 6).attr('y', y + rowH / 2 + 4).attr('style', `fill:${has ? (b >= a ? 'var(--lr-up)' : 'var(--lr-down)') : 'var(--lr-muted)'};font-weight:600;font-size:11.5px`)
        .text(has ? pct((b / a - 1) * 100) + '%' : 'awaiting');
      svg.append('rect').attr('x', 0).attr('y', y).attr('width', W).attr('height', rowH).attr('fill', 'transparent')
        .on('mousemove', (e) => L.showTip(e, `<div class="k">${L.esc(r.country)} · ${L.esc(L.typeLabel(r.storage_type))}</div><b>${L.esc(r.project)}</b><div class="row"><span class="k">2024</span><b>${L.mt(a)} Mt</b></div><div class="row"><span class="k">2025</span><b>${has ? L.mt(b) + ' Mt' : 'Not yet reported'}</b></div>`))
        .on('mouseleave', L.hideTip);
    });
  }

  function coverage() {
    const REG = L.ok('register'); if (!REG) return;
    const Y = L.YEARS;
    let rows = REG.map((r) => {
      const v = Y.map((y) => (r[String(y)] === '' || r[String(y)] == null ? null : Number(r[String(y)])));
      const rep = v.map(() => false);
      let i = 0;
      while (i < v.length) { if (v[i] > 0) { let j = i; while (j + 1 < v.length && v[j + 1] === v[i]) j++; if (j - i + 1 >= 4) for (let k = i; k <= j; k++) rep[k] = true; i = j + 1; } else i++; }
      const first = v.findIndex((x) => x > 0);
      return { r, v, rep, first: first < 0 ? 99 : first, any: rep.some(Boolean) };
    }).sort((a, b) => a.first - b.first || a.r.project.localeCompare(b.r.project));
    if (rowsMode === 'rep') rows = rows.filter((d) => d.any);
    const el = $('#coverage'), narrow = el.parentElement.clientWidth < 700;
    const labW = narrow ? 130 : 250, cell = narrow ? 12 : Math.max(12, Math.min(26, (el.parentElement.clientWidth - labW - 16) / 30)), rowH = 13;
    const Wn = labW + cell * 30 + 8; el.style.width = Wn + 'px';
    const H = 22 + rows.length * rowH + 4;
    el.innerHTML = '';
    const svg = d3.select(el).append('svg').attr('width', Wn).attr('height', H).attr('viewBox', `0 0 ${Wn} ${H}`);
    el.style.minHeight = H + 'px';
    Y.forEach((y, i) => { if (y % 5 === 0 || y === 2025 || y === 1996) svg.append('text').attr('x', labW + i * cell + cell / 2).attr('y', 12).attr('text-anchor', 'middle').text(narrow ? "'" + String(y).slice(2) : y); });
    rows.forEach((d, k) => {
      const y = 20 + k * rowH, max = narrow ? 18 : 36, lab = d.r.project.length > max ? d.r.project.slice(0, max - 1) + '…' : d.r.project;
      svg.append('text').attr('x', labW - 8).attr('y', y + rowH - 3).attr('text-anchor', 'end').attr('style', 'font-size:11px;fill:var(--lr-ink-2)').text(lab);
      d.v.forEach((x, i) => {
        const fill = x > 0 ? (d.rep[i] ? 'var(--lr-oil)' : 'var(--lr-geo)') : 'var(--lr-line)';
        svg.append('rect').attr('x', labW + i * cell + 1).attr('y', y + 1).attr('width', cell - 2).attr('height', rowH - 2).attr('rx', 1.5)
          .attr('style', `fill:${fill};opacity:${x > 0 ? (Y[i] === 2025 ? 0.5 : 1) : 0.6}`);
      });
      svg.append('rect').attr('x', 0).attr('y', y).attr('width', Wn).attr('height', rowH).attr('fill', 'transparent')
        .on('mousemove', (e) => {
          const [mx] = d3.pointer(e); const i = Math.floor((mx - labW) / cell);
          const yr = Y[i], x = i >= 0 && i < 30 ? d.v[i] : undefined;
          L.showTip(e, `<b>${L.esc(d.r.project)}</b><div class="k">${L.esc(d.r.country)} · ${L.esc(d.r.operator || '')}</div>` + (yr ? `<div class="row"><span class="k">${yr}</span><b>${x > 0 ? L.mt(x) + ' Mt' + (d.rep[i] ? ' · repeated' : '') : 'No value'}</b></div>` : ''));
        })
        .on('mouseleave', L.hideTip);
    });
  }
  $$('[data-qs]').forEach((b) => b.addEventListener('click', () => { rowsMode = b.dataset.qs; $$('[data-qs]').forEach((o) => o.setAttribute('aria-pressed', o === b)); coverage(); }));

  function draw() { stats(); if ($('#quality').hidden) return; awaitTable(); track(); coverage(); }
  window.LR_EXTRA = (page) => { if (page === 'quality') draw(); };
  dash.onData(draw);
})();
