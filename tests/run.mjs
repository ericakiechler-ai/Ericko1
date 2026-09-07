#!/usr/bin/env node
/* Run every check. Exit non-zero if anything fails.
   These are the gate before a build goes to a customer. */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const suites = ['tests/ed25519.test.mjs', 'tests/app.test.mjs'];
let bad = 0;
for (const s of suites) {
  console.log(`\n════ ${s}`);
  const r = spawnSync(process.execPath, [s], { stdio: 'inherit' });
  if (r.status !== 0) bad++;
}
if (!existsSync('dist/845-VEC-unlicensed.html')) {
  console.error('\nNo build present — run `npm run build` first.'); bad++;
}
console.log(bad ? `\n${bad} suite(s) FAILED — do not ship this build.` : '\nAll suites passed.');
process.exit(bad ? 1 : 0);
