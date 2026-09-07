/* ------------------------------------------------------------------
   Builds a no-script, fully pre-rendered copy of a tool.

   Some viewers — in-app file previews especially — strip scripts out,
   and a calculator that computes in the browser then shows nothing at
   all. This walks the real tool headlessly, reads back what it renders
   for every element, and writes those results into flat HTML with no
   script in it. It opens anywhere.

   The values are not recomputed here: whatever the tool draws is what
   lands in the page, so the two cannot disagree.

   Usage:  node build-static.js 845
           node build-static.js all
   ------------------------------------------------------------------ */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const REPO = path.resolve(__dirname, '..');
const TOOLS = {
  '845':   { file: '845.html',   tag: '845-VEC',   title: 'GE Multilin 845 transformer protection' },
  '850':   { file: '850.html',   tag: '850-FDR',   title: 'GE Multilin 850 feeder protection' },
  '869':   { file: '869.html',   tag: '869-MTR',   title: 'GE Multilin 869 motor protection' },
  '889':   { file: '889.html',   tag: '889-GEN',   title: 'GE Multilin 889 generator protection' },
  '7sj85': { file: '7SJ85.html', tag: '7SJ85-SIP', title: 'Siemens SIPROTEC 5 7SJ85 overcurrent' },
  '7sd82': { file: '7SD82.html', tag: '7SD82-DIF', title: 'Siemens SIPROTEC 5 7SD82 line differential' }
};

const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

(async () => {
  const arg = (process.argv[2] || '845').toLowerCase();
  const keys = arg === 'all' ? Object.keys(TOOLS) : [arg];
  const browser = await chromium.launch();

  for (const key of keys) {
  const T = TOOLS[key];
  if (!T) { console.error('unknown tool: ' + key); continue; }

  const page = await browser.newPage({ viewport: { width: 1500, height: 1200 } });
  await page.goto('file://' + path.join(REPO, T.file));
  await page.waitForTimeout(1200);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

  const css = await page.evaluate(() =>
    Array.prototype.map.call(document.querySelectorAll('style'), s => s.textContent).join('\n'));

  const head = await page.evaluate(() => ({
    brand: document.querySelector('.brand').innerHTML,
    chips: document.querySelector('#topChips').innerHTML,
    derived: document.querySelector('#derived') ? document.querySelector('#derived').innerHTML : '',
    cfgNotes: document.querySelector('#cfgNotes') ? document.querySelector('#cfgNotes').innerHTML : '',
    cfg: JSON.parse(JSON.stringify(CFG))
  }));

  /* the setup tab only fills once it has been rendered */
  await page.evaluate(() => document.querySelector('[data-view="v-setup"]').click());
  await page.waitForTimeout(300);
  const setup = await page.evaluate(() => ({
    derived: document.querySelector('#derived').innerHTML,
    cfgNotes: document.querySelector('#cfgNotes').innerHTML
  }));

  await page.evaluate(() => document.querySelector('[data-view="v-elem"]').click());
  await page.waitForTimeout(200);

  const rails = await page.$$eval('.rail-i', els => els.map(e => e.dataset.el));
  const groups = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#rail > *').forEach(n => {
      if (n.classList.contains('rail-h')) out.push({ group: n.textContent.trim() });
      else if (n.dataset.el) out.push({ el: n.dataset.el });
    });
    return out;
  });

  const bodies = {};
  for (const a of rails) {
    await page.evaluate(x => document.querySelector('[data-el="' + x + '"]').click(), a);
    await page.waitForTimeout(120);
    bodies[a] = await page.evaluate(() => {
      const s = [];
      /* the settings live in inputs; restate them as text so the page needs no controls */
      document.querySelectorAll('#setForm .f').forEach(f => {
        const lab = f.querySelector('label'), inp = f.querySelector('input,select');
        if (!lab || !inp) return;
        const val = inp.tagName === 'SELECT' && inp.selectedOptions.length
          ? inp.selectedOptions[0].textContent : inp.value;
        const u = f.querySelector('.u');
        s.push({ k: lab.textContent.trim(), v: val, u: u ? u.textContent.trim() : '' });
      });
      const o = [];
      document.querySelectorAll('#optForm .f').forEach(f => {
        const lab = f.querySelector('label'), inp = f.querySelector('input,select');
        if (!lab || !inp) return;
        const val = inp.tagName === 'SELECT' && inp.selectedOptions.length
          ? inp.selectedOptions[0].textContent : inp.value;
        const u = f.querySelector('.u');
        o.push({ k: lab.textContent.trim(), v: val, u: u ? u.textContent.trim() : '' });
      });
      /* Strip what only makes sense when the page is live: the row-selection
         hint, and the single channel table for the selected point, since every
         point's table is listed in full below. */
      const pane = document.querySelector('#outPane').cloneNode(true);
      pane.querySelectorAll('.chan').forEach(c => c.parentNode.removeChild(c));
      pane.querySelectorAll('.hint').forEach(h => {
        if (/select a row/i.test(h.textContent)) h.parentNode.removeChild(h);
      });
      /* the applied-vectors caption names a point that is no longer selectable */
      pane.querySelectorAll('.blk-h .hint').forEach(h => {
        if (h.textContent.trim() && !/[0-9]/.test(h.textContent)) return;
      });
      return { set: s, opt: o, out: pane.innerHTML };
    });
  }

  /* every test point's channel table, not only the selected one */
  const allPoints = {};
  for (const a of rails) {
    await page.evaluate(x => document.querySelector('[data-el="' + x + '"]').click(), a);
    await page.waitForTimeout(100);
    const pts = await page.$$eval('[data-pt]', els => els.map(e => e.dataset.pt));
    const caps = [];
    for (let k = 0; k < pts.length; k++) {
      const pt = pts[k];
      await page.evaluate(x => { const e = document.querySelector('[data-pt="' + x + '"]'); if (e) e.click(); }, pt);
      await page.waitForTimeout(70);
      const cap = await page.evaluate(x => {
        const row = document.querySelector('[data-pt="' + x + '"]');
        const chan = document.querySelector('#outPane .chan');
        return { name: row && row.children[0] ? row.children[0].innerText.trim() : '',
                 chan: chan ? chan.outerHTML : '' };
      }, pt);
      cap.idx = k + 1;
      caps.push(cap);
    }
    allPoints[a] = caps;
  }

  const method = await page.evaluate(() => {
    document.querySelector('[data-view="v-meth"]').click();
    return document.querySelector('#methodDoc').innerHTML;
  });

  await page.close();

  const kvTable = rows => rows.length
    ? '<dl class="readout">' + rows.map(r =>
        '<div><dt>' + esc(r.k) + '</dt><dd>' + esc(r.v) +
        (r.u ? ' <small>' + esc(r.u) + '</small>' : '') + '</dd></div>').join('') + '</dl>'
    : '';

  let sections = '', toc = '';
  groups.forEach(g => {
    if (g.group) { sections += '<h2 class="grp-h">' + esc(g.group) + '</h2>';
      toc += '<div class="toc-g">' + esc(g.group) + '</div>'; return; }
    const a = g.el, b = bodies[a];
    if (!b) return;
    toc += '<a class="toc-i" href="#el-' + esc(a) + '"><span class="ansi">' + esc(a) + '</span></a>';
    sections +=
      '<section class="el" id="el-' + esc(a) + '">' +
      b.out +
      '<div class="blk"><div class="blk-h"><h3>Relay settings used for these values</h3></div>' +
      kvTable(b.set) + '</div>' +
      (b.opt.length ? '<div class="blk"><div class="blk-h"><h3>Test options</h3></div>' + kvTable(b.opt) + '</div>' : '') +
      (allPoints[a] && allPoints[a].length
        ? '<div class="blk"><div class="blk-h"><h3>' +
          (allPoints[a].some(c => c.chan) ? 'Test-set channels, every step' : 'Every step') + '</h3>' +
          '<span class="hint">' + allPoints[a].filter(c => c.chan).length + ' of ' +
          allPoints[a].length + ' inject</span></div>' +
          allPoints[a].map(c => c.chan
            ? '<div class="ptstep"><div class="ptlab"><span class="ptn">' + c.idx + '</span>' +
              esc(c.name) + '</div>' + c.chan + '</div>'
            : '<div class="ptstep noinj"><div class="ptlab"><span class="ptn">' + c.idx + '</span>' +
              esc(c.name) + '</div><p class="noinjp">No analogue injection at this step &mdash; ' +
              'it is binary, link or timing work.</p></div>').join('') + '</div>'
        : '') +
      '</section>';
  });

  const doc = `<!doctype html>
<!--
  ${T.tag} — ${T.title}
  STATIC EDITION — every value pre-computed. Contains no script of any kind,
  so it opens in viewers that strip scripts, including in-app file previews.

  Copyright (c) 2026 Eric Kiechler. All rights reserved.
  Not affiliated with GE Vernova, Siemens AG or OMICRON electronics.
-->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${T.tag} static</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
${css}
/* ---- static edition ------------------------------------------------- */
.stat-note{margin:0; padding:13px 18px; background:var(--accent-soft);
  border-bottom:1px solid var(--accent-line); color:var(--ink); font-size:13px; line-height:1.55;}
.stat-note strong{display:block; font-family:var(--f-disp); font-size:15px;
  letter-spacing:.02em; margin-bottom:2px;}
.wrapS{max-width:1100px; margin:0 auto; padding:0 16px 60px;}
.toc{display:flex; flex-wrap:wrap; gap:5px; align-items:center; padding:14px 0 4px;}
.toc-g{font-family:var(--f-disp); font-size:10px; text-transform:uppercase;
  letter-spacing:.12em; color:var(--ink-3); font-weight:600; width:100%; margin-top:8px;}
.toc-i{text-decoration:none; padding:3px 9px; border:1px solid var(--line-strong);
  border-radius:100px; background:var(--surface);}
.toc-i .ansi{font-family:var(--f-num); font-size:12px; font-weight:600; color:var(--accent);}
.grp-h{font-family:var(--f-disp); font-size:13px; text-transform:uppercase; letter-spacing:.14em;
  color:var(--ink-3); margin:34px 0 8px; padding-bottom:5px; border-bottom:1px solid var(--line-strong);}
section.el{background:var(--surface); border:1px solid var(--line); border-radius:var(--r);
  padding:16px 18px; margin-bottom:14px;}
section.el .chan{margin-bottom:0;}
.ptstep{margin-bottom:12px;}
.ptlab{display:flex; align-items:baseline; gap:8px; margin-bottom:4px;
  font-family:var(--f-disp); font-size:12px; letter-spacing:.06em; text-transform:uppercase;
  color:var(--ink-2); font-weight:600;}
.ptlab .ptn{font-family:var(--f-num); font-size:11px; font-weight:600; color:var(--accent-ink);
  background:var(--accent); border-radius:3px; padding:1px 6px; letter-spacing:0; flex:none;}
.ptstep.noinj .ptlab{color:var(--ink-3);}
.ptstep.noinj .ptlab .ptn{background:var(--surface-3); color:var(--ink-2);}
.noinjp{margin:0; padding:8px 11px; border:1px dashed var(--line-strong); border-radius:var(--r);
  background:var(--surface-2); color:var(--ink-3); font-size:12px;}
.doc{max-width:100%;}
@media (max-width:700px){ .wrapS{padding:0 10px 40px;} section.el{padding:12px 11px;} }
</style>
</head>
<body>

<div class="stat-note">
  <strong>${T.tag} &mdash; static edition</strong>
  Every value below is already computed and written into this page, so it needs no scripting
  and opens in any viewer. The settings it was computed from are printed beside each function.
  To change a setting and recompute, use the interactive edition in a browser.
</div>

<header class="topbar">
  <div class="brand">${head.brand}</div>
  <div class="chipstrip">${head.chips}</div>
</header>

<div class="wrapS">

  <div class="toc">${toc}</div>

  <h2 class="grp-h">Configuration these values come from</h2>
  <section class="el">
    <div class="blk"><div class="blk-h"><h3>Derived base quantities</h3></div>
      <dl class="readout">${setup.derived}</dl></div>
    <div class="blk"><div class="blk-h"><h3>Configuration checks</h3></div>
      <div class="notes">${setup.cfgNotes}</div></div>
  </section>

  ${sections}

  <h2 class="grp-h">Method</h2>
  <section class="el"><div class="doc">${method}</div></section>

  <footer class="pfoot">
    <div class="prow">
      <span class="pname">${T.tag}</span>
      <span>${T.title} &mdash; static edition</span>
      <span class="psep">|</span>
      <span>&copy; 2026 Eric Kiechler. All rights reserved.</span>
    </div>
  </footer>
</div>

</body>
</html>`;

  const out = path.join(REPO, T.tag + '-static.html');
  fs.writeFileSync(out, doc);
  const scripts = (doc.match(/<script/gi) || []).length;
  console.log((T.tag + '-static.html').padEnd(24) + String(rails.length).padStart(2) + ' functions, ' +
    String(Object.values(allPoints).reduce((a, b) => a + b.length, 0)).padStart(3) + ' test points, ' +
    (doc.length / 1024).toFixed(0).padStart(4) + ' KB, ' + scripts + ' scripts');
  }

  await browser.close();
})();
