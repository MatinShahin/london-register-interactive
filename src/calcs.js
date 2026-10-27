dash.calc('annual', {
  inputs: ['register'],
  title: 'Annual storage by type',
  description: 'For each year 1996–2025: Mt stored by storage type, the total, the running total, projects reporting, and the shares held by oil recovery and by the five largest projects.',
  fn: (register) => {
    const years = [];
    for (let y = 1996; y <= 2025; y++) years.push(String(y));
    let running = 0;
    return years.map((y) => {
      const vals = register.map((r) => ({ v: Number(r[y]) || 0, oil: /oil/i.test(r.storage_type) }));
      const geological = vals.filter((d) => !d.oil).reduce((s, d) => s + d.v, 0);
      const oil_recovery = vals.filter((d) => d.oil).reduce((s, d) => s + d.v, 0);
      const total = geological + oil_recovery;
      running += total;
      const top5 = vals.map((d) => d.v).sort((a, b) => b - a).slice(0, 5).reduce((s, v) => s + v, 0);
      return {
        year: Number(y),
        geological: Math.round(geological * 1000) / 1000,
        oil_recovery: Math.round(oil_recovery * 1000) / 1000,
        total: Math.round(total * 1000) / 1000,
        cumulative: Math.round(running * 1000) / 1000,
        projects: vals.filter((d) => d.v > 0).length,
        oil_recovery_share_pct: total ? Math.round(oil_recovery / total * 1000) / 10 : null,
        top5_share_pct: total ? Math.round(top5 / total * 1000) / 10 : null,
        complete: y !== '2025',
      };
    });
  },
});

dash.calc('annual_country', {
  inputs: ['register'],
  title: 'Annual storage by country',
  description: 'Mt stored per year for the six largest countries, with all others grouped as Other.',
  fn: (register) => {
    const named = ['USA', 'Brazil', 'Canada', 'Norway', 'Australia', 'China'];
    const out = [];
    for (let y = 1996; y <= 2025; y++) {
      const row = { year: y };
      named.concat('Other').forEach((k) => (row[k] = 0));
      register.forEach((r) => {
        const k = named.includes(r.country) ? r.country : 'Other';
        row[k] += Number(r[String(y)]) || 0;
      });
      named.concat('Other').forEach((k) => (row[k] = Math.round(row[k] * 1000) / 1000));
      out.push(row);
    }
    return out;
  },
});

dash.calc('annual_cohort', {
  inputs: ['register'],
  title: 'Annual storage by start cohort',
  description: 'Mt stored per year, grouped by the first year each project reported storage above zero.',
  fn: (register) => {
    const cohorts = [['1996–2004', 1996, 2004], ['2005–2014', 2005, 2014], ['2015–2019', 2015, 2019], ['2020 onwards', 2020, 2025]];
    const firstOf = (r) => { for (let y = 1996; y <= 2025; y++) if ((Number(r[String(y)]) || 0) > 0) return y; return null; };
    const tagged = register.map((r) => { const f = firstOf(r); const c = f == null ? null : cohorts.find((c) => f >= c[1] && f <= c[2]); return { r, k: c ? c[0] : null }; });
    const out = [];
    for (let y = 1996; y <= 2025; y++) {
      const row = { year: y };
      cohorts.forEach((c) => (row[c[0]] = 0));
      tagged.forEach(({ r, k }) => { if (k) row[k] += Number(r[String(y)]) || 0; });
      cohorts.forEach((c) => (row[c[0]] = Math.round(row[c[0]] * 1000) / 1000));
      out.push(row);
    }
    return out;
  },
});

dash.calc('kpis', {
  inputs: ['annual'],
  title: 'Headline figures',
  description: 'Cumulative storage to 2025, the 2024 and 2025 totals, the change from 2023 to 2024, and projects reporting in 2024.',
  fn: (annual) => {
    const at = (y) => annual.find((r) => r.year === y);
    const a24 = at(2024), a23 = at(2023), a25 = at(2025);
    return [{
      cumulative_mt: Math.round(a25.cumulative * 10) / 10,
      total_2024_mt: Math.round(a24.total * 10) / 10,
      total_2023_mt: Math.round(a23.total * 10) / 10,
      change_2024_pct: Math.round((a24.total / a23.total - 1) * 1000) / 10,
      total_2025_mt: Math.round(a25.total * 10) / 10,
      projects_2024: a24.projects,
      projects_2023: a23.projects,
    }];
  },
});

dash.calc('countries', {
  inputs: ['register'],
  title: 'Cumulative storage by country',
  description: 'Mt stored 1996–2025 per country, split by storage type, with the number of projects.',
  fn: (register) => {
    const by = {};
    register.forEach((r) => {
      let s = 0;
      for (let y = 1996; y <= 2025; y++) s += Number(r[String(y)]) || 0;
      const o = (by[r.country] = by[r.country] || { country: r.country, projects: 0, geological: 0, oil_recovery: 0 });
      o.projects += 1;
      if (/oil/i.test(r.storage_type)) o.oil_recovery += s; else o.geological += s;
    });
    return Object.values(by).map((o) => ({
      country: o.country, projects: o.projects,
      geological: Math.round(o.geological * 100) / 100,
      oil_recovery: Math.round(o.oil_recovery * 100) / 100,
      cumulative: Math.round((o.geological + o.oil_recovery) * 100) / 100,
    })).sort((a, b) => b.cumulative - a.cumulative);
  },
});

dash.calc('countries_2024', {
  inputs: ['register'],
  title: 'Countries reporting in 2024',
  description: 'How many countries had at least one project reporting storage in 2024.',
  fn: (register) => [{ countries_2024: new Set(register.filter((r) => (Number(r['2024']) || 0) > 0).map((r) => r.country)).size }],
});

dash.calc('projects', {
  inputs: ['register'],
  title: 'Project summary',
  description: 'One row per project: first and last reporting year, peak, 2024 rate, cumulative Mt, share of all storage, reporting status, start cohort, and the longest run of identical consecutive values.',
  fn: (register) => {
    const all = register.reduce((s, r) => { for (let y = 1996; y <= 2025; y++) s += Number(r[String(y)]) || 0; return s; }, 0);
    const cohorts = [['1996–2004', 1996, 2004], ['2005–2014', 2005, 2014], ['2015–2019', 2015, 2019], ['2020 onwards', 2020, 2025]];
    return register.map((r) => {
      const v = []; for (let y = 1996; y <= 2025; y++) v.push(r[String(y)] === '' ? null : Number(r[String(y)]));
      const idx = v.map((x, i) => (x > 0 ? i : -1)).filter((i) => i >= 0);
      const cum = v.reduce((s, x) => s + (x || 0), 0);
      const peak = Math.max(0, ...v.map((x) => x || 0));
      let best = 1, run = 1;
      for (let i = 1; i < v.length; i++) { if (v[i] > 0 && v[i] === v[i - 1]) { run++; best = Math.max(best, run); } else run = 1; }
      const first = idx.length ? 1996 + idx[0] : null;
      const c = first == null ? null : cohorts.find((c) => first >= c[1] && first <= c[2]);
      return {
        project: r.project, operator: r.operator, country: r.country, storage_type: r.storage_type,
        first_year: first, last_year: idx.length ? 1996 + idx[idx.length - 1] : null,
        years_reporting: idx.length,
        peak_year: peak > 0 ? 1996 + v.findIndex((x) => (x || 0) === peak) : null,
        peak_mt: Math.round(peak * 1000) / 1000,
        mt_2024: Math.round((v[28] || 0) * 1000) / 1000,
        cumulative: Math.round(cum * 100) / 100,
        share_pct: Math.round(cum / all * 1000) / 10,
        status: (v[28] || 0) > 0 || (v[29] || 0) > 0 ? 'Reporting' : 'No 2024–25 data',
        cohort: c ? c[0] : null,
        repeated_run: best,
      };
    });
  },
});

dash.calc('findings', {
  inputs: ['annual', 'annual_cohort', 'projects'],
  title: 'Key findings for 2024',
  description: 'Ten-year growth rate, oil-recovery share, top-five concentration and the start-cohort split of 2024 storage.',
  fn: (annual, annual_cohort, projects) => {
    const a24 = annual.find((r) => r.year === 2024), a14 = annual.find((r) => r.year === 2014);
    const c24 = annual_cohort.find((r) => r.year === 2024);
    const keys = Object.keys(c24).filter((k) => k !== 'year');
    const topCohort = keys.slice().sort((a, b) => c24[b] - c24[a])[0];
    const lead = projects.slice().sort((a, b) => b.mt_2024 - a.mt_2024)[0];
    return [{
      cagr_10y_pct: Math.round((Math.pow(a24.total / a14.total, 1 / 10) - 1) * 1000) / 10,
      oil_recovery_share_2024_pct: Math.round(a24.oil_recovery_share_pct),
      geological_2024_mt: Math.round(a24.geological * 10) / 10,
      top5_share_2024_pct: Math.round(a24.top5_share_pct),
      lead_project_2024: lead.project,
      lead_project_2024_mt: Math.round(lead.mt_2024 * 10) / 10,
      top_cohort_2024: topCohort,
      top_cohort_share_pct: Math.round(c24[topCohort] / a24.total * 100),
      cohort_2020_share_pct: Math.round(c24['2020 onwards'] / a24.total * 100),
      repeated_projects: projects.filter((p) => p.repeated_run >= 4).length,
      project_count: projects.length,
    }];
  },
});

dash.calc('changes', {
  inputs: ['register'],
  title: 'Year-on-year change by project',
  description: 'For each year 1997–2025, every project whose stored amount changed from the year before, with both values and the change in Mt.',
  fn: (register) => {
    const out = [];
    for (let y = 1997; y <= 2025; y++) {
      register.forEach((r) => {
        const prev = Number(r[String(y - 1)]) || 0, cur = Number(r[String(y)]) || 0;
        if (Math.abs(cur - prev) > 1e-9) out.push({ year: y, project: r.project, country: r.country, storage_type: r.storage_type, previous: prev, current: cur, change: Math.round((cur - prev) * 1000) / 1000 });
      });
    }
    return out;
  },
});

dash.calc('change_summary', {
  inputs: ['register', 'annual'],
  title: 'Year-on-year summary',
  description: 'For each year 1997–2025: the previous and current totals, the change, and counts of projects that rose, fell, began or stopped reporting.',
  fn: (register, annual) => {
    const out = [];
    for (let y = 1997; y <= 2025; y++) {
      const t0 = annual.find((r) => r.year === y - 1).total, t1 = annual.find((r) => r.year === y).total;
      let up = 0, down = 0, began = 0, stopped = 0;
      register.forEach((r) => {
        const p = Number(r[String(y - 1)]) || 0, c = Number(r[String(y)]) || 0;
        if (c > p) up++; if (c < p) down++;
        if (p > 0 && !(c > 0)) stopped++;
        let first = null; for (let k = 1996; k <= 2025; k++) if ((Number(r[String(k)]) || 0) > 0) { first = k; break; }
        if (first === y) began++;
      });
      out.push({ year: y, previous_total: Math.round(t0 * 100) / 100, total: Math.round(t1 * 100) / 100, change: Math.round((t1 - t0) * 100) / 100, change_pct: Math.round((t1 / t0 - 1) * 1000) / 10, increased: up, decreased: down, began: began, stopped: stopped });
    }
    return out;
  },
});

dash.calc('shares', {
  inputs: ['register', 'annual'],
  title: 'Share of each year by project',
  description: 'For each year, every project with storage above zero, its Mt and its share of that year’s total.',
  fn: (register, annual) => {
    const out = [];
    for (let y = 1996; y <= 2025; y++) {
      const t = annual.find((r) => r.year === y).total;
      register.forEach((r) => {
        const v = Number(r[String(y)]) || 0;
        if (v > 0) out.push({ year: y, project: r.project, country: r.country, storage_type: r.storage_type, mt: v, share_pct: Math.round(v / t * 10000) / 100 });
      });
    }
    return out;
  },
});

dash.calc('growth', {
  inputs: ['annual'],
  title: 'Exponential growth fit',
  description: 'Least-squares line through the natural log of annual totals for 2005–2024, giving the annual growth rate, R² and doubling time.',
  fn: (annual) => {
    const pts = annual.filter((r) => r.year >= 2005 && r.year <= 2024).map((r) => [r.year - 2005, Math.log(r.total)]);
    const n = pts.length, mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
    const b = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
    const a = my - b * mx;
    const r2 = 1 - pts.reduce((s, p) => s + (p[1] - (a + b * p[0])) ** 2, 0) / pts.reduce((s, p) => s + (p[1] - my) ** 2, 0);
    return [{ rate_pct: Math.round((Math.exp(b) - 1) * 1000) / 10, r2: Math.round(r2 * 100) / 100, doubling_years: Math.round(Math.log(2) / b * 10) / 10, intercept: a, slope: b, base_2024_mt: annual.find((r) => r.year === 2024).total }];
  },
});

dash.calc('scenarios', {
  inputs: ['annual'],
  title: 'Growth scenarios to 2050',
  description: 'For growth rates from 4% to 35% a year applied to the 2024 total: the year annual storage reaches 1 Gt and the annual rate in 2050.',
  fn: (annual) => {
    const base = annual.find((r) => r.year === 2024).total, out = [];
    for (let g = 4; g <= 35.001; g += 0.5) {
      const r = g / 100;
      out.push({ rate_pct: Math.round(g * 10) / 10, gt_year: Math.ceil(2024 + Math.log(1000 / base) / Math.log(1 + r)), rate_2050_mt: Math.round(base * Math.pow(1 + r, 26)) });
    }
    return out;
  },
});

dash.calc('completeness', {
  inputs: ['register'],
  title: '2025 reporting progress',
  description: 'Of the projects that reported storage for 2024, how many have reported 2025; the 2024 storage still awaiting a 2025 report; the like-for-like change for projects that reported both years; and an illustrative 2025 total that carries 2024 values forward for projects not yet reported.',
  fn: (register) => {
    const v = (r, y) => Number(r[String(y)]) || 0;
    const rep24 = register.filter((r) => v(r, 2024) > 0);
    const both = rep24.filter((r) => v(r, 2025) > 0);
    const waiting = rep24.filter((r) => !(v(r, 2025) > 0));
    const sum = (a, y) => a.reduce((s, r) => s + v(r, y), 0);
    const t24 = sum(rep24, 2024), w24 = sum(waiting, 2024), b24 = sum(both, 2024), b25 = sum(both, 2025);
    const t25 = register.reduce((s, r) => s + v(r, 2025), 0);
    const isNew = (r) => { for (let y = 1996; y <= 2024; y++) if (v(r, y) > 0) return false; return v(r, 2025) > 0; };
    const fresh = register.filter(isNew);
    return [{
      reported_2024: rep24.length,
      reported_both: both.length,
      awaiting: waiting.length,
      awaiting_mt: Math.round(w24 * 10) / 10,
      awaiting_share_pct: Math.round(w24 / t24 * 1000) / 10,
      like_2024_mt: Math.round(b24 * 10) / 10,
      like_2025_mt: Math.round(b25 * 10) / 10,
      like_change_pct: Math.round((b25 / b24 - 1) * 1000) / 10,
      new_2025: fresh.length,
      new_2025_mt: Math.round(fresh.reduce((s, r) => s + v(r, 2025), 0) * 1000) / 1000,
      reported_2025_mt: Math.round(t25 * 10) / 10,
      carry_forward_2025_mt: Math.round((t25 + w24) * 10) / 10,
    }];
  },
});

dash.calc('awaiting_2025', {
  inputs: ['register'],
  title: 'Projects awaiting a 2025 report',
  description: 'Projects that reported storage for 2024 but not yet for 2025, with their 2024 amount.',
  fn: (register) => register
    .filter((r) => (Number(r['2024']) || 0) > 0 && !((Number(r['2025']) || 0) > 0))
    .map((r) => ({ project: r.project, country: r.country, storage_type: r.storage_type, mt_2024: Number(r['2024']) }))
    .sort((a, b) => b.mt_2024 - a.mt_2024),
});

dash.calc('quality', {
  inputs: ['register'],
  title: 'Repeated reported values',
  description: 'Share of all reported storage, and of reported project-years, that sits in runs of four or more identical consecutive annual values, which usually indicates averaged or estimated reporting.',
  fn: (register) => {
    let tot = 0, rep = 0, cells = 0, repCells = 0;
    const projects = new Set();
    register.forEach((r) => {
      const v = []; for (let y = 1996; y <= 2025; y++) v.push(Number(r[String(y)]) || 0);
      let i = 0;
      while (i < v.length) {
        if (v[i] > 0) {
          let j = i; while (j + 1 < v.length && v[j + 1] === v[i]) j++;
          const L = j - i + 1; tot += v[i] * L; cells += L;
          if (L >= 4) { rep += v[i] * L; repCells += L; projects.add(r.project); }
          i = j + 1;
        } else i++;
      }
    });
    return [{ repeated_share_pct: Math.round(rep / tot * 1000) / 10, repeated_mt: Math.round(rep * 10) / 10, repeated_cells: repCells, reported_cells: cells, repeated_projects: projects.size }];
  },
});
