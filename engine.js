/* Plan-Logik: Terminplanung, Einheiten, Logs, Anpassungsregeln, Statistik */
'use strict';
const PL = window.PLAN;
const RACE_OFFSET = PL.weeks.length * 7 - 1; // 139: Renntag = Tag 140
let S = Store.load();

const commit = () => Store.save(S);

/* ---------- Plan-Termine ---------- */
const planStartFor = raceIso => addDays(raceIso, -RACE_OFFSET);
const dateFor = (week, dayIdx) => addDays(S.startDate, (week - 1) * 7 + dayIdx);
const weekEnd = week => dateFor(week, 6);

function locate(date) {
  if (!S) return null;
  const off = diffDays(date, S.startDate);
  if (off < 0 || off > RACE_OFFSET) return null;
  return { date, week: Math.floor(off / 7) + 1, dayIdx: off % 7, dayKey: DAYKEYS[off % 7] };
}
/* 0 = Plan noch nicht gestartet, 1..20 = laufende Woche, 21 = Rennen vorbei */
function curWeek(today = todayIso()) {
  const off = diffDays(today, S.startDate);
  if (off < 0) return 0;
  if (off > RACE_OFFSET) return 21;
  return Math.floor(off / 7) + 1;
}

/* ---------- Einheiten ---------- */
function parseDuration(t) {
  let m = t.match(/(\d+)h\s*(\d+)m/); if (m) return +m[1] * 60 + +m[2];
  m = t.match(/(\d+)\s*-\s*(\d+)\s*min/); if (m) return Math.round((+m[1] + +m[2]) / 2);
  m = t.match(/(\d+)\s*min/); if (m) return +m[1];
  return null;
}
function buildSession(raw, w, dayKey, idx) {
  const parts = raw.title.split(' - ');
  const name = parts[0];
  const disc = /^Swim/.test(name) ? 'swim' : /^Bike/.test(name) ? 'bike' : /^(Run|Brick)/.test(name) ? 'run' : /^Strength/.test(name) ? 'strength' : 'race';
  const durText = parts.slice(1).join(' - ');
  const test = /baseline|retest/i.test(raw.title) || /zones/i.test(raw.Purpose || '');
  const quality = /quality/i.test(raw.title) || /^Swim B/.test(name) || test;
  const key = /long/i.test(raw.title) || name === 'Brick run' || disc === 'race';
  const strides = /strides/i.test(raw.title);
  return {
    id: `w${w}-${dayKey}-${idx}`, week: w, dayKey, idx, raw, title: raw.title, name, disc,
    durMin: disc === 'race' ? null : parseDuration(durText),
    test, quality, key, hard: quality || key, strides,
    long: /Bike - long|Run - long/.test(raw.title), brick: name === 'Brick run'
  };
}
const SESS = {};
function weekSessions(w) {
  if (!SESS[w]) {
    const wk = PL.weeks[w - 1]; const o = {};
    for (const dk of DAYKEYS) {
      const d = wk.days[dk];
      o[dk] = d.rest ? [] : d.sessions.map((s, i) => buildSession(s, w, dk, i));
    }
    SESS[w] = o;
  }
  return SESS[w];
}
const daySess = (w, dk) => weekSessions(w)[dk];
const isRestDay = (w, dk) => !!PL.weeks[w - 1].days[dk].rest;

function dayModel(date) {
  const l = locate(date); if (!l) return null;
  const wk = PL.weeks[l.week - 1];
  return { ...l, wk, rest: isRestDay(l.week, l.dayKey), restText: wk.days[l.dayKey].text, sessions: daySess(l.week, l.dayKey) };
}
const findSession = id => { const m = id.match(/^w(\d+)-(\w+)-(\d+)$/); return m ? daySess(+m[1], m[2])[+m[3]] : null; };
const dateOfSession = s => dateFor(s.week, DAYKEYS.indexOf(s.dayKey));

/* ---------- Logs ---------- */
const getLog = date => (S.logs[date] = S.logs[date] || { sessions: {}, check: null, complete: false });
const peekLog = date => S.logs[date] || null;

/* ---------- Anpassungen ---------- */
const adjFor = id => S.adjustments.filter(a => a.targets && a.targets.includes(id));
function effective(s) {
  const adjs = adjFor(s.id);
  let mode = 'normal', factor = 1, repsMinus = 0, lower = false;
  for (const a of adjs) {
    if (a.kind === 'rest') mode = 'rest';
    else if (a.kind === 'easy' && mode !== 'rest') mode = 'easy';
    else if (a.kind === 'reduce' && mode === 'normal') mode = 'reduce';
    if (a.kind !== 'note') { factor *= a.factor || 1; repsMinus += a.repsMinus || 0; lower = lower || !!a.lower; }
  }
  factor = Math.max(0.4, factor);
  let dur = s.durMin;
  if (dur != null) {
    if (mode === 'rest') dur = 0;
    else if (mode !== 'normal') dur = Math.max(10, Math.round(dur * factor / 5) * 5);
  }
  return { mode, factor, repsMinus, lower, dur, adjs, changed: adjs.length > 0 };
}

const ADJ_TXT = {
  rest: 'Ruhe statt Training',
  easy: 'Locker (Z1–Z2, RPE 2–3) statt Intensität – keine Intervalle',
  reduce: 'Reduzierte Version'
};

function addAdj(list, a) { list.push({ id: `${a.src}-${a.srcDate}-${list.length}-${uid()}`, created: todayIso(), ...a }); }

/* Sessions in den nächsten n Tagen ab (exklusive) date */
function upcoming(date, n, pred = () => true) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const l = locate(addDays(date, i)); if (!l) break;
    for (const s of daySess(l.week, l.dayKey)) if (s.disc !== 'race' && pred(s)) out.push(s);
  }
  return out;
}
const weekOfTargets = (targets, fallbackDate) => {
  if (targets && targets.length) return Math.max(...targets.map(id => findSession(id).week));
  return (locate(fallbackDate) || { week: 1 }).week;
};

/* Regeln aus dem Plan (Auto-Regulation, Hard-Session-Rule, Junk-Mile, Rest-Day, Volume) */
function evaluateDay(date) {
  const log = peekLog(date); const dm = dayModel(date);
  if (!log || !dm) return [];
  const c = log.check || {}; const out = [];
  const push = a => addAdj(out, { src: a.src, srcDate: date, ...a });
  const ids = arr => arr.map(s => s.id);
  const hardNext = (n, disc) => upcoming(date, n, s => s.hard && (!disc || s.disc === disc));

  // 1) Krankheit
  if (c.illness === 'yes') {
    const t1 = upcoming(date, 1);
    if (t1.length) push({ src: 'illness', kind: 'rest', targets: ids(t1), weekNo: weekOfTargets(ids(t1), date),
      what: 'Nächster Trainingstag: Ruhe statt Einheiten', why: 'Krankheit gemeldet. Laut Plan wird die Last reduziert und Ausgefallenes nicht nachgeholt.' });
    const t2 = upcoming(date, 3).filter(s => !t1.includes(s));
    const hard = t2.filter(s => s.hard); const easyRest = t2.filter(s => !s.hard);
    if (hard.length) push({ src: 'illness', kind: 'easy', factor: 0.7, targets: ids(hard), weekNo: weekOfTargets(ids(hard), date),
      what: 'Qualitäts-/Schlüsseleinheiten der folgenden Tage werden locker (Z1–Z2)', why: 'Nach Krankheit erst Belastbarkeit aufbauen. Intention erhalten, Last senken (Plan-Regel für Krankheit/Unwohlsein).' });
    if (easyRest.length) push({ src: 'illness', kind: 'reduce', factor: 0.7, lower: true, targets: ids(easyRest), weekNo: weekOfTargets(ids(easyRest), date),
      what: 'Lockere Einheiten der folgenden Tage ca. 30 % kürzer', why: 'Krankheit gemeldet – Umfang zurückfahren statt Ausfall zu stapeln.' });
  } else if (c.illness === 'mild') {
    const t = upcoming(date, 1);
    const hard = t.filter(s => s.hard), rest = t.filter(s => !s.hard);
    if (hard.length) push({ src: 'illness', kind: 'easy', factor: 0.7, targets: ids(hard), weekNo: weekOfTargets(ids(hard), date),
      what: 'Nächste Qualitätseinheit wird locker (Z1–Z2)', why: 'Leichte Krankheitszeichen: Intention erhalten, Last reduzieren.' });
    if (rest.length) push({ src: 'illness', kind: 'reduce', factor: 0.8, lower: true, targets: ids(rest), weekNo: weekOfTargets(ids(rest), date),
      what: 'Einheiten am nächsten Tag ca. 20 % kürzer', why: 'Leichte Krankheitszeichen – Umfang zurücknehmen.' });
  }

  // 2) Schmerz
  const area = c.painArea || 'all';
  const inArea = s => area === 'all' || s.disc === area || (area === 'run' && s.brick);
  const areaTxt = { run: 'Lauf-', bike: 'Rad-', swim: 'Schwimm-', all: 'alle ' }[area];
  if (c.pain === 'strong') {
    const t = upcoming(date, 3, inArea);
    if (t.length) push({ src: 'pain', kind: 'rest', targets: ids(t), weekNo: weekOfTargets(ids(t), date),
      what: `${areaTxt}Einheiten der nächsten 3 Tage entfallen`, why: 'Starker Schmerz gemeldet. Nicht durchtrainieren und nichts nachholen – bei anhaltendem Schmerz ärztlich/physiotherapeutisch abklären.' });
  } else if (c.pain === 'mild') {
    const t = upcoming(date, 2, inArea);
    const hard = t.filter(s => s.hard), rest = t.filter(s => !s.hard);
    if (hard.length) push({ src: 'pain', kind: 'easy', factor: 0.8, targets: ids(hard), weekNo: weekOfTargets(ids(hard), date),
      what: `Nächste ${areaTxt}Qualität wird locker`, why: 'Leichter Schmerz: Intention beibehalten, Last senken.' });
    if (rest.length) push({ src: 'pain', kind: 'reduce', factor: 0.85, lower: true, targets: ids(rest), weekNo: weekOfTargets(ids(rest), date),
      what: `${areaTxt}Einheiten der nächsten 2 Tage ca. 15 % kürzer`, why: 'Leichter Schmerz gemeldet – Umfang reduzieren.' });
  }

  // 3) Müdigkeit / Schlaf (Auto-Regulation)
  const flagged = d => { const cc = (peekLog(d) || {}).check; return cc && ((cc.fatigue >= 4) || (cc.sleep != null && cc.sleep < 6)); };
  const today = (c.fatigue >= 4) || (c.sleep != null && c.sleep < 6);
  const strong = c.fatigue === 5 || (c.fatigue >= 4 && c.sleep != null && c.sleep < 6);
  const twoDays = today && flagged(addDays(date, -1));
  if (strong || twoDays) {
    const t = hardNext(3);
    const first = twoDays ? t.slice(0, 2) : t.slice(0, 1);
    if (first.length) push({ src: 'fatigue', kind: 'reduce', factor: 0.8, repsMinus: 1, lower: true, targets: ids(first), weekNo: weekOfTargets(ids(first), date),
      what: `${first.length > 1 ? 'Nächste Qualitätseinheiten' : 'Nächste Qualitätseinheit'}: ~20 % kürzer, 1 Wdh. weniger, unteres Ende der Zone`,
      why: twoDays ? 'Zwei Tage in Folge müde oder zu wenig Schlaf. Plan: Dauer/Intensität senken, statt später Kompensation zu stapeln.' : 'Sehr hohe Müdigkeit bzw. Schlafmangel. Plan (Auto-Regulation): Dauer/Intensität senken statt später Ausgleich einzubauen.' });
  }

  // 4) Qualität nachgelassen (Hard-Session-Rule)
  const flaggedSess = dm.sessions.filter(s => { const l = log.sessions[s.id]; return l && l.stable && l.stable !== 'ok'; });
  for (const fs of flaggedSess) {
    const l = log.sessions[fs.id];
    const t = hardNext(7, fs.disc).slice(0, 1);
    if (t.length) push({ src: 'quality', kind: 'reduce', factor: 0.85, repsMinus: 1, lower: true, targets: ids(t), weekNo: weekOfTargets(ids(t), date),
      what: `Nächste ${fs.disc === 'bike' ? 'Rad' : fs.disc === 'run' ? 'Lauf' : 'Schwimm'}-Qualität: 1 Wdh. weniger, ~15 % kürzer, unteres Ende der Zone`,
      why: `${fs.name}: ${l.stable === 'drop' ? 'Leistung fiel >3–5 % ab' : 'Technik/Form ließ nach'}. Die letzte Wiederholung soll wie die erste aussehen – daher Umfang/Intensität senken statt aufholen.` });
  }
  // zwei Qualitätsprobleme in einer Woche
  if (flaggedSess.length) {
    let cnt = 0;
    for (let i = 0; i < 7; i++) { const lg = peekLog(dateFor(dm.week, i)); if (!lg) continue; for (const s of daySess(dm.week, DAYKEYS[i])) { const l = lg.sessions[s.id]; if (l && l.stable && l.stable !== 'ok') cnt++; } }
    if (cnt >= 2) {
      const rem = upcoming(date, 6, s => s.week === dm.week && s.hard);
      if (rem.length) push({ src: 'quality2', kind: 'easy', factor: 0.85, targets: ids(rem), weekNo: dm.week,
        what: 'Restliche Qualitätseinheiten dieser Woche werden locker', why: 'Zweimal nachlassende Qualität in einer Woche – Hinweis auf Ermüdung. Plan: Last reduzieren statt Extra-Arbeit.' });
    }
  }

  // 5) Ausgelassene Schlüsseleinheit -> nicht nachholen
  for (const s of dm.sessions) {
    const l = log.sessions[s.id];
    if (l && l.status === 'no' && s.hard && !(effective(s).mode === 'rest')) {
      push({ src: 'missed', kind: 'note', targets: [], weekNo: dm.week,
        what: `${s.name} ausgelassen – wird nicht nachgeholt`, why: 'Plan: Kernintention erhalten und nicht verpasste Arbeit stapeln. Die nächste Einheit läuft wie geplant.' });
    }
  }

  // 6) Extra-Umfang (Junk-Mile-Check)
  if (c.extraMin >= 20) {
    push({ src: 'extra', kind: 'note', targets: [], weekNo: dm.week, what: `${c.extraMin} min Zusatztraining außerhalb des Plans`, why: 'Junk-Mile-Check: Ohne klaren Zweck (Recovery, Frequenz, Technik, Aerobic) kein Zusatzumfang – Erholung und Schlüsseleinheiten haben Vorrang.' });
    if (c.extraMin >= 45) {
      const t = upcoming(date, 1);
      if (t.length) push({ src: 'extra', kind: 'reduce', factor: 0.9, lower: true, targets: ids(t), weekNo: weekOfTargets(ids(t), date), what: 'Nächster Tag ca. 10 % kürzer', why: 'Viel ungeplanter Zusatzumfang – Wochenumfang bleibt im Rahmen (11–12 h Ceiling).' });
    }
  }

  // 7) Ruhetag nicht eingehalten
  if (dm.rest && c.restKept === 'no') {
    const t = hardNext(2).slice(0, 1);
    push({ src: 'rest', kind: t.length ? 'reduce' : 'note', factor: 0.9, lower: true, targets: ids(t), weekNo: weekOfTargets(ids(t), date),
      what: t.length ? 'Nächste Qualitätseinheit ~10 % kürzer, unteres Ende der Zone' : 'Ruhetag nicht eingehalten', why: 'Rest-Day-Regel: Der Ruhetag darf nur verschoben werden, wenn die Erholungslogik erhalten bleibt.' });
  }

  // 8) Ernährung (Long Bike)
  for (const s of dm.sessions) {
    const l = log.sessions[s.id];
    if (!l || !(s.long && s.disc === 'bike')) continue;
    const bad = l.gi === 'problems' || l.gi === 'some';
    const low = l.carbs != null && l.carbs < 50 && (s.durMin || 0) >= 150;
    if (bad || low) {
      const t = upcoming(date, 10, x => x.long && x.disc === 'bike').slice(0, 1);
      push({ src: 'nutrition', kind: 'note', targets: ids(t), weekNo: weekOfTargets(ids(t), date),
        what: bad ? 'Ernährung beim nächsten langen Radtraining anpassen' : 'Kohlenhydrat-Zufuhr beim nächsten langen Radtraining erhöhen',
        why: bad ? 'Magen-Darm-Probleme gemeldet: Menge auf ~50 g/h begrenzen, Produkt/Trinkkonzentration testen, dann langsam steigern. Ziel bleibt 50–70 g/h.' : `Nur ${l.carbs} g/h aufgenommen. Ziel laut Plan: 50–70 g/h und regelmäßiges Trinken.` });
    }
  }

  // 9) Wochenende: Wochenumfang
  if (dm.dayIdx === 6) {
    const st = weekStats(dm.week);
    if (st.minutes > 12 * 60 && dm.week < 20) {
      const t = upcoming(date, 7, s => !s.hard);
      if (t.length) push({ src: 'volume', kind: 'reduce', factor: 0.9, lower: true, targets: ids(t), weekNo: weekOfTargets(ids(t), date),
        what: 'Lockere Einheiten der Folgewoche ~10 % kürzer', why: `Wochenumfang ${fmtH(st.minutes)} h lag über dem 12-h-Ceiling des Plans.` });
    }
  }
  return out;
}

function finalizeDay(date) {
  const log = getLog(date);
  S.adjustments = S.adjustments.filter(a => !(a.srcDate === date && a.src !== 'zones'));
  const adj = evaluateDay(date);
  S.adjustments.push(...adj);
  log.complete = true; log.completedAt = new Date().toISOString();
  commit();
  return adj;
}
function reopenDay(date) {
  const log = getLog(date); log.complete = false;
  S.adjustments = S.adjustments.filter(a => !(a.srcDate === date && a.src !== 'zones'));
  commit();
}

/* Info-Banner: bis Ende der betroffenen Woche */
function activeAdjustments(today = todayIso()) {
  return S.adjustments.filter(a => {
    const end = a.weekNo ? weekEnd(a.weekNo) : addDays(a.created, 7);
    return today <= end;
  }).sort((a, b) => (b.created > a.created) ? 1 : -1);
}

/* ---------- Statistik ---------- */
function planMinutes(w) {
  let sum = 0;
  for (const dk of DAYKEYS) for (const s of daySess(w, dk)) sum += effective(s).dur ?? 0;
  return sum;
}
function sessionActualMin(s) {
  const l = (peekLog(dateOfSession(s)) || { sessions: {} }).sessions[s.id];
  if (!l || l.status === 'no' || !l.status) return 0;
  return l.minutes != null ? l.minutes : (effective(s).dur || 0);
}
function weekStats(w) {
  const st = { minutes: 0, disc: { swim: 0, bike: 0, run: 0, strength: 0 }, quality: 0, race: 0, longBike: null, longRun: null, done: 0, planned: 0, plannedMin: 0 };
  for (let i = 0; i < 7; i++) {
    const dk = DAYKEYS[i]; const date = dateFor(w, i); const log = peekLog(date);
    for (const s of daySess(w, dk)) {
      const eff = effective(s);
      if (eff.mode !== 'rest') { st.planned++; st.plannedMin += eff.dur || 0; }
      const l = log && log.sessions[s.id];
      if (!l || !(l.status === 'yes' || l.status === 'partial')) continue;
      const m = l.minutes != null ? l.minutes : (eff.dur || 0);
      st.done++; st.minutes += m;
      if (s.disc in st.disc) st.disc[s.disc] += m;
      st.quality += l.qualMin || 0; st.race += l.raceMin || 0;
      if (s.long && s.disc === 'bike') st.longBike = m;
      if (s.long && s.disc === 'run') st.longRun = m;
    }
  }
  return st;
}
const hmToMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

/* Serien fuer die Diagramme: Plan (aus PDF) + Ist */
function chartSeries() {
  const cw = curWeek(); const upto = cw === 0 ? 0 : Math.min(cw, 20);
  const ist = fn => PL.weeks.map((wk, i) => { const n = i + 1; if (n > upto) return null; const st = weekStats(n); if (n === upto && st.done === 0) return null; return fn(st, wk); });
  return {
    cw: upto,
    volume: { plan: PL.weeks.map(w => w.hours), ist: ist(st => +(st.minutes / 60).toFixed(2)) },
    disc: { plan: PL.disc, ist: ist(st => ({ swim: st.disc.swim / 60, bike: st.disc.bike / 60, run: st.disc.run / 60, strength: st.disc.strength / 60 })) },
    quality: { plan: PL.weeks.map(w => w.quality), planRace: PL.weeks.map(w => w.race), ist: ist(st => st.quality), istRace: ist(st => st.race) },
    long: { planBike: PL.weeks.map(w => hmToMin(w.longBike)), planRun: PL.weeks.map(w => hmToMin(w.longRun)), istBike: ist(st => st.longBike), istRun: ist(st => st.longRun) }
  };
}

/* ---------- Zonen-Update ---------- */
function zoneDiff(a, b) {
  const d = [];
  if (a.ftp !== b.ftp) d.push({ k: 'FTP', from: `${a.ftp} W`, to: `${b.ftp} W`, pct: (b.ftp - a.ftp) / a.ftp });
  if (a.css !== b.css) d.push({ k: 'CSS', from: `${fmtMMSS(a.css)}/100 m`, to: `${fmtMMSS(b.css)}/100 m`, pct: (a.css - b.css) / a.css });
  a.hr.forEach((r, i) => { if (r[0] !== b.hr[i][0] || r[1] !== b.hr[i][1]) d.push({ k: `HF Z${i + 1}`, from: `${r[0]}–${r[1]}`, to: `${b.hr[i][0]}–${b.hr[i][1]}` }); });
  if ((a.runThr || 0) !== (b.runThr || 0)) d.push({ k: 'Lauf-Schwelle', from: a.runThr ? fmtMMSS(a.runThr) + '/km' : '–', to: b.runThr ? fmtMMSS(b.runThr) + '/km' : '–' });
  return d;
}
function applyZoneUpdate(newZ, reason) {
  const old = S.zones; const diff = zoneDiff(old, newZ); const today = todayIso();
  const cw = Math.max(1, Math.min(20, curWeek()));
  S.zones = { ...newZ, updated: today };
  const hist = S.zoneHistory;
  const entry = { date: today, z: JSON.parse(JSON.stringify(S.zones)), reason: reason || '', diff };
  const idx = hist.findIndex(h => h.date === today);
  if (idx >= 0) hist[idx] = entry; else hist.push(entry);
  S.adjustments = S.adjustments.filter(a => !(a.src === 'zones' && a.srcDate === today));
  if (diff.length) {
    const ftpUp = diff.find(d => d.k === 'FTP');
    S.adjustments.push({ id: 'zones-' + uid(), src: 'zones', srcDate: today, created: today, weekNo: cw, kind: 'zones', targets: [],
      what: 'Zonen aktualisiert: ' + diff.map(d => `${d.k} ${d.from} → ${d.to}`).join(' · '),
      why: (reason ? reason + '. ' : '') + 'Alle noch offenen Einheiten nutzen ab sofort die neuen Wattbereiche, Paces und HF-Zonen. Bereits absolvierte Einheiten behalten ihre damaligen Werte (Plan-Regel: Zonen nur vorausschauend anpassen).' });
  } else {
    S.adjustments.push({ id: 'zones-' + uid(), src: 'zones', srcDate: today, created: today, weekNo: cw, kind: 'zones', targets: [],
      what: 'Zonen wöchentlich geprüft – unverändert', why: 'Die Werte wurden bestätigt, der Plan bleibt wie er ist.' });
  }
  commit();
  return diff;
}
const zonesDue = (today = todayIso()) => {
  if (!S || curWeek(today) === 0 || curWeek(today) === 21) return false;
  if (diffDays(today, S.zones.updated) < 7) return false;
  return S.snoozeZone !== today;
};

/* ---------- Onboarding ---------- */
function initState(profile, zones) {
  const start = planStartFor(profile.raceDate);
  S = {
    v: 1, profile, zones: { ...zones, updated: todayIso() }, startDate: start,
    zoneHistory: [], logs: {}, adjustments: [], snoozeZone: null, created: todayIso()
  };
  S.zoneHistory.push({ date: '1970-01-01', z: JSON.parse(JSON.stringify(S.zones)), reason: 'Onboarding', diff: [] });
  commit();
}

