// lane-parity.mjs — scale differential: native lanes (ESARRArray.dll)
// vs Node Array natives on large random/adversarial int32 payloads.
//
// Drives lane-test.exe (freestanding loader for the DLL) with SORT/REV/
// JOIN commands, unpacks the byte+1 wire, and compares against Node's
// semantics:
//   sort    -> [...a].sort()          (default = ToString order)
//   reverse -> [...a].reverse()
//   join    -> a.join(sep)            (sep: ",", "", " | ", "\n")
//
// Covers the design doc §7 band: 4k / 8k / 16k / 32k / 48k elements with
// random dense int32, sorted, reverse-sorted, duplicates-heavy, and
// power-of-10 mixes. Exit 0 on full parity. No Illustrator needed.
//
// Usage: node lane-parity.mjs
//   ESARR_SIZES=65536,131072,262144 node lane-parity.mjs  (high-n override;
//   defaults unchanged)

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const exe = join(here, 'bin', 'lane-test.exe').replaceAll('\\', '/');
// DLL under test: default ESARRArray.dll; override with ESARR_DLL env var
const dllName = process.env.ESARR_DLL || 'ESARRArray.dll';

// deterministic PRNG (mulberry32)
let s = 20260809 >>> 0;
function rnd() {
  s = (s + 0x6D2B79F5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// byte+1 wire (FINAL, decisions/wire-final v3)
function packInt32(v) {
  const n = v < 0 ? v + 4294967296 : v;
  return String.fromCharCode(
    ((n >>> 24) & 255) + 1, ((n >>> 16) & 255) + 1,
    ((n >>> 8) & 255) + 1, (n & 255) + 1);
}
function packArray(vals) {
  let out = '';
  for (const v of vals) out += packInt32(v);
  return out;
}
// The C boundary receives UTF-8 (like the real host): units 1..256 ->
// 1 byte (<128) or C2/C3/C4 + continuation.
function channelBytes(channel) {
  return Buffer.from(channel, 'utf8');
}
function unpackArray(utf8bytes, len) {
  // decode UTF-8 code points back to units (1-byte ASCII, 2-byte C2-DF,
  // 3-byte E0-EF — units up to 4096)
  const units = [];
  let i = 0;
  while (i < utf8bytes.length) {
    const b = utf8bytes[i];
    if (b < 0x80) { units.push(b); i += 1; }
    else if (b >= 0xC2 && b <= 0xDF) {
      units.push(((b & 0x1F) << 6) | (utf8bytes[i + 1] & 0x3F));
      i += 2;
    } else {
      units.push(((b & 0x0F) << 12) | ((utf8bytes[i + 1] & 0x3F) << 6) | (utf8bytes[i + 2] & 0x3F));
      i += 3;
    }
  }
  const out = new Array(len);
  for (let e = 0; e < len; e++) {
    const o = e * 4;
    const c0 = units[o], c1 = units[o + 1], c2 = units[o + 2], c3 = units[o + 3];
    const n = ((c0 - 1) << 24) | ((c1 - 1) << 16) | ((c2 - 1) << 8) | (c3 - 1);
    out[e] = n >= 2147483648 ? n - 4294967296 : n;
  }
  return out;
}

function b64(buf) { return Buffer.from(buf, 'binary').toString('base64'); }

function genCase(n, kind) {
  const a = new Array(n);
  for (let i = 0; i < n; i++) {
    switch (kind) {
      case 'random': a[i] = Math.floor(rnd() * 4294967296) - 2147483648; break;
      case 'small': a[i] = Math.floor(rnd() * 2001) - 1000; break; // heavy duplicates
      case 'sorted': a[i] = i - n / 2; break;
      case 'revsorted': a[i] = n / 2 - i; break;
      case 'pow10': {
        // max 9e8 (p<=8) keeps every value inside int32
        const p = [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000][Math.floor(rnd() * 9)];
        a[i] = Math.floor(rnd() * 9 + 1) * p * (rnd() < 0.5 ? -1 : 1);
        break;
      }
      case 'bounds': {
        const pick = Math.floor(rnd() * 6);
        a[i] = [0, 1, -1, 2147483647, -2147483648, 65535][pick];
        break;
      }
    }
  }
  return a;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const _sizesOverride = (process.env.ESARR_SIZES || '')
  .split(',').filter(Boolean).map((s) => Number(s))
  .filter((n) => Number.isFinite(n) && n > 0);
const sizes = _sizesOverride.length > 0 ? _sizesOverride : [4096, 8192, 16384, 32768, 49152];
const kinds = ['random', 'small', 'sorted', 'revsorted', 'pow10', 'bounds'];
const seps = [',', '', ' | ', '\n', '::'];
// ESARR_SCANS=1 additionally drives the packed-scan lanes (arrIndexOf /
// arrLastIndexOf / arrIncludes — the router's packed-payload scan rows).
// Default stays off so the canonical 210-command sort/reverse/join gate is
// byte-unchanged.
const scanLanes = (process.env.ESARR_SCANS || '') === '1';

// batch per (size, kind): keeps each spawnSync input well under the pipe
// limit (48k elements -> ~500 KB of b64)
let expected = [];
let fails = 0;
const firstFew = [];

function runBatch(cmds, expList) {
  const res = spawnSync(exe, [dllName], {
    input: cmds, encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024 * 1024
  });
  if (res.error) {
    console.error('FATAL: cannot run', exe, ':', res.error.message);
    process.exit(2);
  }
  const lines = res.stdout.trimEnd().split('\n');
  if (lines.length !== expList.length) {
    console.error(`FATAL: driver returned ${lines.length} lines, expected ${expList.length}`);
    process.exit(2);
  }
  for (let i = 0; i < lines.length; i++) {
    const exp = expList[i];
    const line = lines[i];
    if (line.startsWith('ERR')) {
      fails++;
      if (firstFew.length < 10) firstFew.push(`[${exp.kind}@${exp.size} ${exp.op}] native ERR ${line}`);
      continue;
    }
    if (exp.op === 'indexOf' || exp.op === 'lastIndexOf' || exp.op === 'includes') {
      // scan results are plain ints: "OKI <n>" (index, -1, or 1/0)
      if (!line.startsWith('OKI')) {
        fails++;
        if (firstFew.length < 10) firstFew.push(`[${exp.kind}@${exp.size} ${exp.op}] native non-OKI "${line}"`);
        continue;
      }
      const got = Number(line.slice(4));
      if (got !== exp.expect) {
        fails++;
        if (firstFew.length < 10) firstFew.push(`[${exp.kind}@${exp.size} ${exp.op} search=${exp.search}] native ${got} vs Node ${exp.expect}`);
      }
      continue;
    }
    const b64out = line.slice(3);
    if (exp.op === 'join') {
      const got = Buffer.from(b64out, 'base64').toString('utf8');
      if (got !== exp.expect) {
        fails++;
        if (firstFew.length < 10) firstFew.push(`[${exp.kind}@${exp.size} join sep=${JSON.stringify(exp.sep)}] native "${got.slice(0, 80)}" vs "${String(exp.expect).slice(0, 80)}"`);
      }
    } else {
      const got = unpackArray(Buffer.from(b64out, 'base64'), exp.n);
      if (!arraysEqual(got, exp.expect)) {
        fails++;
        if (firstFew.length < 10) {
          const d = got.findIndex((v, i) => v !== exp.expect[i]);
          firstFew.push(`[${exp.kind}@${exp.size} ${exp.op}] first diff at ${d}: native ${got[d]} vs Node ${exp.expect[d]}`);
        }
      }
    }
  }
}

let total = 0;
for (const size of sizes) {
  for (const kind of kinds) {
    const a = genCase(size, kind);
    const b64chan = channelBytes(packArray(a)).toString('base64');
    let cmds = '';
    const expList = [];
    cmds += `SORT ${size} ${b64chan}\n`;
    expList.push({ kind, size, op: 'sort', expect: [...a].sort(), n: size });
    cmds += `REV ${size} ${b64chan}\n`;
    expList.push({ kind, size, op: 'reverse', expect: [...a].reverse(), n: size });
    for (const sep of seps) {
      // empty sep crosses as a NUL byte (b64 "AA==") — the token parser
      // needs a non-empty token; the DLL sees a 0-length separator
      const sepB64 = sep === '' ? 'AA==' : Buffer.from(sep, 'utf8').toString('base64');
      cmds += `JOIN ${size} ${sepB64} ${b64chan}\n`;
      expList.push({ kind, size, op: 'join', expect: a.join(sep), sep });
    }
    if (scanLanes) {
      // packed-scan rows: hit at head/mid/tail + guaranteed miss
      const mid = a[Math.floor(size / 2)];
      const probes = [a[0], mid, a[size - 1]];
      // miss: first value not present (deterministic)
      let miss = 0;
      for (const c of [2147483647, -2147483648, 0, 123456789, -987654321, 999999999]) {
        if (!a.includes(c)) { miss = c; break; }
      }
      for (const s of probes) {
        cmds += `IDX ${size} ${s} ${b64chan}\n`;
        expList.push({ kind, size, op: 'indexOf', search: s, expect: a.indexOf(s) });
        cmds += `LIDX ${size} ${s} ${b64chan}\n`;
        expList.push({ kind, size, op: 'lastIndexOf', search: s, expect: a.lastIndexOf(s) });
        cmds += `INC ${size} ${s} ${b64chan}\n`;
        expList.push({ kind, size, op: 'includes', search: s, expect: a.includes(s) ? 1 : 0 });
      }
      cmds += `IDX ${size} ${miss} ${b64chan}\n`;
      expList.push({ kind, size, op: 'indexOf', search: miss, expect: -1 });
      cmds += `LIDX ${size} ${miss} ${b64chan}\n`;
      expList.push({ kind, size, op: 'lastIndexOf', search: miss, expect: -1 });
      cmds += `INC ${size} ${miss} ${b64chan}\n`;
      expList.push({ kind, size, op: 'includes', search: miss, expect: 0 });
    }
    runBatch(cmds, expList);
    total += expList.length;
  }
}

console.log(`commands: ${total}, seed ${s}`);
console.log(`mismatches: ${fails}`);
if (firstFew.length > 0) {
  for (const f of firstFew) console.log('  ' + f);
  process.exit(1);
}
console.log(`LANE PARITY: OK (${sizes.join('/')}, all patterns${scanLanes ? ' + scans' : ''})`);
process.exit(0);


