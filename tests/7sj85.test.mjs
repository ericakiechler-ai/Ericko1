/* 7SJ85-SIP: licence states, every function renders, and the calculations
   checked against an independent implementation of the same physics. */
const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const ROOT = new URL('..', import.meta.url).pathname, D = ROOT + 'dist';
execFileSync(process.execPath, ['build.mjs', '--tool', '7sj85'], { cwd: ROOT, stdio: 'ignore' });
execFileSync(process.execPath, ['tools/make-licence.mjs', '--tool', '7sj85', '--org', 'Northgate Power Services', '--site', 'Calgary Operations', '--seats', '12', '--id', 'LIC-TEST-7SJ85', '--maint', '2027-09-07'], { cwd: ROOT, stdio: 'ignore' });

let pass = 0, fail = 0;
const ck = (n, ok, x) => { ok ? pass++ : fail++; console.log((ok ? '  ok   ' : '  FAIL ') + n + (x != null ? '  [' + x + ']' : '')); };
const near = (a, b, tol = 0.002) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

/* ---- independent physics, from the sample configuration ---- */
const D2R = Math.PI / 180, cx = (re, im) => ({ re, im }), pol = (m, a) => cx(m * Math.cos(a * D2R), m * Math.sin(a * D2R));
const add = (x, y) => cx(x.re + y.re, x.im + y.im), sub = (x, y) => cx(x.re - y.re, x.im - y.im);
const mul = (x, y) => cx(x.re * y.re - x.im * y.im, x.re * y.im + x.im * y.re);
const div = (x, y) => { const d = y.re * y.re + y.im * y.im; return cx((x.re * y.re + x.im * y.im) / d, (x.im * y.re - x.re * y.im) / d); };
const mag = x => Math.hypot(x.re, x.im), ang = x => Math.atan2(x.im, x.re) / D2R;
const ctr = 400 / 1, ctrg = 60 / 1, vtr = 20000 / 100, zf = ctr / vtr, N = 100 / Math.sqrt(3);
const Z1p = pol(0.120 * 12, 72), Z0p = pol(0.380 * 12, 68), Z1s = cx(Z1p.re * zf, Z1p.im * zf);
const k0 = div(sub(Z0p, Z1p), cx(3 * Z1p.re, 3 * Z1p.im)), K = add(cx(1, 0), k0);

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
  /* the tool prints currents under 1 A in milliamps */
  const m = r.slice(ch.length).match(/^\s*([\d.]+) (mA|A|V)([+−-][\d.]+)°/); return m ? { m: +m[1] / (m[2] === 'mA' ? 1000 : 1), a: +m[3].replace('−', '-') } : null; };
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

console.log('\n— 7SJ85 licensed copy, file://, network blocked —');
{
  const { p, errs, net } = await page('7SJ85-SIP-northgate-power-services.html');
  ck('no external requests', net.length === 0); ck('no errors', errs.length === 0, errs[0]);
  const bar = (await p.locator('#licBar').textContent()).replace(/\s+/g, ' ');
  ck('licensed to the organisation', /^Licensed/.test(bar) && bar.includes('Northgate Power Services') && bar.includes('Updates to 7 Sep 2027'), bar.slice(0, 90));
  ck('bundled fonts applied', await p.evaluate(() => document.fonts.check('600 14px "Barlow Condensed"')));
  ck('version stamp present', /v1\.1\.0 · build \d{4}/.test(await p.locator('#verFoot').textContent()));

  const ids = await p.locator('.rail-i').evaluateAll(a => a.map(x => x.dataset.el));
  let bad = [];
  for (const id of ids) { const rows = await el(p, id); const err = await p.locator('#outPane .note.bad .lb', { hasText: 'Error' }).count(); if ((!rows.length && id !== '74TC') || err) bad.push(id); }
  ck(ids.length + ' functions render with channels (74TC deliberately has none) and no error', bad.length === 0, bad.join(','));

  // 50-1: 2.5 x In on a 1 A CT, +5% at −72°
  let rows = await el(p, '50-1', 'Threshold — above');
  ck('50-1 above threshold: 1.05 × 2.5 A at −72°', near(val(rows, 'I L1').m, 2.625) && near(val(rows, 'I L1').a, -72, 0.01), val(rows, 'I L1').m);

  // 50N-1: 3I0 measured on the core-balance input (Setup default) — its own channel and its own 60:1 ratio
  rows = await el(p, '50N-1', 'Threshold — above');
  ck('50N-1 with 3I0 measured: 1.05 × 0.4 A on the core-balance channel', val(rows, 'I aux') && near(val(rows, 'I aux').m, 0.42) && !val(rows, 'I L1')?.m, rows.find(x => x.startsWith('I aux')));
  ck('50N-1 readout: 24.00 A primary through the 60:1 core-balance CT (was 160 A through the phase CT)', (await readout(p)).includes('24.00') && (await readout(p)).includes('60:1'), (await readout(p)).slice(0, 90));
  await setCfg(p, 'cfg_i0src', 'calc'); rows = await el(p, '50N-1', 'Threshold — above');
  ck('50N-1 with 3I0 calculated: 0.42 A into one phase CT, 160.00 A primary', near(val(rows, 'I L1').m, 0.42) && (await readout(p)).includes('160.00'), val(rows, 'I L1') && val(rows, 'I L1').m);
  await setCfg(p, 'cfg_i0src', 'cb');

  // 46: I2 = I/3 by single phase, so 3 × 0.30 A
  rows = await el(p, '46', 'Threshold — above');
  ck('46: 3 × 1.05 × 0.30 = 0.945 A applied', near(val(rows, 'I L1').m, 0.945), val(rows, 'I L1').m);

  // 51: IEC normal inverse, T 0.2, 2× → 0.2·0.14/(2^0.02 − 1)
  const t51 = 0.2 * 0.14 / (Math.pow(2, 0.02) - 1);
  rows = await el(p, '51', 'Timing at 2× threshold');
  ck('51 at 2×: ' + t51.toFixed(3) + ' s', (await expectOf(p, 'Timing at 2× threshold')).startsWith(t51.toFixed(3) + ' s'), await expectOf(p, 'Timing at 2× threshold'));

  // 67Ns: 60 mA test residual, 15 mA component threshold → sector edge at acos(0.25) = 75.5°
  rows = await el(p, '67Ns', 'Forward — full component');
  ck('67Ns forward: 60 mA on the core-balance channel at 0°, 3V0 = 100 V at 180°', near(val(rows, 'I aux').m, 0.06) && near(val(rows, 'I aux').a, 0, 0.01) && near(val(rows, 'V 4').m, 100) && near(Math.abs(val(rows, 'V 4').a), 180, 0.01), rows.find(x => x.startsWith('I aux')));
  rows = await el(p, '67Ns', 'Sector edge, leading side (inside)');
  const half = Math.acos(0.015 / 0.060) / D2R;
  ck('67Ns sector edge inside: ' + (half - 8).toFixed(1) + '° (edge acos(comp/I) − margin)', near(val(rows, 'I aux').a, half - 8, 0.01), val(rows, 'I aux').a);
  { const va = val(rows, 'V L1'), vb = val(rows, 'V L2'), vc = val(rows, 'V L3');
    const s0 = add(add(pol(va.m, va.a), pol(vb.m, vb.a)), pol(vc.m, vc.a));
    ck('67Ns phase set: independent 3V0 of the displaced set = 3·Vn = ' + (3 * N).toFixed(1) + ' V at 180°', near(mag(s0), 3 * N, 0.005) && near(Math.abs(ang(s0)), 180, 0.01), mag(s0).toFixed(2) + '∠' + ang(s0).toFixed(1)); }

  // 59N: 22 V broken-delta on V 4 with a consistently displaced set (f = 0.22)
  rows = await el(p, '59N', 'Threshold — above');
  { const f = 22 / 100, vb = mag(sub(pol(N, -120), pol(f * N, 0)));
    ck('59N above threshold: V 4 = 22.00 V, L1 = ' + ((1 - f) * N).toFixed(2) + ' V, L2 = ' + vb.toFixed(2) + ' V', near(val(rows, 'V 4').m, 22) && near(val(rows, 'V L1').m, (1 - f) * N) && near(val(rows, 'V L2').m, vb), val(rows, 'V L2').m); }

  // 21 ground loop: Z1 inside at 0.765 of the line, 1 A held → V L1 = |0.765·Z1s·(1+k0)|
  rows = await el(p, '21'); await setField(p, 'set_kind', 'G'); rows = await el(p, '21', 'z0inside');
  { const Zl = mul(cx(Z1s.re * 0.765, Z1s.im * 0.765), K);
    ck('21G Z1 inside: V L1 = 1·|x·Z1·(1+k0)| = ' + mag(Zl).toFixed(3) + ' V, I L1 = 1 A at −∠Zloop', near(val(rows, 'V L1').m, mag(Zl)) && near(val(rows, 'I L1').m, 1) && near(val(rows, 'I L1').a, -ang(Zl), 0.01), val(rows, 'V L1').m + ' / ' + val(rows, 'I L1').a);
    ck('21G healthy phases at nominal', near(val(rows, 'V L2').m, N) && near(val(rows, 'V L3').m, N)); }
  // 21 phase loop: (Vb−Vc)/(Ib−Ic) = x·Z1 and no zero sequence
  await setField(p, 'set_kind', 'P'); rows = await chanRows(p);
  { const va = val(rows, 'V L1'), vb = val(rows, 'V L2'), vc = val(rows, 'V L3'), ib = val(rows, 'I L2'), ic = val(rows, 'I L3');
    const VA = pol(va.m, va.a), VB = pol(vb.m, vb.a), VC = pol(vc.m, vc.a);
    const loop = div(sub(VB, VC), sub(pol(ib.m, ib.a), pol(ic.m, ic.a))), want = cx(Z1s.re * 0.765, Z1s.im * 0.765);
    /* the 2.2 V loop is reconstructed from two ~29 V phasors shown to 0.01 V / 0.1°, so 1.5% is display resolution at a 1 A hold */
    ck('21P: (Vb−Vc)/(Ib−Ic) = x·Z1 = ' + mag(want).toFixed(3) + ' Ω ∠72°', near(mag(loop), mag(want), 0.015) && near(ang(loop), 72, 0.01), mag(loop).toFixed(3) + '∠' + ang(loop).toFixed(2));
    ck('21P: 3V0 is zero to display resolution (was 57.7 V)', mag(add(add(VA, VB), VC)) < 0.005 * Math.max(1, vb.m) + 0.02, mag(add(add(VA, VB), VC)).toFixed(3));
    ck('21P: healthy phase at nominal on +90°, |Vb| = |Vc|, currents in antiphase', near(va.m, N) && near(va.a, 90, 0.01) && near(vb.m, vc.m) && near(Math.abs(((ib.a - ic.a) % 360 + 360) % 360), 180, 0.01)); }

  // 32: 5000 kW → 62.5 W sec; I = P/(3V), independent of the characteristic angle
  await el(p, '32'); await setField(p, 'set_pkp', '5000'); rows = await el(p, '32', 'Above threshold');
  const Psec = 5000e3 / (vtr * ctr), I32 = 1.1 * Psec / (3 * N);
  ck('32: 1.1 × ' + Psec.toFixed(2) + ' W / (3·' + N.toFixed(2) + ' V) = ' + I32.toFixed(4) + ' A at 0°', near(val(rows, 'I L1').m, I32, 0.005) && near(val(rows, 'I L1').a, 0, 0.01), val(rows, 'I L1').m);
  await setField(p, 'set_mta', '30'); rows = await chanRows(p);
  ck('32 with MTA 30°: same magnitude, current at −30° (was ÷cos 30°)', near(val(rows, 'I L1').m, I32, 0.005) && near(val(rows, 'I L1').a, -30, 0.01), val(rows, 'I L1').m + '∠' + val(rows, 'I L1').a);
  await setField(p, 'set_mta', '0'); await setField(p, 'set_pkp', '500');

  // 49: IEC replica, k 1.10 on a 1 A CT, τ 20 min, preload 0.9·k·In, at 2×
  rows = await el(p, '49', 't2');
  { const Ith = 1.1, I = 2.2, Ip = 0.9 * Ith, t = 1200 * Math.log((I * I - Ip * Ip) / (I * I - Ith * Ith));
    ck('49 at 2× k·In: ' + t.toFixed(2) + ' s', near(val(rows, 'I L1').m, 2.2) && (await expectOf(p, 't2')).startsWith(t.toFixed(2) + ' s'), await expectOf(p, 't2')); }

  // 27 any-phase: L1 depressed to 0.95 × 0.80 × Vn, L2 and L3 at nominal
  rows = await el(p, '27', 'Threshold — below');
  ck('27: L1 = ' + (0.76 * N).toFixed(2) + ' V, L2/L3 at nominal', near(val(rows, 'V L1').m, 0.76 * N) && near(val(rows, 'V L2').m, N) && near(val(rows, 'V L3').m, N), val(rows, 'V L1').m);

  // rotation honoured: 47 reversal, the displaced set and the 21 phase loop follow the Setup rotation
  await el(p, '47', 'rot'); const before = val(await chanRows(p), 'V L2').a;
  await setCfg(p, 'cfg_rot', 'ACB');
  const after = val(await chanRows(p), 'V L2').a;
  ck('47 phase-reversal point follows the rotation setting (L2 ' + before + '° → ' + after + '°)', before === 120 && after === -120);
  rows = await el(p, '59N', 'Threshold — above');
  ck('59N displaced set under ACB: L2 leads L1 (L2 at +' + Math.abs(val(rows, 'V L2').a).toFixed(1) + '°)', val(rows, 'V L2').a > 0 && val(rows, 'V L3').a < 0, val(rows, 'V L2').a);
  rows = await el(p, '21', 'z0inside');
  { const va = val(rows, 'V L1'), vb = val(rows, 'V L2'), vc = val(rows, 'V L3'), ib = val(rows, 'I L2'), ic = val(rows, 'I L3');
    const loop = div(sub(pol(vb.m, vb.a), pol(vc.m, vc.a)), sub(pol(ib.m, ib.a), pol(ic.m, ic.a)));
    ck('21P under ACB: loop still x·Z1 ∠72° with 3V0 = 0', near(mag(loop), mag(Z1s) * 0.765, 0.015) && near(ang(loop), 72, 0.01) && mag(add(add(pol(va.m, va.a), pol(vb.m, vb.a)), pol(vc.m, vc.a))) < 0.005 * vb.m + 0.02, mag(loop).toFixed(3)); }
  await setCfg(p, 'cfg_rot', 'ABC');

  // sheet provenance + decimal entry
  await el(p, '51');
  const fld = p.locator('#set_pkp'); await fld.click(); await fld.press('Control+a');
  for (const c of ['0', '.', '7', '5']) { await fld.press(c); await p.waitForTimeout(50); }
  ck('decimal entry completes', await fld.inputValue() === '0.75');
  await p.locator('#addSheet').click(); await p.locator('.tab[data-view="v-sheet"]').click(); await p.waitForTimeout(200);
  const sheet = await p.locator('#sheetOut').inputValue();
  ck('sheet stamped with licence and build', sheet.includes('Licensed to Northgate Power Services') && /7SJ85-SIP v1\.1\.0/.test(sheet));
  await p.close();
}
console.log('\n— 7SJ85 evaluation copy —');
{
  const { p, errs } = await page('7SJ85-SIP-unlicensed.html');
  const bar = (await p.locator('#licBar').textContent()).replace(/\s+/g, ' ');
  ck('evaluation bar, no errors', bar.includes('Evaluation') && errs.length === 0, errs[0]);
  const rows = await el(p, '50-1', 'Threshold — above'); ck('evaluation copy computes identical values', near(val(rows, 'I L1').m, 2.625));
  await p.close();
}
console.log('\n— 7SJ85 fresh load opens on Setup —');
{
  const p = await b.newPage(); await p.goto('file://' + D + '/7SJ85-SIP-unlicensed.html', { waitUntil: 'load' }); await p.waitForTimeout(600);
  ck('nothing saved → Setup tab first', await p.locator('.tab[data-view="v-setup"]').getAttribute('aria-selected') === 'true');
  await p.close();
}
console.log('\n— 7SJ85 tampered licence —');
{
  let h = fs.readFileSync(D + '/7SJ85-SIP-northgate-power-services.html', 'utf8');
  const m = h.match(/\{"p":"([^"]+)","s":"([^"]+)"\}/); const pl = JSON.parse(Buffer.from(m[1], 'base64').toString()); pl.org = 'Forged Co';
  h = h.replace(m[0], JSON.stringify({ p: Buffer.from(JSON.stringify(pl, Object.keys(pl).sort())).toString('base64'), s: m[2] }));
  fs.writeFileSync(D + '/test-7sj85-tamper.html', h);
  const { p } = await page('test-7sj85-tamper.html');
  const bar = (await p.locator('#licBar').textContent());
  ck('forged licence rejected', bar.includes('Evaluation') && !bar.includes('Forged'));
  await p.close(); fs.unlinkSync(D + '/test-7sj85-tamper.html');
}
await b.close();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
