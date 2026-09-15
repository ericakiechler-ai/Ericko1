/* 889-GEN: licence states, every element renders, and the calculations
   checked against an independent implementation of the same physics. */
const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const ROOT = new URL('..', import.meta.url).pathname, D = ROOT + 'dist';
execFileSync(process.execPath, ['build.mjs', '--tool', '889'], { cwd: ROOT, stdio: 'ignore' });
execFileSync(process.execPath, ['tools/make-licence.mjs', '--tool', '889', '--org', 'Northgate Power Services', '--site', 'Calgary Operations', '--seats', '12', '--id', 'LIC-TEST-889', '--maint', '2027-09-07'], { cwd: ROOT, stdio: 'ignore' });

let pass = 0, fail = 0;
const ck = (n, ok, x) => { ok ? pass++ : fail++; console.log((ok ? '  ok   ' : '  FAIL ') + n + (x != null ? '  [' + x + ']' : '')); };
const near = (a, b, tol = 0.002) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

/* ---- independent physics, from the sample configuration ---- */
const D2R = Math.PI / 180, cx = (re, im) => ({ re, im }), pol = (m, a) => cx(m * Math.cos(a * D2R), m * Math.sin(a * D2R));
const add = (x, y) => cx(x.re + y.re, x.im + y.im), sub = (x, y) => cx(x.re - y.re, x.im - y.im);
const mul = (x, y) => cx(x.re * y.re - x.im * y.im, x.re * y.im + x.im * y.re);
const div = (x, y) => { const d = y.re * y.re + y.im * y.im; return cx((x.re * y.re + x.im * y.im) / d, (x.im * y.re - x.re * y.im) / d); };
const mag = x => Math.hypot(x.re, x.im), ang = x => Math.atan2(x.im, x.re) / D2R;
const MVA = 100, kV = 13.8, ctrT = 5000 / 5, ctrG = 200 / 5, vtr = 13800 / 120, N = 120 / Math.sqrt(3), ngtr = 7970 / 240;
const Irp = MVA * 1e6 / (Math.sqrt(3) * kV * 1e3), IrT = Irp / ctrT;            /* 4183.7 A, 4.1837 A */
const Zbs = (kV * kV / MVA) * ctrT / vtr;                                       /* 16.56 Ω secondary */

const b = await chromium.launch();
async function page(file) {
  const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
  const errs = [], net = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.route('**', r => { const u = r.request().url(); if (u.startsWith('file://')) return r.continue(); net.push(u); return r.abort(); });
  await p.goto('file://' + D + '/' + file, { waitUntil: 'load' }); await p.waitForTimeout(1100);
  await p.locator('.tab[data-view="v-elem"]').click(); await p.waitForTimeout(200);
  return { p, errs, net };
}
const chanRows = async p => (await p.locator('.chan table tbody tr').allTextContents()).map(r => r.replace(/\s+/g, ' ').trim());
const val = (rows, ch) => { const r = rows.find(x => x.startsWith(ch + ' ') || x.startsWith(ch)); if (!r) return null;
  const m = r.slice(ch.length).match(/^\s*([\d.]+) (?:A|V)([+−-][\d.]+)°/); return m ? { m: +m[1], a: +m[2].replace('−', '-') } : null; };
async function el(p, id, pt) { await p.locator('.rail-i[data-el="' + id + '"]').click(); await p.waitForTimeout(250);
  if (pt) { await p.locator('tr[data-pt="' + pt + '"]').click(); await p.waitForTimeout(250); } return chanRows(p); }
const expectOf = async (p, pt) => (await p.locator('tr[data-pt="' + pt + '"] td').nth(2).textContent()).replace(/\s+/g, ' ').trim();
const readout = async p => (await p.locator('#outPane .readout').textContent()).replace(/\s+/g, ' ');
async function setField(p, id, value) {
  const f = p.locator('#' + id);
  if (await f.evaluate(e => e.tagName) === 'SELECT') await f.selectOption(value); else { await f.fill(String(value)); await f.dispatchEvent('input'); }
  await p.waitForTimeout(250);
}
async function setCfg(p, id, value) {
  await p.locator('.tab[data-view="v-setup"]').click(); await p.waitForTimeout(100);
  await setField(p, id, value);
  await p.locator('.tab[data-view="v-elem"]').click(); await p.waitForTimeout(200);
}

console.log('\n— 889 licensed copy, file://, network blocked —');
{
  const { p, errs, net } = await page('889-GEN-northgate-power-services.html');
  ck('no external requests', net.length === 0); ck('no errors', errs.length === 0, errs[0]);
  const bar = (await p.locator('#licBar').textContent()).replace(/\s+/g, ' ');
  ck('licensed to the organisation', /^Licensed/.test(bar) && bar.includes('Northgate Power Services') && bar.includes('Updates to 7 Sep 2027'), bar.slice(0, 90));
  ck('bundled fonts applied', await p.evaluate(() => document.fonts.check('600 14px "Barlow Condensed"')));
  ck('version stamp present', /v1\.1\.0 · build \d{4}/.test(await p.locator('#verFoot').textContent()));

  const ids = await p.locator('.rail-i').evaluateAll(a => a.map(x => x.dataset.el));
  let bad = [];
  for (const id of ids) { const rows = await el(p, id); const err = await p.locator('#outPane .note.bad .lb', { hasText: 'Error' }).count(); if (!rows.length || err) bad.push(id); }
  ck(ids.length + ' elements render with channels and no error', bad.length === 0, bad.join(','));

  // 87G: slope 1 applies below break 1 — at Irest 1.0 pu the required Idiff is max(0.10, 0.10·1.0)
  //      and at 3.0 pu it is 0.30; the through pair is IT = Ir, IN = Ir − Id at 180°
  let rows = await el(p, '87G', '87-3-op');
  { const Ir = 3.0, Id = 0.3 * 1.1, iT = Ir * IrT, iN = (Ir - Id) * IrT;
    const t = val(rows, 'I A-L1'), n = val(rows, 'I B-L1');
    ck('87G Irest 3 pu above slope: IT = ' + iT.toFixed(3) + ' A at 0°', t && near(t.m, iT) && near(t.a, 0, 0.01), t && t.m);
    ck('87G Irest 3 pu: IN = (3 − 0.33) pu = ' + iN.toFixed(3) + ' A at 180°', n && near(n.m, iN) && near(Math.abs(n.a), 180, 0.01), n && n.m + '∠' + n.a); }
  await setField(p, 'opt_rests', '1.5'); rows = await chanRows(p);
  { const Id = 0.15 * 1.1, iN = (1.5 - Id) * IrT;   /* slope 1 · 1.5 = 0.15 > pickup 0.10 */
    ck('87G Irest 1.5 pu (below break 1): slope 1 applies, IN = ' + iN.toFixed(3) + ' A (was pickup only)', near(val(rows, 'I B-L1').m, iN), val(rows, 'I B-L1').m); }
  await setField(p, 'opt_rests', '0.5, 1.0, 3.0, 7.0');

  // 87GN REF stability: 4 ×CT on the terminal input is 4·5·1000 = 20 000 A primary = 500 A on a 200:5 ground CT
  rows = await el(p, '87GN', 'stab');
  ck('87GN: terminal 20 A ↔ ground CT ' + (20 * ctrT / ctrG).toFixed(0) + ' A at 180°', near(val(rows, 'I B-L1').m, 20 * ctrT / ctrG) && near(val(rows, 'I A-L1').m, 20), val(rows, 'I B-L1').m);

  // 59N: 5.5 V at the neutral input; a terminal fault gives (kV/√3)/NGT = 239.9 V
  rows = await el(p, '59N', 'n1.1');
  ck('59N above threshold: V 4 = 5.50 V', near(val(rows, 'V 4').m, 5.5), val(rows, 'V 4').m);
  ck('59N readout: terminal fault ' + ((kV * 1e3 / Math.sqrt(3)) / ngtr).toFixed(1) + ' V', (await readout(p)).includes(((kV * 1e3 / Math.sqrt(3)) / ngtr).toFixed(1)));

  // 40 zone 1: centre −(0.125 + 0.5)·Zbs, radius 0.5·Zbs; top-inside point at 92% of the radius, 5 A held
  rows = await el(p, '40', 'topinside');
  { const cX = -(0.125 + 0.5) * Zbs, rad = 0.5 * Zbs, x = cX + rad * 0.92, Zm = Math.abs(x);
    const v = val(rows, 'V L1'), i = val(rows, 'I A-L1');
    ck('40 zone 1 top-inside: |Z| = ' + Zm.toFixed(3) + ' Ω → V = 5·|Z| = ' + (5 * Zm).toFixed(2) + ' V', v && near(v.m, 5 * Zm), v && v.m);
    ck('40: 5 A at +90° (Z at −90°, VARs into the machine)', i && near(i.m, 5) && near(i.a, 90, 0.01), i && i.a); }

  // 21 phase-to-phase loop: (Vb−Vc)/(Ib−Ic) = 0.92·reach at MTA, and the set carries no zero sequence
  rows = await el(p, '21', 'r0inside');
  { const reach = 1.2 * Zbs, Zw = pol(reach * 0.92, 85);
    const va = val(rows, 'V L1'), vb = val(rows, 'V L2'), vc = val(rows, 'V L3'), ib = val(rows, 'I A-L2'), ic = val(rows, 'I A-L3');
    const VA = pol(va.m, va.a), VB = pol(vb.m, vb.a), VC = pol(vc.m, vc.a), IB = pol(ib.m, ib.a), IC = pol(ic.m, ic.a);
    const loop = div(sub(VB, VC), sub(IB, IC));
    ck('21 L2–L3 loop = 0.92·reach = ' + mag(Zw).toFixed(3) + ' Ω ∠85°', near(mag(loop), mag(Zw)) && near(ang(loop), 85, 0.01), mag(loop).toFixed(3) + '∠' + ang(loop).toFixed(2));
    /* channel values are shown to 0.01 V and 0.1°, so the residual on ~97 V phasors is display rounding */
    ck('21: 3V0 of the applied set is zero to display resolution (was 69 V)', mag(add(add(VA, VB), VC)) < 0.005 * vb.m, mag(add(add(VA, VB), VC)).toFixed(3));
    ck('21: healthy phase at nominal on +90°, |Vb| = |Vc|', near(va.m, N) && near(va.a, 90, 0.01) && near(vb.m, vc.m));
    ck('21: Ib and Ic 5 A in antiphase', near(ib.m, 5) && near(ic.m, 5) && near(Math.abs(((ib.a - ic.a) % 360 + 360) % 360), 180, 0.01)); }

  // 32 reverse power: 1% of 85 MW = 0.85 MW → 7.391 W sec; I = P/(3V), 120% for the operate point, at 180°
  rows = await el(p, '32', 'Above threshold — motoring');
  const Psec = 0.01 * MVA * 0.85 * 1e6 / (vtr * ctrT), I32 = 1.2 * Psec / (3 * N);
  ck('32R: I = 1.2·' + Psec.toFixed(3) + ' W / (3·' + N.toFixed(2) + ' V) = ' + I32.toFixed(5) + ' A at 180°', near(val(rows, 'I A-L1').m, I32, 0.01) && near(Math.abs(val(rows, 'I A-L1').a), 180, 0.01), val(rows, 'I A-L1').m);
  await setField(p, 'set_mta', '30'); rows = await chanRows(p);
  ck('32R with MTA 30°: same magnitude, current at +150° (was ÷cos 30°)', near(val(rows, 'I A-L1').m, I32, 0.01) && near(val(rows, 'I A-L1').a, 150, 0.01), val(rows, 'I A-L1').m + '∠' + val(rows, 'I A-L1').a);
  await setField(p, 'set_mta', '0');

  // 50G on the dedicated 200:5 ground CT: 0.5 ×CT = 2.5 A sec = 100 A primary (was 2500 A through the 5000:5 terminal ratio)
  rows = await el(p, '50G', 'io1.05');
  ck('50G: 1.05 × 0.5 ×CT = 2.625 A into the ground CT input', near(val(rows, 'I A-L1').m, 2.625) && rows.some(x => /ground CT input/.test(x)), val(rows, 'I A-L1').m);
  { const ro = await readout(p); ck('50G readout: 100.0 A primary on the 200:5 ground CT', ro.includes('100.0') && ro.includes('200:5'), ro.slice(0, 80)); }
  await setField(p, 'set_pu', 'A_pri'); await setField(p, 'set_pkp', '100'); rows = await chanRows(p);
  ck('50G 100 A primary = 2.5 A secondary → 2.625 A above threshold', near(val(rows, 'I A-L1').m, 2.625), val(rows, 'I A-L1').m);
  await setField(p, 'set_pu', 'xCT'); await setField(p, 'set_pkp', '0.5');

  // 46 I2²t: 0.30 pu by single phase → 3·0.30·IrT; t = K/I2² = 10/0.09
  rows = await el(p, '46', 't0.3');
  ck('46 single-phase at I2 = 0.30 pu: applied 3·0.30·' + IrT.toFixed(4) + ' = ' + (0.9 * IrT).toFixed(3) + ' A', near(val(rows, 'I A-L1').m, 0.9 * IrT), val(rows, 'I A-L1').m);
  ck('46: t = 10 / 0.30² = 111.1 s', (await expectOf(p, 't0.3')).startsWith('111.1 s'), await expectOf(p, 't0.3'));

  // 49 IEC replica with prior load: t = τ·ln[(I² − Ip²)/(I² − (k·Ib)²)]
  rows = await el(p, '49', 'th2');
  { const Ib = IrT, Ith = 1.05 * Ib, I = 2 * Ith, Ip = 0.8 * Ib, t = 900 * Math.log((I * I - Ip * Ip) / (I * I - Ith * Ith));
    ck('49 at 2× k·Ib: I = ' + I.toFixed(3) + ' A, t = ' + t.toFixed(1) + ' s', near(val(rows, 'I A-L1').m, I) && (await expectOf(p, 'th2')).startsWith(t.toFixed(1) + ' s'), await expectOf(p, 'th2')); }

  // 24 V/Hz at 54 Hz: 1.155 pu needs 1.155·N·(54/60) V
  rows = await el(p, '24', 'vh541.05');
  ck('24: 1.05 × 1.10 pu at 54 Hz → ' + (1.155 * N * 0.9).toFixed(2) + ' V', near(val(rows, 'V L1').m, 1.155 * N * 0.9) && rows[0].includes('54.000 Hz'), val(rows, 'V L1').m);

  // 51V restrained at 0.5 ×VT: effective pickup 1.5·5·0.5 = 3.75 A, above = 3.9375 A with V = N/2
  rows = await el(p, '51V', 'v0.51.05');
  ck('51V at 0.5 ×VT: 1.05 × 3.75 = 3.938 A with V = ' + (N / 2).toFixed(2) + ' V', near(val(rows, 'I A-L1').m, 3.9375) && near(val(rows, 'V L1').m, N / 2), val(rows, 'I A-L1').m);

  // 55: 0.95 leading + 5°
  rows = await el(p, '55', 'Past the limit');
  ck('55: pf 0.95 lead + 5° → current at +' + (Math.acos(0.95) / D2R + 5).toFixed(2) + '°', near(val(rows, 'I A-L1').a, Math.acos(0.95) / D2R + 5, 0.01), val(rows, 'I A-L1').a);

  // rotation honoured: 47 reversal, the 46 reverse-rotation set and the 21 loop follow the Setup rotation
  await el(p, '47', 'rot'); const before = val(await chanRows(p), 'V L2').a;
  await setCfg(p, 'cfg_rot', 'ACB');
  const after = val(await chanRows(p), 'V L2').a;
  ck('47 phase-reversal point follows the rotation setting (L2 ' + before + '° → ' + after + '°)', before === 120 && after === -120);
  await el(p, '46'); await setField(p, 'opt_meth', 'rev'); rows = await el(p, '46', 't0.3');
  ck('46 reverse-rotation set under ACB steps −120° (negative sequence for ACB)', near(((val(rows, 'I A-L2').a - val(rows, 'I A-L1').a) % 360 + 360) % 360, 240, 0.01), val(rows, 'I A-L2').a);
  await setField(p, 'opt_meth', '1ph');
  rows = await el(p, '21', 'r0inside');
  { const va = val(rows, 'V L1'), vb = val(rows, 'V L2'), vc = val(rows, 'V L3'), ib = val(rows, 'I A-L2'), ic = val(rows, 'I A-L3');
    const loop = div(sub(pol(vb.m, vb.a), pol(vc.m, vc.a)), sub(pol(ib.m, ib.a), pol(ic.m, ic.a)));
    ck('21 loop under ACB still = 0.92·reach ∠85° with 3V0 = 0', near(mag(loop), 1.2 * Zbs * 0.92) && near(ang(loop), 85, 0.01) && mag(add(add(pol(va.m, va.a), pol(vb.m, vb.a)), pol(vc.m, vc.a))) < 0.005 * vb.m, mag(loop).toFixed(3)); }
  await setCfg(p, 'cfg_rot', 'ABC');

  // sheet provenance + decimal entry
  await el(p, '51P');
  const fld = p.locator('#set_pkp'); await fld.click(); await fld.press('Control+a');
  for (const c of ['0', '.', '7', '5']) { await fld.press(c); await p.waitForTimeout(50); }
  ck('decimal entry completes', await fld.inputValue() === '0.75');
  await p.locator('#addSheet').click(); await p.locator('.tab[data-view="v-sheet"]').click(); await p.waitForTimeout(200);
  const sheet = await p.locator('#sheetOut').inputValue();
  ck('sheet stamped with licence and build', sheet.includes('Licensed to Northgate Power Services') && /889-GEN v1\.1\.0/.test(sheet));
  await p.close();
}
console.log('\n— 889 evaluation copy —');
{
  const { p, errs } = await page('889-GEN-unlicensed.html');
  const bar = (await p.locator('#licBar').textContent()).replace(/\s+/g, ' ');
  ck('evaluation bar, no errors', bar.includes('Evaluation') && errs.length === 0, errs[0]);
  const rows = await el(p, '87G', '87-3-op'); ck('evaluation copy computes identical values', near(val(rows, 'I A-L1').m, 3 * IrT));
  await p.close();
}
console.log('\n— 889 fresh load opens on Setup —');
{
  const p = await b.newPage(); await p.goto('file://' + D + '/889-GEN-unlicensed.html', { waitUntil: 'load' }); await p.waitForTimeout(600);
  ck('nothing saved → Setup tab first', await p.locator('.tab[data-view="v-setup"]').getAttribute('aria-selected') === 'true');
  await p.close();
}
console.log('\n— 889 tampered licence —');
{
  let h = fs.readFileSync(D + '/889-GEN-northgate-power-services.html', 'utf8');
  const m = h.match(/\{"p":"([^"]+)","s":"([^"]+)"\}/); const pl = JSON.parse(Buffer.from(m[1], 'base64').toString()); pl.org = 'Forged Co';
  h = h.replace(m[0], JSON.stringify({ p: Buffer.from(JSON.stringify(pl, Object.keys(pl).sort())).toString('base64'), s: m[2] }));
  fs.writeFileSync(D + '/test-889-tamper.html', h);
  const { p } = await page('test-889-tamper.html');
  const bar = (await p.locator('#licBar').textContent());
  ck('forged licence rejected', bar.includes('Evaluation') && !bar.includes('Forged'));
  await p.close(); fs.unlinkSync(D + '/test-889-tamper.html');
}
await b.close();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
