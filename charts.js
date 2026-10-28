/* SVG-Diagramme: Plan (laut PDF) vs. Ist – für beliebig viele Wochen */
'use strict';
const CH = {};
const COL = { Z1: '#9dc4ee', Z2: '#6aa84f', Z3: '#f1c232', Z4: '#e69138', Z5: '#e00000', swim: '#3aa0ff', bike: '#ff8a2a', run: '#3ddc84', strength: '#ff4d6d', mob: '#b48cff', vol: '#9db8ff', qual: '#c084fc', race: '#fbbf24', q: '#c084fc', v: '#9db8ff' };
const CW_ = 360, CH_ = 240, ML = 36, MR = 12, MT = 14, MB = 40;
let CHN = 20; // Anzahl Wochen im aktuellen Diagramm
const setChartN = n => { CHN = n; };

function niceScale(min, max, ticks = 5) {
  if (max === min) max = min + 1;
  const raw = (max - min) / (ticks - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const t = []; for (let v = lo; v <= hi + step / 2; v += step) t.push(+v.toFixed(6));
  return { lo, hi, t };
}
const xLine = i => ML + (i / Math.max(1, CHN - 1)) * (CW_ - ML - MR);
const xBand = i => ML + ((i + 0.5) / CHN) * (CW_ - ML - MR);
const pathOf = (vals, xf, yf) => {
  let d = '', pen = false;
  vals.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${xf(i).toFixed(1)},${yf(v).toFixed(1)}`; pen = true; });
  return d;
};
const xTicks = () => { const t = [1]; for (let w = 5; w < CHN; w += 5) t.push(w); if (CHN - t[t.length - 1] >= 2) t.push(CHN); return [...new Set(t)]; };

function frame(id, sc, yFmt, xf) {
  const yf = v => CH_ - MB - ((v - sc.lo) / (sc.hi - sc.lo)) * (CH_ - MB - MT);
  let g = '';
  for (const t of sc.t) {
    const y = yf(t).toFixed(1);
    g += `<line class="grid" x1="${ML}" x2="${CW_ - MR}" y1="${y}" y2="${y}"/><text class="ax" x="${ML - 6}" y="${(+y + 3.5)}" text-anchor="end">${yFmt(t)}</text>`;
  }
  for (const w of xTicks()) g += `<text class="ax" x="${xf(w - 1).toFixed(1)}" y="${CH_ - MB + 16}" text-anchor="middle">${w}</text>`;
  g += `<text class="ax" x="${CW_ / 2}" y="${CH_ - 6}" text-anchor="middle" style="opacity:.55">Woche</text>`;
  return { g, yf };
}
const cwMarker = (cw, xf) => cw >= 1 && cw <= CHN ? `<line class="today" x1="${xf(cw - 1).toFixed(1)}" x2="${xf(cw - 1).toFixed(1)}" y1="${MT}" y2="${CH_ - MB}"/>` : '';
const ceilLine = (v, yf, label) => v ? `<line class="ceil" x1="${ML}" x2="${CW_ - MR}" y1="${yf(v).toFixed(1)}" y2="${yf(v).toFixed(1)}"/>${label ? `<text class="ax cl" x="${ML + 4}" y="${(yf(v) - 4).toFixed(1)}">${label}</text>` : ''}` : '';

/* Phasen-Hintergrund und Umfang-Rahmen (frames je Woche: [lo,hi] oder null) */
function bandsSvg(o, xf, half, yf) {
  let g = '';
  (o.bands || []).forEach((b, i) => {
    const x0 = xf(b.a - 1) - half, x1 = xf(b.b - 1) + half;
    if (i % 2 === 0) g += `<rect class="band" x="${x0.toFixed(1)}" y="${MT}" width="${(x1 - x0).toFixed(1)}" height="${CH_ - MB - MT}"/>`;
    g += `<text class="ax bl" x="${((x0 + x1) / 2).toFixed(1)}" y="${MT + 9}" text-anchor="middle">${b.label}</text>`;
  });
  if (o.frames && yf) {
    let start = null;
    const flush = (i) => { if (start === null) return; const f = o.frames[start], x0 = xf(start) - half, x1 = xf(i - 1) + half;
      g += `<line class="frame hi" x1="${x0.toFixed(1)}" x2="${x1.toFixed(1)}" y1="${yf(f[1]).toFixed(1)}" y2="${yf(f[1]).toFixed(1)}"/><line class="frame lo" x1="${x0.toFixed(1)}" x2="${x1.toFixed(1)}" y1="${yf(f[0]).toFixed(1)}" y2="${yf(f[0]).toFixed(1)}"/>`; start = null; };
    o.frames.forEach((f, i) => { const prev = start === null ? null : o.frames[start]; const same = f && prev && f[0] === prev[0] && f[1] === prev[1]; if (!same) { flush(i); if (f) start = i; } });
    flush(o.frames.length);
  }
  return g;
}
const frameMax = o => o.frames ? Math.max(0, ...o.frames.filter(Boolean).map(f => f[1])) : 0;

/* Liniendiagramm mit 1..n Serien {color,plan[],ist[]} */
function lineChart(id, series, o) {
  const all = []; series.forEach(s => { s.plan.forEach(v => all.push(v)); s.ist.forEach(v => v != null && all.push(v)); });
  if (o.ceiling) all.push(o.ceiling);
  if (o.frames) all.push(frameMax(o));
  const sc = niceScale(o.min != null ? Math.min(o.min, ...all) : Math.min(...all), Math.max(...all) + (o.bands ? (Math.max(...all) - (o.min || 0)) * 0.06 : 0), 5);
  const { g, yf } = frame(id, sc, o.yFmt, xLine);
  let body = g + bandsSvg(o, xLine, (xLine(1) - xLine(0)) / 2, yf) + cwMarker(o.cw, xLine) + ceilLine(o.ceiling, yf, o.ceilLabel);
  series.forEach(s => {
    body += `<path class="plan" d="${pathOf(s.plan, xLine, yf)}" stroke="${s.color}"/>`;
    s.plan.forEach((v, i) => body += `<circle class="pdot" cx="${xLine(i).toFixed(1)}" cy="${yf(v).toFixed(1)}" r="2" fill="${s.color}"/>`);
  });
  series.forEach(s => {
    const p = pathOf(s.ist, xLine, yf);
    if (p) body += `<path class="ist" pathLength="1" d="${p}" stroke="${s.color}"/>`;
    s.ist.forEach((v, i) => { if (v != null) body += `<circle class="idot" style="animation-delay:${0.5 + i * 0.05}s" cx="${xLine(i).toFixed(1)}" cy="${yf(v).toFixed(1)}" r="3.6" fill="${s.color}"/>`; });
  });
  CH[id] = { xf: xLine, n: CHN, tip: i => o.tip(i), band: false };
  return wrap(id, body);
}

/* gestapelte Balken: Plan (breit, transparent) + Ist (schmal, voll). keys/colors frei wählbar. */
function stackChart(id, planRows, istRows, o) {
  const keys = o.keys, colors = o.colors || COL;
  const tot = d => keys.reduce((a, k) => a + (d ? (d[k] || 0) : 0), 0);
  const maxV = Math.max(...planRows.map(tot), ...istRows.map(d => d ? tot(d) : 0), o.ceiling || 0);
  const sc = niceScale(0, maxV * (o.bands ? 1.08 : 1), 5);
  const { g, yf } = frame(id, sc, o.yFmt || (v => v), xBand);
  const bw = (CW_ - ML - MR) / CHN;
  let body = g + bandsSvg(o, xBand, bw / 2, yf) + cwMarker(o.cw, xBand) + ceilLine(o.ceiling, yf, o.ceilLabel);
  (o.vmarks || []).forEach(m => {
    const x = xBand(m.i) - bw / 2;
    body += `<line class="vmark" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${MT}" y2="${CH_ - MB}"/><text class="ax vl" text-anchor="end" x="${(x - 4).toFixed(1)}" y="${MT + 10}">${m.label}</text>`;
  });
  planRows.forEach((d, i) => {
    let acc = 0; const x = xBand(i) - bw * 0.42, w = bw * 0.84;
    keys.forEach(k => { const v = d[k]; if (!v) return; const y1 = yf(acc + v), y0 = yf(acc); acc += v;
      body += `<rect class="pbar" x="${x.toFixed(1)}" y="${y1.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0, y0 - y1).toFixed(1)}" fill="${colors[k]}" stroke="${colors[k]}"/>`; });
  });
  istRows.forEach((d, i) => {
    if (!d) return; let acc = 0; const x = xBand(i) - bw * 0.26, w = bw * 0.52;
    keys.forEach(k => { const v = d[k]; if (!v) return; const y1 = yf(acc + v), y0 = yf(acc); acc += v;
      body += `<rect class="ibar" style="animation-delay:${0.15 + i * 0.04}s" x="${x.toFixed(1)}" y="${y1.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0, y0 - y1).toFixed(1)}" fill="${colors[k]}"/>`; });
  });
  CH[id] = { xf: xBand, n: CHN, tip: i => o.tip(i), band: true };
  return wrap(id, body);
}

function wrap(id, body) {
  return `<div class="chart" data-cid="${id}"><svg viewBox="0 0 ${CW_} ${CH_}" role="img" aria-label="Diagramm">${body}<line class="xh" y1="${MT}" y2="${CH_ - MB}" x1="-10" x2="-10"/></svg><div class="tip"></div></div>`;
}

function initCharts(root) {
  $$('.chart', root).forEach(el => {
    const cfg = CH[el.dataset.cid]; if (!cfg) return;
    const svg = $('svg', el), tip = $('.tip', el), xh = $('.xh', el);
    const show = ev => {
      const r = svg.getBoundingClientRect();
      const px = (ev.clientX - r.left) / r.width * CW_;
      let best = 0, bd = 1e9;
      for (let i = 0; i < cfg.n; i++) { const d = Math.abs(cfg.xf(i) - px); if (d < bd) { bd = d; best = i; } }
      const x = cfg.xf(best);
      xh.setAttribute('x1', x); xh.setAttribute('x2', x); xh.style.opacity = 1;
      tip.innerHTML = cfg.tip(best); tip.classList.add('on');
      const left = x / CW_ * r.width;
      tip.style.left = clamp(left, 90, r.width - 90) + 'px';
    };
    el.addEventListener('pointerdown', show);
    el.addEventListener('pointermove', ev => { if (ev.pointerType === 'mouse' || ev.buttons) show(ev); });
    el.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse') { tip.classList.remove('on'); xh.style.opacity = 0; } });
  });
}
