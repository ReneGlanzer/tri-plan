/* Ansichten (planunabhängig; Plan-Eigenheiten kommen aus PM = Plan-Metadaten) */
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
  mob: '<path d="M12 21c-4.5-3.2-8-6.4-8-10.5A4.5 4.5 0 0 1 12 8a4.5 4.5 0 0 1 8 2.5c0 4.1-3.5 7.3-8 10.5z"/>',
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
const DISC_IC = { swim: 'swim', bike: 'bike', run: 'run', strength: 'strength', mob: 'mob', race: 'race' };
const DISC_DE = { swim: 'Schwimmen', bike: 'Rad', run: 'Laufen', strength: 'Kraft', mob: 'Mobility/Yoga', race: 'Rennen' };
const discIc = d => `<span class="dicon d-${d}">${ic(DISC_IC[d])}</span>`;
const phaseDe = p => T(p);

const L = (en, de) => (S && S.lang === 'en' && PM.hasEnglish) ? en : de;
const staggerAttr = i => `style="--i:${i}"`;
const MONTHS_FULL = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const fmtLong = s => { const d = parseIso(s); return `${d.getDate()}. ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`; };
const fmtDMY = s => { const d = parseIso(s); return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`; };

/* Platzhalter in Plan-Texten: Datumsangaben richten sich nach dem gewählten Zeitraum */
function resolveTokens(str) {
  return String(str).replace(/\{\{(range|start:\d+|day:\d+:\w+)\}\}/g, (m, k) => {
    if (k === 'range') return `${fmtLong(S.startDate)} – ${fmtLong(lastPlanDay())}`;
    const p = k.split(':');
    if (p[0] === 'start') { const c = sched().indexOf(+p[1]) + 1; return c ? fmtDMY(dateFor(c, 0)) : '–'; }
    const d = dateOfPlanWeek(+p[1], p[2]); return d ? `${wdShort(d)} ${fmtDate(d).split(', ')[1]} ${parseIso(d).getFullYear()}` : '–';
  });
}
const wkNo = c => planWeekOf(c);
const wkTag = c => isRepeatWeek(c) ? ' · Wiederholung' : '';
const hoursFmt = (wk, mode) => mode === 'hm' ? (wk.hoursText || '') : `${wk.hours.toFixed(2).replace(/\.?0+$/, '')} h`;

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
const sessHead = s => { const parts = T(s.title).split(PM.titleSplit || '\u0000'); return PM.titleSplit ? (parts.length > 2 ? parts.slice(0, 2).join(' – ') : parts[0]) : T(s.name); };
const sessEyebrow = s => esc(DISC_DE[s.disc]) + (s.test ? ' · Test' : s.quality ? ' · ' + PM.qualLabel : s.key ? ' · ' + PM.keyLabel : '');

/* ---------- HEUTE ---------- */
function viewHome() {
  const t = todayIso(); const cw = curWeek(t); const TWK = TW();
  const h = new Date().getHours();
  const hello = h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend';
  const daysTo = diffDays(eventDate(), t);
  let html = `<header class="top rise" ${staggerAttr(0)}>
    <div><p class="eyebrow">${esc(fmtDateLong(t))}</p><h1>${hello}, ${esc(S.profile.name.split(' ')[0])}</h1></div>
    <a class="racechip" href="#/plan">${daysTo > 0 ? `<b>${daysTo}</b><span>Tage bis<br>${esc(S.profile.raceName)}</span>` : daysTo === 0 ? `<b>🏁</b><span>${esc(PM.eventToday)}</span>` : `<b>✓</b><span>${esc(PM.eventDone)}</span>`}</a>
  </header>`;

  if (zonesDue()) {
    html += `<section class="card alert-card rise" ${staggerAttr(1)}><div class="row"><span class="ico-badge amber">${ic('refresh')}</span><div><h3>Wöchentliches Zonen-Update</h3><p>Zeit, FTP, CSS und Garmin-HF-Zonen zu prüfen. Der Plan passt sich an oder bleibt gleich.</p></div></div>
      <div class="btns"><button class="btn primary" data-act="zoneUpdate">Jetzt aktualisieren</button><button class="btn ghost" data-act="snoozeZone">Später</button></div></section>`;
  }
  const adjs = activeAdjustments(t);
  if (adjs.length) {
    html += `<section class="card adj-card rise" ${staggerAttr(2)}><div class="row"><span class="ico-badge blue">${ic('info')}</span><h3>Änderungen am Plan <small>(bis Wochenende)</small></h3></div>
      <ul class="adj-list">${adjs.map(a => `<li class="${a.kind}"><b>${esc(a.what)}</b><p>${esc(a.why)}</p><small>${esc(fmtDM(a.created))}${a.weekNo ? ` · Kalenderwoche ${a.weekNo} von ${TWK}` : ''}</small></li>`).join('')}</ul></section>`;
  }

  if (cw === 0) {
    const d = diffDays(S.startDate, t);
    html += `<section class="card hero-card rise" ${staggerAttr(3)}><p class="eyebrow">Plan startet</p><h2>${esc(fmtDateLong(S.startDate))}</h2><p>In ${d} ${d === 1 ? 'Tag' : 'Tagen'} beginnt Woche 1 – ${esc(phaseDe(PL.weeks[0].phase))}. Bis dahin: ${PM.zoneModel === 'ftp' ? 'Zonen prüfen und ' : ''}den Plan durchsehen.</p><div class="btns"><a class="btn primary" href="#/week/1">Woche 1 ansehen</a><a class="btn ghost" href="#/zones">${esc(PM.zoneModel === 'ftp' ? 'Meine Zonen' : 'Intensitäten')}</a></div></section>`;
    return html + weekStrip(1, t);
  }
  if (cw === TWK + 1) {
    return html + `<section class="card hero-card rise" ${staggerAttr(3)}><p class="eyebrow">${esc(PM.doneTitle)}</p><h2>Starke Arbeit, ${esc(S.profile.name.split(' ')[0])}!</h2><p>Der ${PL.weeks.length}-Wochen-Plan ist vorbei. Sieh dir unter Performance an, wie dein Ist-Stand zum Plan aussah.</p><div class="btns"><a class="btn primary" href="#/perf">Zur Performance</a></div></section>`;
  }

  const dm = dayModel(t); const st = dayState(t);
  const wk = dm.wk;
  html += `<div class="sec-head rise" ${staggerAttr(3)}><h2>Heutiges Training</h2><span class="pill">Woche ${dm.pw}${dm.repeat ? ' (Wdh.)' : ''} · ${esc(phaseDe(wk.phase))}</span></div>`;
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
  return `<a class="card sess ${st || ''} d-${s.disc} rise" ${staggerAttr(i)} href="#/day/${date}">
    <div class="row">${discIc(s.disc)}<div class="grow"><h3>${esc(sessHead(s))}</h3><p>${esc(T(s.raw.Purpose))}</p></div><div class="meta"><b>${durTxt}</b>${eff.changed ? '<span class="tag amber">angepasst</span>' : ''}${st ? `<span class="tag ${st === 'yes' ? 'green' : st === 'no' ? 'red' : 'blue'}">${STAT_TXT[st]}</span>` : ''}</div></div></a>`;
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
  const wk = planWeekData(w);
  return `<div class="sec-head rise" ${staggerAttr(9)}><h2>Wochenübersicht</h2><a class="link" href="#/week/${w}">Details ›</a></div>
  <section class="card rise" ${staggerAttr(10)}><div class="week-strip">${cells}</div>
    <div class="wk-prog"><div class="row between"><span>${fmtH(st.minutes)} h von ${fmtH(planMin)} h</span><b>${pct} %</b></div>${progressBar(pct)}
    <p class="muted small">Fokus: ${esc(T(wk.focus))}</p></div></section>`;
}

/* ---------- TAG ---------- */
function isGenericTargets(t) { return !!(PL.info && PL.info.zones && PL.info.zones.some(z => z.t === t)); }

function detailRow(label, htmlText) {
  return `<div class="dl"><dt>${L(label, PM.labels[label] || label)}</dt><dd>${htmlText}</dd></div>`;
}

function sessionCard(s, date, z, canLog) {
  const eff = effective(s);
  const log = (peekLog(date) || { sessions: {} }).sessions[s.id];
  const opt = { lower: eff.lower };
  const R = s.raw;
  let adj = '';
  if (eff.changed) {
    adj = `<div class="adj-box"><div class="row">${ic('alert')}<b>Angepasst</b></div>` +
      (eff.mode === 'rest' ? '<p class="big">Heute: Ruhe statt dieser Einheit.</p>' :
        eff.mode === 'easy' ? `<p class="big">Neue Vorgabe: ${PM.msgs.easyNow}, ca. ${eff.dur != null ? fmtHM(eff.dur) : 'wie geplant'} – ${PM.msgs.easySuffix}.</p>` :
          eff.mode === 'reduce' ? `<p class="big">Neue Vorgabe: ${eff.dur != null ? `ca. ${fmtHM(eff.dur)}` : 'kürzer'}${eff.repsMinus ? `, ${eff.repsMinus} Wiederholung${eff.repsMinus > 1 ? 'en' : ''} weniger` : ''}${eff.lower ? ', unteres Ende der Vorgaben' : ''}.</p>` : '') +
      eff.adjs.map(a => `<p><b>${esc(a.what)}</b><br><span class="muted">Warum: ${esc(a.why)}</span></p>`).join('') + '</div>';
  }
  const en = t => enrich(T(t), s.disc, z, opt);
  const planBox = () => `
    ${detailRow('Purpose', en(R.Purpose))}
    ${detailRow('Warm-up', en(R['Warm-up']))}
    ${detailRow('Main set', en(R['Main set']))}
    ${detailRow('Cool-down', en(R['Cool-down']))}
    ${detailRow('Targets', z && isGenericTargets(R.Targets) ? `<span class="orig">${esc(T(R.Targets))}</span><div class="zchips">${zoneChips(s.disc, z)}</div>` : en(R.Targets))}
    ${detailRow('Coach note', esc(T(R['Coach note'])))}`;
  const body = eff.mode === 'rest' ? `<details class="orig-plan"><summary>Original-Plan anzeigen</summary><dl>${planBox()}</dl></details>` :
    (eff.mode === 'easy' ? `<details class="orig-plan"><summary>Original-Plan (nicht mehr aktiv)</summary><dl>${planBox()}</dl></details>` : `<dl>${planBox()}</dl>`);
  const durTxt = s.disc === 'race' ? 'Rennen' : eff.mode === 'rest' ? 'Ruhe' : (eff.dur != null ? fmtHM(eff.dur) : '');
  return `<article class="card sessd d-${s.disc} rise" ${staggerAttr(2 + s.idx)} id="${s.id}">
    <div class="row sess-h">${discIc(s.disc)}<div class="grow"><p class="eyebrow">${sessEyebrow(s)}</p><h3>${esc(sessHead(s))}</h3></div><div class="meta"><b>${durTxt}</b>${log && log.status ? `<span class="tag ${log.status === 'yes' ? 'green' : log.status === 'no' ? 'red' : 'blue'}">${STAT_TXT[log.status]}</span>` : ''}</div></div>
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
  const ftp = PM.zoneModel === 'ftp';
  const kind = s.testKind;
  let f = `<form class="logform" data-sid="${s.id}" data-date="${date}" onsubmit="return false">`;
  f += `<div class="grp"><label class="lbl">Status *</label>${radios('status', [['yes', 'Erledigt'], ['partial', 'Teilweise'], ['no', 'Ausgelassen']], l.status)}</div>`;
  f += `<div class="fields">`;
  f += field('Dauer (min) *', 'minutes', l.minutes ?? (eff.dur || ''), 'inputmode="decimal"');
  if (s.disc === 'swim') f += field('Distanz (m)', 'dist', l.dist, 'inputmode="decimal"') + field('Ø Pace (mm:ss /100 m)', 'pace', l.pace, 'placeholder="1:45"');
  if (s.disc === 'bike') f += field('Distanz (km)', 'dist', l.dist, 'inputmode="decimal"') + field('Ø Leistung (W)' + (ftp ? '' : ' – optional'), 'avgP', l.avgP, 'inputmode="numeric"') + (ftp ? field('NP (W)', 'np', l.np, 'inputmode="numeric"') + field('Ø Trittfrequenz', 'cad', l.cad, 'inputmode="numeric"') : '');
  if (s.disc === 'run') f += field('Distanz (km)', 'dist', l.dist, 'inputmode="decimal"') + field('Ø Pace (mm:ss /km)', 'pace', l.pace, 'placeholder="5:30"') + (PM.longRun === 'cont' ? field('Längster Laufabschnitt am Stück (min)', 'contRun', l.contRun, 'inputmode="decimal"') : '');
  if (s.disc !== 'strength' && s.disc !== 'mob') f += field('Ø Herzfrequenz' + (ftp ? '' : ' – optional'), 'avgHr', l.avgHr, 'inputmode="numeric"');
  f += `</div>`;
  if (kind === 'css') f += `<div class="fields">${field('400 m Zeit (mm:ss)', 't400', l.t400, 'placeholder="6:10"')}${field('200 m Zeit (mm:ss)', 't200', l.t200, 'placeholder="2:55"')}</div><p class="muted small">CSS = (T400 − T200) ÷ 2 pro 100 m – wird nach dem Speichern berechnet und für die Zonen vorgeschlagen.</p>`;
  if (kind === 'ftp') f += `<div class="fields">${field('Testergebnis FTP (W)', 'testFtp', l.testFtp, 'inputmode="numeric"')}</div>`;
  if (kind === 'runthr') f += `<div class="fields">${field('Schwellen-Pace (mm:ss /km)', 'testPace', l.testPace, 'placeholder="4:40"')}</div>`;
  if (kind === '5k') f += `<div class="fields">${field('Zeit für 5 km (mm:ss) *', 't5k', l.t5k, 'placeholder="32:30" inputmode="text" autocapitalize="off" autocorrect="off"')}</div><p class="muted small">Die Zeit ist laut Plan der Startwert für den nächsten Zyklus.</p>`;
  f += `<div class="grp"><label class="lbl">RPE (1–10) *</label>${radios('rpe', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => [n, n]), l.rpe, 'rpe')}</div>`;
  if (s.hard || s.test) {
    f += `<div class="fields">${field(PM.ui.qualField, 'qualMin', l.qualMin ?? (s.q ?? ''), 'inputmode="numeric"')}${PM.hasRaceMin ? field('davon rennspezifisch (min)', 'raceMin', l.raceMin ?? (s.r ?? 0), 'inputmode="numeric"') : ''}</div>`;
    f += `<div class="grp"><label class="lbl">${s.disc === 'bike' ? 'Leistung stabil? Letzte Wdh. wie die erste? *' : 'Qualität stabil? Letzte Wdh. wie die erste? *'}</label>${radios('stable', [['ok', 'Ja, stabil'], ['drop', s.disc === 'bike' ? PM.ui.stableDrop.bike : PM.ui.stableDrop.other], ['form', 'Technik/Form ließ nach']], l.stable, 'col')}</div>`;
  }
  if (PM.rules.nutrition && s.long && s.disc === 'bike') {
    f += `<div class="fields">${field('Kohlenhydrate (g/h)', 'carbs', l.carbs, 'inputmode="numeric" placeholder="50–70"')}</div><div class="grp"><label class="lbl">Magen-Darm-Verträglichkeit</label>${radios('gi', [['good', 'Gut'], ['some', 'Leichte Probleme'], ['problems', 'Probleme']], l.gi)}</div>`;
  }
  f += `<div class="grp"><label class="lbl">${esc(PM.coachLabel)}</label><p class="quote">${esc(T(s.raw['Coach note']))}</p>${radios('coachOk', [['yes', 'Ja'], ['partial', 'Teilweise'], ['no', 'Nein']], l.coachOk)}</div>`;
  f += `<label class="fld full"><span>Notiz (optional)</span><textarea name="notes" rows="2">${esc(l.notes || '')}</textarea></label>`;
  f += `<div class="btns"><label class="btn ghost file">${ic('upload')} Garmin-Datei (.tcx/.gpx) einlesen<input type="file" accept=".tcx,.gpx,.xml" data-act-change="importFile"></label><button type="button" class="btn primary" data-act="saveSession">Einheit speichern</button></div></form>`;
  return f;
}

/* ---------- Tages-Check (Wochen-Checkliste aus dem PDF) ---------- */
function painBlock(c) {
  return `<div class="grp"><label class="lbl">Schmerzen? *</label>${radios('pain', PM.ui.painLabels, c.pain)}
      <select name="painArea" class="sel">${PM.ui.painAreas.map(([v, l]) => `<option value="${v}" ${c.painArea === v ? 'selected' : ''}>Bereich: ${l}</option>`).join('')}</select></div>`;
}
function dayCheckCard(date, dm) {
  const log = peekLog(date) || { sessions: {}, check: null, complete: false };
  const c = log.check || {}; const cl = dm.wk.checklist;
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
  const sleepFat = `
    <div class="fields">${field('Schlaf letzte Nacht (h) *', 'sleep', c.sleep, 'inputmode="decimal" placeholder="7.5"')}</div>
    <div class="grp"><label class="lbl">Müdigkeit heute (1 frisch – 5 platt) *</label>${radios('fatigue', [1, 2, 3, 4, 5].map(n => [n, n]), c.fatigue, 'rpe')}</div>
    ${painBlock(c)}
    <div class="grp"><label class="lbl">Krankheitszeichen? *</label>${radios('illness', [['none', 'Nein'], ['mild', 'Leicht'], ['yes', PM.rules.illnessReentry ? 'Ja (Fieber / unterhalb des Halses)' : 'Ja']], c.illness)}</div>`;
  const BLOCKS = {
    rest: ['Ruhetag', () => dm.rest ? `<div class="grp"><label class="lbl">Full Rest eingehalten? *</label>${radios('restKept', [['yes', 'Ja, komplett'], ['no', 'Nein, trainiert']], c.restKept)}<p class="muted small">Nur Spaziergehen und 5–10 min sanfte Mobility sind erlaubt.</p></div>` : `<p class="muted">Kein Ruhetag heute${nextRest ? ` – nächster: ${esc(fmtDate(nextRest))}` : ''}.</p>`],
    volume: ['Volumen', () => `<p class="statline"><b>${fmtHM(dayAct)}</b> heute absolviert · geplant ${fmtHM(dayPlan)}<br>Woche: ${fmtH(st.minutes)} h von ${fmtH(st.plannedMin)} h</p><div class="fields">${field('Zusatztraining außerhalb des Plans (min)', 'extraMin', c.extraMin ?? 0, 'inputmode="numeric"')}</div>`],
    spec: ['Spezifität', () => hasHard ? `<div class="grp"><label class="lbl">Kernintention der Schlüssel-/Qualitätseinheit erfüllt? *</label>${radios('specOk', [['yes', 'Ja'], ['partial', 'Teilweise'], ['no', 'Nein']], c.specOk)}</div>` : '<p class="muted">Keine Qualitäts-/Schlüsseleinheit heute.</p>'],
    junk: ['Junk-Mile-Check', () => `<div class="grp"><label class="lbl">Hatte jede lockere Einheit einen Zweck – kein Füllumfang? *</label>${radios('junkOk', [['yes', 'Ja'], ['no', 'Nein, Füllumfang']], c.junkOk)}</div>`],
    autoreg: ['Auto-Regulation', () => sleepFat],
    intensity: ['Intensität', () => dm.rest ? '<p class="muted">Ruhetag – keine Intensität zu bewerten.</p>' : hasHard
      ? `<div class="grp"><label class="lbl">Zügige Abschnitte wie vorgegeben (RPE 6–7), gleichmäßig? Rest locker? *</label>${radios('specOk', [['yes', 'Ja'], ['partial', 'Teilweise'], ['no', 'Nein']], c.specOk)}</div>`
      : `<div class="grp"><label class="lbl">Alles locker geblieben (RPE 3–4, ganze Sätze sprechen möglich)? *</label>${radios('specOk', [['yes', 'Ja'], ['partial', 'Teilweise'], ['no', 'Nein, zu hart']], c.specOk)}</div>`],
    adapt: ['Anpassung', () => `${sleepFat}
    <div class="grp"><label class="lbl">Zyklus / wenig Energie?</label>${radios('energy', [['no', 'Nein'], ['yes', 'Ja']], c.energy ?? 'no')}<p class="muted small">Bei „Ja“ werden zügige Abschnitte locker absolviert, der Umfang bleibt.</p></div>
    <div class="grp"><label class="lbl">Fühlt sich die Woche deutlich zu schwer an?</label>${radios('weekHard', [['no', 'Nein'], ['yes', 'Ja']], c.weekHard ?? 'no')}<p class="muted small">Bei „Ja“ wird diese Woche wiederholt (der Plan verlängert sich um 1 Woche), statt Einheiten nachzuholen.</p></div>`]
  };
  const q = (n, title, sub, inner) => `<div class="ck"><div class="ck-h"><span class="num">${n}</span><div><h4>${title}</h4><p class="muted small">Plan-Checkliste: „${esc(T(sub))}“</p></div></div>${inner}</div>`;
  return `<section class="card check-card rise" ${staggerAttr(6)}><h2>Tages-Checkliste</h2><p class="muted">Aus der Wochen-Checkliste (Woche ${dm.pw}) – täglich nach dem Training.</p>
  <form id="dayform" data-date="${date}" onsubmit="return false">
  ${PM.checks.map((k, i) => q(i + 1, BLOCKS[k][0], cl[i], BLOCKS[k][1]())).join('')}
  <button type="button" class="btn primary wide" data-act="finishDay">Tag abschließen</button></form></section>`;
}

function viewDay(date) {
  const dm = dayModel(date);
  if (!dm) return `<header class="top"><a class="back" href="#/">${ic('back')}</a><h1>Kein Plantag</h1></header><p class="muted pad">Dieses Datum liegt außerhalb des ${PL.weeks.length}-Wochen-Plans.</p>`;
  const z = S.zones ? Zn.at(S, date) : null;
  const t = todayIso(); const canLog = date <= t;
  const ds = dayState(date);
  let html = `<header class="top rise"><a class="back" href="#/week/${dm.week}">${ic('back')}</a><div class="grow"><p class="eyebrow">Woche ${dm.pw}${dm.repeat ? ' (Wdh.)' : ''} · ${esc(phaseDe(dm.wk.phase))} · Plan-Tag ${DAY_DE[dm.dayKey]}</p><h1>${esc(fmtDateLong(date))}</h1></div>${ds === 'done' ? `<span class="tag green">erledigt</span>` : ''}</header>`;
  html += `<div class="daynav rise"><a class="btn ghost sm" href="#/day/${addDays(date, -1)}">${ic('back')} Vortag</a><a class="btn ghost sm" href="#/day/${addDays(date, 1)}">Folgetag ${ic('next')}</a></div>`;
  if (dm.rest) {
    html += `<article class="card sessd rest rise" ${staggerAttr(2)}><div class="row sess-h"><span class="dicon d-rest">${ic('rest')}</span><div class="grow"><p class="eyebrow">${esc(DAY_DE[dm.dayKey])} · Erholung</p><h3>${PM.zoneModel === 'ftp' ? 'Full Rest' : 'Ruhetag'}</h3></div></div><p class="plan-title">${DAY_DE[dm.dayKey]} - ${T('FULL REST')}</p><p>${esc(T(dm.restText))}</p></article>`;
  } else {
    dm.sessions.forEach(s => html += sessionCard(s, date, z, canLog));
  }
  html += dayCheckCard(date, dm);
  return html;
}

/* ---------- WOCHE (n = Kalenderwoche) ---------- */
function viewWeek(n) {
  n = clamp(n, 1, TW()); const wk = planWeekData(n); const st = weekStats(n); const cw = curWeek();
  const pct = st.plannedMin ? Math.round(st.minutes / st.plannedMin * 100) : 0;
  const kv = PM.kpis.map(([k, en, de, fmt]) => `<div><small>${L(en, de)}</small><b>${fmt ? hoursFmt(wk, fmt) : wk[k]}</b></div>`).join('');
  return `<header class="top rise"><a class="back" href="#/plan">${ic('back')}</a><div class="grow"><p class="eyebrow">${esc(fmtDM(dateFor(n, 0)))} – ${esc(fmtDM(dateFor(n, 6)))}${esc(wkTag(n))}</p><h1>Woche ${wkNo(n)} <small>${esc(phaseDe(wk.phase))}</small></h1></div></header>
  <button class="btn ghost wide rise" data-act="exportWeek" data-week="${n}">${ic('upload')} ${L('Week as Garmin workouts (ZIP)', 'Woche als Garmin-Workouts (ZIP)')}</button>
  <div class="daynav rise">${n > 1 ? `<a class="btn ghost sm" href="#/week/${n - 1}">${ic('back')} Woche ${wkNo(n - 1)}</a>` : '<span></span>'}${n < TW() ? `<a class="btn ghost sm" href="#/week/${n + 1}">Woche ${wkNo(n + 1)} ${ic('next')}</a>` : '<span></span>'}</div>
  <section class="card rise" ${staggerAttr(2)}><div class="kpis">${kv}<div><small>Ist / Plan</small><b>${n <= cw && cw <= TW() ? pct + ' %' : '–'}</b></div></div>
    <p class="focus"><span class="muted">${L('Primary focus', 'Schwerpunkt')}</span> ${esc(T(wk.focus))}</p><p class="muted">${esc(T(wk.note))}</p></section>
  <div class="sec-head rise" ${staggerAttr(3)}><h2>Übersicht</h2></div>
  <section class="card rise" ${staggerAttr(4)}><div class="ovtable"><div class="ovh"><span>${L('Day', 'Tag')}</span><span>${L('Session(s)', 'Einheit(en)')}</span></div>${wk.overview.map((o, i) => {
    const date = dateFor(n, i); const ds = dayState(date);
    return `<a href="#/day/${date}" class="ovrow ${ds}"><span class="d"><b>${DAY_DE[o.day]}</b><small>${fmtDM(date)}</small></span><span class="t">${esc(T(o.text))}${o.sub ? `<small>${esc(T(o.sub))}</small>` : ''}</span><span class="st">${ds === 'done' ? ic('check') : ic('next')}</span></a>`;
  }).join('')}</div></section>
  <div class="sec-head rise" ${staggerAttr(5)}><h2>${L('Weekly quality-control analysis', 'Wöchentliche Qualitätskontrolle')}</h2></div>
  <section class="card rise" ${staggerAttr(6)}><ul class="wkchk">${wk.checklist.map((c, i) => `<li><span class="bullet">${ic('check')}</span><div><p>${esc(T(c))}</p><small class="muted">${weekCheckSummary(n, i)}</small></div></li>`).join('')}</ul></section>`;
}
function weekCheckSummary(n, i) {
  const logs = []; for (let d = 0; d < 7; d++) { const l = peekLog(dateFor(n, d)); if (l && l.check) logs.push({ d, c: l.check, l }); }
  if (!logs.length) return 'Noch keine Tageseinträge.';
  const k = PM.checks[i];
  if (k === 'rest') { const r = logs.find(x => isRestDay(n, DAYKEYS[x.d]) && x.c.restKept); return r ? (r.c.restKept === 'yes' ? 'Ruhetag eingehalten ✓' : 'Ruhetag nicht eingehalten ✗') : 'Ruhetag noch offen.'; }
  if (k === 'volume') { const st = weekStats(n); return `Ist ${fmtH(st.minutes)} h von ${fmtH(st.plannedMin)} h · Zusatz ${logs.reduce((a, x) => a + (x.c.extraMin || 0), 0)} min`; }
  if (k === 'spec' || k === 'intensity') { const spec = logs.filter(x => x.c.specOk); if (!spec.length) return k === 'spec' ? 'Keine Qualitätstage erfasst.' : 'Noch keine Bewertung.'; return `Wie vorgegeben: ${spec.filter(x => x.c.specOk === 'yes').length} von ${spec.length} bewerteten Tagen`; }
  if (k === 'junk') { const bad = logs.filter(x => x.c.junkOk === 'no').length; return bad ? `${bad}× Füllumfang gemeldet` : 'Kein Füllumfang gemeldet ✓'; }
  const sl = logs.filter(x => x.c.sleep != null), fa = logs.filter(x => x.c.fatigue != null);
  const rep = S.inserts.some(x => x.at === n) ? ' · Woche wird wiederholt' : '';
  return `Ø Schlaf ${sl.length ? (sl.reduce((a, x) => a + x.c.sleep, 0) / sl.length).toFixed(1) : '–'} h · Ø Müdigkeit ${fa.length ? (fa.reduce((a, x) => a + x.c.fatigue, 0) / fa.length).toFixed(1) : '–'} / 5${rep}`;
}

/* ---------- PLAN ---------- */
function viewPlan() {
  const cw = curWeek(); const blocks = PM.blocks(); const TWK = TW();
  let html = `<header class="top rise"><div><p class="eyebrow">${esc(S.profile.raceName)} · ${esc(fmtDateLong(eventDate()))}</p><h1>Trainingsplan</h1></div></header>
  <section class="card rise" ${staggerAttr(1)}><div class="row between"><div><small class="muted">Start</small><b class="big2">${esc(fmtDate(S.startDate))}</b></div><div><small class="muted">${esc(PM.endLabel)}</small><b class="big2">${esc(fmtDate(lastPlanDay()))}</b></div><div><small class="muted">Woche</small><b class="big2">${cw === 0 ? '–' : cw > TWK ? '✓' : cw + ' / ' + TWK}</b></div></div>
  ${TWK > PL.weeks.length ? `<p class="muted small" style="margin-top:10px">Der Plan wurde um ${TWK - PL.weeks.length} Woche${TWK - PL.weeks.length > 1 ? 'n' : ''} verlängert (Wiederholung laut Plan-Regel).</p>` : ''}</section>`;
  let last = -1;
  for (let c = 1; c <= TWK; c++) {
    const pw = wkNo(c); const w = planWeekData(c);
    const bi = blocks.findIndex(b => pw >= b.a && pw <= b.z);
    if (bi !== last && bi >= 0) { last = bi; const b = blocks[bi]; html += `<div class="sec-head rise" ${staggerAttr(2)}><h2>${esc(T(b.h))}</h2></div><p class="muted small blockdesc">${esc(T(b.t))}</p>`; }
    const st = weekStats(c); const pct = st.plannedMin ? Math.round(st.minutes / st.plannedMin * 100) : 0;
    const state = c === cw ? 'now' : c < cw ? 'past' : '';
    html += `<a class="card wcard ${state} rise" ${staggerAttr(3 + (c % 4))} href="#/week/${c}"><div class="wnum">${pw}</div><div class="grow"><h3>${esc(phaseDe(w.phase))}${isRepeatWeek(c) ? ' <span class="tag amber">Wiederholung</span>' : ''}</h3><p class="muted small">${esc(fmtDM(dateFor(c, 0)))} – ${esc(fmtDM(dateFor(c, 6)))} · ${hoursFmt(w, PM.kpis[0][3])} · ${PM.lbl[0]} ${w.longBike} · ${PM.lbl[1]} ${w.longRun}</p>${c <= cw && cw <= TWK ? progressBar(pct) : ''}</div>${ic('next')}</a>`;
  }
  return html;
}

/* ---------- PERFORMANCE ---------- */
let perfTab = 'vol';
function viewPerf() {
  const cs = chartSeries(); const cw = cs.cw; const CF = PM.charts; const keys = PM.discs.map(d => d.k);
  setChartN(cs.M);
  const PERF_TABS = [['vol', CF.vol.tab], ['disc', CF.disc.tab], ['qual', CF.qual.tab], ['long', CF.long.tab]];
  if (!PERF_TABS.some(x => x[0] === perfTab)) perfTab = 'vol';
  const legend = items => `<div class="legend">${items.map(([c, l, dash]) => `<span><i class="${dash ? 'dash' : ''}" style="--c:${c}"></i>${l}</span>`).join('')}</div>`;
  const tipTxt = (i, rows) => `<b>Woche ${cs.planWeeks[i]}${isRepeatWeek(i + 1) ? ' (Wdh.)' : ''}</b>` + rows.map(([l, v, c]) => `<span><i style="--c:${c}"></i>${l}<em>${v}</em></span>`).join('');
  const done = Math.max(0, cw - 1);
  const sumTo = (arr, to) => arr.slice(0, to).reduce((a, v) => a + (v || 0), 0);
  let C, chart, leg, stats;
  if (perfTab === 'vol') {
    C = CF.vol; const V = cs.volume;
    const tip = i => tipTxt(i, [['Plan', V.plan[i] + ' h', COL.vol], ['Ist', V.ist[i] != null ? V.ist[i].toFixed(1) + ' h' : '–', COL.vol]]);
    if (C.type === 'bars') {
      const mi = C.mark ? sched().indexOf(C.mark.pw) : -1;
      chart = stackChart('vol', V.plan.map(v => ({ v })), V.ist.map(v => v == null ? null : { v }), { cw, keys: ['v'], ceiling: C.ceiling, ceilLabel: C.ceilLabel, vmarks: mi > 0 ? [{ i: mi, label: C.mark.label }] : [], tip });
    } else chart = lineChart('vol', [{ color: COL.vol, plan: V.plan, ist: V.ist }], { cw, yFmt: v => v, ceiling: C.ceiling, ceilLabel: '', tip });
    leg = legend([[COL.vol, 'Plan (PDF)', true], [COL.vol, 'Ist'], ['#888', C.ceilLabel, true]]);
    const p = sumTo(V.plan, done), a = sumTo(V.ist, done);
    stats = [['Ist (abgeschl. Wochen)', a.toFixed(1) + ' h'], ['Plan (abgeschl. Wochen)', p.toFixed(1) + ' h'], ['Erfüllung', p ? Math.round(a / p * 100) + ' %' : '–'], ['Aktuelle Woche', cw ? `${(V.ist[cw - 1] ?? 0).toFixed(1)} / ${V.plan[cw - 1]} h` : '–']];
  } else if (perfTab === 'disc') {
    C = CF.disc; const D = cs.disc;
    chart = stackChart('disc', D.plan, D.ist, { cw, keys, tip: i => { const p = D.plan[i], a = D.ist[i]; return tipTxt(i, PM.discs.map(d => [d.label, `${a ? a[d.k].toFixed(1) : '–'} / ${p[d.k].toFixed(1)} h`, COL[d.k]])); } });
    leg = legend(PM.discs.map(d => [COL[d.k], d.label]));
    stats = PM.discs.map(d => { const p = D.plan.slice(0, done).reduce((a, x) => a + x[d.k], 0), a = D.ist.slice(0, done).reduce((x, y) => x + (y ? y[d.k] : 0), 0); return [`${d.label} (Ist/Plan)`, `${a.toFixed(1)} / ${p.toFixed(1)} h`]; });
  } else if (perfTab === 'qual') {
    C = CF.qual; const Q = cs.quality;
    if (C.type === 'bars') {
      chart = stackChart('qual', Q.plan.map(v => ({ q: v })), Q.ist.map(v => v == null ? null : { q: v }), { cw, keys: ['q'], tip: i => tipTxt(i, [['Plan', Q.plan[i] + ' min', COL.q], ['Ist', Q.ist[i] != null ? Q.ist[i] + ' min' : '–', COL.q]]) });
      leg = legend([[COL.q, 'Plan (PDF)', true], [COL.q, 'Ist']]);
      stats = [[`${C.labels[0]} Ist / Plan`, `${sumTo(Q.ist, done)} / ${sumTo(Q.plan, done)} min`], ['Aktuelle Woche', cw ? `${Q.ist[cw - 1] ?? 0} / ${Q.plan[cw - 1]} min` : '–']];
    } else {
      chart = lineChart('qual', [{ color: COL.qual, plan: Q.plan, ist: Q.ist }, { color: COL.race, plan: Q.planRace, ist: Q.istRace }], { cw, yFmt: v => v, min: 0, tip: i => tipTxt(i, [[C.labels[0] + ' Plan', Q.plan[i] + ' min', COL.qual], [C.labels[0] + ' Ist', Q.ist[i] != null ? Q.ist[i] + ' min' : '–', COL.qual], [C.labels[1] + ' Plan', Q.planRace[i] + ' min', COL.race], [C.labels[1] + ' Ist', Q.istRace[i] != null ? Q.istRace[i] + ' min' : '–', COL.race]]) });
      leg = legend([[COL.qual, C.labels[0] + ' Plan', true], [COL.qual, C.labels[0] + ' Ist'], [COL.race, C.labels[1] + ' Plan', true], [COL.race, C.labels[1] + ' Ist']]);
      stats = [[`${C.labels[0]} Ist / Plan`, `${sumTo(Q.ist, done)} / ${sumTo(Q.plan, done)} min`], [`${C.labels[1]} Ist / Plan`, `${sumTo(Q.istRace, done)} / ${sumTo(Q.planRace, done)} min`]];
    }
  } else {
    C = CF.long; const G = cs.long;
    chart = lineChart('long', [{ color: COL.bike, plan: G.planBike, ist: G.istBike }, { color: COL.run, plan: G.planRun, ist: G.istRun }], { cw, yFmt: v => v, min: 0, tip: i => tipTxt(i, [[C.labels[0] + ' Plan', fmtHM(G.planBike[i]), COL.bike], [C.labels[0] + ' Ist', G.istBike[i] != null ? fmtHM(G.istBike[i]) : '–', COL.bike], [C.labels[1] + ' Plan', fmtHM(G.planRun[i]), COL.run], [C.labels[1] + ' Ist', G.istRun[i] != null ? fmtHM(G.istRun[i]) : '–', COL.run]]) });
    leg = legend([[COL.bike, C.labels[0] + ' Plan', true], [COL.bike, C.labels[0] + ' Ist'], [COL.run, C.labels[1] + ' Plan', true], [COL.run, C.labels[1] + ' Ist']]);
    const last = done - 1; const lb = last >= 0 ? G.istBike[last] : null, lr = last >= 0 ? G.istRun[last] : null;
    stats = [[`Letzte Woche: ${C.labels[0]} (Ist/Plan)`, last >= 0 ? `${lb != null ? fmtHM(lb) : '–'} / ${fmtHM(G.planBike[last])}` : '–'], [`Letzte Woche: ${C.labels[1]} (Ist/Plan)`, last >= 0 ? `${lr != null ? fmtHM(lr) : '–'} / ${fmtHM(G.planRun[last])}` : '–']];
  }
  return `<header class="top rise"><div><p class="eyebrow">Ist-Stand vs. PDF-Plan</p><h1>Performance</h1></div></header>
  <div class="tabs rise" ${staggerAttr(1)}>${PERF_TABS.map(([k, l]) => `<button class="tabbtn ${perfTab === k ? 'on' : ''}" data-act="perfTab" data-tab="${k}">${l}</button>`).join('')}</div>
  <section class="card rise" ${staggerAttr(2)}><h3 class="ctitle">${C.title}</h3><p class="muted small">${C.sub}</p>${leg}<div id="chartHost">${chart}</div>
    <p class="muted small">${cw === 0 ? 'Der Plan hat noch nicht begonnen – die Ist-Werte erscheinen ab Woche 1.' : 'Tippe/ziehe im Diagramm für Details je Woche. Die senkrechte Linie markiert die aktuelle Woche.'}</p></section>
  <section class="card rise" ${staggerAttr(3)}><div class="kpis two">${stats.map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')}</div></section>
  <p class="muted small pad">${esc(CF.note())}</p>`;
}

/* ---------- ZONEN / INTENSITÄTEN ---------- */
function viewZones() {
  if (PM.zoneModel === 'rpe') {
    const tb = PM.rpeTable();
    return `<header class="top rise"><div><p class="eyebrow">Steuerung nach Gefühl</p><h1>Intensitäten</h1></div></header>
    <section class="card rise" ${staggerAttr(1)}><h3>RPE &amp; Sprechtest</h3><p class="muted small">Dieser Plan kommt ohne Watt, Pace oder Herzfrequenz-Zonen aus. RPE = Belastungsempfinden von 1 (mühelos) bis 10 (maximal).</p>
      <div class="ztable">${tb ? tb.rows.map(r => `<div class="zr c-run rpe"><span>${esc(r[0])} · RPE ${esc(r[1])}</span><b>${esc(r[2])}</b><em>${esc(r[3])}</em></div>`).join('') : ''}</div></section>
    <section class="card rise" ${staggerAttr(2)}><h3>Regeln im Alltag</h3><ul class="plain"><li>Lieber zu langsam als zu schnell. Gehpausen sind Teil des Plans.</li><li>Zügig = RPE 6–7: nur noch kurze Sätze sprechen. Steigerungen: 20 s bis ca. RPE 8, danach 60 s gehen – nie sprinten.</li><li>Rad: Trittfrequenz 85–95 U/min, eher leichter Gang. Indoor darf 10–15 % kürzer sein.</li><li>Kraft: 2–3 Wiederholungen in Reserve, nie bis zum Muskelversagen.</li></ul></section>`;
  }
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
function blockHtml(b) {
  const R = resolveTokens;
  if (b.t === 'h') return `<h4>${esc(R(b.x))}</h4>`;
  if (b.t === 'p') return `<p>${esc(R(b.x))}</p>`;
  if (b.t === 'pm') return `<p class="muted">${esc(R(b.x))}</p>`;
  if (b.t === 'table') return `<div class="mtable ${b.cls || ''}"><div class="mh">${b.cols.map(c => `<span>${esc(c)}</span>`).join('')}</div>${b.rows.map(r => `<div class="mr">${r.map(c => `<span>${esc(c)}</span>`).join('')}</div>`).join('')}</div>`;
  if (b.t === 'blocks') return PM.blocks().map(x => `<h4>${esc(T(x.h))}</h4><p>${esc(T(x.t))}</p><p class="muted">${esc(T(x.m))}</p>`).join('');
  if (b.t === 'master') {
    return `<div class="mtable"><div class="mh"><span>Wk</span><span>Phase</span><span>${L('Hours', 'Std.')}</span><span>${PM.lbl[0]}</span><span>${PM.lbl[1]}</span></div>${PL.weeks.map(w => { const c = sched().indexOf(w.n) + 1; return `<a href="#/week/${c}" class="mr"><span>${w.n}</span><span>${esc(T(w.phase))}<small>${esc(T(w.focus))} · ab ${fmtDMY(dateFor(c, 0))}</small></span><span>${hoursFmt(w, PM.kpis[0][3])}</span><span>${w.longBike}</span><span>${w.longRun}</span></a>`; }).join('')}</div>`;
  }
  return '';
}
function viewMore() {
  const acc = (title, inner, open) => `<details class="acc card rise" ${open ? 'open' : ''}><summary>${esc(title)}${ic('next')}</summary><div class="accbody">${inner}</div></details>`;
  return `<header class="top rise"><div><p class="eyebrow">Plan-Wissen &amp; Einstellungen</p><h1>Mehr</h1></div></header>
  <div class="sec-head"><h2>${esc(PM.moreTitle())}</h2></div>
  <p class="muted pad">${esc(PM.moreSub())}</p>
  ${PM.sections().map(s => acc(s.title, s.blocks.map(blockHtml).join(''), s.open)).join('')}
  <div class="sec-head"><h2>App</h2></div>
  <a class="card linkrow rise" href="#/settings"><span>Einstellungen, Backup, Garmin-Export${PM.hasEnglish ? ' &amp; Sprache' : ''}</span>${ic('next')}</a>`;
}

function viewSettings() {
  const p = S.profile;
  return `<header class="top rise"><a class="back" href="#/more">${ic('back')}</a><h1>Einstellungen</h1></header>
  <section class="card rise" ${staggerAttr(1)}><h3>Profil &amp; Zeitraum</h3><p class="muted small">Plan: <b>${esc(PM.card.title)}</b></p><form id="setform" onsubmit="return false">
    <div class="fields">${field('Name', 'name', p.name)}${field('Gewicht (kg)', 'weight', p.weight, 'inputmode="decimal"')}${PM.askEventName ? field('Rennname', 'raceName', p.raceName) : ''}<label class="fld"><span>${esc(PM.endField.replace(' *', ''))}</span><input type="date" name="raceDate" value="${p.raceDate}"></label></div>
    <p class="muted small">Plan-Start: <b>${esc(fmtDate(S.startDate))}</b> (${PL.weeks.length * 7} Tage bis zum Plan-Ende). Eine Änderung des Datums verschiebt den gesamten Plan; bereits eingetragene Daten bleiben an ihren Kalendertagen.</p>
    <button class="btn primary" data-act="saveSettings">Speichern</button></form></section>
  ${PM.hasEnglish ? `<section class="card rise" ${staggerAttr(2)}><h3>Sprache der Plan-Texte</h3><p class="muted small">Die Einheiten-Beschreibungen gibt es auf Deutsch und im englischen Original des PDFs.</p>
    <div class="seg"><label><input type="radio" name="lang" value="de" ${S.lang === 'en' ? '' : 'checked'} data-act-change="setLang"><span>Deutsch</span></label><label><input type="radio" name="lang" value="en" ${S.lang === 'en' ? 'checked' : ''} data-act-change="setLang"><span>Original (EN)</span></label></div></section>` : ''}
  <section class="card rise" ${staggerAttr(2)}><h3>Backup</h3><p class="muted small">Deine Daten liegen nur auf diesem Gerät (Safari-Speicher). Sichere sie regelmäßig als Datei, besonders vor iOS-Updates oder wenn du Safari-Daten löschst.</p>
    <div class="btns"><button class="btn ghost" data-act="exportData">${ic('upload')} Backup exportieren</button><label class="btn ghost file">Backup importieren<input type="file" accept=".json,application/json" data-act-change="importData"></label></div></section>
  <section class="card rise" ${staggerAttr(3)}><h3>Garmin-Workflow</h3><ul class="plain">
    <li><b>Aktiv:</b> Training in Garmin durchführen → Werte in der App eintragen (Dauer, Distanz, Pace, HF, RPE …) → Tages-Checkliste ausfüllen.</li>
    <li><b>Aktiv:</b> In der Einheit „Garmin-Datei einlesen“: Aktivität in Garmin Connect (Web) als <i>.tcx</i> oder <i>.gpx</i> exportieren und einlesen – Dauer, Distanz und HF werden vorausgefüllt.</li>
    <li><b>Aktiv:</b> Workouts als <i>.fit</i> exportieren (pro Einheit oder als Wochen-ZIP${PM.zoneModel === 'ftp' ? ', mit deinen aktuellen Watt-/HF-/Pace-Zielen' : ', als Zeit-Schritte mit Lauf-/Geh-Intervallen'}). Datei per USB auf die Uhr kopieren: Ordner <i>GARMIN/NewFiles</i> (bzw. <i>GARMIN/Workouts</i>). Danach erscheint sie im Trainingsmenü der Uhr.</li>
    <li><b>Nicht möglich:</b> direkte Garmin-Connect-Verbindung (die Schnittstelle ist nicht frei zugänglich).</li></ul></section>
  <section class="card rise" ${staggerAttr(4)}><h3>Auf dem iPhone installieren</h3><p class="muted small">Safari öffnen → Teilen-Symbol → „Zum Home-Bildschirm“. Danach startet die App im Vollbild und funktioniert offline.${PM.zoneModel === 'ftp' ? ' Die Zonen-Erinnerung erscheint beim Öffnen der App (Wochenstart).' : ''}</p></section>
  <section class="card rise" ${staggerAttr(5)}><h3>Plan wechseln / Zurücksetzen</h3><p class="muted small">Löscht alle Daten auf diesem Gerät und startet mit der Plan-Auswahl und dem Onboarding neu. Erstelle vorher ein Backup, wenn du die Daten behalten willst.</p><button class="btn danger" data-act="resetAll">Alles löschen &amp; neu starten</button></section>`;
}
