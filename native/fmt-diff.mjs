// fmt-diff.mjs — differential validation of the C ES Number->string engine
// vs Node's String(n). Both must produce identical output for the sort/join
// differential oracle to hold on the live engine.
//
// Usage:
//   clang -O2 fmt-test.c esarr_format.c -o fmt-test.exe   (once, CRT build)
//   node fmt-diff.mjs [--count N] [--seed S] [--quick]
//
// Corpus: classic tricky values, powers of two/ten, subnormals, int32
// boundaries, random bit patterns (uniform over the double space) and
// random doubles biased toward "human" magnitudes. Every value is compared
// byte-for-byte against String(n). Exits 0 on full parity.

import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const exe = join(here, 'bin', 'fmt-test.exe').replaceAll('\\', '/');
const tmpdir = join(here, 'bin');
mkdirSync(tmpdir, { recursive: true });

const count = parseInt(process.argv[2] === '--count' ? process.argv[3] : '200000', 10);
const seedArg = process.argv.indexOf('--seed');
const seed = seedArg >= 0 ? parseInt(process.argv[seedArg + 1], 10) : 20260809;

// deterministic PRNG (mulberry32)
let s = seed >>> 0;
function rnd() {
  s = (s + 0x6D2B79F5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function rndBits() {
  return (BigInt(Math.floor(rnd() * 0x100000000)) << 32n) |
         BigInt(Math.floor(rnd() * 0x100000000));
}
function bitsOf(x) {
  const b = new ArrayBuffer(8);
  new Float64Array(b)[0] = x;
  return BigInt.asUintN(64, new BigUint64Array(b)[0]);
}
function dblOf(bits) {
  const b = new ArrayBuffer(8);
  new BigUint64Array(b)[0] = bits;
  return new Float64Array(b)[0];
}

// ---- corpus ----
const corpus = [];

// classics
const classics = [0, -0, 1, -1, 0.5, -0.5, 0.1, 0.2, 0.3, 0.7, 1/3, 2/3, Math.PI,
  Math.E, Math.SQRT2, 10, 100, 1000, 1e6, 1e15, 1e16, 1e20, 1e21, 1e22,
  1e-1, 1e-5, 1e-6, 1e-7, 1e-8, 1e-20, 5e-324, Number.MIN_VALUE,
  Number.MAX_VALUE, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER,
  2 ** 52, 2 ** 53, 2 ** 54, 3.141592653589793, 2.718281828459045,
  0.30000000000000004, 0.123456789, 123456789.123456789, 1e-323,
  1.7976931348623157e308, 2.2250738585072014e-308, 0.9999999999999999,
  0.49999999999999994, 1.0000000000000002, 9007199254740993,
  123456789012345678901234567890, 1e100, 1e-100, 42, -42, 2147483647,
  -2147483648, 2147483648, -2147483649, 65535, 65536, 2, 4, 8, 16];
for (const v of classics) corpus.push(bitsOf(v));

// powers of two (all exponents)
for (let e = -1074; e <= 1023; e++) {
  const b = BigInt(e + 1023) << 52n;
  corpus.push(b);                    // exact power of two
  corpus.push(b | 1n);               // power of two + 1 ulp
  corpus.push(b | 0xFFFFFFFFFFFFFn); // power of two - 1 ulp (next below)
}
// subnormal sweep
for (let m = 1n; m < 1n << 52n; m <<= 1n) corpus.push(m);
for (let i = 0; i < 200; i++) corpus.push(BigInt(Math.floor(rnd() * 0xFFFFFFFFFFFFF)));

// powers of ten neighborhoods (the ES3 threshold boundaries n = 21, n = -6)
for (let p = -320; p <= 308; p++) {
  const ten = 10 ** p;
  if (ten === 0 || !isFinite(ten)) continue;
  const b = bitsOf(ten);
  corpus.push(b);
  // neighbors via bit math (next/prev double)
  for (const delta of [1n, -1n]) {
    let nb = BigInt.asUintN(64, b + delta);
    if (nb >= 0n && nb <= 0x7FFFFFFFFFFFFFFFn) corpus.push(nb);
  }
}

// int32 boundaries (the lane unit)
for (const v of [-2147483648, -2147483647, -2147483646, -1, 0, 1, 2, 9, 10,
  11, 99, 100, 999, 1000, 9999, 10000, 65534, 65535, 65536, 2147483646,
  2147483647]) {
  corpus.push(bitsOf(v));
}

// random: uniform bit patterns (spans every exponent incl. NaN/Inf payloads)
for (let i = 0; i < count; i++) corpus.push(rndBits() & 0x7FFFFFFFFFFFFFFFn);

// random: "human" magnitudes biased small
for (let i = 0; i < count; i++) {
  const mag = Math.floor(rnd() * 60) - 30;
  const mant = (rnd() * 2 - 1) * 10 ** (Math.floor(rnd() * 16) - 8);
  corpus.push(bitsOf(mant * 10 ** mag));
}
// random: full-range uniform doubles (all exponents, mantissa random)
for (let i = 0; i < count; i++) {
  const e = Math.floor(rnd() * 2098) - 1074;
  const m = BigInt(Math.floor(rnd() * 0x10000000000000));
  corpus.push((BigInt(e + 1023) << 52n) | (m & 0xFFFFFFFFFFFFFn));
}

// NaN/Inf must never reach the formatter (handled), but assert engine parity
// for the specials too.
corpus.push(bitsOf(NaN));
corpus.push(bitsOf(Infinity));
corpus.push(bitsOf(-Infinity));

// ---- run the C engine ----
const lines = corpus.map(b => BigInt.asUintN(64, b).toString(16).padStart(16, '0')).join('\n') + '\n';
const res = spawnSync(exe, [], { input: lines, encoding: 'utf8', timeout: 120000, maxBuffer: 256 * 1024 * 1024 });
if (res.error) {
  console.error('FATAL: cannot run', exe, ':', res.error.message);
  process.exit(2);
}
const outputs = res.stdout.split('\n');

// ---- compare ----
let mismatches = 0;
let checked = 0;
const firstFew = [];
for (let i = 0; i < corpus.length; i++) {
  const x = dblOf(corpus[i]);
  const expected = String(x);
  const got = outputs[i] === undefined ? '(missing)' : outputs[i];
  checked++;
  if (got !== expected) {
    mismatches++;
    if (firstFew.length < 15) {
      firstFew.push({ bits: corpus[i].toString(16).padStart(16, '0'), x, expected, got });
    }
  }
}
console.log(`corpus: ${checked} values, seed ${seed}`);
console.log(`mismatches: ${mismatches}`);
if (firstFew.length > 0) {
  console.log('first mismatches (bits / value / expected / C):');
  for (const m of firstFew) {
    console.log(`  ${m.bits}  ${m.x}  "${m.expected}"  "${m.got}"`);
  }
  process.exit(1);
}
console.log('FORMATTER PARITY: OK');
process.exit(0);
