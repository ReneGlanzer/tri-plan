/* App: Router, Onboarding, Sheets, Aktionen */
'use strict';
(() => { const m = /[?&]today=(\d{4}-\d{2}-\d{2})/.exec(location.search); if (m) window.__TODAY__ = m[1]; })();

const view = $('#view'), nav = $('#nav'), sheet = $('#sheet'), sheetBody = $('#sheetBody');
let zonePopupShown = false;

/* ---------- Toast & Sheet ---------- */
function toast(msg, type = '') {
  const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg;
  $('#toasts').appendChild(t); requestAnimationFrame(() => t.classList.add('on'));
  setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 350); }, 2800);
}
function openSheet(html) { sheetBody.innerHTML = html; sheet.classList.add('on'); sheetBody.scrollTop = 0; document.body.classList.add('noscroll'); }
function closeSheet() { sheet.classList.remove('on'); document.body.classList.remove('noscroll'); }
sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
function askConfirm(title, msg, ok = 'Ja', danger = false) {
  return new Promise(res => {
    openSheet(`<div class="sheet-in"><h2>${esc(title)}</h2><p>${msg}</p><div class="btns"><button class="btn ${danger ? 'danger' : 'primary'}" id="cfOk">${esc(ok)}</button><button class="btn ghost" id="cfNo">Abbrechen</button></div></div>`);
    $('#cfOk').onclick = () => { closeSheet(); res(true); }; $('#cfNo').onclick = () => { closeSheet(); res(false); };
  });
}

/* ---------- Zonen lesen/validieren ---------- */
function validateZones(o) {
  const ftp = num(o.ftp), css = parseMMSS(o.css), runThr = o.runThr ? parseMMSS(o.runThr) : null;
  if (!ftp || ftp < 80 || ftp > 600) return { err: 'FTP bitte in Watt angeben (80–600).' };
  if (!css || css < 60 || css > 200) return { err: 'CSS bitte als mm:ss pro 100 m angeben (z. B. 1:45).' };
  const hr = [];
  for (let i = 0; i < 5; i++) {
    const lo = num(o.hr[i][0]), hi = num(o.hr[i][1]);
    if (!lo || !hi) return { err: `HF-Zone ${i + 1}: bitte von/bis eintragen.` };
    if (lo < 30 || hi > 230 || lo >= hi) return { err: `HF-Zone ${i + 1}: Werte prüfen (von < bis, 30–230 bpm).` };
    if (i > 0 && (lo <= hr[i - 1][0] || hi <= hr[i - 1][1])) return { err: `HF-Zone ${i + 1} muss über Zone ${i} liegen.` };
    hr.push([Math.round(lo), Math.round(hi)]);
  }
  if (o.runThr && (!runThr || runThr < 150 || runThr > 600)) return { err: 'Lauf-Schwellen-Pace bitte als mm:ss pro km (z. B. 4:40).' };
  return { z: { ftp: Math.round(ftp), css: Math.round(css), hr, runThr: runThr ? Math.round(runThr) : null } };
}

/* ---------- Onboarding ---------- */
const OB = { step: 0, name: '', weight: '', raceName: 'IRONMAN 70.3', raceDate: '', ftp: '', css: '', t400: '', t200: '', hr: [['', ''], ['', ''], ['', ''], ['', ''], ['', '']], runThr: '' };
const OB_STEPS = 8;
const hrTemplate = i => ['Z1 Sehr leicht', 'Z2 Leicht', 'Z3 Aerob', 'Z4 Schwelle', 'Z5 Maximum'][i];

function obErr(step) {
  if (step === 1) { if (!OB.name.trim()) return 'Bitte deinen Namen eintragen.'; const w = num(OB.weight); if (!w || w < 30 || w > 200) return 'Bitte ein gültiges Gewicht (kg) eintragen.'; }
  if (step === 2) {
    if (!OB.raceName.trim()) return 'Bitte einen Rennnamen eintragen.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(OB.raceDate)) return 'Bitte das Renndatum wählen.';
    if (diffDays(OB.raceDate, todayIso()) < 0) return 'Das Rennen muss in der Zukunft liegen.';
  }
  if (step === 3) { const f = num(OB.ftp); if (!f || f < 80 || f > 600) return 'FTP bitte in Watt eintragen (80–600).'; }
  if (step === 4) { const c = parseMMSS(OB.css); if (!c || c < 60 || c > 200) return 'CSS bitte als mm:ss pro 100 m eintragen (z. B. 1:45).'; }
  if (step === 5) { const r = validateZones({ ftp: OB.ftp, css: OB.css, hr: OB.hr, runThr: '' }); if (r.err && /HF/.test(r.err)) return r.err; }
  if (step === 6 && OB.runThr) { const r = parseMMSS(OB.runThr); if (!r || r < 150 || r > 600) return 'Pace bitte als mm:ss pro km (z. B. 4:40) oder leer lassen.'; }
  return null;
}
function obStepHtml() {
  const s = OB.step;
  const dots = `<div class="ob-dots">${Array.from({ length: OB_STEPS }, (_, i) => `<i class="${i <= s ? 'on' : ''}"></i>`).join('')}</div>`;
  const inp = (label, key, val, extra = '') => `<label class="fld"><span>${label}</span><input data-ob="${key}" value="${esc(val)}" ${extra}></label>`;
  let body = '';
  if (s === 0) body = `<div class="ob-hero"><div class="orb"><i></i><i></i><i></i></div><h1>Dein Weg zum<br>Ironman 70.3</h1><p>20 Wochen Performance-Plan, persönlich berechnet aus deiner FTP, CSS und deinen Garmin-HF-Zonen. Ein kurzes Onboarding – einmalig.</p></div>`;
  if (s === 1) body = `<h2>Über dich</h2><p class="muted">Damit die App dich persönlich ansprechen kann.</p>${inp('Name *', 'name', OB.name, 'autocomplete="given-name"')}${inp('Gewicht (kg) *', 'weight', OB.weight, 'inputmode="decimal" placeholder="75"')}`;
  if (s === 2) {
    const start = OB.raceDate ? planStartFor(OB.raceDate) : null;
    let info = '';
    if (start) {
      const d = diffDays(start, todayIso()); const rd = parseIso(OB.raceDate).getDay();
      info = `<div class="card mini calc-card"><p class="eyebrow">Berechneter Plan</p><p><b>Start: ${esc(fmtDateLong(start))}</b><br>Ende / Rennen: ${esc(fmtDateLong(OB.raceDate))}</p>` +
        (d > 0 ? `<p class="muted small">Der Plan beginnt in ${d} Tagen (${Math.floor(d / 7)} Wochen Vorlauf).</p>` : d === 0 ? '<p class="muted small">Der Plan startet heute.</p>' : `<p class="warn small">Bis zum Rennen sind es weniger als 20 Wochen. Der Plan hätte am ${esc(fmtDate(start))} beginnen müssen – du steigst in Woche ${Math.floor(-d / 7) + 1} ein und die früheren Wochen entfallen.</p>`) +
        (rd !== 0 ? `<p class="warn small">Der Plan ist für einen Rennsonntag gebaut. Dein Renntag ist ein ${WD_LONG[rd]} – die Woche läuft dann von ${WD_LONG[parseIso(start).getDay()]} bis ${WD_LONG[rd]} (Plan-Tage werden entsprechend verschoben).</p>` : '') + '</div>';
    }
    body = `<h2>Dein Rennen</h2><p class="muted">Der 20-Wochen-Plan wird rückwärts vom Renntag berechnet.</p>${inp('Rennname *', 'raceName', OB.raceName)}<label class="fld"><span>Renndatum *</span><input type="date" data-ob="raceDate" value="${OB.raceDate}" min="${todayIso()}"></label><div id="obRaceInfo">${info}</div>`;
  }
  if (s === 3) body = `<h2>Rad · FTP</h2><p class="muted">Deine aktuelle Functional Threshold Power. Daraus werden alle Wattbereiche des Plans berechnet (z. B. Z2 = 56–75 %).</p>${inp('Aktuelle FTP (Watt) *', 'ftp', OB.ftp, 'inputmode="numeric" placeholder="250"')}<div id="obFtp">${obFtpPrev()}</div>`;
  if (s === 4) body = `<h2>Schwimmen · CSS</h2><p class="muted">Critical Swim Speed als Pace pro 100 m. Daraus entstehen Technik-, Race- und Schwellen-Paces.</p>${inp('Aktuelle CSS (mm:ss / 100 m) *', 'css', OB.css, 'placeholder="1:45" inputmode="numeric"')}
    <div class="card mini"><p class="eyebrow">CSS aus Test berechnen</p><div class="fields">${inp('400 m (mm:ss)', 't400', OB.t400, 'placeholder="6:10"')}${inp('200 m (mm:ss)', 't200', OB.t200, 'placeholder="2:55"')}</div><button class="btn ghost sm" data-act="obCss">Berechnen &amp; übernehmen</button></div>`;
  if (s === 5) body = `<h2>Herzfrequenz-Zonen</h2><p class="muted">Deine 5 Garmin-Zonen (Garmin Connect → Benutzereinstellungen → Herzfrequenzbereiche).</p><div class="hrgrid">${OB.hr.map((r, i) => `<div class="hrrow"><span>${hrTemplate(i)}</span><input data-ob="hr.${i}.0" value="${esc(r[0])}" inputmode="numeric" placeholder="von"><em>–</em><input data-ob="hr.${i}.1" value="${esc(r[1])}" inputmode="numeric" placeholder="bis"></div>`).join('')}</div>`;
  if (s === 6) body = `<h2>Lauf-Schwelle <small class="opt">optional</small></h2><p class="muted">Deine aktuelle Schwellen-Pace (z. B. aus dem Lauftest in Woche 1). Damit zeigt die App zusätzlich Pace-Bereiche. Ohne Angabe steuerst du den Lauf per HF und RPE – wie im Plan.</p>${inp('Schwellen-Pace (mm:ss / km)', 'runThr', OB.runThr, 'placeholder="4:40" inputmode="numeric"')}`;
  if (s === 7) {
    const r = validateZones({ ftp: OB.ftp, css: OB.css, hr: OB.hr, runThr: OB.runThr });
    if (r.err) body = `<h2>Fast fertig</h2><p class="warn">${esc(r.err)}</p>`;
    else {
      const z = r.z; const start = planStartFor(OB.raceDate); const d = diffDays(start, todayIso());
      body = `<h2>Alles bereit, ${esc(OB.name.split(' ')[0])}</h2><div class="card mini calc-card"><p class="eyebrow">Plan</p><p><b>${esc(fmtDateLong(start))}</b> bis <b>${esc(fmtDateLong(OB.raceDate))}</b><br><span class="muted small">${esc(OB.raceName)} · ${d > 0 ? `Start in ${d} Tagen` : d === 0 ? 'Start heute' : `Einstieg in Woche ${Math.floor(-d / 7) + 1}`}</span></p></div>
      <div class="card mini"><p class="eyebrow">Deine Zonen</p><div class="ztable">${Zn.bike(z).slice(0, 4).map(b => `<div class="zr c-bike"><span>${b.name}</span><em>${b.lo}–${b.hi} %</em><b>${b.wlo}–${b.whi} W</b></div>`).join('')}${Zn.swim(z).slice(0, 2).map(x => `<div class="zr c-swim"><span>${x.name}</span><b>${paceRange(x.plo, x.phi)}</b></div>`).join('')}${Zn.run(z).slice(0, 3).map(x => `<div class="zr c-run"><span>${x.name}</span><b>HF ${rng(x.hr[0], x.hr[1])}</b></div>`).join('')}</div></div>`;
    }
  }
  const first = s === 0, last = s === OB_STEPS - 1;
  return `<div class="ob">${dots}<div class="ob-body">${body}</div><div id="obErr" class="err"></div><div class="btns ob-btns">${first ? '' : '<button class="btn ghost" data-act="obBack">Zurück</button>'}<button class="btn primary" data-act="${last ? 'obFinish' : 'obNext'}">${first ? 'Los geht’s' : last ? 'Plan starten' : 'Weiter'}</button></div></div>`;
}
function obFtpPrev() {
  const f = num(OB.ftp); if (!f || f < 80 || f > 600) return '';
  const z = { ftp: f };
  return `<div class="ztable">${BIKE_ZONES.slice(0, 3).map(b => `<div class="zr c-bike"><span>${b.name}</span><em>${b.lo}–${b.hi} %</em><b>${Zn.watts(z, b.lo)}–${Zn.watts(z, b.hi)} W</b></div>`).join('')}</div>`;
}
function setPath(path, val) { const p = path.split('.'); if (p[0] === 'hr') OB.hr[+p[1]][+p[2]] = val; else OB[p[0]] = val; }
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.ob; if (!k) return;
  setPath(k, e.target.value);
  if (k === 'raceDate' || k === 'raceName') { if (k === 'raceDate') { const el = $('#obRaceInfo'); if (el) { const tmp = document.createElement('div'); tmp.innerHTML = obStepHtml(); el.innerHTML = $('#obRaceInfo', tmp).innerHTML; } } }
  if (k === 'ftp') { const el = $('#obFtp'); if (el) el.innerHTML = obFtpPrev(); }
});
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.ob;
  const m = k && /^hr\.(\d)\.1$/.exec(k);
  if (m && +m[1] < 4) { const nxt = $(`[data-ob="hr.${+m[1] + 1}.0"]`); const hi = num(e.target.value); if (nxt && !nxt.value && hi) { nxt.value = hi + 1; OB.hr[+m[1] + 1][0] = String(hi + 1); } }
});

/* ---------- Zonen-Update ---------- */
function openZoneUpdate(prefill = {}, intro = '') {
  const z = S.zones; const p = { ftp: z.ftp, css: fmtMMSS(z.css), runThr: z.runThr ? fmtMMSS(z.runThr) : '', ...prefill };
  const hrNames = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];
  openSheet(`<div class="sheet-in"><h2>Zonen aktualisieren</h2><p class="muted">${intro || 'Trage deine aktuellen Werte ein (z. B. aus Garmin). Der Plan rechnet alle noch offenen Einheiten neu – oder bleibt gleich, wenn sich nichts ändert.'}</p>
  <form id="zform" onsubmit="return false"><div class="fields">${field('FTP (W)', 'ftp', p.ftp, 'inputmode="numeric"')}${field('CSS (mm:ss /100 m)', 'css', p.css)}</div>
  <div class="card mini"><p class="eyebrow">CSS aus Test</p><div class="fields">${field('400 m', 't400', '', 'placeholder="6:10"')}${field('200 m', 't200', '', 'placeholder="2:55"')}</div><button type="button" class="btn ghost sm" data-act="zCss">Berechnen &amp; übernehmen</button></div>
  <label class="lbl">Garmin-HF-Zonen (bpm)</label><div class="hrgrid">${z.hr.map((r, i) => `<div class="hrrow"><span>${hrNames[i]}</span><input name="hr${i}0" value="${r[0]}" inputmode="numeric"><em>–</em><input name="hr${i}1" value="${r[1]}" inputmode="numeric"></div>`).join('')}</div>
  ${field('Lauf-Schwellen-Pace (mm:ss /km, optional)', 'runThr', p.runThr)}
  <label class="fld"><span>Grund</span><select name="reason" class="sel"><option>Wöchentliche Kontrolle</option><option>Test / Retest</option><option>Neue Garmin-Werte</option><option>Sonstiges</option></select></label>
  <div id="zErr" class="err"></div><div class="btns"><button type="button" class="btn primary" data-act="zSave">Speichern &amp; Plan aktualisieren</button><button type="button" class="btn ghost" data-act="closeSheet">Abbrechen</button></div></form></div>`);
}
function readZoneForm() {
  const f = $('#zform'); const g = n => f.querySelector(`[name="${n}"]`).value;
  return { ftp: g('ftp'), css: g('css'), hr: [0, 1, 2, 3, 4].map(i => [g(`hr${i}0`), g(`hr${i}1`)]), runThr: g('runThr'), reason: g('reason') };
}

/* ---------- Formulare lesen ---------- */
const val = (root, n) => { const el = root.querySelector(`[name="${n}"]`); return el ? el.value.trim() : ''; };
const rad = (root, n) => { const el = root.querySelector(`input[name="${n}"]:checked`); return el ? el.value : null; };

/* ---------- Garmin-Datei einlesen ---------- */
async function importActivity(input) {
  const file = input.files[0]; if (!file) return;
  const form = input.closest('form'); const sid = form.dataset.sid; const s = findSession(sid);
  try {
    const doc = new DOMParser().parseFromString(await file.text(), 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('parse');
    const byNS = n => Array.from(doc.getElementsByTagNameNS('*', n));
    let secs = 0, dist = 0; const hrs = [], watts = [];
    if (byNS('Lap').length) {
      byNS('TotalTimeSeconds').forEach(e => secs += +e.textContent || 0);
      byNS('DistanceMeters').forEach(e => { if (e.parentNode.localName === 'Lap') dist += +e.textContent || 0; });
      byNS('HeartRateBpm').forEach(e => { const v = +(e.getElementsByTagNameNS('*', 'Value')[0] || {}).textContent; if (v) hrs.push(v); });
      byNS('Watts').forEach(e => { const v = +e.textContent; if (v) watts.push(v); });
    } else {
      const pts = byNS('trkpt'); const times = pts.map(p => p.getElementsByTagNameNS('*', 'time')[0]).filter(Boolean).map(t => +new Date(t.textContent));
      if (times.length > 1) secs = (times[times.length - 1] - times[0]) / 1000;
      byNS('hr').forEach(e => { const v = +e.textContent; if (v) hrs.push(v); });
      let prev = null; pts.forEach(p => { const la = +p.getAttribute('lat'), lo = +p.getAttribute('lon'); if (prev) { const R = 6371000, r = Math.PI / 180, dLa = (la - prev[0]) * r, dLo = (lo - prev[1]) * r; const a = Math.sin(dLa / 2) ** 2 + Math.cos(prev[0] * r) * Math.cos(la * r) * Math.sin(dLo / 2) ** 2; dist += 2 * R * Math.asin(Math.sqrt(a)); } prev = [la, lo]; });
    }
    if (!secs) throw new Error('empty');
    const set = (n, v) => { const el = form.querySelector(`[name="${n}"]`); if (el && v != null && v !== '') el.value = v; };
    set('minutes', Math.round(secs / 60));
    if (hrs.length) set('avgHr', Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length));
    if (watts.length && s.disc === 'bike') set('avgP', Math.round(watts.reduce((a, b) => a + b, 0) / watts.length));
    if (dist > 0) {
      if (s.disc === 'swim') { set('dist', Math.round(dist)); set('pace', fmtMMSS(secs / (dist / 100))); }
      else { set('dist', (dist / 1000).toFixed(1)); if (s.disc === 'run') set('pace', fmtMMSS(secs / (dist / 1000))); }
    }
    toast('Garmin-Datei eingelesen – bitte prüfen und speichern.', 'ok');
  } catch (e) { toast('Datei konnte nicht gelesen werden (nur .tcx/.gpx).', 'err'); }
  input.value = '';
}

/* ---------- Aktionen ---------- */
const actions = {
  closeSheet: () => closeSheet(),
  exportFit(t) { const s = findSession(t.dataset.sid); if (FIT.exportSession(s)) fitHint(); else toast('Für diese Einheit ist kein Export möglich.', 'err'); },
  exportWeek(t) { const n = FIT.exportWeek(+t.dataset.week); if (n) { toast(`${n} Workouts exportiert.`, 'ok'); fitHint(); } else toast('Keine exportierbaren Einheiten.', 'err'); },
  obNext() { const e = obErr(OB.step); if (e) { $('#obErr').textContent = e; shake('.ob-body'); return; } OB.step++; renderOB(); },
  obBack() { OB.step = Math.max(0, OB.step - 1); renderOB(); },
  obCss() { const a = parseMMSS(OB.t400), b = parseMMSS(OB.t200); if (!a || !b || a <= b) { $('#obErr').textContent = 'Bitte 400 m und 200 m Zeiten (mm:ss) eintragen – 400 m muss länger dauern.'; return; } OB.css = fmtMMSS(Zn.cssFromTests(a, b)); renderOB(); toast('CSS berechnet: ' + OB.css + ' /100 m', 'ok'); },
  obFinish() {
    const r = validateZones({ ftp: OB.ftp, css: OB.css, hr: OB.hr, runThr: OB.runThr });
    if (r.err) { $('#obErr').textContent = r.err; return; }
    initState({ name: OB.name.trim(), weight: num(OB.weight), raceName: OB.raceName.trim(), raceDate: OB.raceDate }, r.z);
    location.hash = '#/'; boot();
  },
  zoneUpdate() { closeSheet(); openZoneUpdate(); },
  snoozeZone() { S.snoozeZone = todayIso(); commit(); closeSheet(); render(); },
  zCss() { const f = $('#zform'); const a = parseMMSS(val(f, 't400')), b = parseMMSS(val(f, 't200')); if (!a || !b || a <= b) { $('#zErr').textContent = 'Bitte 400 m und 200 m Zeiten (mm:ss) eintragen.'; return; } f.querySelector('[name="css"]').value = fmtMMSS(Zn.cssFromTests(a, b)); $('#zErr').textContent = ''; },
  async zSave() {
    const d = readZoneForm(); const r = validateZones(d);
    if (r.err) { $('#zErr').textContent = r.err; return; }
    const old = S.zones; const wk = curWeek();
    const ftpUp = (r.z.ftp - old.ftp) / old.ftp, cssUp = (old.css - r.z.css) / old.css;
    const testWeek = [1, 8, 12, 13, 17, 18].includes(wk);
    if ((ftpUp > 0.04 || cssUp > 0.03) && !(d.reason === 'Test / Retest' && testWeek)) {
      const ok = await askConfirm('Deutliche Verbesserung übernehmen?', `Laut Plan (Zone-update rule) werden Zonen erst nach <b>bestätigter</b> Leistungssteigerung angehoben – nicht nach einem einzelnen guten Tag. Der Sprung beträgt ${ftpUp > 0.04 ? `FTP +${(ftpUp * 100).toFixed(1)} %` : `CSS ${(cssUp * 100).toFixed(1)} % schneller`}. Ist der Wert durch einen Test oder mehrere Einheiten belegt?`, 'Ja, übernehmen');
      if (!ok) { openZoneUpdate({ ftp: d.ftp, css: d.css, runThr: d.runThr }); return; }
    }
    const diff = applyZoneUpdate(r.z, d.reason);
    closeSheet(); toast(diff.length ? 'Zonen aktualisiert – Plan angepasst.' : 'Zonen bestätigt – Plan bleibt gleich.', 'ok'); render();
  },
  perfTab(t) { perfTab = t.dataset.tab; render(false); },
  saveSession(t) {
    const form = t.closest('form'); const sid = form.dataset.sid, date = form.dataset.date; const s = findSession(sid);
    const status = rad(form, 'status'); if (!status) return toast('Bitte den Status wählen.', 'err');
    const l = { status };
    const n = k => num(val(form, k));
    if (status !== 'no') {
      l.minutes = n('minutes'); if (!(l.minutes > 0)) return toast('Bitte die tatsächliche Dauer eintragen.', 'err');
      l.rpe = num(rad(form, 'rpe')); if (!l.rpe) return toast('Bitte den RPE-Wert wählen.', 'err');
      if ((s.hard || s.test) && !rad(form, 'stable')) return toast('Bitte angeben, ob die Qualität stabil blieb.', 'err');
    } else l.minutes = 0;
    ['dist', 'avgP', 'np', 'cad', 'avgHr', 'qualMin', 'raceMin', 'carbs', 'testFtp'].forEach(k => { const v = n(k); if (v != null) l[k] = v; });
    ['pace', 't400', 't200', 'testPace', 'notes'].forEach(k => { const v = val(form, k); if (v) l[k] = v; });
    ['stable', 'gi', 'coachOk'].forEach(k => { const v = rad(form, k); if (v) l[k] = v; });
    const log = getLog(date);
    if (log.complete) reopenDay(date);
    log.sessions[sid] = l; commit();
    toast('Einheit gespeichert.', 'ok');
    // Test-Ergebnisse -> Zonen vorschlagen
    let pre = null, why = '';
    if (l.t400 && l.t200) { const a = parseMMSS(l.t400), b = parseMMSS(l.t200); if (a && b && a > b) { const css = Math.round(Zn.cssFromTests(a, b)); if (css !== S.zones.css) { pre = { css: fmtMMSS(css) }; why = `Aus deinem Test ergibt sich eine CSS von ${fmtMMSS(css)}/100 m.`; } } }
    if (l.testFtp && l.testFtp !== S.zones.ftp) { pre = { ...(pre || {}), ftp: l.testFtp }; why = (why ? why + ' ' : '') + `Dein Testergebnis: FTP ${l.testFtp} W.`; }
    if (l.testPace) { const p = parseMMSS(l.testPace); if (p) { pre = { ...(pre || {}), runThr: fmtMMSS(p) }; why = (why ? why + ' ' : '') + `Schwellen-Pace ${fmtMMSS(p)}/km.`; } }
    render(false);
    if (pre) setTimeout(() => openZoneUpdate(pre, why + ' Zonen jetzt übernehmen?'), 300);
  },
  finishDay(t) {
    const form = t.closest('form'); const date = form.dataset.date; const dm = dayModel(date);
    const log = getLog(date);
    const pending = dm.sessions.filter(s => effective(s).mode !== 'rest' && !(log.sessions[s.id] && log.sessions[s.id].status));
    if (pending.length) { toast('Bitte zuerst alle Einheiten eintragen.', 'err'); const el = document.getElementById(pending[0].id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const c = {};
    c.sleep = num(val(form, 'sleep')); if (c.sleep == null || c.sleep < 0 || c.sleep > 16) return toast('Bitte die Schlafdauer (h) eintragen.', 'err');
    c.fatigue = num(rad(form, 'fatigue')); if (!c.fatigue) return toast('Bitte die Müdigkeit (1–5) wählen.', 'err');
    c.pain = rad(form, 'pain'); if (!c.pain) return toast('Bitte Schmerzen angeben.', 'err');
    c.painArea = val(form, 'painArea') || 'all';
    c.illness = rad(form, 'illness'); if (!c.illness) return toast('Bitte Krankheitszeichen angeben.', 'err');
    c.extraMin = num(val(form, 'extraMin')) || 0;
    c.junkOk = rad(form, 'junkOk'); if (!c.junkOk) return toast('Bitte den Junk-Mile-Check beantworten.', 'err');
    if (dm.rest) { c.restKept = rad(form, 'restKept'); if (!c.restKept) return toast('Bitte angeben, ob der Ruhetag eingehalten wurde.', 'err'); }
    if (dm.sessions.some(s => s.hard && effective(s).mode !== 'rest')) { c.specOk = rad(form, 'specOk'); if (!c.specOk) return toast('Bitte die Spezifität (Kernintention) beantworten.', 'err'); }
    log.check = c; const adj = finalizeDay(date);
    showDayResult(date, adj);
  },
  async reopenDay(t) { reopenDay(t.dataset.date); render(false); },
  saveSettings() {
    const f = $('#setform'); const name = val(f, 'name'), w = num(val(f, 'weight')), rn = val(f, 'raceName'), rd = val(f, 'raceDate');
    if (!name || !w || !rn || !rd) return toast('Bitte alle Felder ausfüllen.', 'err');
    if (rd !== S.profile.raceDate) { S.startDate = planStartFor(rd); }
    S.profile = { name, weight: w, raceName: rn, raceDate: rd }; commit(); toast('Gespeichert.', 'ok'); render(false);
  },
  exportData() {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `triathlon-backup-${todayIso()}.json`; document.body.appendChild(a); a.click(); a.remove();
    toast('Backup erstellt.', 'ok');
  },
  async resetAll() { if (await askConfirm('Alles löschen?', 'Alle Daten (Profil, Zonen, Einträge) werden unwiderruflich von diesem Gerät gelöscht. Erstelle vorher ein Backup, wenn du sie behalten willst.', 'Ja, alles löschen', true)) { Store.clear(); S = null; Object.assign(OB, { step: 0, name: '', weight: '', raceDate: '', ftp: '', css: '', hr: [['', ''], ['', ''], ['', ''], ['', ''], ['', '']], runThr: '' }); location.hash = '#/'; boot(); } }
};
const changeActions = {
  setLang(input) { S.lang = input.value; commit(); render(false); toast(S.lang === 'en' ? 'Plan texts: original (EN)' : 'Plan-Texte: Deutsch', 'ok'); },
  importFile: importActivity,
  async importData(input) {
    const f = input.files[0]; if (!f) return;
    try { const d = JSON.parse(await f.text()); if (!d.profile || !d.zones || !d.startDate || !d.logs) throw 0; Store.save(d); S = d; toast('Backup geladen.', 'ok'); location.hash = '#/'; boot(); } catch (e) { toast('Diese Datei ist kein gültiges Backup.', 'err'); }
    input.value = '';
  }
};
document.addEventListener('click', e => { const t = e.target.closest('[data-act]'); if (t && actions[t.dataset.act]) { e.preventDefault(); actions[t.dataset.act](t, e); } });
document.addEventListener('change', e => { const t = e.target.closest('[data-act-change]'); if (t && changeActions[t.dataset.actChange]) changeActions[t.dataset.actChange](t, e); });

function fitHint() {
  if (S.fitHintShown) return; S.fitHintShown = true; commit();
  openSheet(`<div class="sheet-in"><h2>Workout auf die Uhr bringen</h2><p class="muted">1. Uhr per USB an einen PC anschließen.<br>2. Die .fit-Datei(en) (ZIP vorher entpacken) in den Ordner <b>GARMIN/NewFiles</b> kopieren (alternativ <b>GARMIN/Workouts</b>).<br>3. Uhr trennen – das Workout erscheint im Trainingsmenü der Uhr.<br><br>Hinweis: Das Format ist nach dem FIT-Standard erzeugt, aber noch nicht auf jeder Uhr getestet. Prüfe das erste Workout vor einer wichtigen Einheit.</p><div class="btns"><button class="btn primary" data-act="closeSheet">Verstanden</button></div></div>`);
}

function shake(sel) { const el = $(sel); if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

function showDayResult(date, adj) {
  const changes = adj.filter(a => a.kind !== 'note' || true);
  openSheet(`<div class="sheet-in center"><div class="checkmark"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="23"/><path d="M15 27l8 8 15-17"/></svg></div><h2>Tag erledigt</h2>
  ${changes.length ? `<p class="muted">Aus deinen Angaben hat der Plan Folgendes angepasst:</p><ul class="adj-list left">${changes.map(a => `<li class="${a.kind}"><b>${esc(a.what)}</b><p>${esc(a.why)}</p></li>`).join('')}</ul>` : '<p class="muted">Alles im grünen Bereich – der Plan bleibt unverändert.</p>'}
  <div class="btns"><button class="btn primary" id="resOk">Weiter</button></div></div>`);
  $('#resOk').onclick = () => { closeSheet(); location.hash = '#/'; render(); };
  render(false);
}

/* ---------- Router ---------- */
function renderOB() {
  nav.classList.add('hide'); view.innerHTML = obStepHtml(); view.className = 'view ob-view'; window.scrollTo(0, 0);
}
let lastRoute = '';
function render(resetScroll = true) {
  if (!S) return renderOB();
  const h = (location.hash.slice(1) || '/'); const p = h.split('/').filter(Boolean);
  let html = '', tab = 'home';
  const y = window.scrollY;
  if (!p.length) html = viewHome();
  else if (p[0] === 'plan') { html = viewPlan(); tab = 'plan'; }
  else if (p[0] === 'week') { html = viewWeek(+p[1] || Math.max(1, Math.min(20, curWeek()))); tab = 'plan'; }
  else if (p[0] === 'day') { html = viewDay(p[1] || todayIso()); tab = (p[1] === todayIso()) ? 'home' : 'plan'; }
  else if (p[0] === 'perf') { html = viewPerf(); tab = 'perf'; }
  else if (p[0] === 'zones') { html = viewZones(); tab = 'zones'; }
  else if (p[0] === 'more') { html = viewMore(); tab = 'more'; }
  else if (p[0] === 'settings') { html = viewSettings(); tab = 'more'; }
  else html = viewHome();
  nav.classList.remove('hide'); view.className = 'view';
  view.innerHTML = html;
  $$('.tabitem', nav).forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
  initCharts(view);
  if (resetScroll && h !== lastRoute) window.scrollTo(0, 0); else window.scrollTo(0, y);
  lastRoute = h;
}
window.addEventListener('hashchange', () => render());

/* ---------- Start ---------- */
function boot() {
  S = Store.load();
  if (!S) { renderOB(); return; }
  if (!S.adjustments) S.adjustments = [];
  render();
  if (!zonePopupShown && zonesDue()) {
    zonePopupShown = true;
    setTimeout(() => openSheet(`<div class="sheet-in center"><div class="ico-badge amber big">${ic('refresh')}</div><h2>Wöchentliches Zonen-Update</h2><p class="muted">Neue Woche, neue Werte? Prüfe FTP, CSS und deine Garmin-HF-Zonen. Der Plan wird entsprechend angepasst – oder bleibt gleich.</p><div class="btns"><button class="btn primary" data-act="zoneUpdate">Jetzt aktualisieren</button><button class="btn ghost" data-act="snoozeZone">Später erinnern</button></div></div>`), 600);
  }
}
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { });
boot();
