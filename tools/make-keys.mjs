#!/usr/bin/env node
/* Generate the signing keypair. Run ONCE, then guard the private key.
   If you lose it you cannot issue or renew licences; if it leaks, anyone can. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'keys');
const priv = path.join(dir, 'signing-key.pem');
const pub = path.join(dir, 'public-key.b64');

if (fs.existsSync(priv)) {
  console.error(`Refusing to overwrite ${priv}\nEvery licence you have ever issued was signed with it.`);
  process.exit(1);
}
fs.mkdirSync(dir, { recursive: true });

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
fs.writeFileSync(priv, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
const raw = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
fs.writeFileSync(pub, raw.toString('base64') + '\n');

console.log(`Private key  ${priv}   (mode 600 — never commit, never email)`);
console.log(`Public key   ${pub}`);
console.log(`\nPublic key (embedded in every build):\n  ${raw.toString('base64')}`);
console.log(`\nBack the private key up offline now. Losing it ends your ability to issue licences.`);
