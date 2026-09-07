import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ED = require(new URL('../tools/ed25519-verify.cjs', import.meta.url).pathname);

let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log((ok ? '  ok   ' : '  FAIL ') + name); };

// RFC 8032 test vector 2
const rfcPub = Buffer.from('3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c','hex');
const rfcMsg = Buffer.from('72','hex');
const rfcSig = Buffer.from('92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00','hex');
check('RFC 8032 vector 2 verifies', await ED.verify(new Uint8Array(rfcSig), new Uint8Array(rfcMsg), new Uint8Array(rfcPub)));

// Round-trip against Node's own signer, 200 random cases
let allOk = true;
for (let i = 0; i < 200; i++) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const raw = publicKey.export({ type:'spki', format:'der' }).subarray(-32);
  const msg = crypto.randomBytes(1 + (i % 97));
  const sig = crypto.sign(null, msg, privateKey);
  if (!(await ED.verify(new Uint8Array(sig), new Uint8Array(msg), new Uint8Array(raw)))) { allOk = false; break; }
}
check('200 random Node-signed messages verify', allOk);

// Negative cases
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const raw = publicKey.export({ type:'spki', format:'der' }).subarray(-32);
const msg = Buffer.from('845-VEC licence payload');
const sig = crypto.sign(null, msg, privateKey);
check('rejects a flipped message byte',
  !(await ED.verify(new Uint8Array(sig), new Uint8Array(Buffer.from('845-VEC licence payloae')), new Uint8Array(raw))));
const bad = Buffer.from(sig); bad[5] ^= 1;
check('rejects a corrupted signature', !(await ED.verify(new Uint8Array(bad), new Uint8Array(msg), new Uint8Array(raw))));
const other = crypto.generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'der'}).subarray(-32);
check('rejects a signature from a different key', !(await ED.verify(new Uint8Array(sig), new Uint8Array(msg), new Uint8Array(other))));
check('rejects a wrong-length signature', !(await ED.verify(new Uint8Array(63), new Uint8Array(msg), new Uint8Array(raw))));
check('rejects a wrong-length public key', !(await ED.verify(new Uint8Array(sig), new Uint8Array(msg), new Uint8Array(31))));
check('rejects null input without throwing', !(await ED.verify(null, new Uint8Array(msg), new Uint8Array(raw))));
// non-canonical S (S >= L)
const nc = Buffer.from(sig); nc.fill(0xff, 32, 64);
check('rejects non-canonical S', !(await ED.verify(new Uint8Array(nc), new Uint8Array(msg), new Uint8Array(raw))));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
