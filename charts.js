/* SVG-Diagramme: Plan (laut PDF) vs. Ist */
'use strict';
const CH = {};
const COL = { swim: '#3aa0ff', bike: '#ff8a2a', run: '#3ddc84', strength: '#ff4d6d', vol: '#9db8ff', qual: '#c084fc', race: '#fbbf24' };
const CW_ = 360, CH_ = 240, ML = 36, MR = 12, MT = 14, MB = 40;

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
const xLine = i => ML + (i / 19) * (CW_ - ML - MR);
const xBand = i => ML + ((i + 0.5) / 20) * (CW_ - ML - MR);
const pathOf = (vals, xf, yf) => {
  let d = '', pen = false;
  vals.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${xf(i).toFixed(1)},${yf(v).toFixed(1)}`; pen = true; });
  return d;
};

function frame(id, sc, yFmt, xf, bandMode) {
  const yf = v => CH_ - MB - ((v - sc.lo) / (sc.hi - sc.lo)) * (CH_ - MB - MT);
  let g = '';
  for (const t of sc.t) {
    const y = yf(t).toFixed(1);
    g += `<line class="grid" x1="${ML}" x2="${CW_ - MR}" y1="${y}" y2="${y}"/><text class="ax" x="${ML - 6}" y="${(+y + 3.5)}" text-anchor="end">${yFmt(t)}</text>`;
  }
  for (const w of [1, 5, 10, 15, 20]) g += `<text class="ax" x="${xf(w - 1).toFixed(1)}" y="${CH_ - MB + 16}" text-anchor="middle">${w}</text>`;
  g += `<text class="ax" x="${CW_ / 2}" y="${CH_ - 6}" text-anchor="middle" style="opacity:.55">Woche</text>`;
  return { g, yf };
}
const cwMarker = (cw, xf) => cw >= 1 && cw <= 20 ? `<line class="today" x1="${xf(cw - 1).toFixed(1)}" x2="${xf(cw - 1).toFixed(1)}" y1="${MT}" y2="${CH_ - MB}"/>` : '';

/* Liniendiagramm mit 1..n Serien {label,color,plan[],ist[]} */
function lineChart(id, series, o) {
  const all = []; series.forEach(s => { s.plan.forEach(v => all.push(v)); s.ist.forEach(v => v != null && all.push(v)); });
  const sc = niceScale(o.min != null ? Math.min(o.min, ...all) : Math.min(...all), Math.max(...all), 5);
  const { g, yf } = frame(id, sc, o.yFmt, xLine, false);
  let body = g + cwMarker(o.cw, xLine);
  if (o.ceiling) body += `<line class="ceil" x1="${ML}" x2="${CW_ - MR}" y1="${yf(o.ceiling).toFixed(1)}" y2="${yf(o.ceiling).toFixed(1)}"/>`;
  series.forEach(s => {
    body += `<path class="plan" d="${pathOf(s.plan, xLine, yf)}" stroke="${s.color}"/>`;
    s.plan.forEach((v, i) => body += `<circle class="pdot" cx="${xLine(i).toFixed(1)}" cy="${yf(v).toFixed(1)}" r="2" fill="${s.color}"/>`);
  });
  series.forEach(s => {
    const p = pathOf(s.ist, xLine, yf);
    if (p) body += `<path class="ist" pathLength="1" d="${p}" stroke="${s.color}"/>`;
    s.ist.forEach((v, i) => { if (v != null) body += `<circle class="idot" style="animation-delay:${0.5 + i * 0.05}s" cx="${xLine(i).toFixed(1)}" cy="${yf(v).toFixed(1)}" r="3.6" fill="${s.color}"/>`; });
  });
  CH[id] = { xf: xLine, n: 20, tip: i => o.tip(i), band: false };
  return wrap(id, body, series);
}

/* gestapelte Balken: Plan (breit, transparent) + Ist (schmal, voll) */
function stackChart(id, planDisc, istDisc, o) {
  const keys = ['swim', 'bike', 'run', 'strength'];
  const tot = d => keys.reduce((a, k) => a + (d ? d[k] : 0), 0);
  const maxV = Math.max(...planDisc.map(tot), ...istDisc.map(d => d ? tot(d) : 0));
  const sc = niceScale(0, maxV, 5);
  const { g, yf } = frame(id, sc, v => v, xBand, true);
  const bw = (CW_ - ML - MR) / 20;
  let body = g + cwMarker(o.cw, xBand);
  planDisc.forEach((d, i) => {
    let acc = 0; const x = xBand(i) - bw * 0.42, w = bw * 0.84;
    keys.forEach(k => { const v = d[k]; if (!v) return; const y1 = yf(acc + v), y0 = yf(acc); acc += v;
      body += `<rect class="pbar" x="${x.toFixed(1)}" y="${y1.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0, y0 - y1).toFixed(1)}" fill="${COL[k]}" stroke="${COL[k]}"/>`; });
  });
  istDisc.forEach((d, i) => {
    if (!d) return; let acc = 0; const x = xBand(i) - bw * 0.26, w = bw * 0.52;
    keys.forEach(k => { const v = d[k]; if (!v) return; const y1 = yf(acc + v), y0 = yf(acc); acc += v;
      body += `<rect class="ibar" style="animation-delay:${0.15 + i * 0.04}s" x="${x.toFixed(1)}" y="${y1.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0, y0 - y1).toFixed(1)}" fill="${COL[k]}"/>`; });
  });
  CH[id] = { xf: xBand, n: 20, tip: i => o.tip(i), band: true };
  return wrap(id, body, null);
}

function wrap(id, body, series) {
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

