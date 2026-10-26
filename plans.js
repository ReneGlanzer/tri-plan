/* Plan-Register: jeder Plan = Metadaten (Verhalten, Regeln, Texte) + Daten (Wochen/Einheiten aus dem PDF).
   Neue Pläne mit demselben PDF-Aufbau: Daten per tools/gen_plan_*.py erzeugen und hier registrieren. */
'use strict';
window.PLANS = {
  tri70: {
    meta: {
      id: 'tri70',
      card: {
        title: 'Ironman 70.3 – 20 Wochen', tagline: 'Performance-Plan für Fortgeschrittene',
        facts: ['20 Wochen', '8–12 h pro Woche', 'Schwimmen · Rad · Lauf · Kraft'],
        needs: 'Du brauchst: aktuelle FTP, CSS und deine 5 Garmin-HF-Zonen.'
      },
      zoneModel: 'ftp', zonesTab: 'Zonen', hasEnglish: true,
      eventName: 'IRONMAN 70.3', askEventName: true, eventOffset: 0, defaultEnd: null,
      endKind: 'Rennen', endTitle: 'Dein Rennen', endField: 'Renndatum *', endLabel: 'Rennen',
      endIntro: 'Der 20-Wochen-Plan wird rückwärts vom Renntag berechnet.',
      endWeekdayWarn: 'Der Plan ist für einen Rennsonntag gebaut. Dein Renntag ist ein',
      eventToday: 'Renntag!', eventDone: 'Rennen vorbei', doneTitle: 'Rennen abgeschlossen',
      heroTitle: 'Dein Weg zum<br>Ironman 70.3',
      heroText: '20 Wochen Performance-Plan, persönlich berechnet aus deiner FTP, CSS und deinen Garmin-HF-Zonen. Ein kurzes Onboarding – einmalig.',
      titleSplit: ' - ', qualLabel: 'Qualität', keyLabel: 'Schlüsseleinheit',
      labels: { 'Purpose': 'Zweck', 'Warm-up': 'Aufwärmen', 'Main set': 'Hauptteil', 'Cool-down': 'Ausklang', 'Targets': 'Vorgaben', 'Coach note': 'Coach-Hinweis' },
      coachLabel: 'Coach-Hinweis eingehalten?',
      discs: [{ k: 'swim', label: 'Schwimmen' }, { k: 'bike', label: 'Rad' }, { k: 'run', label: 'Laufen' }, { k: 'strength', label: 'Kraft' }],
      longBike: 'flag', longRun: 'session', hasRaceMin: true,
      checks: ['rest', 'volume', 'spec', 'junk', 'autoreg'],
      rules: { maxHours: 12, repeatWeek: false, missedAny: false, nutrition: true, energy: false, painStrong: 'area', painMildOk: false, fatigueMode: 'reduce', illnessReentry: null, deloadPhase: null, maxRepeats: 0 },
      msgs: {
        easy: 'Z1–Z2', easyNow: 'locker Z1–Z2 (RPE 2–3)', easySuffix: 'keine Intervalle',
        illnessYes: 'Krankheit gemeldet. Laut Plan wird die Last reduziert und Ausgefallenes nicht nachgeholt.',
        qualityDrop: 'Leistung fiel >3–5 % ab',
        missed: 'Plan: Kernintention erhalten und verpasste Arbeit nicht stapeln. Die nächste Einheit läuft wie geplant.',
        extra: 'Junk-Mile-Check: Ohne klaren Zweck (Recovery, Frequenz, Technik, Aerobic) kein Zusatzumfang – Erholung und Schlüsseleinheiten haben Vorrang.',
        restBroken: 'Rest-Day-Regel: Der Ruhetag darf nur verschoben werden, wenn die Erholungslogik erhalten bleibt.'
      },
      ui: {
        painLabels: [['none', 'Keine'], ['mild', 'Leicht'], ['strong', 'Stark']],
        painAreas: [['all', 'allgemein'], ['run', 'Laufen'], ['bike', 'Rad'], ['swim', 'Schwimmen (Schulter)']],
        stableDrop: { bike: 'Leistung >3–5 % gefallen', other: 'Tempo/Leistung gefallen' },
        qualField: 'Min im Zielbereich (Qualität)'
      },
      kpis: [['hours', 'Planned volume', 'Geplanter Umfang', 'h'], ['longBike', 'Long bike', 'Lange Ausfahrt'], ['longRun', 'Long run', 'Langer Lauf'], ['quality', 'Quality min', 'Qualität (min)'], ['race', 'Race-specific min', 'Rennspezifisch (min)']],
      lbl: ['LB', 'LR'],
      charts: {
        vol: { type: 'line', tab: 'Volumen', title: 'Weekly training volume progression', sub: 'Wochenumfang in Stunden – Plan (PDF) vs. Ist', ceiling: 12, ceilLabel: '12-h-Ceiling' },
        disc: { tab: 'Disziplinen', title: 'Approximate discipline distribution by week', sub: 'Stunden je Disziplin – Plan (PDF, breite Balken) vs. Ist (schmale Balken)' },
        qual: { type: 'line', tab: 'Qualität', title: 'Progression of quality and race specificity', sub: 'Qualitäts- und rennspezifische Minuten pro Woche – Plan (PDF) vs. Ist (Ist = Minuten im Zielbereich, die du beim Eintragen angibst)', labels: ['Quality', 'Race-specific'] },
        long: { tab: 'Long Sessions', title: 'Long-session progression', sub: 'Länge der Long Bike (Sa) und Long Run (So) in Minuten – Plan (PDF) vs. Ist', labels: ['Long bike', 'Long run'] },
        note: () => T(PL.info.dashboardNote)
      },
      moreTitle: () => L('20-Week Ironman 70.3 Performance Plan', '20-Wochen Ironman 70.3 Performance-Plan'),
      moreSub: () => T(PL.info.subtitle),
      blocks: () => PL.info.blocks.map((b, i) => ({ ...b, a: i * 4 + 1, z: i * 4 + 4 })),
      sections() {
        const I = PL.info;
        return [
          { title: L('Performance philosophy & How to use', 'Performance-Philosophie & Anwendung'), open: true, blocks: [
            { t: 'h', x: L('Performance philosophy', 'Performance-Philosophie') }, { t: 'p', x: T(I.philosophy) },
            { t: 'h', x: L('How to use this document', 'So nutzt du diesen Plan') }, { t: 'p', x: T(I.howto) }] },
          { title: L('1. Training zones and execution rules', '1. Trainingszonen und Ausführungsregeln'), blocks: [
            ...I.zones.flatMap(x => [{ t: 'h', x: T(x.h) }, { t: 'p', x: T(x.t) }]),
            { t: 'table', cols: [T('Metric'), T('Primary use'), T('Secondary guardrail')], cls: 'm3', rows: I.metrics.map(m => m.map(c => T(c))) },
            { t: 'h', x: L('Hard-session rule', 'Regel für harte Einheiten') }, { t: 'p', x: T(I.hardrule) }] },
          { title: L('2. 20-week master plan', '2. 20-Wochen-Masterplan'), blocks: [{ t: 'master' }] },
          { title: L('3. Block / monthly analysis', '3. Block-/Monatsanalyse'), blocks: [{ t: 'blocks' }] },
          { title: L('5. Test / retest protocol', '5. Test-/Retest-Protokoll'), blocks: I.tests.flatMap(b => [{ t: 'h', x: T(b.h) }, { t: 'p', x: T(b.t) }]) },
          { title: L('6. Race-execution framework', '6. Rennausführung'), blocks: [
            { t: 'table', cols: ['Segment', L('Execution', 'Ausführung')], cls: 'm2', rows: I.race.map(r => [T(r[0]), T(r[1])]) },
            { t: 'h', x: L('Nutrition rehearsal', 'Ernährungsprobe') }, { t: 'p', x: T(I.nutrition) },
            { t: 'h', x: L('Final principle', 'Leitprinzip') }, { t: 'p', x: T(I.principle) }] }
        ];
      }
    },
    get data() { return window.PLAN; }
  },

  jennifer: {
    meta: {
      id: 'jennifer',
      card: {
        title: 'Trainingsplan 26 Wochen · Jennifer', tagline: 'Einsteigerin: Laufen lernen, Rad, Kraft, Mobility/Yoga',
        facts: ['26 Wochen', '2:00–6:00 h pro Woche', 'Gesteuert nach Gefühl (RPE)'],
        needs: 'Du brauchst nur Name und Zeitraum – keine FTP, CSS oder HF-Zonen. Der Plan arbeitet mit RPE und Sprechtest.'
      },
      zoneModel: 'rpe', zonesTab: 'Intensität', hasEnglish: false,
      eventName: '5-km-Abschlusstest', askEventName: false, eventOffset: -1, defaultEnd: '2027-05-02',
      endKind: 'Plan-Ende', endTitle: 'Dein Zeitraum', endField: 'Letzter Plantag (Sonntag) *', endLabel: 'Plan-Ende',
      endIntro: 'Der Plan dauert 26 Wochen und endet mit dem 5-km-Abschlusstest. Vorgabe aus dem Plan: Start Mo 02.11.2026, Ende So 02.05.2027. Du kannst das Ende verschieben – der Start wird entsprechend berechnet.',
      endWeekdayWarn: 'Der Plan ist für einen Sonntag als letzten Tag gebaut. Dein gewählter Tag ist ein',
      eventToday: 'Testtag!', eventDone: 'Test geschafft', doneTitle: 'Plan abgeschlossen',
      heroTitle: 'Dein Weg zu<br>5 km am Stück',
      heroText: '26 Wochen: Routine aufbauen, Laufen am Stück lernen, Rad, Kraft und Mobility – ohne Zahlenballast, nach Gefühl.',
      titleSplit: null, qualLabel: 'Zügige Abschnitte', keyLabel: 'Meilenstein',
      labels: { 'Purpose': 'Zweck', 'Warm-up': 'Aufwärmen', 'Main set': 'Hauptteil', 'Cool-down': 'Ausklang', 'Targets': 'Ziele', 'Coach note': 'Hinweis' },
      coachLabel: 'Hinweis beachtet?',
      discs: [{ k: 'run', label: 'Laufen' }, { k: 'bike', label: 'Rad' }, { k: 'strength', label: 'Kraft' }, { k: 'mob', label: 'Rumpf/Mobility/Yoga' }],
      longBike: 'max', longRun: 'cont', hasRaceMin: false,
      checks: ['rest', 'volume', 'intensity', 'adapt'],
      rules: { maxHours: 6, repeatWeek: true, missedAny: true, nutrition: false, energy: true, painStrong: 'noRun', painMildOk: true, fatigueMode: 'easy', illnessReentry: 6, deloadPhase: 'Entlastung', maxRepeats: 4 },
      msgs: {
        easy: 'RPE 3–4', easyNow: 'locker (RPE 3–4)', easySuffix: 'zügige Abschnitte locker absolvieren, Umfang bleibt',
        illnessYes: 'Bei Fieber oder Symptomen unterhalb des Halses wird pausiert (Plan-Regel). Ausgefallenes wird nicht nachgeholt.',
        qualityDrop: 'Leistung deutlich eingebrochen',
        missed: 'Plan-Regel: Nicht nachholen. Priorität bei Zeitmangel: Lauf > Kraft > langes Rad > Rest. Die nächste Einheit läuft wie geplant.',
        extra: 'Der Plan sagt: nichts zusätzlich einbauen, weil es sich gut anfühlt – der Fortschritt kommt aus wiederholbaren Wochen. Erholung und die geplanten Einheiten haben Vorrang.',
        restBroken: 'Ruhetage sind komplett trainingsfrei (normales Spazierengehen ist erlaubt). Schlaf, Essen und Erholung haben Vorrang.'
      },
      ui: {
        painLabels: [['none', 'Keine'], ['mild', 'Leicht (bis 3/10)'], ['strong', 'Stark (über 3/10, stechend, Hinken)']],
        painAreas: [['all', 'allgemein'], ['run', 'Laufen'], ['bike', 'Rad'], ['strength', 'Kraft / Rumpf']],
        stableDrop: { bike: 'Leistung deutlich eingebrochen', other: 'Tempo/Leistung gefallen' },
        qualField: 'Zügige Minuten (RPE 6–8)'
      },
      kpis: [['hours', 'Geplanter Umfang', 'Geplanter Umfang', 'hm'], ['longBike', 'Längste Radeinheit', 'Längste Radeinheit'], ['longRun', 'Längster Lauf am Stück', 'Längster Lauf am Stück'], ['quality', 'Zügige Minuten', 'Zügige Minuten'], ['restDays', 'Ruhetage', 'Ruhetage']],
      lbl: ['Rad', 'Lauf'],
      charts: {
        vol: { type: 'bars', tab: 'Umfang', title: 'Wochenumfang steigt von 2:30 auf 6:00 h – jede 4. Woche Entlastung', sub: 'Stunden pro Woche – Plan (PDF, breite Balken) vs. Ist (schmale Balken)', ceiling: 6, ceilLabel: 'Maximum 6 h', mark: { pw: 13, label: 'ab Woche 13: 5 Einheiten, 2 Ruhetage' } },
        disc: { tab: 'Sportarten', title: 'Verteilung nach Sportart: Rad trägt den Zuwachs, Laufen steigt behutsam', sub: 'Stunden je Sportart – Plan (PDF, breite Balken) vs. Ist (schmale Balken)' },
        qual: { type: 'bars', tab: 'Zügig', title: 'Zügige Minuten pro Woche: ab Woche 9 dosiert, Höhepunkt 60 min in Woche 23', sub: 'Zügige Minuten (RPE 6–8) pro Woche – Plan (PDF) vs. Ist (Ist = Minuten, die du beim Eintragen angibst)', labels: ['Zügige Minuten'] },
        long: { tab: 'Lange Einheiten', title: 'Lange Einheiten: Rad bis 120 min, Laufen von 1 auf 40 min am Stück', sub: 'Längste Radeinheit und längster Lauf am Stück in Minuten – Plan (PDF) vs. Ist', labels: ['Längste Radeinheit', 'Längster Lauf am Stück'] },
        note: () => 'Die Diagramme zeigen die geplante Belastung, keine garantierten Ergebnisse. Sie machen sichtbar, wie sich Umfang, lange Einheiten und Intensität über die 26 Wochen entwickeln.'
      },
      moreTitle: () => '26-Wochen-Trainingsplan · Einsteigerin',
      moreSub: () => PL.subtitle + ' · ' + resolveTokens('{{range}}'),
      blocks: () => PL.blocks.map(b => ({ ...b, a: b.weeks[0], z: b.weeks[1] })),
      sections: () => PL.sections,
      rpeTable() {
        for (const s of PL.sections) for (const b of s.blocks) if (b.t === 'table' && b.cols[0] === 'Stufe') return b;
        return null;
      }
    },
    get data() { return window.PLAN_JEN; }
  }
};
