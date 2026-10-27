/* Standalone edition: theme switch, figure and table downloads. Not used inside the dashboard. */
(() => {
  const $ = (s) => document.querySelector(s), $$ = (s) => Array.from(document.querySelectorAll(s));
  const html = document.documentElement;
  // theme
  const btn = document.createElement('button'); btn.className = 'lr-theme'; btn.type = 'button';
  const setTheme = (dark) => { html.classList.toggle('dark', dark); btn.textContent = dark ? 'Light theme' : 'Dark theme'; btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme'); try { localStorage.setItem('lr-theme', dark ? 'dark' : 'light'); } catch (e) {} window.__dashRedraw && window.__dashRedraw(); };
  $('.lr-brand').appendChild(btn);
  let saved = null; try { saved = localStorage.getItem('lr-theme'); } catch (e) {}
  setTheme(saved === 'dark');
  btn.addEventListener('click', () => setTheme(!html.classList.contains('dark')));

  const save = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // PNG export of a figure: chart svg with resolved colours, plus title and source
  function figurePng(card) {
    const svg = card.querySelector('.lr-chart svg'); if (!svg) return;
    const title = (card.querySelector('.lr-figure__no')?.textContent || '') + ' · ' + (card.querySelector('.lr-figure__title')?.textContent || '');
    const src = card.querySelector('.lr-figure__src')?.textContent || 'Source: The London Register of Subsurface CO2 Storage (2026).';
    const clone = svg.cloneNode(true), orig = svg.querySelectorAll('*'), copy = clone.querySelectorAll('*');
    orig.forEach((el, i) => { const cs = getComputedStyle(el), c = copy[i];
      ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'font-size', 'font-weight', 'font-family'].forEach((p) => c.style.setProperty(p, cs.getPropertyValue(p))); c.removeAttribute('class'); });
    const vb = svg.viewBox.baseVal, w = vb && vb.width ? vb.width : svg.clientWidth, h = vb && vb.height ? vb.height : svg.clientHeight;
    clone.setAttribute('width', w); clone.setAttribute('height', h); clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const legend = Array.from(card.querySelectorAll('.lr-figure__legend span')).map((s) => { const i = s.querySelector('i'), cs = getComputedStyle(i || s); return { t: s.textContent.trim(), c: cs.backgroundColor, b: cs.borderTopStyle === 'dashed' ? cs.borderTopColor : null }; });
    const css = getComputedStyle(card), bg = css.backgroundColor, fg = getComputedStyle($('.lr')).color, muted = getComputedStyle($('.lr-figure__sub') || card).color;
    const img = new Image(), scale = 2, pad = 28, headH = 46, legH = legend.length ? 30 : 0, footH = 34;
    img.onload = () => {
      const W = w + pad * 2, H = headH + h + legH + footH + pad;
      const cv = document.createElement('canvas'); cv.width = W * scale; cv.height = H * scale;
      const g = cv.getContext('2d'); g.scale(scale, scale); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.fillStyle = fg; g.font = '600 16px Geist, system-ui, sans-serif'; g.fillText(title, pad, pad + 6);
      g.drawImage(img, pad, headH, w, h);
      let x = pad; g.font = '13px Geist, system-ui, sans-serif';
      legend.forEach((l) => { if (l.b) { g.strokeStyle = l.b; g.setLineDash([2, 2]); g.strokeRect(x + .5, headH + h + 12.5, 9, 9); g.setLineDash([]); } else { g.fillStyle = l.c; g.fillRect(x, headH + h + 12, 10, 10); } g.fillStyle = fg; g.fillText(l.t, x + 16, headH + h + 21); x += 30 + g.measureText(l.t).width; });
      g.fillStyle = muted; g.font = '12px Geist, system-ui, sans-serif'; g.fillText(src.length > 160 ? src.slice(0, 157) + '…' : src, pad, H - pad / 2 - 4);
      g.fillText('London Register interactive edition · Matin Shahin', W - pad - g.measureText('London Register interactive edition · Matin Shahin').width, pad + 6);
      cv.toBlob((b) => save(b, slug(title) + '.png'), 'image/png');
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  }
  function addPngButtons() {
    $$('.lr-figure').forEach((card) => {
      if (!card.querySelector('.lr-chart') || card.querySelector('.lr-dl-btn')) return;
      const head = card.querySelector('.lr-figure__head'); if (!head) return;
      let ctls = head.querySelector('.lr-ctls, .lr-step'); if (!ctls) { ctls = document.createElement('div'); ctls.className = 'lr-ctls'; head.appendChild(ctls); }
      const b = document.createElement('button'); b.className = 'lr-dl-btn'; b.type = 'button'; b.textContent = 'PNG'; b.title = 'Download this figure as an image'; b.setAttribute('aria-label', 'Download figure as PNG');
      b.addEventListener('click', () => figurePng(card)); ctls.appendChild(b);
    });
  }
  // CSV downloads
  const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  function addCsv(where, label, name, rowsFn) {
    const host = $(where); if (!host) return;
    const b = document.createElement('button'); b.className = 'lr-dl-btn'; b.type = 'button'; b.textContent = label;
    b.addEventListener('click', () => { const rows = rowsFn(); save(new Blob(['﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv' }), name); });
    host.appendChild(b);
  }
  const reg = () => dash.data('register').data, cols = () => dash.data('register').columns;
  addCsv('#table-card .lr-ctls', 'Download CSV', 'london-register-2026.csv', () => { const c = $('#tc').value, C = cols(); return [C, ...reg().filter((r) => !c || r.country === c).map((r) => C.map((k) => r[k]))]; });
  const pctl = document.createElement('div'); pctl.className = 'lr-ctls'; pctl.style.justifyContent = 'flex-end';
  $('#projects .lr-filters').appendChild(pctl); pctl.id = 'pdl';
  addCsv('#pdl', 'Download project summary', 'london-register-projects.csv', () => { const P = dash.data('projects').data, C = Object.keys(P[0]); return [C, ...P.map((r) => C.map((k) => r[k]))]; });
  addPngButtons();
})();
