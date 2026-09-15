/* ------------------------------------------------------------------
   Generates Omicron Test Universe test plans from the relay tools.

   The calculations are NOT retyped here — the script loads each tool's
   own page, enumerates every element at its default settings, and reads
   back the channel tables the tool computed. Whatever the tool produces
   is what lands in the CSV, so the two can never drift apart.

   Usage:  node build-testplan.js [850|869|889|845|7sj85|7sd82|all]
   ------------------------------------------------------------------ */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const REPO = path.resolve(__dirname, '..');
const RELAYS = {
  '850': { file: 'src/850-fdr.html', tag: '850-FDR', title: 'Multilin 850 feeder protection' },
  '869': { file: 'src/869-mtr.html', tag: '869-MTR', title: 'Multilin 869 motor protection' },
  '889': { file: 'src/889-gen.html', tag: '889-GEN', title: 'Multilin 889 generator protection' },
  '845': { file: 'src/845-vec.html', tag: '845-VEC', title: 'Multilin 845 transformer protection' },
  '7sj85': { file: 'src/7sj85-sip.html', tag: '7SJ85-SIP', title: 'Siemens 7SJ85 SIPROTEC 5 overcurrent' },
  '7sd82': { file: 'src/7sd82-dif.html', tag: '7SD82-DIF', title: 'Siemens 7SD82 SIPROTEC 5 line differential',
    /* A differential plan is not one plan. What can be injected depends on how
       the two ends are staged, so the same tool is read twice: once as the
       device is found on a first visit, and once looped back at the local end,
       which is how a single test set reaches the slope and the stability point. */
    variants: [{ suffix: '', cfg: {} }, { suffix: '-loopback', cfg: { stage: 'loop' } }] }
};

/* Which Test Universe module each element is built in, and how it is driven.
   "Sequence" elements have ordered states that must run as one shot. */
const MODULE = {
  // --- timed sequences: the order of the states is the test -----------
  '79':    ['State Sequencer', 'sequence', 'AutoReclosure module if licensed; otherwise State Sequencer with breaker simulation on the binary outputs.'],
  'CLPU':  ['State Sequencer', 'sequence', 'Long timers. Reduce them in the relay for the test and restore afterwards, or budget the full window.'],
  '50/27': ['State Sequencer', 'sequence', 'Arming depends on the preceding state. Never split into separate shots.'],
  '19':    ['State Sequencer', 'sequence', 'Voltage and current both change at the transition.'],
  '48':    ['State Sequencer', 'sequence', 'Two runs: a healthy start and a stalled one.'],
  '66':    ['State Sequencer', 'sequence', 'Rolling-hour counter. Cannot be shortcut on the test set.'],
  '50BF':  ['State Sequencer', 'sequence', 'Initiate is a binary output, not a channel. Start timers from the initiate edge.'],
  '68':    ['State Sequencer', 'sequence', 'Transit timing between characteristics is the element; static points only locate them.'],
  // --- characteristic / search tests ----------------------------------
  '21':    ['Advanced Distance', 'shots', 'Enter each point as a shot, or use the Z-plane search against the zone characteristic.'],
  'FLOC':  ['Advanced Distance', 'shots', 'Run as shots and read the relay-reported distance from its fault record, not from a trip time.'],
  '40':    ['Advanced Distance', 'shots', 'Impedance plane. Enter each point as a shot in the Z-plane.'],
  '78':    ['Advanced Distance', 'shots', 'Static points locate the blinders; the swing itself needs a sequence.'],
  // --- ramps -----------------------------------------------------------
  '81R':   ['Ramping', 'ramp', 'Frequency ramp. A stepped sequence produces an infinite instantaneous df/dt and trips regardless of setting.'],
  '67':    ['Ramping', 'points', 'Six fixed points, or ramp the current angle and log the operate/reset angles.'],
  // --- overcurrent -----------------------------------------------------
  '50P':   ['Overcurrent', 'pickup+time', ''], '51P': ['Overcurrent', 'characteristic', ''],
  '50G':   ['Overcurrent', 'pickup+time', ''], '51G': ['Overcurrent', 'characteristic', ''],
  '50N':   ['Overcurrent', 'pickup+time', ''], '51N': ['Overcurrent', 'characteristic', ''],
  '50SG':  ['Overcurrent', 'pickup+time', 'Core-balance CT: the current must pass through the window, not into a phase CT.'],
  '51SG':  ['Overcurrent', 'characteristic', 'Core-balance CT: through the window.'],
  '50_2':  ['Overcurrent', 'pickup+time', 'Single-phase injection gives I2 = I/3; the values already carry the ×3.'],
  '46':    ['Overcurrent', 'characteristic', 'Negative sequence. Values already carry the ×3 where single-phase.'],
  '51LR':  ['Overcurrent', 'pickup+time', 'Locked-rotor points must be stepped from zero, not ramped from load.'],
  '37':    ['Overcurrent', 'pickup+time', 'Undercurrent: every step starts from healthy load and works down.'],
  '46BC':  ['Quick CMC', 'points', 'One phase reduced by an exact fraction; magnitudes differ per phase.'],
  '49':    ['Overcurrent', 'characteristic', 'Thermal replica has memory. Reset capacity between points and record the starting value.'],
  '49TC':  ['Quick CMC', 'points', 'Read thermal capacity used off the relay at intervals rather than waiting for a trip.'],
  // --- differential ----------------------------------------------------
  '87T':   ['Differential', 'characteristic', 'Two current triples. Needs the 6 × 12.5 A amplifier arrangement.'],
  '87T-H': ['Harmonics', 'points', 'Fundamental and harmonic superimposed on the same output.'],
  '87G':   ['Differential', 'characteristic', 'Two current triples. Needs the 6 × 12.5 A amplifier arrangement.'],
  '87GN':  ['Quick CMC', 'points', 'Ground input alone for sensitivity; opposed injection for stability.'],
  '87M':   ['Quick CMC', 'points', 'Core balance: through the window. Dual CT: both triples.'],
  // --- voltage / frequency ---------------------------------------------
  '27': ['Voltage', 'pickup+time', ''], '59': ['Voltage', 'pickup+time', ''],
  '59N': ['Quick CMC', 'points', 'Broken-delta input on V4, or unbalance the wye set.'],
  '27TN': ['Harmonics', 'points', 'Third harmonic on the neutral input, with the supervision quantities present.'],
  '47': ['Quick CMC', 'points', ''],
  '81': ['Quick CMC', 'points', 'Step the frequency; do not ramp it for threshold points.'],
  '24': ['Quick CMC', 'points', 'Voltage and frequency both change per point.'],
  '25': ['Synchronizer', 'points', 'Line side on V4 with independent frequency for the slip case.'],
  '32': ['Quick CMC', 'points', 'Balanced three-phase; a single-phase injection reads a third of the power.'],
  '55': ['Quick CMC', 'points', 'Current angle carries the test; voltage stays at nominal.']
};
Object.assign(MODULE, {
  '67Ns':  ['Quick CMC', 'points', 'Displacement voltage on V4 and the residual on the core-balance input. Milliamp resolution matters more than headroom.'],
  '50-1':  MODULE['50P'], '50-2': MODULE['50P'], '51': MODULE['51P'],
  '50N-1': MODULE['50N'], '50N-2': MODULE['50N'],
  '74TC':  ['—', 'binary / DC', 'Not an analogue test: trip-circuit continuity at the terminal block, evidenced by the device alarm.'],
  'Inrush': ['Harmonics', 'points', 'Fundamental and 2nd harmonic superimposed on the same output.'],
  /* --- 7SD82 line differential ------------------------------------------
     Every two-ended step needs six current outputs, so the 6 x 12.5 A
     arrangement is mandatory unless a second set is standing at the far end. */
  '87L':   ['Differential', 'characteristic', 'Two current triples: I A-* is the local end, I B-* the remote. Slope points cannot be reached with one triple.'],
  '87N':   ['Quick CMC', 'points', 'Residual sensitivity on one phase; the stability point still needs both ends.'],
  'Ich':   ['Quick CMC', 'points', 'Both ends at nominal load with the difference set deliberately. Read the standing differential off the device, not off a trip.'],
  'PI':    ['—', 'link / no injection', 'Protection-interface tests are link work, not injection: read the measured delay and asymmetry in DIGSI, then break and restore the fibre.'],
  '85':    ['State Sequencer', 'sequence', 'Intertrip travels over the same interface as the differential. Time it from the sending-end initiate, with a binary input at the receiving end.'],
  'Stub':  ['Overcurrent', 'pickup+time', 'Stub logic is released by the isolator auxiliary contact — assert that binary input first or the element never arms.']
});
const DEFAULT_MODULE = ['Quick CMC', 'points', ''];

const csvCell = v => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const csv = rows => rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

(async () => {
  const which = (process.argv[2] || 'all').toLowerCase();
  const keys = which === 'all' ? Object.keys(RELAYS) : [which];
  const browser = await chromium.launch();
  for (const key of keys) {
    const R = RELAYS[key];
    if (!R) { console.error('unknown relay: ' + key); continue; }
    for (const variant of (R.variants || [{ suffix: '', cfg: {} }])) {
    const tag = R.tag + variant.suffix;
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto('file://' + path.join(REPO, R.file));
    await page.waitForTimeout(1200);
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    if (Object.keys(variant.cfg).length)
      await page.evaluate(c => { Object.assign(CFG, c); }, variant.cfg);

    const data = await page.evaluate(() => {
      const out = { cfg: JSON.parse(JSON.stringify(CFG)), elements: [] };
      ELEMENTS.forEach(el => {
        let R;
        try { const d = defaults(el); R = el.compute(d.s, d.o); }
        catch (err) { out.elements.push({ ansi: el.ansi, error: err.message }); return; }
        const d = defaults(el);
        out.elements.push({
          ansi: el.ansi, name: el.name, group: el.group,
          settings: Object.keys(d.s).map(k => k + '=' + d.s[k]).join('; '),
          readout: (R.readout || []).map(r => r.k + ' ' + r.v + (r.u ? ' ' + r.u : '')).join('; '),
          points: (() => { let run = 0; return R.points.map((p, i) => {
            if (p.tl && p.tlIdx === 0) run++;
            return {
            run: p.tl ? run : '',
            idx: i + 1, name: p.name, detail: p.detail,
            expect: p.expect, expectSub: p.expectSub || '', verdict: p.verdict || '',
            needsB: !!p.needsB,
            seq: p.tl ? (p.tlIdx + 1) + '/' + p.tl.length : '',
            seqLabel: p.tl ? p.tl[p.tlIdx].lab : '',
            dur: p.tl ? p.tl[p.tlIdx].dur : '',
            channels: p.channels.map(c => ({ ch: c.ch, mag: c.mag, unit: c.unit, ang: c.ang, freq: c.freq, note: c.note || '' }))
          }; }); })()
        });
      });
      return out;
    });
    await page.close();
    if (errs.length) console.error(tag + ' page errors: ' + errs.join(' | '));

    const wrapAng = a => { let r = ((a + 180) % 360 + 360) % 360 - 180; return r === -180 ? 180 : r; };
    const cfgLine = Object.keys(data.cfg).map(k => k + '=' + data.cfg[k]).join('; ');
    /* on a two-ended scheme the staging decides which steps can be run at all */
    const twoEnded = data.cfg.stage != null && data.cfg.stage !== 'local';

    /* ---- long form: one row per channel per step -------------------- */
    const chRows = [['Element', 'ElementName', 'Group', 'TU_Module', 'DriveAs', 'Step', 'StepName',
      'SeqRun', 'SeqState', 'SeqLabel', 'StateDuration_s', 'Channel', 'Magnitude', 'Unit', 'Angle_deg',
      'Frequency_Hz', 'ChannelNote', 'Expected', 'ExpectedDetail', 'Verdict', 'CurrentNeededAt']];
    /* ---- step form: the test-record skeleton ------------------------ */
    const stRows = [['Element', 'ElementName', 'TU_Module', 'DriveAs', 'Step', 'StepName', 'WhatIsApplied',
      'SeqRun', 'SeqState', 'StateDuration_s', 'V_L1', 'V_L2', 'V_L3', 'V_4', 'I_L1', 'I_L2', 'I_L3',
      'I_B_L1', 'I_B_L2', 'I_B_L3', 'Freq_Hz', 'CurrentNeededAt', 'Reachable', 'Expected', 'ExpectedDetail',
      'Measured', 'PassFail']];

    data.elements.forEach(el => {
      if (el.error) { console.error(tag + ' ' + el.ansi + ' threw: ' + el.error); return; }
      const M = MODULE[el.ansi] || DEFAULT_MODULE;
      const hasSeq = el.points.some(x => x.seq);
      const driveAs = (M[1] === 'sequence' && !hasSeq) ? 'sequence (assemble from these steps)' : M[1];
      el.points.forEach(p => {
        if (!p.channels.length)
          chRows.push([el.ansi, el.name, el.group, M[0], driveAs, p.idx, p.name,
            p.run, p.seq, p.seqLabel, p.dur === '' ? '' : (+p.dur).toFixed(3),
            '(no injection)', '', '', '', '', p.detail, p.expect, p.expectSub, p.verdict,
            p.needsB ? 'both ends' : '']);
        p.channels.forEach(c => chRows.push([el.ansi, el.name, el.group, M[0], driveAs, p.idx, p.name,
          p.run, p.seq, p.seqLabel, p.dur === '' ? '' : (+p.dur).toFixed(3),
          c.ch, c.mag.toFixed(c.unit === 'A' ? 4 : 3), c.unit, wrapAng(c.ang).toFixed(2),
          c.freq.toFixed(3), c.note, p.expect, p.expectSub, p.verdict,
          p.needsB ? 'both ends' : '']));
        const g = nm => { const c = p.channels.find(x => x.ch === nm); return c ? c.mag.toFixed(c.unit === 'A' ? 4 : 3) + '@' + wrapAng(c.ang).toFixed(1) : ''; };
        const f = p.channels.length ? p.channels[0].freq.toFixed(3) : '';
        stRows.push([el.ansi, el.name, M[0], driveAs, p.idx, p.name, p.detail, p.run, p.seq,
          p.dur === '' ? '' : (+p.dur).toFixed(3),
          g('V L1'), g('V L2'), g('V L3'), g('V 4'),
          g('I L1') || g('I A-L1'), g('I L2') || g('I A-L2'), g('I L3') || g('I A-L3'),
          g('I B-L1'), g('I B-L2'), g('I B-L3'), f,
          p.needsB ? 'both ends' : '', p.needsB ? (twoEnded ? 'yes' : 'NO — staging is local end only') : 'yes',
          p.expect, p.expectSub, '', '']);
      });
    });

    const hdr = '# ' + tag + ' — ' + R.title + '\r\n# generated ' + new Date().toISOString().slice(0, 16).replace('T', ' ') +
      ' from ' + R.file + '\r\n# configuration: ' + cfgLine + '\r\n' +
      '# All quantities are SECONDARY at the relay terminals. Angles in degrees, CCW positive, V L1 = 0.\r\n' +
      '# Values shown are for the tool\'s sample configuration — re-generate after entering real station data.\r\n' +
      (data.cfg.stage != null
        ? '# Staging is ' + data.cfg.stage + '. Steps marked "both ends" in CurrentNeededAt need current at the remote end;\r\n' +
          '# at local-end staging they cannot be run and must be recorded as untested, not as passed.\r\n'
        : '');
    fs.writeFileSync(path.join(__dirname, tag + '-channels.csv'), hdr + csv(chRows));
    fs.writeFileSync(path.join(__dirname, tag + '-steps.csv'), hdr + csv(stRows));

    const seqEls = data.elements.filter(e => !e.error && e.points.some(p => p.seq));
    const unreach = stRows.slice(1).filter(r => r[22] !== 'yes').length;
    console.log(tag + ': ' + data.elements.filter(e => !e.error).length + ' elements, ' +
      (chRows.length - 1) + ' channel rows, ' + (stRows.length - 1) + ' steps, ' +
      seqEls.length + ' sequence elements (' + seqEls.map(e => e.ansi).join(', ') + ')' +
      (data.cfg.stage != null ? ', staging ' + data.cfg.stage + ', ' + unreach + ' steps not reachable' : ''));
    }
  }
  await browser.close();
})();
