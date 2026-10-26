/* Plan-Logik: Terminplanung, Einheiten, Logs, Anpassungsregeln, Statistik (planunabhängig) */
'use strict';
let S = Store.load();
let PLANID = null, PM = null, PL = null; // aktiver Plan: Meta, Daten
let SESS = {};

function usePlan(id) {
  const P = window.PLANS[id] || window.PLANS.tri70;
  PLANID = P.meta.id; PM = P.meta; PL = P.data; SESS = {}; _sk = null;
}
if (S) {
  if (!S.planId) S.planId = 'tri70';
  if (!S.inserts) S.inserts = [];
  if (!S.adjustments) S.adjustments = [];
}
let _sk = null, _sv = null;
usePlan(S ? S.planId : 'tri70');

const commit = () => Store.save(S);

/* ---------- Kalender & Wochen-Schedule ----------
   Kalenderwoche c (1..TW) -> Planwoche sched()[c-1]. Ohne Wiederholungen ist das die Identität.
   Wiederholte Wochen (Plan-Regel) werden als "inserts" gespeichert: nach Kalenderwoche `at` wird `planWeek` eingefügt. */
function sched() {
  const ins = S.inserts || [];
  const key = PLANID + '|' + ins.map(i => i.id).join(',');
  if (_sk !== key) {
    const L = PL.weeks.map((_, i) => i + 1);
    for (const i of ins) L.splice(Math.min(i.at, L.length), 0, i.planWeek);
    _sk = key; _sv = L;
  }
  return _sv;
}
const TW = () => sched().length;                         // Anzahl Kalenderwochen
const planWeekOf = c => sched()[c - 1];
const isRepeatWeek = c => sched().indexOf(planWeekOf(c)) !== c - 1;
const planStartFor = endIso => addDays(endIso, -(PL.weeks.length * 7 - 1));
const planDays = () => TW() * 7 - 1;
const lastPlanDay = () => addDays(S.startDate, planDays());
const dateFor = (week, dayIdx) => addDays(S.startDate, (week - 1) * 7 + dayIdx);
const weekEnd = week => dateFor(week, 6);
const planWeekData = c => PL.weeks[planWeekOf(c) - 1];

function locate(date) {
  if (!S) return null;
  const off = diffDays(date, S.startDate);
  if (off < 0 || off > planDays()) return null;
  return { date, week: Math.floor(off / 7) + 1, dayIdx: off % 7, dayKey: DAYKEYS[off % 7] };
}
/* 0 = Plan noch nicht gestartet, 1..TW = laufende Woche, TW+1 = Plan vorbei */
function curWeek(today = todayIso()) {
  const off = diffDays(today, S.startDate);
  if (off < 0) return 0;
  if (off > planDays()) return TW() + 1;
  return Math.floor(off / 7) + 1;
}
/* Datum des Tages `dayKey` der ersten Kalenderwoche, in der Planwoche p läuft */
function dateOfPlanWeek(p, dayKey) {
  const c = sched().indexOf(p) + 1; if (!c) return null;
  return dateFor(c, DAYKEYS.indexOf(dayKey));
}
const eventDate = () => addDays(S.profile.raceDate, PM.eventOffset || 0);

/* ---------- Einheiten ---------- */
function buildSession(raw, w, dayKey, idx) {
  return {
    id: `w${w}-${dayKey}-${idx}`, week: w, dayKey, idx, raw, title: raw.title, name: raw.name, disc: raw.disc,
    durMin: raw.dur, test: !!raw.test, testKind: raw.testKind || null, quality: !!raw.quality, key: !!raw.key, hard: !!raw.hard,
    strides: !!raw.strides, long: !!raw.long, brick: !!raw.brick, q: raw.q, r: raw.r
  };
}
function weekSessions(w) {
  if (!planWeekOf(w)) return null;
  if (!SESS[w]) {
    const wk = planWeekData(w); const o = {};
    for (const dk of DAYKEYS) {
      const d = wk.days[dk];
      o[dk] = d.rest ? [] : d.sessions.map((s, i) => buildSession(s, w, dk, i));
    }
    SESS[w] = o;
  }
  return SESS[w];
}
const daySess = (w, dk) => (weekSessions(w) || {})[dk] || [];
const isRestDay = (w, dk) => !!planWeekData(w).days[dk].rest;

function dayModel(date) {
  const l = locate(date); if (!l) return null;
  const wk = planWeekData(l.week);
  return { ...l, pw: planWeekOf(l.week), repeat: isRepeatWeek(l.week), wk, rest: isRestDay(l.week, l.dayKey), restText: wk.days[l.dayKey].text, sessions: daySess(l.week, l.dayKey) };
}
const findSession = id => { const m = id.match(/^w(\d+)-(\w+)-(\d+)$/); return m ? (daySess(+m[1], m[2])[+m[3]] || null) : null; };
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
    else if (mode !== 'normal' && factor !== 1) dur = Math.max(10, Math.round(dur * factor / 5) * 5);
  }
  return { mode, factor, repsMinus, lower, dur, adjs, changed: adjs.some(a => a.kind !== 'repeat') };
}

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
  const ws = (targets || []).map(id => (findSession(id) || {}).week).filter(Boolean);
  if (ws.length) return Math.max(...ws);
  return (locate(fallbackDate) || { week: 1 }).week;
};
const lastDeload = pw => { const d = PL.weeks.filter(w => w.phase === PM.rules.deloadPhase && w.n <= pw).pop(); return d ? d.n : 1; };
const missedCount = c => {
  let n = 0;
  for (let i = 0; i < 7; i++) { const lg = peekLog(dateFor(c, i)); if (!lg) continue; for (const s of daySess(c, DAYKEYS[i])) { const l = lg.sessions[s.id]; if (l && l.status === 'no' && effective(s).mode !== 'rest') n++; } }
  return n;
};

/* Regeln aus dem Plan; welche aktiv sind und wie sie heißen, steht in PM.rules / PM.msgs */
function evaluateDay(date) {
  const log = peekLog(date); const dm = dayModel(date);
  if (!log || !dm) return [];
  const c = log.check || {}; const out = [];
  const rules = PM.rules, M = PM.msgs;
  const push = a => addAdj(out, { src: a.src, srcDate: date, ...a });
  const ids = arr => arr.map(s => s.id);
  const hardNext = (n, disc) => upcoming(date, n, s => s.hard && (!disc || s.disc === disc));
  const easyTxt = M.easy;

  // 1) Krankheit
  if (c.illness === 'yes') {
    const t1 = upcoming(date, 1);
    if (t1.length) push({ src: 'illness', kind: 'rest', targets: ids(t1), weekNo: weekOfTargets(ids(t1), date),
      what: 'Nächster Trainingstag: Ruhe statt Einheiten', why: M.illnessYes });
    const t2 = upcoming(date, 3).filter(s => !t1.includes(s));
    const hard = t2.filter(s => s.hard); const easyRest = t2.filter(s => !s.hard);
    if (hard.length) push({ src: 'illness', kind: 'easy', factor: 0.7, targets: ids(hard), weekNo: weekOfTargets(ids(hard), date),
      what: `Qualitäts-/Schlüsseleinheiten der folgenden Tage werden locker (${easyTxt})`, why: 'Nach Krankheit erst Belastbarkeit aufbauen. Intention erhalten, Last senken.' });
    if (easyRest.length) push({ src: 'illness', kind: 'reduce', factor: 0.7, lower: true, targets: ids(easyRest), weekNo: weekOfTargets(ids(easyRest), date),
      what: 'Lockere Einheiten der folgenden Tage ca. 30 % kürzer', why: 'Krankheit gemeldet – Umfang zurückfahren statt Ausfall zu stapeln.' });
    if (rules.illnessReentry) {
      let streak = 0;
      for (let i = 0; i < 40; i++) { const cc = (peekLog(addDays(date, -i)) || {}).check; if (cc && cc.illness === 'yes') streak++; else break; }
      const lastIns = S.inserts.some(x => x.src === 'illness' && Math.abs(diffDays(date, x.srcDate)) < 14);
      if (streak >= rules.illnessReentry && !lastIns) {
        const d = lastDeload(dm.pw);
        push({ src: 'illness', kind: 'repeat', planWeek: d, targets: [], weekNo: dm.week + 1,
          what: `Wiedereinstieg mit der letzten Entlastungswoche (Woche ${d})`, why: `Nach mehr als 5 Tagen Pause steigst du laut Plan mit der letzten Entlastungswoche wieder ein. Danach geht es normal weiter – der Plan verlängert sich um 1 Woche.` });
      }
    }
  } else if (c.illness === 'mild') {
    const t = upcoming(date, 1);
    const hard = t.filter(s => s.hard), rest = t.filter(s => !s.hard);
    if (hard.length) push({ src: 'illness', kind: 'easy', factor: 0.7, targets: ids(hard), weekNo: weekOfTargets(ids(hard), date),
      what: `Nächste Qualitätseinheit wird locker (${easyTxt})`, why: 'Leichte Krankheitszeichen: Intention erhalten, Last reduzieren.' });
    if (rest.length) push({ src: 'illness', kind: 'reduce', factor: 0.8, lower: true, targets: ids(rest), weekNo: weekOfTargets(ids(rest), date),
      what: 'Einheiten am nächsten Tag ca. 20 % kürzer', why: 'Leichte Krankheitszeichen – Umfang zurücknehmen.' });
  }

  // 2) Schmerz
  const area = c.painArea || 'all';
  const inArea = s => area === 'all' || s.disc === area || (area === 'run' && s.brick);
  const areaTxt = { run: 'Lauf-', bike: 'Rad-', swim: 'Schwimm-', strength: 'Kraft-', all: 'alle ' }[area] || 'alle ';
  if (c.pain === 'strong') {
    if (rules.painStrong === 'noRun') {
      const t = upcoming(date, 3, s => s.disc === 'run');
      if (t.length) push({ src: 'pain', kind: 'rest', targets: ids(t), weekNo: weekOfTargets(ids(t), date),
        what: 'Laufeinheiten der nächsten 3 Tage entfallen', why: 'Schmerz über 3/10, stechend oder hinkend: Laufen wird gestrichen, Rad und Kraft nur schmerzfrei. Bei anhaltendem Schmerz ärztlich abklären. Nichts nachholen.' });
      else push({ src: 'pain', kind: 'note', targets: [], weekNo: dm.week, what: 'Starker Schmerz gemeldet', why: 'Laufen streichen, Rad und Kraft nur schmerzfrei, ärztlich abklären.' });
    } else {
      const t = upcoming(date, 3, inArea);
      if (t.length) push({ src: 'pain', kind: 'rest', targets: ids(t), weekNo: weekOfTargets(ids(t), date),
        what: `${areaTxt}Einheiten der nächsten 3 Tage entfallen`, why: 'Starker Schmerz gemeldet. Nicht durchtrainieren und nichts nachholen – bei anhaltendem Schmerz ärztlich/physiotherapeutisch abklären.' });
    }
  } else if (c.pain === 'mild') {
    if (rules.painMildOk) {
      push({ src: 'pain', kind: 'note', targets: [], weekNo: dm.week, what: 'Leichter Schmerz (bis 3/10) gemeldet',
        why: 'Bis 3/10 ist laut Plan okay, solange der Schmerz nicht zunimmt und am nächsten Morgen weg ist. Sonst Einheit beenden und Laufen streichen.' });
    } else {
      const t = upcoming(date, 2, inArea);
      const hard = t.filter(s => s.hard), rest = t.filter(s => !s.hard);
      if (hard.length) push({ src: 'pain', kind: 'easy', factor: 0.8, targets: ids(hard), weekNo: weekOfTargets(ids(hard), date),
        what: `Nächste ${areaTxt}Qualität wird locker`, why: 'Leichter Schmerz: Intention beibehalten, Last senken.' });
      if (rest.length) push({ src: 'pain', kind: 'reduce', factor: 0.85, lower: true, targets: ids(rest), weekNo: weekOfTargets(ids(rest), date),
        what: `${areaTxt}Einheiten der nächsten 2 Tage ca. 15 % kürzer`, why: 'Leichter Schmerz gemeldet – Umfang reduzieren.' });
    }
  }

  // 3) Müdigkeit / Schlaf
  const flagged = d => { const cc = (peekLog(d) || {}).check; return cc && ((cc.fatigue >= 4) || (cc.sleep != null && cc.sleep < 6)); };
  const today = (c.fatigue >= 4) || (c.sleep != null && c.sleep < 6);
  const strong = c.fatigue === 5 || (c.fatigue >= 4 && c.sleep != null && c.sleep < 6);
  const twoDays = today && flagged(addDays(date, -1));
  if (strong || twoDays) {
    const t = hardNext(3);
    const first = twoDays ? t.slice(0, 2) : t.slice(0, 1);
    const why = twoDays ? 'Zwei Tage in Folge müde oder zu wenig Schlaf.' : 'Sehr hohe Müdigkeit bzw. Schlafmangel.';
    if (first.length) {
      if (rules.fatigueMode === 'easy') push({ src: 'fatigue', kind: 'easy', factor: 1, targets: ids(first), weekNo: weekOfTargets(ids(first), date),
        what: `${first.length > 1 ? 'Nächste zügige Einheiten' : 'Nächste zügige Einheit'}: Abschnitte locker absolvieren, Umfang bleibt`,
        why: `${why} Laut Plan werden zügige Abschnitte dann locker gelaufen/gefahren; der Umfang darf bleiben. Schlaf: 7–9 Stunden.` });
      else push({ src: 'fatigue', kind: 'reduce', factor: 0.8, repsMinus: 1, lower: true, targets: ids(first), weekNo: weekOfTargets(ids(first), date),
        what: `${first.length > 1 ? 'Nächste Qualitätseinheiten' : 'Nächste Qualitätseinheit'}: ~20 % kürzer, 1 Wdh. weniger, unteres Ende der Vorgaben`,
        why: `${why} Plan: Dauer/Intensität senken, statt später Kompensation zu stapeln.` });
    }
  }
  if (rules.energy && c.energy === 'yes') {
    const t = hardNext(3);
    if (t.length) push({ src: 'energy', kind: 'easy', factor: 1, targets: ids(t), weekNo: weekOfTargets(ids(t), date),
      what: 'Zügige Abschnitte der nächsten 3 Tage locker absolvieren, Umfang bleibt', why: 'Zyklus / wenig Energie gemeldet. Plan-Regel: Zügige Abschnitte locker absolvieren; der Umfang darf bleiben.' });
  }

  // 4) Qualität nachgelassen (Regel für harte Einheiten)
  const flaggedSess = dm.sessions.filter(s => { const l = log.sessions[s.id]; return l && l.stable && l.stable !== 'ok'; });
  for (const fs of flaggedSess) {
    const l = log.sessions[fs.id];
    const t = hardNext(7, fs.disc).slice(0, 1);
    if (t.length) push({ src: 'quality', kind: 'reduce', factor: 0.85, repsMinus: 1, lower: true, targets: ids(t), weekNo: weekOfTargets(ids(t), date),
      what: `Nächste ${(typeof DISC_DE !== 'undefined' && DISC_DE[fs.disc]) || ''}-Qualität: 1 Wdh. weniger, ~15 % kürzer, unteres Ende der Vorgaben`,
      why: `${fs.name}: ${l.stable === 'drop' ? M.qualityDrop : 'Technik/Form ließ nach'}. Die letzte Wiederholung soll wie die erste aussehen – daher Umfang/Intensität senken statt aufholen.` });
  }
  if (flaggedSess.length) {
    let cnt = 0;
    for (let i = 0; i < 7; i++) { const lg = peekLog(dateFor(dm.week, i)); if (!lg) continue; for (const s of daySess(dm.week, DAYKEYS[i])) { const l = lg.sessions[s.id]; if (l && l.stable && l.stable !== 'ok') cnt++; } }
    if (cnt >= 2) {
      const rem = upcoming(date, 6, s => s.week === dm.week && s.hard);
      if (rem.length) push({ src: 'quality2', kind: 'easy', factor: 0.85, targets: ids(rem), weekNo: dm.week,
        what: 'Restliche Qualitätseinheiten dieser Woche werden locker', why: 'Zweimal nachlassende Qualität in einer Woche – Hinweis auf Ermüdung. Plan: Last reduzieren statt Extra-Arbeit.' });
    }
  }

  // 5) Ausgelassene Einheit -> nicht nachholen
  for (const s of dm.sessions) {
    const l = log.sessions[s.id];
    if (l && l.status === 'no' && (s.hard || rules.missedAny) && !(effective(s).mode === 'rest')) {
      push({ src: 'missed', kind: 'note', targets: [], weekNo: dm.week, what: `${s.name} ausgelassen – wird nicht nachgeholt`, why: M.missed });
    }
  }

  // 5b) Woche wiederholen (Plan-Regel): Woche zu schwer / mehr als 1 Einheit verpasst
  if (rules.repeatWeek) {
    const alreadyNext = S.inserts.some(x => x.at === dm.week) || S.inserts.length >= (rules.maxRepeats || 3);
    const tooHard = c.weekHard === 'yes';
    const missed2 = missedCount(dm.week) >= 2;
    if ((tooHard || missed2) && !alreadyNext) {
      push({ src: tooHard ? 'weekhard' : 'missed2', kind: 'repeat', planWeek: dm.pw, targets: [], weekNo: dm.week + 1,
        what: `Woche ${dm.pw} wird wiederholt – der Plan verlängert sich um 1 Woche`,
        why: tooHard ? 'Die Woche fühlte sich deutlich zu schwer an. Plan-Regel: Woche wiederholen statt Einheiten nachholen, danach normal weiter.' : 'Mehr als 1 Einheit verpasst. Plan-Regel: Woche wiederholen, danach normal weiter – nichts nachholen.' });
    }
  }

  // 6) Extra-Umfang
  if (c.extraMin >= 20) {
    push({ src: 'extra', kind: 'note', targets: [], weekNo: dm.week, what: `${c.extraMin} min Zusatztraining außerhalb des Plans`, why: M.extra });
    if (c.extraMin >= 45) {
      const t = upcoming(date, 1);
      if (t.length) push({ src: 'extra', kind: 'reduce', factor: 0.9, lower: true, targets: ids(t), weekNo: weekOfTargets(ids(t), date), what: 'Nächster Tag ca. 10 % kürzer', why: `Viel ungeplanter Zusatzumfang – Wochenumfang bleibt im Rahmen (max. ${rules.maxHours} h).` });
    }
  }

  // 7) Ruhetag nicht eingehalten
  if (dm.rest && c.restKept === 'no') {
    const t = hardNext(2).slice(0, 1);
    push({ src: 'rest', kind: t.length ? 'reduce' : 'note', factor: 0.9, lower: true, targets: ids(t), weekNo: weekOfTargets(ids(t), date),
      what: t.length ? 'Nächste Qualitätseinheit ~10 % kürzer, unteres Ende der Vorgaben' : 'Ruhetag nicht eingehalten', why: M.restBroken });
  }

  // 8) Ernährung (nur Pläne mit Verpflegungsproben)
  if (rules.nutrition) for (const s of dm.sessions) {
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
  if (dm.dayIdx === 6 && rules.maxHours) {
    const st = weekStats(dm.week);
    if (st.minutes > rules.maxHours * 60 && dm.week < TW()) {
      const t = upcoming(date, 7, s => !s.hard);
      if (t.length) push({ src: 'volume', kind: 'reduce', factor: 0.9, lower: true, targets: ids(t), weekNo: weekOfTargets(ids(t), date),
        what: 'Lockere Einheiten der Folgewoche ~10 % kürzer', why: `Wochenumfang ${fmtH(st.minutes)} h lag über dem Maximum von ${rules.maxHours} h.` });
    }
  }
  return out;
}

function dropDayResults(date) {
  S.adjustments = S.adjustments.filter(a => !(a.srcDate === date && a.src !== 'zones'));
  S.inserts = S.inserts.filter(x => x.srcDate !== date);
}
function finalizeDay(date) {
  const log = getLog(date);
  dropDayResults(date);
  const adj = evaluateDay(date);
  for (const a of adj) if (a.kind === 'repeat') S.inserts.push({ id: uid(), at: locate(date).week, planWeek: a.planWeek, src: a.src, srcDate: date });
  S.adjustments.push(...adj);
  log.complete = true; log.completedAt = new Date().toISOString();
  commit();
  return adj;
}
function reopenDay(date) {
  const log = getLog(date); log.complete = false;
  dropDayResults(date);
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
const isLongBike = s => s.disc === 'bike' && (PM.longBike === 'max' || s.long);
function weekStats(w) {
  const disc = {}; PM.discs.forEach(d => disc[d.k] = 0);
  const st = { minutes: 0, disc, quality: 0, race: 0, longBike: null, longRun: null, done: 0, planned: 0, plannedMin: 0 };
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
      if (isLongBike(s)) st.longBike = Math.max(st.longBike || 0, m);
      if (s.disc === 'run') {
        const v = PM.longRun === 'cont' ? l.contRun : (s.long ? m : null);
        if (v != null) st.longRun = Math.max(st.longRun || 0, v);
      }
    }
  }
  return st;
}
/* "2:15" -> 135, "45 min" -> 45 */
const minOf = t => { t = String(t); if (/min/.test(t)) return parseInt(t, 10); const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };

/* Serien für die Diagramme: Plan (aus dem PDF) + Ist, je Kalenderwoche */
function chartSeries() {
  const M = TW(); const cw = curWeek(); const upto = cw === 0 ? 0 : Math.min(cw, M);
  const arr = f => Array.from({ length: M }, (_, i) => f(planWeekData(i + 1), i + 1));
  const ist = fn => arr((wk, c) => { if (c > upto) return null; const st = weekStats(c); if (c === upto && st.done === 0) return null; return fn(st, wk); });
  const keys = PM.discs.map(d => d.k);
  return {
    M, cw: upto, planWeeks: arr((wk, c) => planWeekOf(c)),
    volume: { plan: arr(w => w.hours), ist: ist(st => +(st.minutes / 60).toFixed(2)) },
    disc: { plan: arr((w, c) => PL.disc[planWeekOf(c) - 1]), ist: ist(st => Object.fromEntries(keys.map(k => [k, st.disc[k] / 60]))) },
    quality: { plan: arr(w => w.quality), planRace: arr(w => w.race), ist: ist(st => st.quality), istRace: ist(st => st.race) },
    long: { planBike: arr(w => minOf(w.longBike)), planRun: arr(w => minOf(w.longRun)), istBike: ist(st => st.longBike), istRun: ist(st => st.longRun) }
  };
}

/* ---------- Zonen-Update (nur Pläne mit FTP/CSS/HF) ---------- */
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
  const cw = Math.max(1, Math.min(TW(), curWeek()));
  S.zones = { ...newZ, updated: today };
  const hist = S.zoneHistory;
  const entry = { date: today, z: JSON.parse(JSON.stringify(S.zones)), reason: reason || '', diff };
  const idx = hist.findIndex(h => h.date === today);
  if (idx >= 0) hist[idx] = entry; else hist.push(entry);
  S.adjustments = S.adjustments.filter(a => !(a.src === 'zones' && a.srcDate === today));
  if (diff.length) {
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
  if (!S || !S.zones || PM.zoneModel !== 'ftp') return false;
  if (curWeek(today) === 0 || curWeek(today) === TW() + 1) return false;
  if (diffDays(today, S.zones.updated) < 7) return false;
  return S.snoozeZone !== today;
};

/* ---------- Onboarding ---------- */
function initState(planId, profile, zones) {
  usePlan(planId);
  const start = planStartFor(profile.raceDate);
  S = {
    v: 2, planId, profile, zones: zones ? { ...zones, updated: todayIso() } : null, startDate: start,
    zoneHistory: [], logs: {}, adjustments: [], inserts: [], snoozeZone: null, created: todayIso()
  };
  if (S.zones) S.zoneHistory.push({ date: '1970-01-01', z: JSON.parse(JSON.stringify(S.zones)), reason: 'Onboarding', diff: [] });
  commit();
}
