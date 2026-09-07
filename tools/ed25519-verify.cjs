/* ============================================================================
   Ed25519 signature verification — verify only, no dependencies.

   Used in two places from this one source: the browser build inlines it, and
   the licence tooling imports it to self-check every licence it mints.

   Why hand-rolled rather than WebCrypto: WebCrypto only gained Ed25519 in
   Chrome 137, Safari 17 and Firefox 130. This tool runs on substation laptops
   that are not always current, and a licence that fails to verify on an old
   browser is a support call on a paid product. BigInt is supported everywhere
   back to 2018, so this path always works.

   Verification only. The private key never appears in this file or in any
   build produced from it.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ED25519 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var P = (1n << 255n) - 19n;
  var L = (1n << 252n) + 27742317777372353535851937790883648493n;

  function mod(a, m) { m = m || P; var r = a % m; return r >= 0n ? r : r + m; }
  function pw(a, e, m) {
    m = m || P; var r = 1n; a = mod(a, m);
    while (e > 0n) { if (e & 1n) r = mod(r * a, m); a = mod(a * a, m); e >>= 1n; }
    return r;
  }
  function inv(a) { return pw(a, P - 2n); }

  var D = mod(-121665n * inv(121666n));
  var SQRT_M1 = pw(2n, (P - 1n) / 4n);

  /* Extended twisted-Edwards coordinates (X : Y : Z : T), a = -1.
     The addition formula below is unified, so doubling is add(p, p). */
  function pt(X, Y, Z, T) { return { X: X, Y: Y, Z: Z, T: T }; }
  var ZERO = pt(0n, 1n, 1n, 0n);

  function add(p, q) {
    var A = mod((p.Y - p.X) * (q.Y - q.X));
    var B = mod((p.Y + p.X) * (q.Y + q.X));
    var C = mod(p.T * 2n * D * q.T);
    var Dd = mod(p.Z * 2n * q.Z);
    var E = B - A, F = Dd - C, G = Dd + C, H = B + A;
    return pt(mod(E * F), mod(G * H), mod(F * G), mod(E * H));
  }

  function mul(p, n) {
    var r = ZERO, a = p;
    while (n > 0n) { if (n & 1n) r = add(r, a); a = add(a, a); n >>= 1n; }
    return r;
  }

  function eq(p, q) {
    return mod(p.X * q.Z) === mod(q.X * p.Z) && mod(p.Y * q.Z) === mod(q.Y * p.Z);
  }

  var Gy = mod(4n * inv(5n));
  var G = null;

  function decode(bytes) {
    if (bytes.length !== 32) return null;
    var n = 0n;
    for (var i = 31; i >= 0; i--) n = (n << 8n) | BigInt(bytes[i]);
    var sign = (n >> 255n) & 1n;
    var y = n & ((1n << 255n) - 1n);
    if (y >= P) return null;
    var y2 = mod(y * y);
    var u = mod(y2 - 1n), v = mod(D * y2 + 1n);
    var x = mod(u * inv(v));
    x = pw(x, (P + 3n) / 8n);
    if (mod(x * x - mod(u * inv(v))) !== 0n) x = mod(x * SQRT_M1);
    if (mod(x * x - mod(u * inv(v))) !== 0n) return null;
    if ((x & 1n) !== sign) x = mod(-x);
    return pt(x, y, 1n, mod(x * y));
  }

  function leInt(bytes) {
    var n = 0n;
    for (var i = bytes.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(bytes[i]);
    return n;
  }

  function cat() {
    var total = 0, k;
    for (k = 0; k < arguments.length; k++) total += arguments[k].length;
    var out = new Uint8Array(total), off = 0;
    for (k = 0; k < arguments.length; k++) { out.set(arguments[k], off); off += arguments[k].length; }
    return out;
  }

  function sha512(bytes) {
    var c = (typeof crypto !== 'undefined' && crypto.subtle) ? crypto :
            (typeof require === 'function' ? require('crypto').webcrypto : null);
    if (!c || !c.subtle) return Promise.reject(new Error('No SHA-512 available'));
    return c.subtle.digest('SHA-512', bytes).then(function (b) { return new Uint8Array(b); });
  }

  /* verify(sig64, msgBytes, pub32) -> Promise<boolean>. Never throws. */
  function verify(sig, msg, pub) {
    try {
      if (!G) { var g = decode(encodeY(Gy, true)); G = g; }
      if (!sig || sig.length !== 64 || !pub || pub.length !== 32) return Promise.resolve(false);
      var Rb = sig.subarray(0, 32), Sb = sig.subarray(32, 64);
      var s = leInt(Sb);
      if (s >= L) return Promise.resolve(false);          /* non-canonical S */
      var A = decode(pub), R = decode(Rb);
      if (!A || !R) return Promise.resolve(false);
      return sha512(cat(Rb, pub, msg)).then(function (h) {
        var k = mod(leInt(h), L);
        return eq(mul(G, s), add(R, mul(A, k)));
      }).catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }

  /* Recover the canonical base point encoding for the known Gy (x is even). */
  function encodeY(y, xEven) {
    var y2 = mod(y * y);
    var u = mod(y2 - 1n), v = mod(D * y2 + 1n);
    var x2 = mod(u * inv(v));
    var x = pw(x2, (P + 3n) / 8n);
    if (mod(x * x - x2) !== 0n) x = mod(x * SQRT_M1);
    if ((x & 1n) === 1n && xEven) x = mod(-x);
    var n = y | ((x & 1n) << 255n);
    var out = new Uint8Array(32);
    for (var i = 0; i < 32; i++) { out[i] = Number(n & 0xffn); n >>= 8n; }
    return out;
  }

  function b64ToBytes(b64) {
    var bin = (typeof atob === 'function') ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function utf8(str) {
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(str);
    return new Uint8Array(Buffer.from(str, 'utf8'));
  }

  return { verify: verify, b64ToBytes: b64ToBytes, utf8: utf8 };
});
