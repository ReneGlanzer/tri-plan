/* Ansichten */
'use strict';

const IC = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  plan: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/>',
  chart: '<path d="M3 20h18M6 16v-5M11 16V6M16 16v-8M21 16v-3"/>',
  zones: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  swim: '<path d="M2 18c2 0 2-1.4 4-1.4S8 18 10 18s2-1.4 4-1.4S16 18 18 18s2-1.4 4-1.4M2 13c2 0 2-1.4 4-1.4S8 13 10 13s2-1.4 4-1.4S16 13 18 13s2-1.4 4-1.4M14 5.5l-3.5 3 3 3M16 5a1.6 1.6 0 1 0 0-.01"/>',
  bike: '<circle cx="6" cy="16" r="3.6"/><circle cx="18" cy="16" r="3.6"/><path d="M6 16l4-8h5l3 8M10 8L8.5 6H7M12 12h4"/>',
  run: '<circle cx="14.5" cy="4.5" r="1.7"/><path d="M8 21l3-5-2.5-2.5 2-4.5 3.5 2 2.5 3M7 11l3-2.5M14 13.5l2 7"/>',
  strength: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/>',
  race: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  rest: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  alert: '<path d="M12 3l10 18H2zM12 10v5M12 18h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
};
const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${IC[n] || ''}</svg>`;
const DISC_IC = { swim: 'swim', bike: 'bike', run: 'run', strength: 'strength', race: 'race' };
const DISC_DE = { swim: 'Schwimmen', bike: 'Rad', run: 'Laufen', strength: 'Kraft', race: 'Rennen' };
const discIc = d => `<span class="dicon d-${d}">${ic(DISC_IC[d])}</span>`;

const PHASE_DE = {
  'Preparation / Baseline': 'Vorbereitung / Baseline', 'Base I': 'Base I', 'Recovery': 'Regeneration', 'Base II': 'Base II',
  'Recovery / Retest': 'Regeneration / Retest', 'Build I': 'Build I', 'Race Specific I': 'Race Specific I', 'Race Specific II': 'Race Specific II',
  'Peak Specific': 'Peak Specific', 'Peak / Rehearsal': 'Peak / Rehearsal', 'Taper I': 'Taper I', 'Race Week': 'Rennwoche'
};
const phaseDe = p => T(p);

const L = (en, de) => S.lang === 'en' ? en : de;
const staggerAttr = i => `style="--i:${i}"`;

/* ---------- Schätzung Qualitäts-/Race-Minuten aus dem Hauptteil ---------- */
function estMinutes(s) {
  const main = s.raw['Main set'] || '';
  if (s.disc === 'swim' || s.disc === 'strength' || s.disc === 'race') return { q: null, r: null };
  let q = 0, r = 0;
  for (const seg of main.split(/;|\bthen\b|\+/)) {
    let m = 0; let mm;
    const re1 = /(\d+)\s?x\s?(\d+(?:-\d+)?)\s?(min|s)\b/gi;
    while ((mm = re1.exec(seg))) { const a = mm[2].split('-').map(Number); const mid = a.length > 1 ? (a[0] + a[1]) / 2 : a[0]; m += +mm[1] * mid / (mm[3].toLowerCase() === 's' ? 60 : 1); }
    if (!m) { const re2 = /(?:final\s)?(\d+)(?:-(\d+))?\s?min\b(?=[^;]*?(?:@|race|70\.3|tempo|steady|threshold|controlled))/i; const m2 = seg.match(re2); if (m2) m = m2[2] ? (+m2[1] + +m2[2]) / 2 : +m2[1]; }
    if (/\bZ2\b|easy|jog|recovery/i.test(seg) && !/@|race|70\.3|tempo|steady/i.test(seg) && !/\d+\s?x/.test(seg)) m = 0;
    if (m) { q += m; if (/race|70\.3|validated/i.test(seg)) r += m; }
  }
  return { q: q ? Math.round(q) : null, r: r ? Math.round(r) : null };
}

/* ---------- Kleine Bausteine ---------- */
function statusOfSession(s, date) {
  const eff = effective(s);
  if (eff.mode === 'rest') return 'rest';
  const l = (peekLog(date) || { sessions: {} }).sessions[s.id];
  return l && l.status ? l.status : null;
}
const STAT_TXT = { yes: 'Erledigt', partial: 'Teilweise', no: 'Ausgelassen', rest: 'Ruhe (angepasst)' };

function dayState(date) {
  const dm = dayModel(date); if (!dm) return 'none';
  const log = peekLog(date);
  if (log && log.complete) return 'done';
  if (date > todayIso()) return 'future';
  if (date === todayIso()) return 'today';
  return 'open';
}

function progressBar(pct, cls = '') {
  return `<div class="bar ${cls}"><i style="--w:${clamp(pct, 0, 100)}%"></i></div>`;
}

/* ---------- HEUTE ---------- */
function viewHome() {
  const t = todayIso(); const cw = curWeek(t);
  const h = new Date().getHours();
  const hello = h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend';
  const daysToRace = diffDays(S.profile.raceDate, t);
  let html = `<header class="top rise" ${staggerAttr(0)}>
    <div><p class="eyebrow">${esc(fmtDateLong(t))}</p><h1>${hello}, ${esc(S.profile.name.split(' ')[0])}</h1></div>
    <a class="racechip" href="#/plan">${daysToRace > 0 ? `<b>${daysToRace}</b><span>Tage bis<br>${esc(S.profile.raceName)}</span>` : daysToRace === 0 ? `<b>🏁</b><span>Renntag!</span>` : `<b>✓</b><span>Rennen<br>vorbei</span>`}</a>
  </header>`;

  if (zonesDue()) {
    html += `<section class="card alert-card rise" ${staggerAttr(1)}><div class="row"><span class="ico-badge amber">${ic('refresh')}</span><div><h3>Wöchentliches Zonen-Update</h3><p>Zeit, FTP, CSS und Garmin-HF-Zonen zu prüfen. Der Plan passt sich an oder bleibt gleich.</p></div></div>
      <div class="btns"><button class="btn primary" data-act="zoneUpdate">Jetzt aktualisieren</button><button class="btn ghost" data-act="snoozeZone">Später</button></div></section>`;
  }
  const adjs = activeAdjustments(t);
  if (adjs.length) {
    html += `<section class="card adj-card rise" ${staggerAttr(2)}><div class="row"><span class="ico-badge blue">${ic('info')}</span><h3>Änderungen am Plan <small>(bis Wochenende)</small></h3></div>
      <ul class="adj-list">${adjs.map(a => `<li class="${a.kind}"><b>${esc(a.what)}</b><p>${esc(a.why)}</p><small>${esc(fmtDM(a.created))}${a.weekNo ? ` · Woche ${a.weekNo}` : ''}</small></li>`).join('')}</ul></section>`;
  }

  if (cw === 0) {
    const d = diffDays(S.startDate, t);
    html += `<section class="card hero-card rise" ${staggerAttr(3)}><p class="eyebrow">Plan startet</p><h2>${esc(fmtDateLong(S.startDate))}</h2><p>In ${d} ${d === 1 ? 'Tag' : 'Tagen'} beginnt Woche 1 – ${esc(phaseDe(PL.weeks[0].phase))}. Bis dahin: Zonen prüfen und den Plan durchsehen.</p><div class="btns"><a class="btn primary" href="#/week/1">Woche 1 ansehen</a><a class="btn ghost" href="#/zones">Meine Zonen</a></div></section>`;
    return html + weekStrip(1, t);
  }
  if (cw === 21) {
    return html + `<section class="card hero-card rise" ${staggerAttr(3)}><p class="eyebrow">Rennen abgeschlossen</p><h2>Starke Arbeit, ${esc(S.profile.name.split(' ')[0])}!</h2><p>Der 20-Wochen-Plan ist vorbei. Sieh dir unter Performance an, wie dein Ist-Stand zum Plan aussah.</p><div class="btns"><a class="btn primary" href="#/perf">Zur Performance</a></div></section>`;
  }

  const dm = dayModel(t); const st = dayState(t);
  const wk = dm.wk;
  html += `<div class="sec-head rise" ${staggerAttr(3)}><h2>Heutiges Training</h2><span class="pill">Woche ${dm.week} · ${esc(phaseDe(wk.phase))}</span></div>`;
  if (dm.rest) {
    html += `<a class="card sess rest rise" ${staggerAttr(4)} href="#/day/${t}"><div class="row">${`<span class="dicon d-rest">${ic('rest')}</span>`}<div><h3>Ruhetag – Full Rest</h3><p>${esc(T(dm.restText))}</p></div></div>${st === 'done' ? '<span class="done-tag">Tag erledigt</span>' : '<span class="go">Check-in ausfüllen ›</span>'}</a>`;
  } else {
    dm.sessions.forEach((s, i) => { html += sessMini(s, t, i + 4); });
  }
  html += `<a class="btn ${st === 'done' ? 'ghost' : 'primary'} wide rise" ${staggerAttr(8)} href="#/day/${t}">${st === 'done' ? 'Tag ansehen' : 'Training öffnen & eintragen'} ${ic('next')}</a>`;
  html += weekStrip(dm.week, t);
  return html;
}

function sessMini(s, date, i) {
  const eff = effective(s); const st = statusOfSession(s, date);
  const durTxt = s.disc === 'race' ? 'Rennen' : eff.mode === 'rest' ? 'Ruhe' : (eff.dur != null ? fmtHM(eff.dur) : '');
  const parts = T(s.title).split(' - ');
  return `<a class="card sess ${st || ''} d-${s.disc} rise" ${staggerAttr(i)} href="#/day/${date}">
    <div class="row">${discIc(s.disc)}<div class="grow"><h3>${esc(parts.slice(0, 2).join(' – '))}</h3><p>${esc(T(s.raw.Purpose))}</p></div><div class="meta"><b>${durTxt}</b>${eff.changed ? '<span class="tag amber">angepasst</span>' : ''}${st ? `<span class="tag ${st === 'yes' ? 'green' : st === 'no' ? 'red' : 'blue'}">${STAT_TXT[st]}</span>` : ''}</div></div></a>`;
}

function weekStrip(w, today) {
  const st = weekStats(w); const planMin = st.plannedMin;
  const pct = planMin ? Math.round(st.minutes / planMin * 100) : 0;
  let cells = '';
  for (let i = 0; i < 7; i++) {
    const dk = DAYKEYS[i]; const date = dateFor(w, i); const ds = dayState(date);
    const ss = daySess(w, dk);
    const dots = isRestDay(w, dk) ? `<span class="rd">${ic('rest')}</span>` : ss.map(s => `<i class="dot d-${s.disc}${effective(s).changed ? ' chg' : ''}"></i>`).join('');
    cells += `<a href="#/day/${date}" class="wd ${ds} ${date === today ? 'now' : ''}" ${staggerAttr(i)}><small>${wdShort(date)}</small><b>${parseIso(date).getDate()}</b><div class="dots">${dots}</div>${ds === 'done' ? `<span class="tick">${ic('check')}</span>` : ''}</a>`;
  }
  const wk = PL.weeks[w - 1];
  return `<div class="sec-head rise" ${staggerAttr(9)}><h2>Wochenübersicht</h2><a class="link" href="#/week/${w}">Details ›</a></div>
  <section class="card rise" ${staggerAttr(10)}><div class="week-strip">${cells}</div>
    <div class="wk-prog"><div class="row between"><span>${fmtH(st.minutes)} h von ${fmtH(planMin)} h</span><b>${pct} %</b></div>${progressBar(pct)}
    <p class="muted small">Fokus: ${esc(T(wk.focus))}</p></div></section>`;
}

/* ---------- TAG ---------- */
function isGenericTargets(t) { return PL.info.zones.some(z => z.t === t); }

const LBL = { 'Purpose': 'Zweck', 'Warm-up': 'Aufwärmen', 'Main set': 'Hauptteil', 'Cool-down': 'Ausklang', 'Targets': 'Vorgaben', 'Coach note': 'Coach-Hinweis' };
function detailRow(label, htmlText) {
  return `<div class="dl"><dt>${S.lang === 'en' ? label : (LBL[label] || label)}</dt><dd>${htmlText}</dd></div>`;
}

function sessionCard(s, date, z, canLog) {
  const eff = effective(s); const parts = T(s.title).split(' - ');
  const log = (peekLog(date) || { sessions: {} }).sessions[s.id];
  const opt = { lower: eff.lower };
  const R = s.raw;
  let adj = '';
  if (eff.changed) {
    adj = `<div class="adj-box"><div class="row">${ic('alert')}<b>Angepasst</b></div>` +
      (eff.mode === 'rest' ? '<p class="big">Heute: Ruhe statt dieser Einheit.</p>' :
        eff.mode === 'easy' ? `<p class="big">Neue Vorgabe: locker Z1–Z2 (RPE 2–3), ca. ${eff.dur != null ? fmtHM(eff.dur) : 'wie geplant'} – keine Intervalle.</p>` :
          eff.mode === 'reduce' ? `<p class="big">Neue Vorgabe: ${eff.dur != null ? `ca. ${fmtHM(eff.dur)}` : 'kürzer'}${eff.repsMinus ? `, ${eff.repsMinus} Wiederholung${eff.repsMinus > 1 ? 'en' : ''} weniger` : ''}${eff.lower ? ', unteres Ende der Zielbereiche' : ''}.</p>` : '') +
      eff.adjs.map(a => `<p><b>${esc(a.what)}</b><br><span class="muted">Warum: ${esc(a.why)}</span></p>`).join('') + '</div>';
  }
  const planBox = () => `
    ${detailRow('Purpose', enrich(T(R.Purpose), s.disc, z, opt))}
    ${detailRow('Warm-up', enrich(T(R['Warm-up']), s.disc, z, opt))}
    ${detailRow('Main set', enrich(T(R['Main set']), s.disc, z, opt))}
    ${detailRow('Cool-down', enrich(T(R['Cool-down']), s.disc, z, opt))}
    ${detailRow('Targets', isGenericTargets(R.Targets) ? `<span class="orig">${esc(T(R.Targets))}</span><div class="zchips">${zoneChips(s.disc, z)}</div>` : enrich(T(R.Targets), s.disc, z, opt))}
    ${detailRow('Coach note', esc(T(R['Coach note'])))}`;
  const body = eff.mode === 'rest' ? `<details class="orig-plan"><summary>Original-Plan anzeigen</summary><dl>${planBox()}</dl></details>` :
    (eff.mode === 'easy' ? `<details class="orig-plan"><summary>Original-Plan (nicht mehr aktiv)</summary><dl>${planBox()}</dl></details>` : `<dl>${planBox()}</dl>`);
  const durTxt = s.disc === 'race' ? 'Rennen' : eff.mode === 'rest' ? 'Ruhe' : (eff.dur != null ? fmtHM(eff.dur) : '');
  return `<article class="card sessd d-${s.disc} rise" ${staggerAttr(2 + s.idx)} id="${s.id}">
    <div class="row sess-h">${discIc(s.disc)}<div class="grow"><p class="eyebrow">${esc(DISC_DE[s.disc])}${s.test ? ' · Test' : s.quality ? ' · Qualität' : s.key ? ' · Schlüsseleinheit' : ''}</p><h3>${esc(parts.length > 2 ? parts.slice(0, 2).join(' – ') : parts[0])}</h3></div><div class="meta"><b>${durTxt}</b>${log && log.status ? `<span class="tag ${log.status === 'yes' ? 'green' : log.status === 'no' ? 'red' : 'blue'}">${STAT_TXT[log.status]}</span>` : ''}</div></div>
    <p class="plan-title">${esc(T(s.title))}</p>
    ${adj}${body}
    ${eff.mode !== 'rest' && s.disc !== 'race' ? `<button class="btn ghost sm fitbtn" data-act="exportFit" data-sid="${s.id}">${ic('upload')} Garmin-Workout (.fit)</button>` : ''}
    ${eff.mode !== 'rest' && canLog ? logSection(s, date, log, eff, z) : eff.mode !== 'rest' ? `<p class="muted small lock">Eintragen ab ${esc(fmtDate(date))} möglich.</p>` : ''}
  </article>`;
}

/* Eintrag der Ausführungswerte */
function logSection(s, date, log, eff, z) {
  const done = log && log.status;
  return `<details class="logbox" ${done ? '' : 'open'}><summary>${ic('bolt')} Ausführung eintragen ${done ? `<span class="tag green">gespeichert</span>` : ''}</summary>${logForm(s, date, log || {}, eff, z)}</details>`;
}
const radios = (name, opts, cur, cls = '') => `<div class="seg ${cls}" role="radiogroup">${opts.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${String(cur) === String(v) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
const field = (label, name, val, extra = '') => `<label class="fld"><span>${label}</span><input name="${name}" value="${val ?? ''}" ${extra}></label>`;

function logForm(s, date, l, eff, z) {
  const est = estMinutes(s);
  const isTestSwim = /CSS baseline/i.test(s.title);
  const isTestBike = s.test && s.disc === 'bike';
  const isTestRun = s.test && s.disc === 'run';
  let f = `<form class="logform" data-sid="${s.id}" data-date="${date}" onsubmit="return false">`;
  f += `<div class="grp"><label class="lbl">Status *</label>${radios('status', [['yes', 'Erledigt'], ['partial', 'Teilweise'], ['no', 'Ausgelassen']], l.status)}</div>`;
  f += `<div class="fields">`;
  f += field('Dauer (min) *', 'minutes', l.minutes ?? (eff.dur || ''), 'inputmode="decimal"');
  if (s.disc === 'swim') f += field('Distanz (m)', 'dist', l.dist, 'inputmode="decimal"') + field('Ø Pace (mm:ss /100 m)', 'pace', l.pace, 'placeholder="1:45"');
  if (s.disc === 'bike') f += field('Distanz (km)', 'dist', l.dist, 'inputmode="decimal"') + field('Ø Leistung (W)', 'avgP', l.avgP, 'inputmode="numeric"') + field('NP (W)', 'np', l.np, 'inputmode="numeric"') + field('Ø Trittfrequenz', 'cad', l.cad, 'inputmode="numeric"');
  if (s.disc === 'run') f += field('Distanz (km)', 'dist', l.dist, 'inputmode="decimal"') + field('Ø Pace (mm:ss /km)', 'pace', l.pace, 'placeholder="5:30"');
  if (s.disc !== 'strength') f += field('Ø Herzfrequenz', 'avgHr', l.avgHr, 'inputmode="numeric"');
  f += `</div>`;
  if (isTestSwim) f += `<div class="fields">${field('400 m Zeit (mm:ss)', 't400', l.t400, 'placeholder="6:10"')}${field('200 m Zeit (mm:ss)', 't200', l.t200, 'placeholder="2:55"')}</div><p class="muted small">CSS = (T400 − T200) ÷ 2 pro 100 m – wird nach dem Speichern berechnet und für die Zonen vorgeschlagen.</p>`;
  if (isTestBike) f += `<div class="fields">${field('Testergebnis FTP (W)', 'testFtp', l.testFtp, 'inputmode="numeric"')}</div>`;
  if (isTestRun) f += `<div class="fields">${field('Schwellen-Pace (mm:ss /km)', 'testPace', l.testPace, 'placeholder="4:40"')}</div>`;
  f += `<div class="grp"><label class="lbl">RPE (1–10) *</label>${radios('rpe', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => [n, n]), l.rpe, 'rpe')}</div>`;
  if (s.hard || s.test) {
    f += `<div class="fields">${field('Min im Zielbereich (Qualität)', 'qualMin', l.qualMin ?? (est.q ?? ''), 'inputmode="numeric"')}${field('davon rennspezifisch (min)', 'raceMin', l.raceMin ?? (est.r ?? 0), 'inputmode="numeric"')}</div>`;
    f += `<div class="grp"><label class="lbl">${s.disc === 'bike' ? 'Leistung stabil? Letzte Wdh. wie die erste? *' : 'Qualität stabil? Letzte Wdh. wie die erste? *'}</label>${radios('stable', [['ok', 'Ja, stabil'], ['drop', s.disc === 'bike' ? 'Leistung >3–5 % gefallen' : 'Tempo/Leistung gefallen'], ['form', 'Technik/Form ließ nach']], l.stable, 'col')}</div>`;
  }
  if (s.long && s.disc === 'bike') {
    f += `<div class="fields">${field('Kohlenhydrate (g/h)', 'carbs', l.carbs, 'inputmode="numeric" placeholder="50–70"')}</div><div class="grp"><label class="lbl">Magen-Darm-Verträglichkeit</label>${radios('gi', [['good', 'Gut'], ['some', 'Leichte Probleme'], ['problems', 'Probleme']], l.gi)}</div>`;
  }
  f += `<div class="grp"><label class="lbl">Coach-Hinweis eingehalten?</label><p class="quote">${esc(T(s.raw['Coach note']))}</p>${radios('coachOk', [['yes', 'Ja'], ['partial', 'Teilweise'], ['no', 'Nein']], l.coachOk)}</div>`;
  f += `<label class="fld full"><span>Notiz (optional)</span><textarea name="notes" rows="2">${esc(l.notes || '')}</textarea></label>`;
  f += `<div class="btns"><label class="btn ghost file">${ic('upload')} Garmin-Datei (.tcx/.gpx) einlesen<input type="file" accept=".tcx,.gpx,.xml" data-act-change="importFile"></label><button type="button" class="btn primary" data-act="saveSession">Einheit speichern</button></div></form>`;
  return f;
}

/* ---------- Tages-Check (Wochen-Checkliste aus dem PDF) ---------- */
function dayCheckCard(date, dm) {
  const log = peekLog(date) || { sessions: {}, check: null, complete: false };
  const c = log.check || {}; const wk = dm.wk; const cl = wk.checklist;
  const canLog = date <= todayIso();
  if (log.complete) {
    return `<section class="card done-card rise" ${staggerAttr(6)}><div class="row"><span class="ico-badge green">${ic('check')}</span><div><h3>Tag erledigt</h3><p>Alle Einheiten und die Tages-Checkliste sind eingetragen.</p></div></div><div class="btns"><button class="btn ghost" data-act="reopenDay" data-date="${date}">Tag wieder öffnen</button></div></section>`;
  }
  if (!canLog) return '';
  const st = weekStats(dm.week);
  const dayPlan = dm.sessions.reduce((a, s) => a + (effective(s).dur || 0), 0);
  const dayAct = dm.sessions.reduce((a, s) => a + sessionActualMin(s), 0);
  const hasHard = dm.sessions.some(s => s.hard && effective(s).mode !== 'rest');
  const nextRest = (() => { for (let i = 1; i <= 7; i++) { const l = locate(addDays(date, i)); if (l && isRestDay(l.week, l.dayKey)) return addDays(date, i); } return null; })();
  const q = (n, title, sub, inner) => `<div class="ck"><div class="ck-h"><span class="num">${n}</span><div><h4>${title}</h4><p class="muted small">Plan-Checkliste: „${esc(T(sub))}“</p></div></div>${inner}</div>`;
  return `<section class="card check-card rise" ${staggerAttr(6)}><h2>Tages-Checkliste</h2><p class="muted">Aus der Wochen-Checkliste (Woche ${dm.week}) – täglich nach dem Training.</p>
  <form id="dayform" data-date="${date}" onsubmit="return false">
  ${q(1, 'Ruhetag', cl[0], dm.rest ? `<div class="grp"><label class="lbl">Full Rest eingehalten? *</label>${radios('restKept', [['yes', 'Ja, komplett'], ['no', 'Nein, trainiert']], c.restKept)}<p class="muted small">Nur Spaziergehen und 5–10 min lockere Mobility sind erlaubt.</p></div>` : `<p class="muted">Kein Ruhetag heute${nextRest ? ` – nächster: ${esc(fmtDate(nextRest))}` : ''}.</p>`)}
  ${q(2, 'Volumen', cl[1], `<p class="statline"><b>${fmtHM(dayAct)}</b> heute absolviert · geplant ${fmtHM(dayPlan)}<br>Woche: ${fmtH(st.minutes)} h von ${fmtH(st.plannedMin)} h</p><div class="fields">${field('Zusatztraining außerhalb des Plans (min)', 'extraMin', c.extraMin ?? 0, 'inputmode="numeric"')}</div>`)}
  ${q(3, 'Spezifität', cl[2], hasHard ? `<div class="grp"><label class="lbl">Kernintention der Schlüssel-/Qualitätseinheit erfüllt? *</label>${radios('specOk', [['yes', 'Ja'], ['partial', 'Teilweise'], ['no', 'Nein']], c.specOk)}</div>` : '<p class="muted">Keine Qualitäts-/Schlüsseleinheit heute.</p>')}
  ${q(4, 'Junk-Mile-Check', cl[3], `<div class="grp"><label class="lbl">Hatte jede lockere Einheit einen Zweck – kein Füllumfang? *</label>${radios('junkOk', [['yes', 'Ja'], ['no', 'Nein, Füllumfang']], c.junkOk)}</div>`)}
  ${q(5, 'Auto-Regulation', cl[4], `
    <div class="fields">${field('Schlaf letzte Nacht (h) *', 'sleep', c.sleep, 'inputmode="decimal" placeholder="7.5"')}</div>
    <div class="grp"><label class="lbl">Müdigkeit heute (1 frisch – 5 platt) *</label>${radios('fatigue', [1, 2, 3, 4, 5].map(n => [n, n]), c.fatigue, 'rpe')}</div>
    <div class="grp"><label class="lbl">Schmerzen? *</label>${radios('pain', [['none', 'Keine'], ['mild', 'Leicht'], ['strong', 'Stark']], c.pain)}
      <select name="painArea" class="sel"><option value="all" ${c.painArea === 'all' ? 'selected' : ''}>Bereich: allgemein</option><option value="run" ${c.painArea === 'run' ? 'selected' : ''}>Bereich: Laufen</option><option value="bike" ${c.painArea === 'bike' ? 'selected' : ''}>Bereich: Rad</option><option value="swim" ${c.painArea === 'swim' ? 'selected' : ''}>Bereich: Schwimmen (Schulter)</option></select></div>
    <div class="grp"><label class="lbl">Krankheitszeichen? *</label>${radios('illness', [['none', 'Nein'], ['mild', 'Leicht'], ['yes', 'Ja']], c.illness)}</div>`)}
  <button type="button" class="btn primary wide" data-act="finishDay">Tag abschließen</button></form></section>`;
}

function viewDay(date) {
  const dm = dayModel(date);
  if (!dm) return `<header class="top"><a class="back" href="#/">${ic('back')}</a><h1>Kein Plantag</h1></header><p class="muted pad">Dieses Datum liegt außerhalb des 20-Wochen-Plans.</p>`;
  const z = Zn.at(S, date);
  const t = todayIso(); const canLog = date <= t;
  const ds = dayState(date);
  let html = `<header class="top rise"><a class="back" href="#/week/${dm.week}">${ic('back')}</a><div class="grow"><p class="eyebrow">Woche ${dm.week} · ${esc(phaseDe(dm.wk.phase))} · Plan-Tag ${DAY_DE[dm.dayKey]}</p><h1>${esc(fmtDateLong(date))}</h1></div>${ds === 'done' ? `<span class="tag green">erledigt</span>` : ''}</header>`;
  const sib = `<div class="daynav rise"><a class="btn ghost sm" href="#/day/${addDays(date, -1)}">${ic('back')} Vortag</a><a class="btn ghost sm" href="#/day/${addDays(date, 1)}">Folgetag ${ic('next')}</a></div>`;
  html += sib;
  if (dm.rest) {
    html += `<article class="card sessd rest rise" ${staggerAttr(2)}><div class="row sess-h"><span class="dicon d-rest">${ic('rest')}</span><div class="grow"><p class="eyebrow">${esc(DAY_DE[dm.dayKey])} · Erholung</p><h3>Full Rest</h3></div></div><p class="plan-title">${DAY_DE[dm.dayKey]} - ${T('FULL REST')}</p><p>${esc(T(dm.restText))}</p></article>`;
  } else {
    dm.sessions.forEach(s => html += sessionCard(s, date, z, canLog));
  }
  html += dayCheckCard(date, dm);
  return html;
}

/* ---------- WOCHE ---------- */
function viewWeek(n) {
  n = clamp(n, 1, 20); const wk = PL.weeks[n - 1]; const st = weekStats(n); const cw = curWeek();
  const pct = st.plannedMin ? Math.round(st.minutes / st.plannedMin * 100) : 0;
  let html = `<header class="top rise"><a class="back" href="#/plan">${ic('back')}</a><div class="grow"><p class="eyebrow">${esc(fmtDM(dateFor(n, 0)))} – ${esc(fmtDM(dateFor(n, 6)))}</p><h1>Woche ${n} <small>${esc(phaseDe(wk.phase))}</small></h1></div></header>
  <button class="btn ghost wide rise" data-act="exportWeek" data-week="${n}">${ic('upload')} ${L('Week as Garmin workouts (ZIP)', 'Woche als Garmin-Workouts (ZIP)')}</button>
  <div class="daynav rise">${n > 1 ? `<a class="btn ghost sm" href="#/week/${n - 1}">${ic('back')} Woche ${n - 1}</a>` : '<span></span>'}${n < 20 ? `<a class="btn ghost sm" href="#/week/${n + 1}">Woche ${n + 1} ${ic('next')}</a>` : '<span></span>'}</div>
  <section class="card rise" ${staggerAttr(2)}><div class="kpis">
    <div><small>${L('Planned volume','Geplanter Umfang')}</small><b>${wk.hours.toFixed(2).replace(/\.?0+$/, '')} h</b></div><div><small>${L('Long bike','Lange Ausfahrt')}</small><b>${wk.longBike}</b></div><div><small>${L('Long run','Langer Lauf')}</small><b>${wk.longRun}</b></div>
    <div><small>${L('Quality min','Qualität (min)')}</small><b>${wk.quality}</b></div><div><small>${L('Race-specific min','Rennspezifisch (min)')}</small><b>${wk.race}</b></div><div><small>Ist / Plan</small><b>${n <= cw && cw <= 20 ? pct + ' %' : '–'}</b></div></div>
    <p class="focus"><span class="muted">${L('Primary focus','Hauptfokus')}</span> ${esc(T(wk.focus))}</p><p class="muted">${esc(T(wk.note))}</p></section>
  <div class="sec-head rise" ${staggerAttr(3)}><h2>Übersicht</h2></div>
  <section class="card rise" ${staggerAttr(4)}><div class="ovtable"><div class="ovh"><span>${L('Day','Tag')}</span><span>${L('Session(s)','Einheit(en)')}</span></div>${wk.overview.map((o, i) => {
    const date = dateFor(n, i); const ds = dayState(date);
    return `<a href="#/day/${date}" class="ovrow ${ds}"><span class="d"><b>${DAY_DE[o.day]}</b><small>${fmtDM(date)}</small></span><span class="t">${esc(T(o.text))}</span><span class="st">${ds === 'done' ? ic('check') : ic('next')}</span></a>`;
  }).join('')}</div></section>
  <div class="sec-head rise" ${staggerAttr(5)}><h2>${L('Weekly quality-control analysis','Wöchentliche Qualitätskontrolle')}</h2></div>
  <section class="card rise" ${staggerAttr(6)}><ul class="wkchk">${wk.checklist.map((c, i) => `<li><span class="bullet">${ic('check')}</span><div><p>${esc(T(c))}</p><small class="muted">${weekCheckSummary(n, i)}</small></div></li>`).join('')}</ul></section>`;
  return html;
}
function weekCheckSummary(n, i) {
  const logs = []; for (let d = 0; d < 7; d++) { const l = peekLog(dateFor(n, d)); if (l && l.check) logs.push({ d, c: l.check, l }); }
  if (!logs.length) return 'Noch keine Tageseinträge.';
  if (i === 0) { const r = logs.find(x => isRestDay(n, DAYKEYS[x.d])); return r ? (r.c.restKept === 'yes' ? 'Ruhetag eingehalten ✓' : 'Ruhetag nicht eingehalten ✗') : 'Ruhetag noch offen.'; }
  if (i === 1) { const st = weekStats(n); return `Ist ${fmtH(st.minutes)} h von ${fmtH(st.plannedMin)} h · Zusatz ${logs.reduce((a, x) => a + (x.c.extraMin || 0), 0)} min`; }
  if (i === 2) { const spec = logs.filter(x => x.c.specOk); if (!spec.length) return 'Keine Qualitätstage erfasst.'; return `Kernintention: ${spec.filter(x => x.c.specOk === 'yes').length} von ${spec.length} Qualitätstagen erfüllt`; }
  if (i === 3) { const bad = logs.filter(x => x.c.junkOk === 'no').length; return bad ? `${bad}× Füllumfang gemeldet` : 'Kein Füllumfang gemeldet ✓'; }
  const sl = logs.filter(x => x.c.sleep != null), fa = logs.filter(x => x.c.fatigue != null);
  return `Ø Schlaf ${sl.length ? (sl.reduce((a, x) => a + x.c.sleep, 0) / sl.length).toFixed(1) : '–'} h · Ø Müdigkeit ${fa.length ? (fa.reduce((a, x) => a + x.c.fatigue, 0) / fa.length).toFixed(1) : '–'} / 5`;
}

/* ---------- PLAN ---------- */
function viewPlan() {
  const cw = curWeek(); const blocks = PL.info.blocks;
  let html = `<header class="top rise"><div><p class="eyebrow">${esc(S.profile.raceName)} · ${esc(fmtDateLong(S.profile.raceDate))}</p><h1>Trainingsplan</h1></div></header>
  <section class="card rise" ${staggerAttr(1)}><div class="row between"><div><small class="muted">Start</small><b class="big2">${esc(fmtDate(S.startDate))}</b></div><div><small class="muted">Rennen</small><b class="big2">${esc(fmtDate(S.profile.raceDate))}</b></div><div><small class="muted">Woche</small><b class="big2">${cw === 0 ? '–' : cw > 20 ? '✓' : cw + ' / 20'}</b></div></div></section>`;
  let bi = 0;
  PL.weeks.forEach((w, i) => {
    if (i % 4 === 0) { const b = blocks[bi++]; html += `<div class="sec-head rise" ${staggerAttr(2)}><h2>${esc(T(b.h))}</h2></div><p class="muted small blockdesc">${esc(T(b.t))}</p>`; }
    const st = weekStats(w.n); const pct = st.plannedMin ? Math.round(st.minutes / st.plannedMin * 100) : 0;
    const state = w.n === cw ? 'now' : w.n < cw ? 'past' : '';
    html += `<a class="card wcard ${state} rise" ${staggerAttr(3 + (i % 4))} href="#/week/${w.n}"><div class="wnum">${w.n}</div><div class="grow"><h3>${esc(phaseDe(w.phase))}</h3><p class="muted small">${esc(fmtDM(dateFor(w.n, 0)))} – ${esc(fmtDM(dateFor(w.n, 6)))} · ${w.hours.toFixed(2).replace(/\.?0+$/, '')} h · LB ${w.longBike} · LR ${w.longRun}</p>${w.n <= cw && cw <= 20 ? progressBar(pct) : ''}</div>${ic('next')}</a>`;
  });
  return html;
}

/* ---------- PERFORMANCE ---------- */
const PERF_TABS = [['vol', 'Volumen'], ['disc', 'Disziplinen'], ['qual', 'Qualität'], ['long', 'Long Sessions']];
let perfTab = 'vol';
function viewPerf() {
  const cs = chartSeries(); const cw = cs.cw;
  const legend = items => `<div class="legend">${items.map(([c, l, dash]) => `<span><i class="${dash ? 'dash' : ''}" style="--c:${c}"></i>${l}</span>`).join('')}</div>`;
  let title, sub, chart, leg, stats;
  const sumTo = (arr, to) => arr.slice(0, to).reduce((a, v) => a + (v || 0), 0);
  if (perfTab === 'vol') {
    title = 'Weekly training volume progression'; sub = 'Wochenumfang in Stunden – Plan (PDF) vs. Ist';
    chart = lineChart('vol', [{ label: 'Stunden', color: COL.vol, plan: cs.volume.plan, ist: cs.volume.ist }], { cw, yFmt: v => v, ceiling: 12, tip: i => tipTxt(i, [['Plan', cs.volume.plan[i] + ' h', COL.vol], ['Ist', cs.volume.ist[i] != null ? cs.volume.ist[i].toFixed(1) + ' h' : '–', COL.vol]]) });
    leg = legend([[COL.vol, 'Plan (PDF)', true], [COL.vol, 'Ist'], ['#888', '12-h-Ceiling', true]]);
    const done = Math.max(0, cw - 1); const p = sumTo(cs.volume.plan, done), a = sumTo(cs.volume.ist, done);
    stats = [['Ist (abgeschl. Wochen)', a.toFixed(1) + ' h'], ['Plan (abgeschl. Wochen)', p.toFixed(1) + ' h'], ['Erfüllung', p ? Math.round(a / p * 100) + ' %' : '–'], ['Aktuelle Woche', cw ? `${(cs.volume.ist[cw - 1] ?? 0).toFixed(1)} / ${cs.volume.plan[cw - 1]} h` : '–']];
  } else if (perfTab === 'disc') {
    title = 'Approximate discipline distribution by week'; sub = 'Stunden je Disziplin – Plan (PDF, breite Balken) vs. Ist (schmale Balken)';
    chart = stackChart('disc', cs.disc.plan, cs.disc.ist, { cw, tip: i => { const p = cs.disc.plan[i], a = cs.disc.ist[i]; return tipTxt(i, ['swim', 'bike', 'run', 'strength'].map(k => [DISC_DE[k], `${a ? a[k].toFixed(1) : '–'} / ${p[k].toFixed(1)} h`, COL[k]])); } });
    leg = legend([[COL.swim, 'Swim'], [COL.bike, 'Bike'], [COL.run, 'Run'], [COL.strength, 'Strength']]);
    const done = Math.max(0, cw - 1);
    stats = ['swim', 'bike', 'run', 'strength'].map(k => { const p = cs.disc.plan.slice(0, done).reduce((a, d) => a + d[k], 0), a = cs.disc.ist.slice(0, done).reduce((x, d) => x + (d ? d[k] : 0), 0); return [`${DISC_DE[k]} (Ist/Plan)`, `${a.toFixed(1)} / ${p.toFixed(1)} h`]; });
  } else if (perfTab === 'qual') {
    title = 'Progression of quality and race specificity'; sub = 'Qualitäts- und rennspezifische Minuten pro Woche – Plan (PDF) vs. Ist (Ist = Minuten im Zielbereich, die du beim Eintragen angibst)';
    chart = lineChart('qual', [{ color: COL.qual, plan: cs.quality.plan, ist: cs.quality.ist }, { color: COL.race, plan: cs.quality.planRace, ist: cs.quality.istRace }], { cw, yFmt: v => v, min: 0, tip: i => tipTxt(i, [['Quality Plan', cs.quality.plan[i] + ' min', COL.qual], ['Quality Ist', cs.quality.ist[i] != null ? cs.quality.ist[i] + ' min' : '–', COL.qual], ['Race-spec. Plan', cs.quality.planRace[i] + ' min', COL.race], ['Race-spec. Ist', cs.quality.istRace[i] != null ? cs.quality.istRace[i] + ' min' : '–', COL.race]]) });
    leg = legend([[COL.qual, 'Quality Plan', true], [COL.qual, 'Quality Ist'], [COL.race, 'Race-specific Plan', true], [COL.race, 'Race-specific Ist']]);
    const done = Math.max(0, cw - 1);
    stats = [['Quality Ist / Plan', `${sumTo(cs.quality.ist, done)} / ${sumTo(cs.quality.plan, done)} min`], ['Race-specific Ist / Plan', `${sumTo(cs.quality.istRace, done)} / ${sumTo(cs.quality.planRace, done)} min`]];
  } else {
    title = 'Long-session progression'; sub = 'Länge der Long Bike (Sa) und Long Run (So) in Minuten – Plan (PDF) vs. Ist';
    chart = lineChart('long', [{ color: COL.bike, plan: cs.long.planBike, ist: cs.long.istBike }, { color: COL.run, plan: cs.long.planRun, ist: cs.long.istRun }], { cw, yFmt: v => v, min: 0, tip: i => tipTxt(i, [['Long bike Plan', fmtHM(cs.long.planBike[i]), COL.bike], ['Long bike Ist', cs.long.istBike[i] != null ? fmtHM(cs.long.istBike[i]) : '–', COL.bike], ['Long run Plan', fmtHM(cs.long.planRun[i]), COL.run], ['Long run Ist', cs.long.istRun[i] != null ? fmtHM(cs.long.istRun[i]) : '–', COL.run]]) });
    leg = legend([[COL.bike, 'Long bike Plan', true], [COL.bike, 'Long bike Ist'], [COL.run, 'Long run Plan', true], [COL.run, 'Long run Ist']]);
    const last = Math.max(0, cw - 1) - 1; const lb = last >= 0 ? cs.long.istBike[last] : null, lr = last >= 0 ? cs.long.istRun[last] : null;
    stats = [['Letzte Long Bike (Ist/Plan)', last >= 0 ? `${lb != null ? fmtHM(lb) : '–'} / ${fmtHM(cs.long.planBike[last])}` : '–'], ['Letzte Long Run (Ist/Plan)', last >= 0 ? `${lr != null ? fmtHM(lr) : '–'} / ${fmtHM(cs.long.planRun[last])}` : '–']];
  }
  return `<header class="top rise"><div><p class="eyebrow">Ist-Stand vs. PDF-Plan</p><h1>Performance</h1></div></header>
  <div class="tabs rise" ${staggerAttr(1)}>${PERF_TABS.map(([k, l]) => `<button class="tabbtn ${perfTab === k ? 'on' : ''}" data-act="perfTab" data-tab="${k}">${l}</button>`).join('')}</div>
  <section class="card rise" ${staggerAttr(2)}><h3 class="ctitle">${title}</h3><p class="muted small">${sub}</p>${leg}<div id="chartHost">${chart}</div>
    <p class="muted small">${cw === 0 ? 'Der Plan hat noch nicht begonnen – die Ist-Linie erscheint ab Woche 1.' : 'Tippe/ziehe im Diagramm für Details je Woche. Die senkrechte Linie markiert die aktuelle Woche.'}</p></section>
  <section class="card rise" ${staggerAttr(3)}><div class="kpis two">${stats.map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')}</div></section>
  <p class="muted small pad">${esc(T(PL.info.dashboardNote))}</p>`;
}
const tipTxt = (i, rows) => `<b>Woche ${i + 1}</b>` + rows.map(([l, v, c]) => `<span><i style="--c:${c}"></i>${l}<em>${v}</em></span>`).join('');

/* ---------- ZONEN ---------- */
function viewZones() {
  const z = S.zones; const bike = Zn.bike(z), swim = Zn.swim(z), run = Zn.run(z);
  const nextDue = addDays(z.updated, 7);
  const hrNames = ['Z1 Sehr leicht', 'Z2 Leicht', 'Z3 Aerob', 'Z4 Schwelle', 'Z5 Maximum'];
  return `<header class="top rise"><div><p class="eyebrow">Stand ${esc(fmtDate(z.updated))} · nächstes Update ${esc(fmtDate(nextDue))}</p><h1>Meine Zonen</h1></div></header>
  <button class="btn primary wide rise" ${staggerAttr(1)} data-act="zoneUpdate">${ic('refresh')} Zonen aktualisieren</button>
  <section class="card rise d-bike" ${staggerAttr(2)}><div class="row">${discIc('bike')}<div><h3>Rad · FTP ${z.ftp} W</h3><p class="muted small">${S.profile.weight ? (z.ftp / S.profile.weight).toFixed(2) + ' W/kg' : ''}</p></div></div>
    <div class="ztable">${bike.map(b => `<div class="zr c-bike"><span>${b.name}</span><em>${b.lo}–${b.hi} %</em><b>${b.wlo}–${b.whi} W</b></div>`).join('')}</div></section>
  <section class="card rise d-swim" ${staggerAttr(3)}><div class="row">${discIc('swim')}<div><h3>Schwimmen · CSS ${fmtMMSS(z.css)}/100 m</h3></div></div>
    <div class="ztable">${swim.map(s => `<div class="zr c-swim"><span>${s.name}</span><em>CSS ${s.a === s.b ? '' : (s.a >= 0 ? '+' : '') + s.a + ' … ' + (s.b >= 0 ? '+' : '') + s.b + ' s'}</em><b>${paceRange(s.plo, s.phi)}</b></div>`).join('')}</div></section>
  <section class="card rise d-run" ${staggerAttr(4)}><div class="row">${discIc('run')}<div><h3>Laufen · Garmin-HF-Zonen</h3><p class="muted small">${z.runThr ? 'Schwellen-Pace ' + fmtMMSS(z.runThr) + '/km' : 'Keine Schwellen-Pace hinterlegt – Lauf-Vorgaben in HF/RPE'}</p></div></div>
    <div class="ztable">${z.hr.map((r, i) => `<div class="zr c-run"><span>${hrNames[i]}</span><b>${r[0]}–${r[1]} bpm</b></div>`).join('')}</div>
    <h4 class="sub">Lauf-Vorgaben des Plans (RPE → HF${z.runThr ? ' / Pace' : ''})</h4>
    <div class="ztable">${run.map(r => `<div class="zr c-run"><span>${r.name}</span><b>HF ${rng(r.hr[0], r.hr[1])}</b>${r.plo ? `<em>${runPaceRange(r.plo, r.phi)}</em>` : ''}</div>`).join('')}</div>
    <p class="muted small">Laut Plan haben bei Hitze, Hügeln und Müdigkeit HF und RPE Vorrang vor der Pace.</p></section>
  <div class="sec-head rise" ${staggerAttr(5)}><h2>Verlauf</h2></div>
  <section class="card rise" ${staggerAttr(6)}>${S.zoneHistory.slice().reverse().map(h => `<div class="hist"><div class="row between"><b>${h.date === '1970-01-01' ? 'Onboarding' : esc(fmtDate(h.date))}</b><small class="muted">${esc(h.reason || '')}</small></div>${h.diff && h.diff.length ? `<p class="small">${h.diff.map(d => `${esc(d.k)}: ${esc(d.from)} → ${esc(d.to)}`).join('<br>')}</p>` : `<p class="small muted">${h.date === '1970-01-01' ? `FTP ${h.z.ftp} W · CSS ${fmtMMSS(h.z.css)}` : 'Unverändert bestätigt'}</p>`}</div>`).join('')}</section>`;
}

/* ---------- MEHR / INFO ---------- */
function viewMore() {
  const I = PL.info;
  const acc = (title, inner, open) => `<details class="acc card rise" ${open ? 'open' : ''}><summary>${title}${ic('next')}</summary><div class="accbody">${inner}</div></details>`;
  const master = `<div class="mtable"><div class="mh"><span>Wk</span><span>Phase</span><span>${L('Hours', 'Std.')}</span><span>LB</span><span>LR</span></div>${PL.weeks.map(w => `<a href="#/week/${w.n}" class="mr"><span>${w.n}</span><span>${esc(T(w.phase))}<small>${esc(T(w.focus))}</small></span><span>${w.hours}</span><span>${w.longBike}</span><span>${w.longRun}</span></a>`).join('')}</div>`;
  return `<header class="top rise"><div><p class="eyebrow">Plan-Wissen &amp; Einstellungen</p><h1>Mehr</h1></div></header>
  <div class="sec-head"><h2>${L('20-Week Ironman 70.3 Performance Plan', '20-Wochen Ironman 70.3 Performance-Plan')}</h2></div>
  <p class="muted pad">${esc(T(I.subtitle))}</p>
  ${acc(L('Performance philosophy &amp; How to use', 'Performance-Philosophie &amp; Anwendung'), `<h4>${L('Performance philosophy', 'Performance-Philosophie')}</h4><p>${esc(T(I.philosophy))}</p><h4>${L('How to use this document', 'So nutzt du diesen Plan')}</h4><p>${esc(T(I.howto))}</p>`, true)}
  ${acc(L('1. Training zones and execution rules', '1. Trainingszonen und Ausführungsregeln'), I.zones.map(x => `<h4>${esc(T(x.h))}</h4><p>${esc(T(x.t))}</p>`).join('') + `<div class="mtable m3"><div class="mh"><span>${T('Metric')}</span><span>${T('Primary use')}</span><span>${T('Secondary guardrail')}</span></div>${I.metrics.map(m => `<div class="mr">${m.map(c => `<span>${esc(T(c))}</span>`).join('')}</div>`).join('')}</div><h4>${L('Hard-session rule', 'Regel für harte Einheiten')}</h4><p>${esc(T(I.hardrule))}</p>`)}
  ${acc(L('2. 20-week master plan', '2. 20-Wochen-Masterplan'), master)}
  ${acc(L('3. Block / monthly analysis', '3. Block-/Monatsanalyse'), I.blocks.map(b => `<h4>${esc(T(b.h))}</h4><p>${esc(T(b.t))}</p><p class="muted">${esc(T(b.m))}</p>`).join(''))}
  ${acc(L('5. Test / retest protocol', '5. Test-/Retest-Protokoll'), I.tests.map(b => `<h4>${esc(T(b.h))}</h4><p>${esc(T(b.t))}</p>`).join(''))}
  ${acc(L('6. Race-execution framework', '6. Rennausführung'), `<div class="mtable m2"><div class="mh"><span>Segment</span><span>${L('Execution', 'Ausführung')}</span></div>${I.race.map(r => `<div class="mr"><span>${esc(T(r[0]))}</span><span>${esc(T(r[1]))}</span></div>`).join('')}</div><h4>${L('Nutrition rehearsal', 'Ernährungsprobe')}</h4><p>${esc(T(I.nutrition))}</p><h4>${L('Final principle', 'Leitprinzip')}</h4><p>${esc(T(I.principle))}</p>`)}
  <div class="sec-head"><h2>App</h2></div>
  <a class="card linkrow rise" href="#/settings"><span>Einstellungen, Backup, Garmin-Export &amp; Sprache</span>${ic('next')}</a>`;
}

function viewSettings() {
  const p = S.profile;
  return `<header class="top rise"><a class="back" href="#/more">${ic('back')}</a><h1>Einstellungen</h1></header>
  <section class="card rise" ${staggerAttr(1)}><h3>Profil &amp; Rennen</h3><form id="setform" onsubmit="return false">
    <div class="fields">${field('Name', 'name', p.name)}${field('Gewicht (kg)', 'weight', p.weight, 'inputmode="decimal"')}${field('Rennname', 'raceName', p.raceName)}<label class="fld"><span>Renndatum</span><input type="date" name="raceDate" value="${p.raceDate}"></label></div>
    <p class="muted small">Plan-Start: <b>${esc(fmtDate(S.startDate))}</b> (${RACE_OFFSET + 1} Tage vor dem Rennen inkl. Renntag). Eine Änderung des Renndatums verschiebt den gesamten Plan; bereits eingetragene Daten bleiben an ihren Kalendertagen.</p>
    <button class="btn primary" data-act="saveSettings">Speichern</button></form></section>
  <section class="card rise" ${staggerAttr(2)}><h3>Sprache der Plan-Texte</h3><p class="muted small">Die Einheiten-Beschreibungen gibt es auf Deutsch und im englischen Original des PDFs.</p>
    <div class="seg"><label><input type="radio" name="lang" value="de" ${S.lang === 'en' ? '' : 'checked'} data-act-change="setLang"><span>Deutsch</span></label><label><input type="radio" name="lang" value="en" ${S.lang === 'en' ? 'checked' : ''} data-act-change="setLang"><span>Original (EN)</span></label></div></section>
  <section class="card rise" ${staggerAttr(2)}><h3>Backup</h3><p class="muted small">Deine Daten liegen nur auf diesem Gerät (Safari-Speicher). Sichere sie regelmäßig als Datei, besonders vor iOS-Updates oder wenn du Safari-Daten löschst.</p>
    <div class="btns"><button class="btn ghost" data-act="exportData">${ic('upload')} Backup exportieren</button><label class="btn ghost file">Backup importieren<input type="file" accept=".json,application/json" data-act-change="importData"></label></div></section>
  <section class="card rise" ${staggerAttr(3)}><h3>Garmin-Workflow</h3><ul class="plain">
    <li><b>Aktiv:</b> Training in Garmin durchführen → Werte in der App eintragen (Dauer, Leistung, Pace, HF, RPE …) → Tages-Checkliste ausfüllen.</li>
    <li><b>Aktiv:</b> In der Einheit „Garmin-Datei einlesen“: Aktivität in Garmin Connect (Web) als <i>.tcx</i> oder <i>.gpx</i> exportieren und einlesen – Dauer, Distanz und HF werden vorausgefüllt.</li>
    <li><b>Neu:</b> Workouts als <i>.fit</i> exportieren (pro Einheit oder als Wochen-ZIP, mit deinen aktuellen Watt-/HF-/Pace-Zielen). Datei per USB auf die Uhr kopieren: Ordner <i>GARMIN/NewFiles</i> (bzw. <i>GARMIN/Workouts</i>). Danach erscheint sie im Trainingsmenü der Uhr.</li>
    <li><b>Nicht möglich:</b> direkte Garmin-Connect-Verbindung (die Schnittstelle ist nicht frei zugänglich).</li></ul></section>
  <section class="card rise" ${staggerAttr(4)}><h3>Auf dem iPhone installieren</h3><p class="muted small">Safari öffnen → Teilen-Symbol → „Zum Home-Bildschirm“. Danach startet die App im Vollbild und funktioniert offline. Die Zonen-Erinnerung erscheint beim Öffnen der App (Wochenstart).</p></section>
  <section class="card rise" ${staggerAttr(5)}><h3>Zurücksetzen</h3><p class="muted small">Löscht alle Daten auf diesem Gerät und startet das Onboarding neu.</p><button class="btn danger" data-act="resetAll">Alles löschen</button></section>`;
}

