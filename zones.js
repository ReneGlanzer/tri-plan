/* Zonenberechnung: FTP -> Watt, CSS -> Pace/100 m, Garmin-HF-Zonen, Lauf-RPE */
'use strict';

const BIKE_ZONES = [
  { key: 'z2', name: 'Easy / Z2', lo: 56, hi: 75 },
  { key: 'tempo', name: 'Tempo', lo: 76, hi: 87 },
  { key: 'ss', name: 'Sweetspot', lo: 88, hi: 94 },
  { key: 'thr', name: 'Threshold', lo: 95, hi: 103 },
  { key: 'vo2', name: 'VO2', lo: 106, hi: 120 },
  { key: 'race', name: '70.3-Power', lo: 78, hi: 83 }
];
const SWIM_ZONES = [
  { key: 'tech', name: 'Technik / aerobic', a: 7, b: 20 },
  { key: 'race', name: 'Racepace', a: 3, b: 7 },
  { key: 'thr', name: 'Schwelle (≈ CSS)', a: 0, b: 2 },
  { key: 'fast', name: 'Schnelle Reps', a: -6, b: 0 }
];
/* Lauf-RPE -> Garmin-HF-Zonen (Richtwert; laut Plan haben HF/RPE Vorrang vor Pace) */
const RPE_ZONES = { 1: [1, 1], 2: [1, 2], 3: [2, 2], 4: [2, 3], 5: [3, 3], 6: [3, 4], 7: [4, 4], 8: [4, 5], 9: [5, 5], 10: [5, 5] };
const RUN_LEVELS = [
  { key: 'easy', name: 'Easy (RPE 2–3)', rpe: [2, 3], f: [1.22, 1.35] },
  { key: 'aer', name: 'Aerobic (RPE 3–4)', rpe: [3, 4], f: [1.12, 1.22] },
  { key: 'race', name: '70.3-Effort (RPE 5–6)', rpe: [5, 6], f: [1.04, 1.10] },
  { key: 'thr', name: 'Threshold (RPE 7–8)', rpe: [7, 8], f: [0.99, 1.03] }
];

const Zn = {
  /* wirksame Zonen für ein Datum (Historie, prospektiv) */
  at(state, dateIso) {
    const h = state.zoneHistory || [];
    let best = h[0];
    for (const e of h) if (e.date <= dateIso) best = e;
    return best ? best.z : state.zones;
  },
  watts(z, pct) { return Math.round(z.ftp * pct / 100); },
  bike(z) { return BIKE_ZONES.map(b => ({ ...b, wlo: Zn.watts(z, b.lo), whi: Zn.watts(z, b.hi) })); },
  swim(z) { return SWIM_ZONES.map(s => ({ ...s, plo: z.css + Math.min(s.a, s.b), phi: z.css + Math.max(s.a, s.b) })); },
  hrZone(z, i) { return z.hr[i - 1]; },
  hrRange(z, a, b) { const lo = z.hr[Math.min(a, b) - 1][0], hi = z.hr[Math.max(a, b) - 1][1]; return [lo, hi]; },
  rpeHr(z, a, b) {
    const ra = RPE_ZONES[clamp(a, 1, 10)], rb = RPE_ZONES[clamp(b ?? a, 1, 10)];
    return Zn.hrRange(z, Math.min(ra[0], rb[0]), Math.max(ra[1], rb[1]));
  },
  run(z) {
    return RUN_LEVELS.map(l => {
      const hr = Zn.rpeHr(z, l.rpe[0], l.rpe[1]);
      const o = { ...l, hr };
      if (z.runThr) { o.plo = z.runThr * l.f[0]; o.phi = z.runThr * l.f[1]; }
      return o;
    });
  },
  cssFromTests(t400, t200) { return (t400 - t200) / 2; } // s pro 100 m
};

const rng = (a, b, unit = '') => a === b ? `${a}${unit}` : `${a}–${b}${unit}`;
const paceRange = (a, b) => `${fmtMMSS(Math.min(a, b))}–${fmtMMSS(Math.max(a, b))}/100 m`;
const runPaceRange = (a, b) => `${fmtMMSS(Math.min(a, b))}–${fmtMMSS(Math.max(a, b))}/km`;

/* Text 1:1 anzeigen und Kennzahlen (Watt / Pace / HF) direkt dahinter einblenden */
function enrich(text, disc, z, opt = {}) {
  const lower = !!opt.lower;
  const re = /(\d{2,3})(?:\s?-\s?(\d{2,3}))?\s?%\s?FTP|CSS\s?([+\-])\s?(\d+)(?:\s?-\s?(\d+))?\s?s\b|\bZ([1-5])(?:-Z([1-5]))?\b|\bRPE\s?(\d{1,2})(?:\s?-\s?(\d{1,2}))?|\b(?:validated )?(?:race|70\.3) power\b|\b70\.3[ -](?:swim effort|Schwimmeffort|pace)\b|\brace pace\b/gi;
  let out = '', last = 0, m;
  const calc = s => ` <span class="calc">${s}</span>`;
  while ((m = re.exec(text))) {
    out += esc(text.slice(last, m.index)) + esc(m[0]);
    last = m.index + m[0].length;
    const all = m[0].toLowerCase();
    let add = '';
    if (m[1]) { // % FTP
      let lo = +m[1], hi = m[2] ? +m[2] : +m[1];
      if (lower && hi > lo) hi = Math.round((lo + hi) / 2);
      add = `${rng(Zn.watts(z, lo), Zn.watts(z, hi))} W`;
    } else if (m[3]) { // CSS +/- s
      const sg = m[3] === '-' ? -1 : 1;
      let a = sg * +m[4], b = m[5] ? sg * +m[5] : a;
      if (lower && Math.abs(b - a) > 0) { if (sg > 0) a = a + (b - a) / 2; else b = b - (b - a) / 2; }
      add = paceRange(z.css + a, z.css + b);
    } else if (m[6]) { // Z1-Z2
      const a = +m[6], b = m[7] ? +m[7] : a;
      const hr = Zn.hrRange(z, a, b);
      if (disc === 'bike') {
        const top = b >= 2 ? Zn.watts(z, 75) : Zn.watts(z, 55);
        add = `${a === 1 && b === 1 ? '<' : '≤'} ${top} W · HF ${rng(hr[0], hr[1])}`;
      } else add = `HF ${rng(hr[0], hr[1])} bpm`;
    } else if (m[8]) { // RPE
      if (disc === 'run' || disc === 'race') {
        const a = +m[8], b = m[9] ? +m[9] : a;
        if (b >= 7 && a >= 7 && !m[9]) add = ''; // Strides RPE 7: zu kurz für HF
        else { const hr = Zn.rpeHr(z, a, b); add = `HF ≈ ${rng(hr[0], hr[1])} bpm`; }
      }
    } else if (/power/.test(all)) { // race power / 70.3 power
      if (disc === 'bike') add = `${rng(Zn.watts(z, 78), Zn.watts(z, 83))} W`;
    } else if (/swim effort|schwimmeffort|70\.3 pace/.test(all)) {
      if (disc === 'swim') add = paceRange(z.css + 3, z.css + 7);
      else if (disc === 'run') add = runRace(z);
    } else if (/race pace/.test(all)) {
      if (disc === 'run') add = runRace(z);
      else if (disc === 'swim') add = paceRange(z.css + 3, z.css + 7);
    }
    if (add) out += calc(add);
  }
  return out + esc(text.slice(last));
}
function runRace(z) {
  const hr = Zn.rpeHr(z, 5, 6);
  const race = RUN_LEVELS[2];
  return z.runThr ? `${runPaceRange(z.runThr * race.f[0], z.runThr * race.f[1])} · HF ${rng(hr[0], hr[1])}` : `HF ${rng(hr[0], hr[1])} bpm`;
}

/* Generische "Targets"-Zeile aus dem PDF erkennen -> Zonen-Chips statt Fließtext-Anreicherung */
function zoneChips(disc, z) {
  const chip = (cls, label, val) => `<div class="zchip ${cls}"><span>${esc(label)}</span><b>${val}</b></div>`;
  if (disc === 'bike') return Zn.bike(z).map(b => chip('c-bike', `${b.name} · ${b.lo}–${b.hi} %`, `${b.wlo}–${b.whi} W`)).join('');
  if (disc === 'swim') return Zn.swim(z).map(s => chip('c-swim', s.name, paceRange(s.plo, s.phi))).join('');
  if (disc === 'run' || disc === 'race') return Zn.run(z).map(r => chip('c-run', r.name, `HF ${rng(r.hr[0], r.hr[1])}` + (r.plo ? `<em>${runPaceRange(r.plo, r.phi)}</em>` : ''))).join('');
  return '';
}
