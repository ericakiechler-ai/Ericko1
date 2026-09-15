/* ------------------------------------------------------------------
   Builds an interactive edition that uses no JavaScript.

   Some viewers strip scripts, so a calculator that computes in the
   browser shows nothing there. This keeps the settings changeable by
   computing every combination in advance and letting CSS reveal the
   one selected — radio inputs and sibling selectors, no script.

   The settings that can be changed are the ones that move the answer:
   the threshold, and the characteristic or unit beside it. Continuous
   values become a spread around the sample setting rather than a free
   number, which is the price of doing this without script.

   Values are not recomputed here. Each combination is set on the real
   tool and its own rendering is captured, so this and the interactive
   edition cannot disagree.

   Usage:  node build-interactive.js 845
   ------------------------------------------------------------------ */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const REPO = path.resolve(__dirname, '..');
const TOOLS = {
  '845': { file: '845.html', tag: '845-VEC', title: 'GE Multilin 845 transformer protection' }
};

/* Seventeen curves is too many to enumerate against every threshold.
   These six are the families actually set on this class of feeder. */
const CURVE_PICK = ['IEEE Mod Inv', 'IEEE Very Inv', 'IEEE Ext Inv',
  'IEC Curve A (SI)', 'IEC Curve B (VI)', 'IEC Curve C (EI)'];

const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const idsafe = t => String(t).replace(/[^A-Za-z0-9]+/g, '_');

/* a spread around the sample value, kept to the field's own precision */
function spread(d, step) {
  const dp = step && step < 1 ? String(step).split('.')[1].length : (d < 1 ? 3 : 2);
  const f = [0.5, 0.75, 1, 1.5, 2].map(m => +(d * m).toFixed(dp));
  return f.filter((v, i) => v > 0 && f.indexOf(v) === i);
}

(async () => {
  const key = (process.argv[2] || '845').toLowerCase();
  const T = TOOLS[key];
  if (!T) { console.error('unknown tool: ' + key); process.exit(1); }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1200 } });
  await page.goto('file://' + path.join(REPO, T.file));
  await page.waitForTimeout(1200);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

  const css = await page.evaluate(() =>
    Array.prototype.map.call(document.querySelectorAll('style'), s => s.textContent).join('\n'));
  const brand = await page.evaluate(() => document.querySelector('.brand').innerHTML);

  await page.evaluate(() => document.querySelector('[data-view="v-setup"]').click());
  await page.waitForTimeout(300);
  const setup = await page.evaluate(() => ({
    chips: document.querySelector('#topChips').innerHTML,
    derived: document.querySelector('#derived').innerHTML,
    cfgNotes: document.querySelector('#cfgNotes').innerHTML
  }));
  await page.evaluate(() => document.querySelector('[data-view="v-elem"]').click());
  await page.waitForTimeout(200);

  /* which two settings each element exposes, and the values offered */
  const plan = await page.evaluate(pick => {
    return ELEMENTS.map(e => {
      const nums = e.fields.filter(f => f.t === 'num');
      const sels = e.fields.filter(f => f.t === 'sel' && f.opts && f.opts.length > 1);
      const A = nums[0] || null;
      /* prefer the characteristic, then the unit the threshold is in */
      let B = sels.find(f => f.k === 'crv') || sels.find(f => f.k === 'pu') || sels[0] || nums[1] || null;
      return {
        ansi: e.ansi, name: e.name,
        A: A ? { k: A.k, l: A.l, u: A.u, d: A.d, step: A.step, t: 'num' } : null,
        B: B ? (B.t === 'sel'
          ? { k: B.k, l: B.l, u: B.u, d: B.d, t: 'sel',
              opts: (B.k === 'crv' ? B.opts.filter(o => pick.indexOf(o[0]) >= 0) : B.opts)
                     .slice(0, 6).map(o => ({ v: o[0], lab: o[1] })) }
          : { k: B.k, l: B.l, u: B.u, d: B.d, step: B.step, t: 'num' })
          : null
      };
    });
  }, CURVE_PICK);

  const groups = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#rail > *').forEach(n => {
      if (n.classList.contains('rail-h')) out.push({ group: n.textContent.trim() });
      else if (n.dataset.el) out.push({ el: n.dataset.el });
    });
    return out;
  });

  /* build the value lists, then capture every combination */
  const built = {};
  let combos = 0;
  for (const P of plan) {
    const av = P.A ? spread(P.A.d, P.A.step) : [null];
    const bv = P.B ? (P.B.t === 'sel' ? P.B.opts.map(o => o.v) : spread(P.B.d, P.B.step).slice(0, 3)) : [null];
    const cells = [];
    for (let i = 0; i < av.length; i++) {
      for (let j = 0; j < bv.length; j++) {
        const over = {};
        if (P.A) over[P.A.k] = av[i];
        if (P.B) over[P.B.k] = bv[j];
        const html = await page.evaluate(args => {
          ST.el = args.ansi;
          ST.set[args.ansi] = Object.assign({}, args.over);
          ST.pt = null;
          renderElement();
          const pane = document.querySelector('#outPane').cloneNode(true);
          pane.querySelectorAll('.hint').forEach(h => {
            if (/select a row/i.test(h.textContent)) h.parentNode.removeChild(h);
          });
          return pane.innerHTML;
        }, { ansi: P.ansi, over });
        cells.push({ i, j, html });
        combos++;
      }
    }
    built[P.ansi] = { av, bv, cells, P };
  }

  const method = await page.evaluate(() => {
    document.querySelector('[data-view="v-meth"]').click();
    return document.querySelector('#methodDoc').innerHTML;
  });
  await browser.close();

  /* ---- markup ------------------------------------------------------
     Inputs come first inside their container so the general sibling
     combinator can reach the blocks they reveal.                      */
  let radios = '', rail = '', panels = '', rules = [];
  groups.forEach(g => {
    if (g.group) { rail += '<div class="rail-h">' + esc(g.group) + '</div>'; return; }
    const a = g.el, B = built[a];
    if (!B) return;
    const first = Object.keys(built)[0] === a;
    radios += '<input type="radio" name="el" class="elr" id="el_' + idsafe(a) + '"' + (first ? ' checked' : '') + '>';
    rail += '<label class="rail-i" for="el_' + idsafe(a) + '"><span class="ansi">' + esc(a) +
            '</span><span class="nm">' + esc(B.P.name) + '</span></label>';
    rules.push('#el_' + idsafe(a) + ':checked ~ .panel[data-el="' + a + '"]{display:block;}');
    rules.push('#el_' + idsafe(a) + ':checked ~ .rail label[for="el_' + idsafe(a) + '"]' +
               '{background:var(--accent-soft); border-left-color:var(--accent); color:var(--ink);}');

    let vr = '', ctrl = '', vars = '';
    B.av.forEach((v, i) => {
      const id = 'a_' + idsafe(a) + '_' + i;
      vr += '<input type="radio" name="a_' + idsafe(a) + '" class="vr" id="' + id + '"' + (i === 2 || (B.av.length < 3 && i === 0) ? ' checked' : '') + '>';
      rules.push('#' + id + ':checked ~ .ctrl label[for="' + id + '"]{background:var(--accent); color:var(--accent-ink); border-color:var(--accent);}');
    });
    B.bv.forEach((v, j) => {
      const id = 'b_' + idsafe(a) + '_' + j;
      const isDef = B.P.B && (B.P.B.t === 'sel' ? v === B.P.B.d : j === 1);
      vr += '<input type="radio" name="b_' + idsafe(a) + '" class="vr" id="' + id + '"' + (isDef ? ' checked' : '') + '>';
      rules.push('#' + id + ':checked ~ .ctrl label[for="' + id + '"]{background:var(--accent); color:var(--accent-ink); border-color:var(--accent);}');
    });
    /* nothing checked by default on B when no option matched the sample */
    if (B.P.B && B.P.B.t === 'sel' && !B.bv.some(v => v === B.P.B.d))
      vr = vr.replace('id="b_' + idsafe(a) + '_0"', 'id="b_' + idsafe(a) + '_0" checked');

    ctrl += '<div class="ctrl">';
    if (B.P.A) {
      ctrl += '<div class="dim"><span class="dimlab">' + esc(B.P.A.l) +
        (B.P.A.u ? ' <em>' + esc(B.P.A.u) + '</em>' : '') + '</span><span class="opts">' +
        B.av.map((v, i) => '<label for="a_' + idsafe(a) + '_' + i + '"' +
          (v === B.P.A.d ? ' data-sample="1"' : '') + '>' + esc(v) + '</label>').join('') + '</span></div>';
    }
    if (B.P.B) {
      ctrl += '<div class="dim"><span class="dimlab">' + esc(B.P.B.l) +
        (B.P.B.u ? ' <em>' + esc(B.P.B.u) + '</em>' : '') + '</span><span class="opts">' +
        B.bv.map((v, j) => '<label for="b_' + idsafe(a) + '_' + j + '"' +
          (v === B.P.B.d ? ' data-sample="1"' : '') + '>' +
          esc(B.P.B.t === 'sel' ? (B.P.B.opts[j] ? B.P.B.opts[j].lab : v) : v) + '</label>').join('') +
        '</span></div>';
    }
    ctrl += '<p class="ctrlnote">Values are pre-computed, so only the listed steps are available. ' +
      'The sample setting is ringed. Everything below follows the selection.</p></div>';

    B.cells.forEach(c => {
      vars += '<div class="var v_' + c.i + '_' + c.j + '">' + c.html + '</div>';
      rules.push('#a_' + idsafe(a) + '_' + c.i + ':checked ~ #b_' + idsafe(a) + '_' + c.j +
                 ':checked ~ .var.v_' + c.i + '_' + c.j + '{display:block;}');
    });
    panels += '<section class="panel" data-el="' + a + '">' + vr + ctrl + vars + '</section>';
  });

  const doc = `<!doctype html>
<!--
  ${T.tag} — ${T.title}
  INTERACTIVE, NO-SCRIPT EDITION. Settings are changed with the controls on
  each function; every combination is pre-computed and revealed by CSS, so the
  page works in viewers that strip scripts.

  Copyright (c) 2026 Eric Kiechler. All rights reserved.
  Not affiliated with GE Vernova, Siemens AG or OMICRON electronics.
-->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${T.tag} interactive</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
${css}
/* ---- no-script interactive shell ------------------------------------ */
.app{display:block;}
.elr,.vr{position:absolute; width:1px; height:1px; opacity:0; pointer-events:none;}
.rail{display:flex; flex-wrap:wrap; gap:4px; padding:10px 14px;
  background:var(--surface); border-bottom:1px solid var(--line);}
.rail .rail-h{width:100%; margin-top:6px;}
.rail label.rail-i{display:inline-flex; gap:7px; width:auto; cursor:pointer;
  border:1px solid var(--line-strong); border-left-width:2px; border-radius:100px;
  padding:4px 11px; background:var(--ground);}
.rail label.rail-i .nm{display:none;}
.panel{display:none; padding:14px 16px 40px;}
.elr:focus-visible ~ .rail label.rail-i{outline:2px solid var(--accent); outline-offset:2px;}
.ctrl{background:var(--surface); border:1px solid var(--accent-line); border-radius:var(--r);
  padding:12px 14px; margin-bottom:16px;}
.dim{display:grid; grid-template-columns:150px 1fr; gap:8px 14px; align-items:baseline;
  margin-bottom:9px;}
.dimlab{font-family:var(--f-disp); font-size:11px; text-transform:uppercase;
  letter-spacing:.1em; font-weight:600; color:var(--ink-3);}
.dimlab em{font-style:normal; text-transform:none; letter-spacing:0; font-family:var(--f-body);}
.opts{display:flex; flex-wrap:wrap; gap:5px;}
.opts label{cursor:pointer; padding:4px 11px; border:1px solid var(--line-strong);
  border-radius:100px; background:var(--ground); font-family:var(--f-num); font-size:12px;
  color:var(--ink-2); user-select:none;}
.opts label:hover{border-color:var(--accent); color:var(--accent);}
.opts label[data-sample="1"]{box-shadow:0 0 0 2px var(--accent-soft);}
.ctrlnote{margin:4px 0 0; font-size:11.5px; color:var(--ink-3); line-height:1.5;}
.var{display:none;}
/* a long characteristic name must wrap rather than be cut off */
.readout dd{overflow-wrap:anywhere; line-height:1.3;}
.setupblk{padding:14px 16px 0;}
@media (max-width:700px){
  .dim{grid-template-columns:1fr; gap:4px;}
  .panel{padding:12px 10px 30px;}
  .rail{padding:8px 10px;}
}
${rules.join('\n')}
</style>
</head>
<body>

<div class="stat-note" style="margin:0; padding:13px 16px; background:var(--accent-soft);
  border-bottom:1px solid var(--accent-line); font-size:13px; line-height:1.55;">
  <strong style="display:block; font-family:var(--f-disp); font-size:15px; letter-spacing:.02em;">${T.tag} &mdash; interactive, no scripting</strong>
  Pick a function, then change its threshold and characteristic with the controls. Every
  combination is worked out in advance, so this page needs no scripting and runs in a viewer
  that blocks it &mdash; the cost is that settings step through fixed values rather than taking
  any number. For free entry and your own CT and VT ratios, use the full edition in a browser.
</div>

<header class="topbar">
  <div class="brand">${brand}</div>
  <div class="chipstrip">${setup.chips}</div>
</header>

<div class="setupblk">
  <div class="blk"><div class="blk-h"><h3>Derived base quantities</h3>
    <span class="hint">the sample station these values are built on</span></div>
    <dl class="readout">${setup.derived}</dl></div>
</div>

<div class="app">
  ${radios}
  <nav class="rail">${rail}</nav>
  ${panels}
</div>

<div class="setupblk"><div class="doc">${method}</div></div>

<footer class="pfoot">
  <div class="prow">
    <span class="pname">${T.tag}</span>
    <span>${T.title} &mdash; interactive, no-script edition</span>
    <span class="psep">|</span>
    <span>&copy; 2026 Eric Kiechler. All rights reserved.</span>
  </div>
</footer>

</body>
</html>`;

  const out = path.join(REPO, T.tag + '-interactive.html');
  fs.writeFileSync(out, doc);
  console.log((T.tag + '-interactive.html').padEnd(28) + plan.length + ' functions, ' +
    combos + ' pre-computed combinations, ' + rules.length + ' CSS rules, ' +
    (doc.length / 1024 / 1024).toFixed(2) + ' MB, ' +
    (doc.match(/<script/gi) || []).length + ' scripts');
})();
