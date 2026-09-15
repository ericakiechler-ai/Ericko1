/* 869-MTR: licence states, every element renders, and the calculations
   checked against an independent implementation of the same physics. */
const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const ROOT = new URL('..', import.meta.url).pathname, D = ROOT + 'dist';
execFileSync(process.execPath, ['build.mjs', '--tool', '869'], { cwd: ROOT, stdio: 'ignore' });
execFileSync(process.execPath, ['tools/make-licence.mjs', '--tool', '869', '--org', 'Northgate Power Services', '--site', 'Calgary Operations', '--seats', '12', '--id', 'LIC-TEST-869', '--maint', '2027-09-07'], { cwd: ROOT, stdio: 'ignore' });

let pass = 0, fail = 0;
const ck = (n, ok, x) => { ok ? pass++ : fail++; console.log((ok ? '  ok   ' : '  FAIL ') + n + (x != null ? '  [' + x + ']' : '')); };
const near = (a, b, tol = 0.002) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

/* ---- independent physics, from the sample configuration ---- */
const D2R = Math.PI / 180, cx = (re, im) => ({ re, im }), pol = (m, a) => cx(m * Math.cos(a * D2R), m * Math.sin(a * D2R));
const add = (x, y) => cx(x.re + y.re, x.im + y.im), mul = (x, y) => cx(x.re * y.re - x.im * y.im, x.re * y.im + x.im * y.re);
const mag = x => Math.hypot(x.re, x.im);
const A = pol(1, 120), A2 = pol(1, 240);
const seq = (ia, ib, ic) => ({ p: mag(add(add(ia, mul(A, ib)), mul(A2, ic))) / 3, n: mag(add(add(ia, mul(A2, ib)), mul(A, ic))) / 3 });
const ctr = 200 / 5, ctrg = 50 / 5, vtr = 4160 / 120, N = 120 / Math.sqrt(3);
const FLA = 180, flaSec = FLA / ctr, la = -Math.acos(0.89) / D2R;               /* 4.5 A, −27.13° */
const CM = 4, Ac = 87.4, K = 6, HCR = 0.75;
const tTh = (i, hot) => CM * Ac / (i * i - 1) * (hot ? HCR : 1);               /* GE standard overload curve */
const ieq = (i1, i2) => Math.sqrt(i1 * i1 + K * i2 * i2);
const kW = 1500 * 0.7457;

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
const notes = async p => (await p.locator('#outPane .note').allTextContents()).map(x => x.replace(/\s+/g, ' '));
async function setCfg(p, id, value) {
  await p.locator('.tab[data-view="v-setup"]').click(); await p.waitForTimeout(100);
  const f = p.locator('#' + id);
  if (await f.evaluate(e => e.tagName) === 'SELECT') await f.selectOption(value); else { await f.fill(String(value)); await f.dispatchEvent('input'); }
  await p.waitForTimeout(200); await p.locator('.tab[data-view="v-elem"]').click(); await p.waitForTimeout(200);
}

console.log('\n— 869 licensed copy, file://, network blocked —');
{
  const { p, errs, net } = await page('869-MTR-northgate-power-services.html');
  ck('no external requests', net.length === 0); ck('no errors', errs.length === 0, errs[0]);
  const bar = (await p.locator('#licBar').textContent()).replace(/\s+/g, ' ');
  ck('licensed to the organisation', /^Licensed/.test(bar) && bar.includes('Northgate Power Services') && bar.includes('Updates to 7 Sep 2027'), bar.slice(0, 90));
  ck('bundled fonts applied', await p.evaluate(() => document.fonts.check('600 14px "Barlow Condensed"')));
  ck('version stamp present', /v1\.1\.0 · build \d{4}/.test(await p.locator('#verFoot').textContent()));

  const ids = await p.locator('.rail-i').evaluateAll(a => a.map(x => x.dataset.el));
  let bad = [];
  for (const id of ids) { const rows = await el(p, id); const err = await p.locator('#outPane .note.bad .lb', { hasText: 'Error' }).count(); if (!rows.length || err) bad.push(id); }
  ck(ids.length + ' elements render with channels and no error', bad.length === 0, bad.join(','));

  // 49 thermal: balanced timing at 6 ×FLA from the GE standard curve, and the applied current
  let rows = await el(p, '49', 't6');
  let i = val(rows, 'I L1');
  ck('49: 6 ×FLA = ' + (6 * flaSec).toFixed(2) + ' A at −acos(pf) = ' + la.toFixed(2) + '°', i && near(i.m, 6 * flaSec) && near(i.a, la, 0.01), i && i.m + '∠' + i.a);
  ck('49: cold time at 6 ×FLA = CM·87.4/(36−1) = ' + tTh(6).toFixed(2) + ' s', (await expectOf(p, 't6')).startsWith(tTh(6).toFixed(2) + ' s'), await expectOf(p, 't6'));
  await p.locator('#set_state').selectOption('hot'); await p.waitForTimeout(250);
  ck('49: hot time = cold × HCR = ' + tTh(6, true).toFixed(2) + ' s', (await expectOf(p, 't6')).startsWith(tTh(6, true).toFixed(2) + ' s'), await expectOf(p, 't6'));
  await p.locator('#set_state').selectOption('cold'); await p.locator('#opt_unb').selectOption('half'); await p.waitForTimeout(250);
  rows = await el(p, '49', 't3');
  { const I1 = val(rows, 'I L1'), I2 = val(rows, 'I L2'), I3 = val(rows, 'I L3');
    const s = seq(pol(I1.m, I1.a), pol(I2.m, I2.a), pol(I3.m, I3.a));
    const ie = ieq(s.p / flaSec, s.n / flaSec);
    ck('49 half-unbalance at 3 ×FLA: independent I1 = 2.5, I2 = 0.5 ×FLA', near(s.p / flaSec, 2.5) && near(s.n / flaSec, 0.5), (s.p / flaSec).toFixed(3) + ', ' + (s.n / flaSec).toFixed(3));
    ck('49 half-unbalance: time from Ieq = √(I1²+K·I2²) = ' + tTh(ie).toFixed(1) + ' s', (await expectOf(p, 't3')).startsWith(tTh(ie).toFixed(1) + ' s'), await expectOf(p, 't3')); }
  await p.locator('#opt_unb').selectOption('none'); await p.waitForTimeout(200);

  // 49TC decay: 100·e^(−30/30)
  rows = await el(p, '49TC', 'd30');
  ck('49TC: 30 min stopped leaves 100·e^(−1) = 36.8%', (await expectOf(p, 'd30')).startsWith('36.8% remaining'), await expectOf(p, 'd30'));

  // 46: below FLA the relay measures I2/FLA, so the injected set must carry I2 = r·FLA
  rows = await el(p, '46', 'Ratio — above threshold');
  { const r = 0.15 * 1.1, I1 = val(rows, 'I L1'), I2 = val(rows, 'I L2'), I3 = val(rows, 'I L3');
    const s = seq(pol(I1.m, I1.a), pol(I2.m, I2.a), pol(I3.m, I3.a));
    ck('46 at 1.0 ×FLA load: L3 reduced to 1 − 3r = ' + ((1 - 3 * r) * 100).toFixed(1) + '%', near(I3.m, flaSec * (1 - 3 * r)) && near(I1.m, flaSec), I3.m);
    ck('46 at 1.0 ×FLA: independent I2/FLA of the injected set = 16.5%', near(s.n / flaSec, r, 0.005), (100 * s.n / flaSec).toFixed(2) + '%');
    ck('46 at 1.0 ×FLA: average current is below FLA, so I2/FLA is the right regime', (I1.m + I2.m + I3.m) / 3 < flaSec);
    ck('46 readout names the regime', (await p.locator('#outPane .readout').textContent()).includes('I2/FLA')); }
  await p.locator('#opt_iload').fill('2'); await p.locator('#opt_iload').dispatchEvent('input'); await p.waitForTimeout(250);
  rows = await chanRows(p);
  { const r = 0.15 * 1.1, I1 = val(rows, 'I L1'), I2 = val(rows, 'I L2'), I3 = val(rows, 'I L3');
    const s = seq(pol(I1.m, I1.a), pol(I2.m, I2.a), pol(I3.m, I3.a)), f = (1 - 2 * r) / (1 + r);
    ck('46 at 2.0 ×FLA load: L3 reduced to (1−2r)/(1+r) = ' + (f * 100).toFixed(1) + '%', near(I3.m, 2 * flaSec * f), I3.m);
    ck('46 at 2.0 ×FLA: independent I2/I1 of the injected set = 16.5%', near(s.n / s.p, r, 0.005), (100 * s.n / s.p).toFixed(2) + '%'); }
  await p.locator('#opt_iload').fill('1'); await p.locator('#opt_iload').dispatchEvent('input'); await p.waitForTimeout(200);

  // 87M core balance: 0.2 A primary through a 50:5 window
  rows = await el(p, '87M', 'cb1.1');
  ck('87M core balance: 1.1 × 0.2 A / 10 = 0.022 A through the window', near(val(rows, 'I L1').m, 0.022, 0.01), val(rows, 'I L1').m);
  // dual CT: both sets are listed in 3 × 32 A mode and the mode is flagged
  await setCfg(p, 'cfg_diff', 'dual');
  rows = await el(p, '87M', 'stab');
  ck('87M dual CT stability: line end 18 A at 0°, neutral end 18 A at 180°', near(val(rows, 'I L1').m, 4 * flaSec) && val(rows, 'I B-L1') && near(val(rows, 'I B-L1').m, 4 * flaSec) && near(Math.abs(val(rows, 'I B-L1').a), 180, 0.01), rows.find(x => x.startsWith('I B-L1')));
  ck('87M dual CT in 3 × 32 A mode is flagged, not silently one-sided', (await notes(p)).some(x => /Six currents/.test(x)));
  await setCfg(p, 'cfg_diff', 'cb');

  // 32 underpower: I = P/(3V) on the characteristic, independent of MTA
  rows = await el(p, '32', 'Below threshold — load lost');
  const Psec = 0.2 * kW * 1000 / (vtr * ctr), I32 = 0.85 * Psec / (3 * N);
  ck('32: 85% of 20% × ' + kW.toFixed(1) + ' kW → I = ' + I32.toFixed(4) + ' A at 0°', near(val(rows, 'I L1').m, I32, 0.005) && near(val(rows, 'I L1').a, 0, 0.01), val(rows, 'I L1').m);
  await p.locator('#set_mta').fill('30'); await p.locator('#set_mta').dispatchEvent('input'); await p.waitForTimeout(250);
  rows = await chanRows(p);
  ck('32 with MTA 30°: same magnitude, current at −30° (was ÷cos 30°)', near(val(rows, 'I L1').m, I32, 0.005) && near(val(rows, 'I L1').a, -30, 0.01), val(rows, 'I L1').m + '∠' + val(rows, 'I L1').a);
  await p.locator('#set_mta').fill('0'); await p.locator('#set_mta').dispatchEvent('input'); await p.waitForTimeout(200);

  // 55 power factor: 0.70 leading + 5°
  rows = await el(p, '55', 'Past the limit');
  ck('55: pf 0.70 lead + 5° → current at +' + (Math.acos(0.7) / D2R + 5).toFixed(2) + '°', near(val(rows, 'I L1').a, Math.acos(0.7) / D2R + 5, 0.01), val(rows, 'I L1').a);

  // 27 pickup 0.80 × 69.28 V, 95% of it
  rows = await el(p, '27', 'Pickup — below threshold');
  ck('27: 0.95 × 0.80 × ' + N.toFixed(2) + ' V = ' + (0.76 * N).toFixed(2) + ' V', near(val(rows, 'V L1').m, 0.76 * N), val(rows, 'V L1').m);

  // 51G: IEC A at 2× pickup, TDM 0.2 → 0.2·0.14/(2^0.02−1)
  rows = await el(p, '51G', 'Timing at 2× pickup');
  const t51 = 0.2 * 0.14 / (Math.pow(2, 0.02) - 1);
  ck('51G: 3 A pri / 10 = 0.3 A sec, 2× = 0.6 A', near(val(rows, 'I L1').m, 0.6), val(rows, 'I L1').m);
  ck('51G: IEC A time at 2× = ' + t51.toFixed(2) + ' s', (await expectOf(p, 'Timing at 2× pickup')).startsWith(t51.toFixed(2) + ' s'), await expectOf(p, 'Timing at 2× pickup'));
  ck('51G channel note names the ground CT input', rows.some(x => /ground CT input/.test(x)));

  // rotation honoured: 47 reversal set and the 46 reduced phase follow the Setup rotation
  await el(p, '47', 'rot'); const before = val(await chanRows(p), 'V L2').a;
  await setCfg(p, 'cfg_rot', 'ACB');
  const after = val(await chanRows(p), 'V L2').a;
  ck('47 phase-reversal point follows the rotation setting (L2 ' + before + '° → ' + after + '°)', before === 120 && after === -120);
  rows = await el(p, '46', 'Ratio — above threshold');
  { const I1 = val(rows, 'I L1'), I2 = val(rows, 'I L2'), I3 = val(rows, 'I L3');
    /* under ACB the relay's positive sequence is the ABC operator's negative: swap */
    const s = seq(pol(I1.m, I1.a), pol(I2.m, I2.a), pol(I3.m, I3.a));
    ck('46 under ACB: L2 leads L1 by 120° and the relay-side I2/FLA is still 16.5%', near(((I2.a - I1.a) % 360 + 360) % 360, 120, 0.01) && near(s.p / flaSec, 0.165, 0.005), (100 * s.p / flaSec).toFixed(2) + '%'); }
  await setCfg(p, 'cfg_rot', 'ABC');

  // sheet provenance + decimal entry
  await el(p, '50P');
  const fld = p.locator('#set_pkp'); await fld.click(); await fld.press('Control+a');
  for (const c of ['0', '.', '7', '5']) { await fld.press(c); await p.waitForTimeout(50); }
  ck('decimal entry completes', await fld.inputValue() === '0.75');
  await p.locator('#addSheet').click(); await p.locator('.tab[data-view="v-sheet"]').click(); await p.waitForTimeout(200);
  const sheet = await p.locator('#sheetOut').inputValue();
  ck('sheet stamped with licence and build', sheet.includes('Licensed to Northgate Power Services') && /869-MTR v1\.1\.0/.test(sheet));
  await p.close();
}
console.log('\n— 869 evaluation copy —');
{
  const { p, errs } = await page('869-MTR-unlicensed.html');
  const bar = (await p.locator('#licBar').textContent()).replace(/\s+/g, ' ');
  ck('evaluation bar, no errors', bar.includes('Evaluation') && errs.length === 0, errs[0]);
  const rows = await el(p, '49', 't6'); ck('evaluation copy computes identical values', near(val(rows, 'I L1').m, 6 * flaSec));
  await p.close();
}
console.log('\n— 869 fresh load opens on Setup —');
{
  const p = await b.newPage(); await p.goto('file://' + D + '/869-MTR-unlicensed.html', { waitUntil: 'load' }); await p.waitForTimeout(600);
  ck('nothing saved → Setup tab first', await p.locator('.tab[data-view="v-setup"]').getAttribute('aria-selected') === 'true');
  await p.close();
}
console.log('\n— 869 tampered licence —');
{
  let h = fs.readFileSync(D + '/869-MTR-northgate-power-services.html', 'utf8');
  const m = h.match(/\{"p":"([^"]+)","s":"([^"]+)"\}/); const pl = JSON.parse(Buffer.from(m[1], 'base64').toString()); pl.org = 'Forged Co';
  h = h.replace(m[0], JSON.stringify({ p: Buffer.from(JSON.stringify(pl, Object.keys(pl).sort())).toString('base64'), s: m[2] }));
  fs.writeFileSync(D + '/test-869-tamper.html', h);
  const { p } = await page('test-869-tamper.html');
  const bar = (await p.locator('#licBar').textContent());
  ck('forged licence rejected', bar.includes('Evaluation') && !bar.includes('Forged'));
  await p.close(); fs.unlinkSync(D + '/test-869-tamper.html');
}
await b.close();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
