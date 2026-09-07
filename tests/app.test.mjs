import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const D = new URL('../dist', import.meta.url).pathname;
let pass = 0, fail = 0;
const ck = (n, ok, extra) => { ok ? pass++ : fail++; console.log((ok?'  ok   ':'  FAIL ')+n+(extra?'  ['+extra+']':'')); };

const { execFileSync } = await import('node:child_process');
const ROOT = new URL('..', import.meta.url).pathname;
execFileSync(process.execPath, ['build.mjs', '--out', 'dist/test-old-build.html'], { cwd: ROOT, env: { ...process.env, VEC_BUILD_DATE: '2026-01-15' }, stdio: 'ignore' });
execFileSync(process.execPath, ['tools/make-licence.mjs', '--org', 'Lapsed Maint Co', '--seats', '4', '--maint', '2026-06-30', '--template', 'dist/test-old-build.html', '--id', 'LIC-TEST-LAPSED'], { cwd: ROOT, stdio: 'ignore' });
const b = await chromium.launch();

async function page(file) {
  const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  // Hard offline: nothing may leave the machine.
  const net = [];
  await p.route('**', r => {
    const u = r.request().url();
    if (u.startsWith('file://')) return r.continue();
    net.push(u); return r.abort();
  });
  await p.goto('file://' + D + '/' + file, { waitUntil: 'load' });
  await p.waitForTimeout(1200);          // licence verify is async
  await p.locator('.tab[data-view="v-elem"]').click();   // fresh profile opens on Setup
  await p.waitForTimeout(250);
  return { p, errs, net };
}

console.log('\n— Licensed copy, file://, network blocked —');
{
  const { p, errs, net } = await page('845-VEC-northgate-power-services.html');
  ck('no external network requests attempted', net.length === 0, net.slice(0,2).join(','));
  ck('no page or console errors', errs.length === 0, errs.slice(0,2).join(' | '));
  const bar = (await p.locator('#licBar').textContent()).replace(/\s+/g,' ').trim();
  ck('licence bar reports Licensed', /^Licensed/.test(bar), bar.slice(0,70));
  ck('bar names the organisation', bar.includes('Northgate Power Services'));
  ck('bar names the site', bar.includes('Calgary Operations'));
  ck('bar states the seat count', bar.includes('12 seat'));
  ck('bar states perpetual', bar.includes('Perpetual'));
  ck('bar class is licensed, not evaluation', await p.locator('#licBar').evaluate(e => e.classList.contains('lic')));
  ck('footer carries the same provenance line',
     (await p.locator('#licFoot').textContent()).includes('Northgate Power Services'));
  ck('footer shows version and build', /v1\.1\.0 · build \d{4}-\d{2}-\d{2}/.test(await p.locator('#verFoot').textContent()));

  // Bundled fonts actually applied (not a system fallback)
  const ff = await p.evaluate(() => document.fonts.check('600 14px "Barlow Condensed"'));
  ck('bundled Barlow Condensed available offline', ff);
  const face = await p.evaluate(() => getComputedStyle(document.querySelector('.tab')).fontFamily);
  ck('display face is Barlow Condensed', face.includes('Barlow Condensed'), face);

  // The app itself works
  ck('element rail populated', (await p.locator('.rail-i').count()) > 10);
  ck('channel table renders', (await p.locator('.chan table tbody tr').count()) > 0);

  // ---- 87G fix, verified numerically ----
  await p.locator('.rail-i[data-el="87G"]').click();
  await p.waitForTimeout(300);
  await p.locator('tr[data-pt="refstab"]').click();
  await p.waitForTimeout(300);
  const rows = await p.locator('.chan table tbody tr').allTextContents();
  const gnd = rows.find(r => /reversed polarity/.test(r));
  // sample: phase 1200:5, ground 200:5, thru 4 xCT -> It = 20 A, Ig = 20 * 240/40 = 120 A
  ck('87G ground injection is 120.000 A (was 20 A before the fix)', !!gnd && /120\.000 A/.test(gnd), (gnd||'').replace(/\s+/g,' ').slice(0,60));
  const ph = rows.find(r => /phase L1/.test(r));
  ck('87G phase injection is 20.000 A', !!ph && /20\.000 A/.test(ph));
  const notes = (await p.locator('#outPane .notes').textContent()).replace(/\s+/g,' ');
  ck('note states matching primary amperes', notes.includes('4800 A primary'), notes.slice(notes.indexOf('Phase CTs'),notes.indexOf('Phase CTs')+120));
  const over = await p.locator('#outPane .note.bad').count();
  ck('over-range is flagged rather than silently shipped', over > 0);

  // ---- test sheet carries the licence ----
  await p.locator('.rail-i[data-el="51P"]').click();
  await p.waitForTimeout(250);
  await p.locator('#addSheet').click();
  await p.waitForTimeout(250);
  await p.locator('.tab[data-view="v-sheet"]').click();
  await p.waitForTimeout(250);
  const sheet = await p.locator('#sheetOut').inputValue();
  ck('exported sheet is stamped with the licence', sheet.includes('Licensed to Northgate Power Services'));
  ck('exported sheet names the build', /845-VEC v1\.1\.0/.test(sheet));
  ck('exported sheet has data rows', sheet.split('\n').filter(l => l.includes('51P')).length >= 3);
  await p.close();
}

console.log('\n— Unlicensed copy —');
{
  const { p, errs } = await page('845-VEC-unlicensed.html');
  ck('no errors', errs.length === 0, errs[0]);
  const bar = (await p.locator('#licBar').textContent()).replace(/\s+/g,' ');
  ck('shows Evaluation', bar.includes('Evaluation'));
  ck('states it is not licensed for commissioning', bar.includes('Not licensed for commissioning work'));
  ck('bar class is evaluation', await p.locator('#licBar').evaluate(e => e.classList.contains('evat')));
  // Calculations must be IDENTICAL to the licensed copy — never degraded.
  await p.locator('.rail-i[data-el="87G"]').click();
  await p.waitForTimeout(300);
  await p.locator('tr[data-pt="refstab"]').click();
  await p.waitForTimeout(300);
  const rows = await p.locator('.chan table tbody tr').allTextContents();
  ck('unlicensed copy computes the SAME values (safety)', rows.some(r => /120\.000 A/.test(r)));
  await p.locator('.rail-i[data-el="51P"]').click(); await p.waitForTimeout(200);
  await p.locator('#addSheet').click(); await p.waitForTimeout(200);
  await p.locator('.tab[data-view="v-sheet"]').click(); await p.waitForTimeout(200);
  const sheet = await p.locator('#sheetOut').inputValue();
  ck('sheet stamped EVALUATION COPY', sheet.includes('EVALUATION COPY — NOT FOR COMMISSIONING USE'));
  await p.close();
}

console.log('\n— Expired licence —');
{
  const { p } = await page('845-VEC-demo-expired.html');
  const bar = (await p.locator('#licBar').textContent()).replace(/\s+/g,' ');
  ck('expired licence falls back to evaluation', bar.includes('Evaluation'));
  ck('says which date it expired', bar.includes('expired on 1 Jan 2020'), bar.slice(0,120));
  await p.close();
}

console.log('\n— Tampered licence (org name edited) —');
{
  const fs = await import('node:fs');
  let h = fs.readFileSync(D + '/845-VEC-northgate-power-services.html','utf8');
  const m = h.match(/\{"p":"([^"]+)","s":"([^"]+)"\}/);
  const payload = JSON.parse(Buffer.from(m[1],'base64').toString());
  payload.org = 'Somebody Else Entirely'; payload.seats = 9999;
  const forged = Buffer.from(JSON.stringify(payload, Object.keys(payload).sort())).toString('base64');
  h = h.replace(m[0], `{"p":"${forged}","s":"${m[2]}"}`);
  fs.writeFileSync(D + '/tampered.html', h);
  const { p } = await page('tampered.html');
  const bar = (await p.locator('#licBar').textContent()).replace(/\s+/g,' ');
  ck('forged licence is rejected', bar.includes('Evaluation'), bar.slice(0,60));
  ck('forged org name never displayed', !bar.includes('Somebody Else Entirely'));
  await p.close();
  fs.unlinkSync(D + '/tampered.html');
}

console.log('\n— Station file round-trip —');
{
  const fsp = await import('node:fs');
  const { p } = await page('845-VEC-northgate-power-services.html');
  await p.locator('.tab[data-view="v-setup"]').click();
  await p.waitForTimeout(200);
  // Change the station away from the worked sample.
  await p.locator('[data-cfg="ct1p"]').fill('300');
  await p.locator('[data-cfg="kv1"]').fill('69');
  await p.waitForTimeout(300);
  const dl = p.waitForEvent('download');
  await p.locator('#saveCfg').click();
  const d = await dl;
  const tmp = '/tmp/station.json';
  await d.saveAs(tmp);
  const doc = JSON.parse(fsp.readFileSync(tmp, 'utf8'));
  ck('saved file has the expected format tag', doc.format === '845-VEC station');
  ck('saved file carries the edited CT primary', String(doc.station.ct1p) === '300', String(doc.station.ct1p));
  ck('saved file carries the edited kV', String(doc.station.kv1) === '69');
  ck('download filename names the station', /845-VEC-.*69.*\.json/.test(d.suggestedFilename()), d.suggestedFilename());

  // Reset to the sample, then load the file back.
  await p.locator('#resetBtn').click();
  await p.waitForTimeout(300);
  ck('reset restored the sample', await p.locator('[data-cfg="ct1p"]').inputValue() === '150');
  await p.locator('#cfgFile').setInputFiles(tmp);
  await p.waitForTimeout(400);
  ck('loaded file restored the CT primary', await p.locator('[data-cfg="ct1p"]').inputValue() === '300');
  ck('loaded file restored the kV', await p.locator('[data-cfg="kv1"]').inputValue() === '69');
  ck('chip shows the loaded filename', (await p.locator('#cfgName').textContent()).endsWith('.json'));

  // A junk file must be refused without touching the current station.
  fsp.writeFileSync('/tmp/junk.json', '{"hello":"world"}');
  p.once('dialog', d2 => d2.accept());
  await p.locator('#cfgFile').setInputFiles('/tmp/junk.json');
  await p.waitForTimeout(400);
  ck('junk file refused, station unchanged', await p.locator('[data-cfg="ct1p"]').inputValue() === '300');
  await p.close();
}

console.log('\n— Licence model: perpetual + maintenance —');
{
  const fsp = await import('node:fs');
  // (a) maintenance current
  const a = await page('845-VEC-northgate-power-services.html');
  const barA = (await a.p.locator('#licBar').textContent()).replace(/\s+/g,' ');
  ck('current maintenance: bar shows the updates-to date', barA.includes('Updates to 7 Sep 2027'), barA.slice(0,110));
  ck('current maintenance: not marked lapsed', !(await a.p.locator('#licBar').evaluate(e => e.classList.contains('lapsed'))));
  ck('current maintenance: footer line names the term', (await a.p.locator('#licFoot').textContent()).includes('maintenance to 7 Sep 2027'));
  await a.p.close();

  // (b) maintenance lapsed, build inside the term -> still fully licensed
  const b2 = await page('845-VEC-lapsed-maint-co.html');
  const barB = (await b2.p.locator('#licBar').textContent()).replace(/\s+/g,' ');
  ck('lapsed maintenance: still Licensed', /^Licensed/.test(barB), barB.slice(0,60));
  ck('lapsed maintenance: bar carries lapsed class', await b2.p.locator('#licBar').evaluate(e => e.classList.contains('lapsed')));
  ck('lapsed maintenance: says this version stays licensed', barB.includes('Maintenance lapsed 30 Jun 2026') && barB.includes('stays fully licensed'));
  ck('lapsed maintenance: NOT evaluation', !barB.includes('Evaluation'));
  await b2.p.locator('.rail-i[data-el="51P"]').click(); await b2.p.waitForTimeout(200);
  await b2.p.locator('#addSheet').click(); await b2.p.waitForTimeout(200);
  await b2.p.locator('.tab[data-view="v-sheet"]').click(); await b2.p.waitForTimeout(200);
  const sheetB = await b2.p.locator('#sheetOut').inputValue();
  ck('lapsed maintenance: exported sheet is still stamped Licensed, not evaluation',
     sheetB.includes('Licensed to Lapsed Maint Co') && sheetB.includes('maintenance lapsed 30 Jun 2026') && !sheetB.includes('EVALUATION'));
  await b2.p.close();

  // (c) a build dated AFTER the maintenance term -> evaluation, with a specific reason.
  //     make-licence refuses to mint this, so splice the lapsed licence into today's build.
  const lapsedHtml = fsp.readFileSync(D + '/845-VEC-lapsed-maint-co.html', 'utf8');
  const blk = lapsedHtml.match(/\{"p":"[^"]+","s":"[^"]+"\}/)[0];
  const todayHtml = fsp.readFileSync(D + '/845-VEC-unlicensed.html', 'utf8').replace('{"p":"","s":""}', blk);
  fsp.writeFileSync(D + '/test-outside.html', todayHtml);
  const c = await page('test-outside.html');
  const barC = (await c.p.locator('#licBar').textContent()).replace(/\s+/g,' ');
  ck('build outside maintenance: runs as Evaluation', barC.includes('Evaluation'));
  ck('build outside maintenance: explains why, with both dates', barC.includes('newer than the maintenance term') && barC.includes('30 Jun 2026'), barC.slice(0,200));
  ck('build outside maintenance: signature was still valid (no badsig wording)', !barC.includes('Contact the publisher'));
  await c.p.close();
  fsp.unlinkSync(D + '/test-outside.html');
}

await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
