/* Standalone runtime: provides the small `dash` data API the page uses, from data embedded in this file. */
(() => {
  const parseCSV = (text) => {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch !== '\r') cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    const cols = rows.shift();
    return { columns: cols, data: rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i] ?? '']))) };
  };
  const store = {};
  const reg = parseCSV(window.LR_DATA.register);
  store.register = { status: 'ok', data: reg.data, columns: reg.columns, meta: [] };
  store.reports = { status: 'ok', data: window.LR_DATA.reports, columns: Object.keys(window.LR_DATA.reports[0]), meta: [] };
  const cbs = [];
  window.dash = {
    data: (id) => store[id] || { status: 'missing', data: [], columns: [], meta: [] },
    calc: (id, o) => {
      try { const d = o.fn(...o.inputs.map((i) => store[i].data)); store[id] = { status: 'ok', data: d, columns: Array.isArray(d) && d[0] ? Object.keys(d[0]) : [], meta: [] }; }
      catch (e) { store[id] = { status: 'error', data: [], message: String(e), meta: [] }; console.error('calc ' + id, e); }
    },
    onData: (fn) => { cbs.push(fn); fn(); },
    setLink: (n) => { try { history.replaceState(null, '', '#' + n); } catch (e) {} },
    loader() {}, refresh() {}, params: () => ({}), setParams() {}, resetParams() {}, colors: [],
  };
  window.__dashRedraw = () => cbs.forEach((f) => f());
  let t; let lastW = window.innerWidth;
  addEventListener('resize', () => { if (window.innerWidth === lastW) return; lastW = window.innerWidth; clearTimeout(t); t = setTimeout(window.__dashRedraw, 150); });
})();
