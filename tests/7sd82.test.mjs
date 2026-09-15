/* 7SD82-DIF: licence states, every function renders, and the calculations
   checked against an independent implementation of the same physics. */
const { chromium } = await import('playwright').catch(() => import('/opt/node22/lib/node_modules/playwright/index.mjs'));
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const ROOT = new URL('..', import.meta.url).pathname, D = ROOT + 'dist';
execFileSync(process.execPath, ['build.mjs', '--tool', '7sd82'], { cwd: ROOT, stdio: 'ignore' });
execFileSync(process.execPath, ['tools/make-licence.mjs', '--tool', '7sd82', '--org', 'Northgate Power Services', '--site', 'Calgary Operations', '--seats', '12', '--id', 'LIC-TEST-7SD82', '--maint', '2027-09-07'], { cwd: ROOT, stdio: 'ignore' });

let pass = 0, fail = 0;
const ck = (n, ok, x) => { ok ? pass++ : fail++; console.log((ok ? '  ok   ' : '  FAIL ') + n + (x != null ? '  [' + x + ']' : '')); };
const near = (a, b, tol = 0.002) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

/* ---- independent physics, from the sample configuration ---- */
const ctrA = 600, ctrB = 600, iref = 600, irefA = iref / ctrA, N = 100 / Math.sqrt(3), ichPu = 25 / iref;
/* the 87L characteristic as set on the sample: pickup 0.30, slope 1 30% to break 1 2.0, slope 2 70% from break 2 6.0 */
const req = Ir => Ir <= 6 ? Math.max(0.3, 0.3 * Ir) : Math.max(0.3, 0.3 * 6 + 0.7 * (Ir - 6));
const splitSum = (Ir, Id) => [(Ir + Id) / 2, (Ir - Id) / 2];

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
  const m = r.slice(ch.length).match(/^\s*([\d.]+) (mA|A|V)([+−-][\d.]+)°/); return m ? { m: +m[1] / (m[2] === 'mA' ? 1000 : 1), a: +m[3].replace('−', '-') } : null; };
async function el(p, id, pt) { await p.locator('.rail-i[data-el="' + id + '"]').click(); await p.waitForTimeout(250);
  if (pt) { await p.locator('tr[data-pt="' + pt + '"]').click(); await p.waitForTimeout(250); } return chanRows(p); }
const expectOf = async (p, pt) => (await p.locator('tr[data-pt="' + pt + '"] td').nth(2).textContent()).replace(/\s+/g, ' ').trim();
const rowText = async (p, pt) => (await p.locator('tr[data-pt="' + pt + '"]').textContent()).replace(/\s+/g, ' ');
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

console.log('\n— 7SD82 licensed copy, file://, network blocked —');
{
  const { p, errs, net } = await page('7SD82-DIF-northgate-power-services.html');
  ck('no external requests', net.length === 0); ck('no errors', errs.length === 0, errs[0]);
  const bar = (await p.locator('#licBar').textContent()).replace(/\s+/g, ' ');
  ck('licensed to the organisation', /^Licensed/.test(bar) && bar.includes('Northgate Power Services') && bar.includes('Updates to 7 Sep 2027'), bar.slice(0, 90));
  ck('bundled fonts applied', await p.evaluate(() => document.fonts.check('600 14px "Barlow Condensed"')));
  ck('version stamp present', /v1\.1\.0 · build \d{4}/.test(await p.locator('#verFoot').textContent()));

  const ids = await p.locator('.rail-i').evaluateAll(a => a.map(x => x.dataset.el));
  let bad = [];
  const noChan = ['PI', '85', '74TC'];
  for (const id of ids) { const rows = await el(p, id); const err = await p.locator('#outPane .note.bad .lb', { hasText: 'Error' }).count(); if ((!rows.length && !noChan.includes(id)) || err) bad.push(id); }
  ck(ids.length + ' functions render (PI, 85 and 74TC deliberately have no channels) and no error', bad.length === 0, bad.join(','));

  // 87L minimum pickup: end A alone, 1.15 × 0.30 pu = 0.345 A, end B quiescent
  let rows = await el(p, '87L', 'pk1.15');
  ck('87L minimum pickup: I A-L1 = 0.345 A at 0°, end B quiescent', near(val(rows, 'I A-L1').m, 0.345) && near(val(rows, 'I A-L1').a, 0, 0.01) && (!val(rows, 'I B-L1') || val(rows, 'I B-L1').m === 0), val(rows, 'I A-L1').m);
  // slope at 3 pu, sum restraint: Idiff = 1.15 × 0.9, |IA| = (3 + 1.035)/2, |IB| = (3 − 1.035)/2 at 180°
  rows = await el(p, '87L', 'sl31.15');
  { const Id = 1.15 * req(3), [a, bb] = splitSum(3, Id);
    ck('87L slope at 3 pu: IA = ' + a.toFixed(4) + ' A at 0°, IB = ' + bb.toFixed(4) + ' A at 180°', near(val(rows, 'I A-L1').m, a * irefA) && near(val(rows, 'I B-L1').m, bb * irefA) && near(Math.abs(val(rows, 'I B-L1').a), 180, 0.01), val(rows, 'I A-L1').m + ' / ' + val(rows, 'I B-L1').m);
    ck('87L slope point is flagged unreachable at local staging', /not reachable/.test(await rowText(p, 'sl31.15'))); }
  // below break 1: slope 1 applies with the pickup as a floor (was pickup alone)
  await setField(p, 'opt_rests', '1.5'); rows = await el(p, '87L', 'sl1.51.15');
  { const Id = 1.15 * req(1.5), [a, bb] = splitSum(1.5, Id);
    ck('87L at 1.5 pu (below break 1): Idiff = 1.15 × 0.45 → IB = ' + bb.toFixed(4) + ' A (was ' + ((1.5 - 0.345) / 2).toFixed(4) + ' with pickup only)', near(val(rows, 'I B-L1').m, bb * irefA), val(rows, 'I B-L1').m); }
  await setField(p, 'opt_rests', '1.0, 3.0, 8.0');
  rows = await el(p, '87L', 'stab');
  ck('87L through-current stability: 8 A at both ends, opposed', near(val(rows, 'I A-L1').m, 8) && near(val(rows, 'I B-L1').m, 8) && near(Math.abs(val(rows, 'I B-L1').a), 180, 0.01));
  await setCfg(p, 'cfg_stage', 'loop'); rows = await el(p, '87L', 'sl31.15');
  ck('87L slope point reachable once staging is loop-back', !/not reachable/.test(await rowText(p, 'sl31.15')));
  // CT ratio mismatch: end B 300:1 → one per unit is 2 A there
  await setCfg(p, 'cfg_ctBp', '300'); rows = await el(p, '87L', 'stab');
  ck('87L with end B 300:1: 8 pu is 8 A at end A and 16 A at end B', near(val(rows, 'I A-L1').m, 8) && near(val(rows, 'I B-L1').m, 16), val(rows, 'I B-L1').m);
  await setCfg(p, 'cfg_ctBp', '600'); await setCfg(p, 'cfg_stage', 'local');

  // 87N: single-phase residual at end A, 1.15 × 0.10 pu
  rows = await el(p, '87N', 'p1.15');
  ck('87N above threshold: 115.0 mA single-phase at end A', near(val(rows, 'I A-L1').m, 0.115) && !val(rows, 'I A-L2')?.m, val(rows, 'I A-L1').m);

  // charging current: end B short by ich/iref
  rows = await el(p, 'Ich', 'nocomp');
  ck('Ich standing differential: IA 1 A, IB = 1 − ' + ichPu.toFixed(4) + ' = ' + (1 - ichPu).toFixed(4) + ' A at 180°', near(val(rows, 'I A-L1').m, 1) && near(val(rows, 'I B-L1').m, 1 - ichPu) && near(Math.abs(val(rows, 'I B-L1').a), 180, 0.01), val(rows, 'I B-L1').m);

  // backup overcurrent
  rows = await el(p, '50-1', 'Threshold — above');
  ck('50-1: 1.05 × 2.0 × In = 2.1 A at −75°', near(val(rows, 'I A-L1').m, 2.1) && near(val(rows, 'I A-L1').a, -75, 0.01), val(rows, 'I A-L1').m);
  const t51 = 0.2 * 0.14 / (Math.pow(2, 0.02) - 1);
  rows = await el(p, '51', 'Timing at 2× threshold');
  ck('51 at 2×: ' + t51.toFixed(3) + ' s', (await expectOf(p, 'Timing at 2× threshold')).startsWith(t51.toFixed(3) + ' s'), await expectOf(p, 'Timing at 2× threshold'));

  // 27 any-phase and 25 angle window
  rows = await el(p, '27', 'Threshold — below');
  ck('27: L1 = 0.95 × 0.80 × ' + N.toFixed(2) + ' = ' + (0.76 * N).toFixed(2) + ' V, L2/L3 at nominal', near(val(rows, 'V L1').m, 0.76 * N) && near(val(rows, 'V L2').m, N) && near(val(rows, 'V L3').m, N), val(rows, 'V L1').m);
  rows = await el(p, '25', 'Angle inside limit');
  ck('25 angle inside: V 4 at 0.8 × 12° = 9.6°', near(val(rows, 'V 4').a, 9.6, 0.01) && near(val(rows, 'V 4').m, N), val(rows, 'V 4').a);

  // rotation: the new Setup field flips every set
  await el(p, '27', 'Threshold — below'); const before = val(await chanRows(p), 'V L2').a;
  await setCfg(p, 'cfg_rot', 'ACB');
  rows = await el(p, '27', 'Threshold — below');
  ck('27 healthy phases follow the rotation setting (L2 ' + before + '° → ' + val(rows, 'V L2').a + '°)', before === -120 && val(rows, 'V L2').a === 120);
  rows = await el(p, '87L', 'stab');
  ck('87L sets under ACB: L2 at +120° both ends', near(val(rows, 'I A-L2').a, 120, 0.01) && near(val(rows, 'I B-L2').a, -60, 0.01), val(rows, 'I A-L2').a + ' / ' + val(rows, 'I B-L2').a);
  await setCfg(p, 'cfg_rot', 'ABC');

  // sheet provenance + decimal entry
  await el(p, '51');
  const fld = p.locator('#set_pkp'); await fld.click(); await fld.press('Control+a');
  for (const c of ['0', '.', '7', '5']) { await fld.press(c); await p.waitForTimeout(50); }
  ck('decimal entry completes', await fld.inputValue() === '0.75');
  await p.locator('#addSheet').click(); await p.locator('.tab[data-view="v-sheet"]').click(); await p.waitForTimeout(200);
  const sheet = await p.locator('#sheetOut').inputValue();
  ck('sheet stamped with licence and build', sheet.includes('Licensed to Northgate Power Services') && /7SD82-DIF v1\.1\.0/.test(sheet));
  await p.close();
}
console.log('\n— 7SD82 evaluation copy —');
{
  const { p, errs } = await page('7SD82-DIF-unlicensed.html');
  const bar = (await p.locator('#licBar').textContent()).replace(/\s+/g, ' ');
  ck('evaluation bar, no errors', bar.includes('Evaluation') && errs.length === 0, errs[0]);
  const rows = await el(p, '87L', 'pk1.15'); ck('evaluation copy computes identical values', near(val(rows, 'I A-L1').m, 0.345));
  await p.close();
}
console.log('\n— 7SD82 fresh load opens on Setup —');
{
  const p = await b.newPage(); await p.goto('file://' + D + '/7SD82-DIF-unlicensed.html', { waitUntil: 'load' }); await p.waitForTimeout(600);
  ck('nothing saved → Setup tab first', await p.locator('.tab[data-view="v-setup"]').getAttribute('aria-selected') === 'true');
  await p.close();
}
console.log('\n— 7SD82 tampered licence —');
{
  let h = fs.readFileSync(D + '/7SD82-DIF-northgate-power-services.html', 'utf8');
  const m = h.match(/\{"p":"([^"]+)","s":"([^"]+)"\}/); const pl = JSON.parse(Buffer.from(m[1], 'base64').toString()); pl.org = 'Forged Co';
  h = h.replace(m[0], JSON.stringify({ p: Buffer.from(JSON.stringify(pl, Object.keys(pl).sort())).toString('base64'), s: m[2] }));
  fs.writeFileSync(D + '/test-7sd82-tamper.html', h);
  const { p } = await page('test-7sd82-tamper.html');
  const bar = (await p.locator('#licBar').textContent());
  ck('forged licence rejected', bar.includes('Evaluation') && !bar.includes('Forged'));
  await p.close(); fs.unlinkSync(D + '/test-7sd82-tamper.html');
}
await b.close();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
