/* Garmin-Workout-Export: erzeugt .fit-Workoutdateien (FIT-Protokoll 2.0) und ZIP-Pakete */
'use strict';
const FIT = (() => {
  /* ---------- Bausteine ---------- */
  const mid = (a, b) => b ? (+a + +b) / 2 : +a;
  const firstMin = (t, def) => { const m = (t || '').match(/(\d+)(?:-(\d+))?\s*min/); return m ? mid(m[1], m[2]) : def; };
  const pctRange = (a, b, lower) => { if (lower && b > a) b = Math.round((a + b) / 2); return [a, b]; };
  const step = (name, dur, tgt, int, notes) => ({ name, dur, tgt: tgt || { t: 'open' }, int, notes: notes || '' });
  const timeS = sec => ({ t: 'time', v: Math.max(1, Math.round(sec)) });
  const distM = m => ({ t: 'dist', v: Math.max(1, Math.round(m)) });
  const OPEN = { t: 'open' };
  const cap = (s, n) => (s || '').replace(/\s+/g, ' ').slice(0, n);

  /* ---------- Rad ---------- */
  function bikeSteps(s, z, eff) {
    const R = s.raw, total = eff.dur || s.durMin || 60;
    const P = (a, b) => ({ t: 'power', lo: Zn.watts(z, a), hi: Zn.watts(z, b) });
    const warm = Math.min(firstMin(R['Warm-up'], 15), total * 0.35), cool = Math.min(firstMin(R['Cool-down'], 10), total * 0.2);
    const out = [step('Warm-up', timeS(warm * 60), P(50, 70), 'warmup', T(R['Warm-up']))];
    const mainMin = Math.max(5, total - warm - cool); const main = R['Main set'];
    const notes = T(main);
    let m;
    if (s.test) out.push(step('Test (Lap-Taste)', { t: 'open' }, OPEN, 'active', notes));
    else if (eff.mode === 'easy') out.push(step('Z2 locker', timeS(mainMin * 60), P(56, 75), 'active', 'Locker Z1-Z2, keine Intervalle'));
    else if ((m = main.match(/(\d+)x(\d+(?:-\d+)?)\s*min/))) {
      const seg = main.split(';').find(x => x.includes(m[0])) || main;
      let n = Math.max(1, +m[1] - (eff.repsMinus || 0)); const M = mid(...m[2].split('-'));
      let lo, hi; const f = seg.match(/(\d+)(?:-(\d+))?%\s*FTP/);
      if (f) [lo, hi] = pctRange(+f[1], +(f[2] || f[1]), eff.lower);
      else if (/race power|70\.3 (?:power|pace)/i.test(seg)) [lo, hi] = pctRange(78, 83, eff.lower);
      else if (/threshold/i.test(seg)) [lo, hi] = pctRange(95, 103, eff.lower);
      else [lo, hi] = pctRange(76, 87, eff.lower);
      const rm = main.slice(main.indexOf(m[0]) + m[0].length).match(/(\d+)(?:-(\d+))?\s*min\s*(?:easy|Z2|jog)/i);
      const rest = rm ? mid(rm[1], rm[2]) : 0;
      const left = mainMin - n * (M + rest);
      if (left >= 10) out.push(step('Z2 Ausdauer', timeS(left * 60), P(56, 75), 'active', 'Z2'));
      const base = out.length;
      out.push(step('Intervall', timeS(M * 60), P(lo, hi), 'interval', cap(notes, 50)));
      if (rest > 0) out.push(step('Erholung', timeS(rest * 60), P(40, 65), 'recovery', ''));
      if (n > 1) out.push({ repeat: true, from: base, count: n });
    } else if ((m = main.match(/final (\d+) min @ (\d+)(?:-(\d+))?%\s*FTP/i))) {
      const N = +m[1]; const [lo, hi] = pctRange(+m[2], +(m[3] || m[2]), eff.lower);
      out.push(step('Z2 Ausdauer', timeS(Math.max(5, mainMin - N) * 60), P(56, 75), 'active', 'Z2'));
      out.push(step('Finale', timeS(N * 60), P(lo, hi), 'interval', cap(notes, 50)));
    } else out.push(step('Hauptteil', timeS(mainMin * 60), P(56, 75), 'active', cap(notes, 50)));
    out.push(step('Cool-down', timeS(cool * 60), P(40, 60), 'cooldown', T(R['Cool-down'])));
    return out;
  }

  /* ---------- Laufen ---------- */
  function runSteps(s, z, eff) {
    const R = s.raw, total = eff.dur || s.durMin || 45;
    const H = (a, b) => { const r = Zn.rpeHr(z, a, b); return { t: 'hr', lo: r[0], hi: r[1] }; };
    const rpeOf = seg => { const m = seg.match(/RPE\s?(\d)(?:-(\d))?/); if (m) return [+m[1], +(m[2] || m[1])]; if (/threshold/i.test(seg)) return [7, 8]; if (/tempo/i.test(seg)) return [6, 6]; if (/race pace|70\.3/i.test(seg)) return [5, 6]; return [2, 3]; };
    const lowerR = r => eff.lower ? [Math.max(2, r[0] - 1), Math.max(2, r[1] - 1)] : r;
    const warm = Math.min(firstMin(R['Warm-up'], 10), total * 0.3), cool = Math.min(firstMin(R['Cool-down'], 8), total * 0.25);
    const out = []; const main = R['Main set']; const notes = cap(T(main), 50);
    let strideMin = 0, sm = null;
    if (s.strides && eff.mode !== 'easy') { sm = s.title.match(/(\d+)(?:-(\d+))?x(\d+)s/); if (sm) strideMin = mid(sm[1], sm[2]) * 90 / 60; }
    if (s.brick) {
      const tm = s.title.match(/:\s*(.+)$/);
      if (tm && eff.mode === 'normal') {
        tm[1].split('+').forEach(tok => {
          const t = tok.match(/(\d+)(?:-(\d+))?\s*(?:min\s*)?(.*)/); if (!t) return;
          const race = /race pace|70\.3|controlled/i.test(t[3]);
          out.push(step(race ? 'Race Pace' : 'Locker', timeS(mid(t[1], t[2]) * 60), race ? H(...lowerR([5, 6])) : H(2, 3), race ? 'interval' : 'active', ''));
        });
      } else out.push(step('Koppellauf locker', timeS(total * 60), H(2, 3), 'active', notes));
      return out;
    }
    out.push(step('Warm-up', timeS(warm * 60), H(1, 2), 'warmup', T(R['Warm-up'])));
    const mainMin = Math.max(5, total - warm - cool - strideMin);
    let m;
    if (s.test) out.push(step('Test (Lap-Taste)', OPEN, OPEN, 'active', notes));
    else if (eff.mode === 'easy') out.push(step('Locker', timeS(mainMin * 60), H(2, 3), 'active', 'Locker Z1-Z2, keine Intervalle'));
    else if ((m = main.match(/(\d+)x(\d+(?:-\d+)?)\s*(min|s|km)\b/))) {
      const seg = main.split(';')[0]; const n = Math.max(1, +m[1] - (eff.repsMinus || 0)); const v = mid(...m[2].split('-'));
      const rp = lowerR(rpeOf(seg)); const dur = m[3] === 'km' ? distM(v * 1000) : timeS(m[3] === 's' ? v : v * 60);
      const rm = main.match(/(\d+)(?:-(\d+))?\s*min\s*(?:jog|easy)/i); const restS = rm ? mid(rm[1], rm[2]) * 60 : (/jog back/i.test(main) ? 90 : 0);
      const est = n * ((m[3] === 'km' ? v * 300 : m[3] === 's' ? v : v * 60) + restS) / 60;
      if (mainMin - est >= 10) out.push(step('Locker', timeS((mainMin - est) * 60), H(2, 3), 'active', ''));
      const base = out.length;
      out.push(step('Intervall', dur, H(...rp), 'interval', notes));
      if (restS > 0) out.push(step('Trabpause', timeS(restS), H(1, 2), 'recovery', ''));
      if (n > 1) out.push({ repeat: true, from: base, count: n });
    } else out.push(step('Hauptteil', timeS(mainMin * 60), /Z2/.test(main) || /easy|Z1-Z2/i.test(main) ? H(2, 3) : H(2, 4), 'active', notes));
    if (sm) {
      const n = Math.round(mid(sm[1], sm[2])), base = out.length;
      out.push(step('Stride', timeS(+sm[3]), OPEN, 'interval', 'schnell, locker'));
      out.push(step('Trab', timeS(70), OPEN, 'recovery', ''));
      if (n > 1) out.push({ repeat: true, from: base, count: n });
    }
    out.push(step('Cool-down', timeS(cool * 60), H(1, 2), 'cooldown', T(R['Cool-down'])));
    return out;
  }

  /* ---------- Schwimmen ---------- */
  function swimSteps(s, z, eff) {
    const R = s.raw; const main = R['Main set']; const notes = cap(T(main), 50);
    const sumM = t => (t || '').split(/[;+]/).reduce((a, tok) => { const x = tok.match(/(\d+)x(\d+)/); if (x) return a + x[1] * x[2]; const y = tok.trim().match(/^(\d+)(?:-(\d+))?\s/); return a + (y ? mid(y[1], y[2]) : 0); }, 0);
    const kmM = s.title.match(/\/\s*~?([\d.,]+)(?:-([\d.,]+))?\s*km|~([\d,]+)\s*m/);
    let totalM = 0; if (kmM) { totalM = kmM[3] ? +kmM[3].replace(',', '') : mid(kmM[1].replace(',', '.'), kmM[2] && kmM[2].replace(',', '.')) * 1000; }
    if (eff.mode !== 'normal' && s.durMin) totalM *= (eff.dur || s.durMin) / s.durMin;
    const warmM = sumM(R['Warm-up']) || 300, coolM = sumM(R['Cool-down']) || 200;
    const out = [step('Warm-up', distM(warmM), OPEN, 'warmup', T(R['Warm-up']))];
    const pace = seg => { const m = seg.match(/CSS\s?\+(\d+)(?:-(\d+))?\s?s/); if (!m) return OPEN; const a = z.css + +m[1], b = z.css + +(m[2] || m[1]); return { t: 'speed', lo: Math.round(100 / b * 1000), hi: Math.round(100 / a * 1000) }; };
    if (s.test) {
      out.push(step('400 m Test', distM(400), OPEN, 'interval', 'hart kontrolliert'), step('Pause', timeS(420), OPEN, 'rest', ''), step('200 m Test', distM(200), OPEN, 'interval', 'hart kontrolliert'));
    } else if (eff.mode === 'easy') out.push(step('Locker', distM(Math.max(400, (totalM || 2000) - warmM - coolM)), OPEN, 'active', 'locker aerob'));
    else {
      const re = /(\d+)x(\d+)\b((?:(?!\d+x\d+)[^;])*)/g; let m, used = 0, any = false;
      while ((m = re.exec(main))) {
        const seg = m[0]; let n = +m[1]; const d = +m[2];
        if (d > 1000 || d < 25) continue;
        const rm = seg.match(/(\d+)(?:-(\d+))?\s?s rest/); const restS = rm ? mid(rm[1], rm[2]) : 0;
        if (eff.repsMinus && n > 1 && !any) n = Math.max(1, n - eff.repsMinus);
        const base = out.length; any = true; used += n * d;
        out.push(step(`${d} m`, distM(d), pace(seg), 'interval', cap(seg, 50)));
        if (restS > 0) out.push(step('Pause', timeS(restS), OPEN, 'rest', ''));
        if (n > 1) out.push({ repeat: true, from: base, count: n });
      }
      if (!any) { const left = (totalM || 0) - warmM - coolM; out.push(step('Hauptteil', left > 200 ? distM(left) : OPEN, OPEN, 'active', notes)); }
    }
    out.push(step('Cool-down', distM(coolM), OPEN, 'cooldown', T(R['Cool-down'])));
    return out;
  }

  function stepsFor(s, z, eff) {
    if (s.disc === 'bike') return { sport: 2, sub: 0, steps: bikeSteps(s, z, eff) };
    if (s.disc === 'run') return { sport: 1, sub: 0, steps: runSteps(s, z, eff) };
    if (s.disc === 'swim') return { sport: 5, sub: 17, steps: swimSteps(s, z, eff) };
    if (s.disc === 'strength') return { sport: 10, sub: 20, steps: [step('Kraft', OPEN, OPEN, 'active', cap(T(s.raw['Main set']), 50))] };
    return null;
  }

  /* ---------- FIT-Kodierung ---------- */
  const CRC_T = [0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401, 0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400];
  function crc16(bytes, crc = 0) {
    for (const b of bytes) {
      let t = CRC_T[crc & 0xF]; crc = (crc >> 4) & 0x0FFF; crc = crc ^ t ^ CRC_T[b & 0xF];
      t = CRC_T[crc & 0xF]; crc = (crc >> 4) & 0x0FFF; crc = crc ^ t ^ CRC_T[(b >> 4) & 0xF];
    }
    return crc;
  }
  const utf8 = s => Array.from(new TextEncoder().encode(s));
  function fixedStr(s, size) { let b = utf8(s); while (b.length > size - 1) { s = s.slice(0, -1); b = utf8(s); } while (b.length < size) b.push(0); return b; }
  const u16 = v => [v & 255, (v >> 8) & 255], u32 = v => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  const INT = { warmup: 2, active: 0, rest: 1, cooldown: 3, recovery: 4, interval: 5 };
  const DUR = { time: 0, dist: 1, open: 5 };

  function encode(name, sport, sub, steps) {
    const d = [];
    const def = (local, global, fields) => { d.push(0x40 | local, 0, 0, ...u16(global), fields.length); fields.forEach(f => d.push(f[0], f[1], f[2])); };
    const NAME = 32, SN = 20, NOTE = 50;
    // file_id
    def(0, 0, [[0, 1, 0x00], [1, 2, 0x84], [2, 2, 0x84], [3, 4, 0x8C], [4, 4, 0x86]]);
    d.push(0, 5, ...u16(255), ...u16(1), ...u32(1), ...u32(Math.floor(Date.now() / 1000) - 631065600));
    // workout
    def(1, 26, [[4, 1, 0x00], [6, 2, 0x84], [8, NAME, 0x07], [11, 1, 0x00]]);
    const real = steps.length;
    d.push(1, sport, ...u16(real), ...fixedStr(name, NAME), sub);
    // workout_step
    def(2, 27, [[254, 2, 0x84], [0, SN, 0x07], [1, 1, 0x00], [2, 4, 0x86], [3, 1, 0x00], [4, 4, 0x86], [5, 4, 0x86], [6, 4, 0x86], [7, 1, 0x00], [8, NOTE, 0x07]]);
    steps.forEach((st, i) => {
      let dt, dv, tt = 2, tv = 0, lo = 0, hi = 0, inten = 0, nm = st.name || '', nt = st.notes || '';
      if (st.repeat) { dt = 6; dv = st.from; tv = st.count; nm = ''; } else {
        dt = DUR[st.dur.t]; dv = st.dur.t === 'time' ? st.dur.v * 1000 : st.dur.t === 'dist' ? st.dur.v * 100 : 0;
        inten = INT[st.int] ?? 0;
        const g = st.tgt;
        if (g.t === 'power') { tt = 4; lo = g.lo + 1000; hi = g.hi + 1000; }
        else if (g.t === 'hr') { tt = 1; lo = g.lo + 100; hi = g.hi + 100; }
        else if (g.t === 'speed') { tt = 0; lo = g.lo; hi = g.hi; }
      }
      d.push(2, ...u16(i), ...fixedStr(nm, SN), dt, ...u32(dv), tt, ...u32(tv), ...u32(lo), ...u32(hi), inten, ...fixedStr(nt, NOTE));
    });
    const head = [14, 0x20, ...u16(2100), ...u32(d.length), 0x2E, 0x46, 0x49, 0x54];
    head.push(...u16(crc16(head)));
    const all = [...head, ...d]; all.push(...u16(crc16(all)));
    return new Uint8Array(all);
  }

  /* ---------- ZIP (ohne Kompression) ---------- */
  let CRC32 = null;
  function crc32(b) {
    if (!CRC32) { CRC32 = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC32[n] = c >>> 0; } }
    let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC32[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function zip(files) {
    const out = [], cen = []; let off = 0;
    for (const f of files) {
      const nm = utf8(f.name), c = crc32(f.data);
      const lh = [0x50, 0x4B, 3, 4, 20, 0, 0, 8, 0, 0, 0, 0, 0x21, 0, ...u32(c), ...u32(f.data.length), ...u32(f.data.length), ...u16(nm.length), 0, 0, ...nm];
      out.push(...lh, ...f.data);
      cen.push(0x50, 0x4B, 1, 2, 20, 0, 20, 0, 0, 8, 0, 0, 0, 0, 0x21, 0, ...u32(c), ...u32(f.data.length), ...u32(f.data.length), ...u16(nm.length), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(off), ...nm);
      off += lh.length + f.data.length;
    }
    const end = [0x50, 0x4B, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cen.length), ...u32(off), 0, 0];
    return new Uint8Array([...out, ...cen, ...end]);
  }

  /* ---------- Öffentliche API ---------- */
  const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  function build(s) {
    const date = dateOfSession(s), z = Zn.at(S, date), eff = effective(s);
    if (s.disc === 'race' || eff.mode === 'rest') return null;
    const r = stepsFor(s, z, eff); if (!r) return null;
    const parts = T(s.title).split(' - ');
    const nm = `W${s.week} ${wdShort(date)} ${parts[0]}`.slice(0, 31);
    const flat = r.steps;
    return { name: `${slug(nm.replace(/ /g, '_'))}-${date}.fit`, data: encode(nm, r.sport, r.sub, flat), steps: flat };
  }
  function save(name, bytes, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: type || 'application/octet-stream' }));
    a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  return {
    build, zip, save, encode, crc16, stepsFor,
    exportSession(s) { const f = build(s); if (!f) return false; save(f.name, f.data); return true; },
    exportWeek(w) {
      const files = []; for (const dk of DAYKEYS) for (const s of daySess(w, dk)) { const f = build(s); if (f) files.push({ name: f.name, data: f.data }); }
      if (!files.length) return 0; save(`Woche-${w}-Garmin-Workouts.zip`, zip(files), 'application/zip'); return files.length;
    }
  };
})();
