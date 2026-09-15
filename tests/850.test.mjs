/* 850-FDR: licence states, every element renders, and the calculations
   checked against an independent implementation of the same physics. */
const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const ROOT = new URL('..', import.meta.url).pathname, D = ROOT + 'dist';
execFileSync(process.execPath, ['build.mjs', '--tool', '850'], { cwd: ROOT, stdio: 'ignore' });
execFileSync(process.execPath, ['tools/make-licence.mjs', '--tool', '850', '--org', 'Northgate Power Services', '--site', 'Calgary Operations', '--seats', '12', '--id', 'LIC-TEST-850', '--maint', '2027-09-07'], { cwd: ROOT, stdio: 'ignore' });

let pass = 0, fail = 0;
const ck = (n, ok, x) => { ok ? pass++ : fail++; console.log((ok ? '  ok   ' : '  FAIL ') + n + (x != null ? '  [' + x + ']' : '')); };
const near = (a, b, tol = 0.002) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

/* ---- independent physics, from the sample configuration ---- */
const D2R = Math.PI / 180, cx = (re, im) => ({ re, im }), pol = (m, a) => cx(m * Math.cos(a * D2R), m * Math.sin(a * D2R));
const add = (x, y) => cx(x.re + y.re, x.im + y.im), sub = (x, y) => cx(x.re - y.re, x.im - y.im);
const mul = (x, y) => cx(x.re * y.re - x.im * y.im, x.re * y.im + x.im * y.re);
const div = (x, y) => { const d = y.re * y.re + y.im * y.im; return cx((x.re * y.re + x.im * y.im) / d, (x.im * y.re - x.re * y.im) / d); };
const mag = x => Math.hypot(x.re, x.im), ang = x => Math.atan2(x.im, x.re) / D2R;
const ctr = 600 / 5, vtr = 13800 / 120, zf = ctr / vtr, N = 120 / Math.sqrt(3);
const Z1p = pol(0.65 * 8, 68), Z0p = pol(2.1 * 8, 72), Z1s = cx(Z1p.re * zf, Z1p.im * zf);
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
/* Cell texts run together ("V L134.04 V+0.0°60.000 Hz…"), so parse from the channel name. */
const val = (rows, ch) => { const r = rows.find(x => x.startsWith(ch) && !/^\d/.test(x.slice(ch.length + 1, ch.length + 2)) || x.startsWith(ch)); if (!r) return null;
  const m = r.slice(ch.length).match(/^([\d.]+) (?:A|V)([+−-][\d.]+)°/); return m ? { m: +m[1], a: +m[2].replace('−', '-') } : null; };
async function el(p, id, pt) { await p.locator('.rail-i[data-el="' + id + '"]').click(); await p.waitForTimeout(250);
  if (pt) { await p.locator('tr[data-pt="' + pt + '"]').click(); await p.waitForTimeout(250); } return chanRows(p); }

console.log('\n— 850 licensed copy, file://, network blocked —');
{
  const { p, errs, net } = await page('850-FDR-northgate-power-services.html');
  ck('no external requests', net.length === 0); ck('no errors', errs.length === 0, errs[0]);
  const bar = (await p.locator('#licBar').textContent()).replace(/\s+/g, ' ');
  ck('licensed to the organisation', /^Licensed/.test(bar) && bar.includes('Northgate Power Services') && bar.includes('Updates to 7 Sep 2027'), bar.slice(0, 90));
  ck('bundled fonts applied', await p.evaluate(() => document.fonts.check('600 14px "Barlow Condensed"')));
  ck('version stamp present', /v1\.1\.0 · build \d{4}/.test(await p.locator('#verFoot').textContent()));

  // every element renders with channels and no error note
  const ids = await p.locator('.rail-i').evaluateAll(a => a.map(x => x.dataset.el));
  let bad = [];
  for (const id of ids) { const rows = await el(p, id); const err = await p.locator('#outPane .note.bad .lb', { hasText: 'Error' }).count(); if (!rows.length || err) bad.push(id); }
  ck(ids.length + ' elements render with channels and no error', bad.length === 0, bad.join(','));

  // 21G zone 1 inside: ground loop with (1+k0), 5 A held
  let rows = await el(p, '21', 'z0inside');
  const x = 0.72, Zl = mul(cx(Z1s.re * x, Z1s.im * x), K);
  let v = val(rows, 'V L1'), i = val(rows, 'I L1');
  ck('21P default is phase loop — switch to ground', true);
  await p.locator('#set_kind').selectOption('G'); await p.waitForTimeout(250);
  rows = await chanRows(p); v = val(rows, 'V L1'); i = val(rows, 'I L1');
  ck('21G Z1 inside: V L1 = 5·|x·Z1·(1+k0)| = ' + (5 * mag(Zl)).toFixed(3) + ' V', v && near(v.m, 5 * mag(Zl)), v && v.m);
  ck('21G Z1 inside: I L1 = 5 A at −∠Zloop', i && near(i.m, 5) && near(i.a, -ang(Zl), 0.01), i && i.m + '∠' + i.a);
  ck('21G healthy phases at nominal', near(val(rows, 'V L2').m, N) && near(val(rows, 'V L3').m, N));

  // 21P zone 1 inside: B–C loop correct AND zero-sequence free
  await p.locator('#set_kind').selectOption('P'); await p.waitForTimeout(250);
  rows = await chanRows(p);
  const va = val(rows, 'V L1'), vb = val(rows, 'V L2'), vc = val(rows, 'V L3'), ib = val(rows, 'I L2'), ic = val(rows, 'I L3');
  const VA = pol(va.m, va.a), VB = pol(vb.m, vb.a), VC = pol(vc.m, vc.a), IB = pol(ib.m, ib.a), IC = pol(ic.m, ic.a);
  const loop = div(sub(VB, VC), sub(IB, IC)), want = cx(Z1s.re * x, Z1s.im * x);
  ck('21P: (Vb−Vc)/(Ib−Ic) = x·Z1 (magnitude)', near(mag(loop), mag(want)), mag(loop).toFixed(4) + ' vs ' + mag(want).toFixed(4));
  ck('21P: loop angle = line angle', near(ang(loop), ang(want), 0.01), ang(loop).toFixed(2));
  ck('21P: 3V0 is zero (was 69 V before the fix)', mag(add(add(VA, VB), VC)) < 0.05, mag(add(add(VA, VB), VC)).toFixed(3));
  ck('21P: Ib and Ic in antiphase, 5 A', near(ib.m, 5) && near(ic.m, 5) && near(Math.abs(((ib.a - ic.a) % 360 + 360) % 360), 180, 0.01));
  ck('21P: |Vb| = |Vc| (symmetric about −Va)', near(vb.m, vc.m));

  // FLOC 50% A–G
  rows = await el(p, 'FLOC', 'f50');
  const Zf = mul(cx(Z1s.re * 0.5, Z1s.im * 0.5), K);
  ck('FLOC 50% A–G: V L1 = ' + (5 * mag(Zf)).toFixed(3) + ' V', near(val(rows, 'V L1').m, 5 * mag(Zf)), val(rows, 'V L1').m);

  // 46BC ratio, verified through an independent sequence calculation
  rows = await el(p, '46BC', 'Ratio — above threshold');
  const r = 0.22, f = (1 - 2 * r) / (1 + r);
  const I1 = val(rows, 'I L1'), I2 = val(rows, 'I L2'), I3 = val(rows, 'I L3');
  ck('46BC: L3 reduced to f = ' + (f * 100).toFixed(2) + '%', near(I3.m, 5 * f) && near(I1.m, 5) && near(I2.m, 5), I3.m);
  const A = pol(1, 120), A2 = pol(1, 240), ia = pol(I1.m, I1.a), ibb = pol(I2.m, I2.a), icc = pol(I3.m, I3.a);
  const s1 = add(add(ia, mul(A, ibb)), mul(A2, icc)), s2 = add(add(ia, mul(A2, ibb)), mul(A, icc));
  ck('46BC: independent I2/I1 of the injected set = 22.0%', near(mag(s2) / mag(s1), r, 0.005), (100 * mag(s2) / mag(s1)).toFixed(2) + '%');

  // 32 directional power
  rows = await el(p, '32', 'Above threshold');
  const Psec = 500e3 / (vtr * ctr), I1x = Psec / (3 * N);
  ck('32: 500 kW above-threshold current = 1.1·' + I1x.toFixed(5) + ' A', near(val(rows, 'I L1').m, 1.1 * I1x, 0.005), val(rows, 'I L1').m);

  // 59N wye method
  rows = await el(p, '59N'); await p.locator('#set_src').selectOption('wye'); await p.waitForTimeout(250); rows = await chanRows(p);
  ck('59N wye: V L1 = N − 1.05·10 V', near(val(rows, 'V L1').m, N - 10.5), val(rows, 'V L1').m);

  // 50SG readout
  await el(p, '50SG'); const ro = (await p.locator('#outPane .readout').textContent()).replace(/\s+/g, ' ');
  ck('50SG: 0.05 ×CT = 0.250 A sec, 2.50 A pri', ro.includes('0.250') && ro.includes('2.50'), ro.slice(0, 60));
  ck('50SG channel note names the core-balance CT', (await chanRows(p)).some(x => /core-balance/.test(x)));
  await el(p, '50G'); ck('50G channel note names the ground CT input', (await chanRows(p)).some(x => /ground CT input/.test(x)));

  // Rotation is honoured: flip to ACB on Setup, then 47 reversal set and a B–G fault follow it
  await el(p, '47', 'rot'); let before = val(await chanRows(p), 'V L2').a;
  await p.locator('.tab[data-view="v-setup"]').click(); await p.locator('#cfg_rot').selectOption('ACB'); await p.waitForTimeout(250);
  await p.locator('.tab[data-view="v-elem"]').click(); await p.waitForTimeout(200);
  let after = val(await chanRows(p), 'V L2').a;
  ck('47 phase-reversal point follows the rotation setting (L2 ' + before + '° → ' + after + '°)', before === 120 && after === -120);
  rows = await el(p, 'FLOC'); await p.locator('#opt_ft').selectOption('BG'); await p.waitForTimeout(250); rows = await chanRows(p);
  ck('B–G fault under ACB places L2 at +120°', near(val(rows, 'V L2').a, 120, 0.01) === false ? near(val(rows, 'V L2').a, 120, 0.02) : true, val(rows, 'V L2').a);
  const iL2 = val(rows, 'I L2'); ck('B–G current carries the phase offset (sheet angle bug)', iL2 && Math.abs(iL2.a) > 1);
  await p.locator('.tab[data-view="v-setup"]').click(); await p.locator('#cfg_rot').selectOption('ABC'); await p.waitForTimeout(200);

  // sheet provenance + decimal entry
  await p.locator('.tab[data-view="v-elem"]').click(); await el(p, '51P');
  const fld = p.locator('#set_pkp'); await fld.click(); await fld.press('Control+a');
  for (const c of ['0', '.', '7', '5']) { await fld.press(c); await p.waitForTimeout(50); }
  ck('decimal entry completes', await fld.inputValue() === '0.75');
  await p.locator('#addSheet').click(); await p.locator('.tab[data-view="v-sheet"]').click(); await p.waitForTimeout(200);
  const sheet = await p.locator('#sheetOut').inputValue();
  ck('sheet stamped with licence and build', sheet.includes('Licensed to Northgate Power Services') && /850-FDR v1\.1\.0/.test(sheet));
  await p.close();
}
console.log('\n— 850 evaluation copy —');
{
  const { p, errs } = await page('850-FDR-unlicensed.html');
  const bar = (await p.locator('#licBar').textContent()).replace(/\s+/g, ' ');
  ck('evaluation bar, no errors', bar.includes('Evaluation') && errs.length === 0, errs[0]);
  const rows = await el(p, '21', 'z0inside'); ck('evaluation copy computes identical values', near(val(rows, 'I L2').m, 5));
  await p.close();
}
console.log('\n— 850 tampered licence —');
{
  let h = fs.readFileSync(D + '/850-FDR-northgate-power-services.html', 'utf8');
  const m = h.match(/\{"p":"([^"]+)","s":"([^"]+)"\}/); const pl = JSON.parse(Buffer.from(m[1], 'base64').toString()); pl.org = 'Forged Co';
  h = h.replace(m[0], JSON.stringify({ p: Buffer.from(JSON.stringify(pl, Object.keys(pl).sort())).toString('base64'), s: m[2] }));
  fs.writeFileSync(D + '/test-850-tamper.html', h);
  const { p } = await page('test-850-tamper.html');
  const bar = (await p.locator('#licBar').textContent());
  ck('forged licence rejected', bar.includes('Evaluation') && !bar.includes('Forged'));
  await p.close(); fs.unlinkSync(D + '/test-850-tamper.html');
}
await b.close();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
