#!/usr/bin/env node
// ARCHITECT probe battery (swarm esarr-beat-builtin, stream STRATEGY) —
// hypothesis-funnel validation for the ESARR DLL-acceleration strategy.
// Standalone ES3 probe generator + COM runner + resume markers.
// NO src/ changes. NO dist dependency EXCEPT the pipe battery (loads a
// snapshot of dist/vendor-esarr.js taken at harness start, so peer rebuilds
// cannot shift the measured baseline mid-run).
//
// Batteries (--battery <name> --sizes <a,b,c>):
//   packvars  — pack/unpack variant shootout. v1 vs 4x/8x/16x literal-offset
//               UNROLLED reads; fast classify `v === (v|0)`; branchless
//               `>>>0` shift-packing; unrolled WRITES into fresh + existing
//               O; read-scan + fromCharCode-only isolation rows. THE key
//               lever: if constant-offset reads hit the engine IC fast path,
//               the wire floor collapses and every native lane beats the
//               builtin. Sizes: 8192 (reps 9) / 32768 (reps 3).
//   base2048  — 3-char base-2048 wire vs 4-char byte+1 (pack+unpack only,
//               JSX-side delta; the DLL decode change is held pending this).
//   chunked   — 16k-elem chunked pack wedge safety + superlinear-reset check
//               at 64k/128k/256k + builtin sort/reverse/join at the safe
//               sizes. NEVER single-loop packs >= 48k.
//   bigsort   — the crossing hunt: chunked pack -> DLL sort/reverse/join ->
//               chunked unpack vs the engine builtin at 64k/128k. sort stays
//               SINGLE-call (one arrSort on the whole payload).
//   pipe      — pack-once amortization @32k: engine pipe vs pipe-packonce
//               vs per-call ESARR-gated pipe + gated-sort-full + pack/unpack
//               components (the public ESARR.pack/unpack cost table).
//
// Methodology (round-1 contract): primed $.hiresTimer medians, warmups,
// outlier rejection (samples <= 0 or > 1e8 us dropped). Mutating lanes time
// a fresh clone per run (pre-built pool, clone excluded from timing).
// Fixture: mixedFull (LCG seed 987654321, full int32 range) + asc.
// Every eval is file-logged; bench/architect-status.json carries resume
// markers. ONE DLL per probe (bigsort/pipe load the canonical
// ESARRArray.dll once).
//
// Instance policy: run against a FRESH disposable instance (never the
// degraded round-1 bench instance). Wedge recovery = CloseMainWindow +
// Stop-Process on that instance only. Cap 2 machine-wide.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

var ROOT = dirname(fileURLToPath(import.meta.url));      // .../bench
var PROJECT = join(ROOT, '..');
var DIST = join(PROJECT, 'dist');
var VENDOR = join(DIST, 'vendor-esarr.js');
var BENCH = ROOT;                                          // bench/
var SNAPSHOT = join(BENCH, 'vendor-esarr.snapshot.js');
var TOOL = 'C:/Program Files/Adobe/Adobe Illustrator 2026/Presets/en_US/Scripts/agent-skills/illustrator-com-automation-skill/comtool/ILLUSTRATOR_COM_TOOL.py';
var DLL = 'C:/Program Files/Adobe/Adobe Illustrator 2026/Presets/en_US/Scripts/esarr/native/bin/ESARRArray.dll';
var DLL_NAME = 'ESARRArray.dll';
var DLL_DIR = 'C:/Program Files/Adobe/Adobe Illustrator 2026/Presets/en_US/Scripts/esarr/native/bin';

// ---- CLI -------------------------------------------------------------------
var BATTERY = 'packvars';
var SIZES = [8192];
var FORCE = false;
var GEN_ONLY = false;
var MERGE_ONLY = false;
(function () {
  var i = process.argv.indexOf('--battery');
  if (i >= 0 && process.argv[i + 1]) { BATTERY = process.argv[i + 1]; }
  i = process.argv.indexOf('--sizes');
  if (i >= 0 && process.argv[i + 1]) { SIZES = process.argv[i + 1].split(',').map(function (s) { return parseInt(s, 10); }); }
  if (process.argv.indexOf('--force') >= 0) { FORCE = true; }
  if (process.argv.indexOf('--gen-only') >= 0) { GEN_ONLY = true; }
  if (process.argv.indexOf('--merge-only') >= 0) { MERGE_ONLY = true; }
})();

var probeDir = join(process.env.TEMP || '', 'esarr-arch');
mkdirSync(probeDir, { recursive: true });

// ---- status resume markers ---------------------------------------------------
var STATUS = join(BENCH, 'architect-status.json');
function loadStatus() {
  try { return JSON.parse(readFileSync(STATUS, 'utf8')); } catch (e) { return { done: {}, started: {} }; }
}
function saveStatus(st) { writeFileSync(STATUS, JSON.stringify(st, null, 1)); }
function markDone(st, key, file) { st.done[key] = { file: file, at: new Date().toISOString() }; saveStatus(st); }
function markStarted(st, key) { st.started[key] = new Date().toISOString(); saveStatus(st); }

function repsFor(n) {
  if (n <= 8192) { return 9; }
  if (n <= 65536) { return 3; }
  if (n <= 131072) { return 3; }
  return 3;
}
function warmFor(n) {
  if (n <= 65536) { return 2; }
  if (n <= 131072) { return 1; }
  return 0; // 256k: single timed reps only — reps are minutes each
}
function timeoutFor(battery, n) {
  var base = n <= 8192 ? 150 : (n <= 32768 ? 300 : (n <= 65536 ? 540 : (n <= 131072 ? 720 : 1080)));
  if (battery === 'chunked' && n >= 262144) { return 1500; }
  if (battery === 'bigsort') { return base + 240; }
  return base;
}

// ---- pack body snippets (ES3; embedded verbatim in generated JSX) ----------
var CLS_FULL = 'typeof v !== "number" || v !== v || Math.floor(v) !== v || v < -2147483648 || v > 2147483647';
var CLS_FAST = 'v !== (v | 0)';
var BODY_BRANCH = 'var n = v < 0 ? v + 4294967296 : v; s += String.fromCharCode(((n >>> 24) & 255) + 1, ((n >>> 16) & 255) + 1, ((n >>> 8) & 255) + 1, (n & 255) + 1);';
var BODY_SHIFT = 's += String.fromCharCode(((v >>> 24) & 255) + 1, ((v >>> 16) & 255) + 1, ((v >>> 8) & 255) + 1, ((v >>> 0) & 255) + 1);';

// one pack lane: read vals[EXPR] (EXPR may be a literal-offset expr), classify
// (CLS text), pack (BODY text). The `in` guard is included ONLY when inCheck.
function lane(expr, cls, body, inCheck) {
  return 'v = vals[' + expr + ']; ' +
    (inCheck ? 'if (!(' + expr + ' in vals) || ' + cls + ') { return ""; } ' : 'if (' + cls + ') { return ""; } ') +
    body;
}

// generate a pack function of `unroll` lanes with classify cls / body / inCheck
function packFn(unroll, cls, body, inCheck) {
  var L = [];
  L.push('function (vals, len) { var s = "", k = 0, v;');
  if (unroll > 1) {
    L.push('for (k = 0; k + ' + (unroll - 1) + ' < len; k += ' + unroll + ') {');
    var i;
    for (i = 0; i < unroll; i++) { L.push(lane('k + ' + i, cls, body, inCheck)); }
    L.push('}');
    L.push('for (; k < len; k++) { ' + lane('k', cls, body, inCheck) + ' }');
  } else {
    L.push('for (k = 0; k < len; k++) { ' + lane('k', cls, body, inCheck) + ' }');
  }
  L.push('return s; }');
  return L.join('\n');
}

var UI = 'function ui(s, i) { return (((s.charCodeAt(i) - 1) << 24) | ((s.charCodeAt(i + 1) - 1) << 16) | ((s.charCodeAt(i + 2) - 1) << 8) | (s.charCodeAt(i + 3) - 1)) | 0; }';

// unpack function: `unroll` literal-offset writes into target
function unpackFn(unroll) {
  var L = [];
  L.push('function (ch, len, target) { var k = 0, i4 = 0;');
  if (unroll > 1) {
    L.push('for (k = 0; k + ' + (unroll - 1) + ' < len; k += ' + unroll + ') {');
    var i;
    for (i = 0; i < unroll; i++) { L.push('target[k + ' + i + '] = ui(ch, i4); i4 += 4;'); }
    L.push('}');
  }
  L.push('for (; k < len; k++) { target[k] = ui(ch, i4); i4 += 4; }');
  L.push('return target; }');
  return L.join('\n');
}

// base-2048 pack/unpack (3 chars/elem, units 1..2048)
function pack3Fn() {
  return 'function (vals, len) { var s = "", k, v; for (k = 0; k < len; k++) { v = vals[k]; if (v !== (v | 0)) { return ""; } s += String.fromCharCode(((v >>> 22) & 2047) + 1, ((v >>> 11) & 2047) + 1, ((v >>> 0) & 2047) + 1); } return s; }';
}
function unpack3Fn() {
  return 'function (ch, len, target) { var k = 0, i3 = 0; for (k = 0; k < len; k++) { target[k] = (((ch.charCodeAt(i3) - 1) << 22) | ((ch.charCodeAt(i3 + 1) - 1) << 11) | (ch.charCodeAt(i3 + 2) - 1)) | 0; i3 += 3; } return target; }';
}

// ---- fixture + timing preamble (ES3) -----------------------------------------
function preamble(n, reps, warm) {
  var L = [];
  L.push('#target illustrator');
  L.push('// generated by bench/architect-probes.mjs - do not edit');
  L.push('var B_N = ' + n + ';');
  L.push('var B_REPS = ' + reps + ';');
  L.push('var B_WARM = ' + warm + ';');
  L.push('function bMedian(t) { t.sort(function (a, b) { return a - b; }); return t[Math.floor(t.length / 2)]; }');
  L.push('function bTime(fn) { var i, d, t = []; try { for (i = 0; i < B_WARM; i++) { fn(); } } catch (e) { return -1; } for (i = 0; i < B_REPS; i++) { $.hiresTimer; try { fn(); d = $.hiresTimer; if (d > 0 && d < 1e8) { t[t.length] = d; } } catch (e2) { return -1; } } if (!t.length) { return -1; } return bMedian(t); }');
  L.push('function makePool(src, count) { var p = [], j; for (j = 0; j < count; j++) { p[p.length] = src.slice(0); } return { p: p, i: 0 }; }');
  L.push('function next(pool) { return pool.p[pool.i++]; }');
  L.push('var i, q;');
  L.push('var asc = []; for (i = 0; i < B_N; i++) { asc[asc.length] = i; }');
  L.push('var mSeed = 987654321; function lcg() { mSeed = (mSeed * 1103515245 + 12345) % 2147483648; return mSeed; }');
  L.push('var mixedFull = []; for (i = 0; i < B_N; i++) { mixedFull[mixedFull.length] = (lcg() * 2) - 2147483647; }');
  L.push('var rows = [];');
  L.push('function bRow(name, v, unit) { rows[rows.length] = { lane: name, v: v, u: unit }; }');
  L.push('function tRow(name, fn) { bRow(name, bTime(fn), "us"); }');
  return L;
}

function close(n, battery) {
  var L = [];
  L.push('var bReport = { engine: $.version, host: app.name + " " + app.version, sizes: [' + n + '], reps: ' + repsFor(n) + ', warm: ' + warmFor(n) + ', lane: "' + battery + '", dllOk: B_DLL_OK, rows: rows };');
  L.push('bReport;');
  return L.join('\n');
}

// ---- battery generators ------------------------------------------------------
var PACK_VARIANTS = [
  ['pack-v1', packFn(1, CLS_FULL, BODY_BRANCH, true)],
  ['pack-u4-full', packFn(4, CLS_FULL, BODY_BRANCH, true)],
  ['pack-u8-full', packFn(8, CLS_FULL, BODY_BRANCH, true)],
  ['pack-u16-full', packFn(16, CLS_FULL, BODY_BRANCH, true)],
  ['pack-u8-fast', packFn(8, CLS_FAST, BODY_BRANCH, false)],
  ['pack-u8-fastshift', packFn(8, CLS_FAST, BODY_SHIFT, false)],
  ['pack-u16-fastshift', packFn(16, CLS_FAST, BODY_SHIFT, false)]
];
var UNPACK_VARIANTS = [
  ['unpack-v1-fresh', unpackFn(1)],
  ['unpack-u8-fresh', unpackFn(8)],
  ['unpack-u16-fresh', unpackFn(16)]
];

function genPackvars(n) {
  var L = preamble(n, repsFor(n), warmFor(n));
  L.push('var B_DLL_OK = false;');
  L.push(UI);
  var i;
  for (i = 0; i < PACK_VARIANTS.length; i++) {
    L.push('var f' + i + ' = ' + PACK_VARIANTS[i][1] + ';');
    L.push('tRow("' + PACK_VARIANTS[i][0] + '", function () { var s = f' + i + '(mixedFull, B_N); if (s.length !== B_N * 4) { throw new Error("len"); } });');
  }
  // reference packed channel (must be assigned BEFORE the unpack rows run —
  // tRow invokes bTime synchronously, so a later `var packed =` would be
  // undefined inside the closures)
  L.push('var packed = f0(mixedFull, B_N);');
  L.push('bRow("packed-len", packed.length, "chars");');
  // unpack variants into fresh arrays
  for (i = 0; i < UNPACK_VARIANTS.length; i++) {
    L.push('var u' + i + ' = ' + UNPACK_VARIANTS[i][1] + ';');
    L.push('tRow("' + UNPACK_VARIANTS[i][0] + '", function () { var o = u' + i + '(packed, B_N, new Array(B_N)); if (o.length !== B_N) { throw new Error("len"); } });');
  }
  // unpack into EXISTING O (mutating-lane write cost) — separate pool per
  // variant (a shared pool is drained after the first variant's reps)
  L.push('var pO = makePool(asc, B_REPS + B_WARM);');
  L.push('var pO2 = makePool(asc, B_REPS + B_WARM);');
  L.push('var pO3 = makePool(asc, B_REPS + B_WARM);');
  L.push('var u1O = ' + unpackFn(1) + ';');
  L.push('var u8O = ' + unpackFn(8) + ';');
  L.push('var u16O = ' + unpackFn(16) + ';');
  L.push('tRow("unpack-v1-into-O", function () { var c = next(pO); u1O(packed, B_N, c); });');
  L.push('tRow("unpack-u8-into-O", function () { var c = next(pO2); u8O(packed, B_N, c); });');
  L.push('tRow("unpack-u16-into-O", function () { var c = next(pO3); u16O(packed, B_N, c); });');
  // read-scan isolation (variable vs unrolled reads)
  L.push('function readScan(vals, len) { var s = 0, q; for (q = 0; q < len; q++) { s += vals[q]; } return s; }');
  L.push('function readScanU8(vals, len) { var s = 0, q; for (q = 0; q + 7 < len; q += 8) { s += vals[q] + vals[q + 1] + vals[q + 2] + vals[q + 3] + vals[q + 4] + vals[q + 5] + vals[q + 6] + vals[q + 7]; } for (; q < len; q++) { s += vals[q]; } return s; }');
  L.push('tRow("read-scan", function () { readScan(mixedFull, B_N); });');
  L.push('tRow("read-scan-u8", function () { readScanU8(mixedFull, B_N); });');
  // fromCharCode-only isolation (concat cost without reads)
  L.push('function fccOnly(len) { var s = "", k; for (k = 0; k < len; k++) { s += String.fromCharCode(1, 2, 3, 4); } return s; }');
  L.push('function fcc3Only(len) { var s = "", k; for (k = 0; k < len; k++) { s += String.fromCharCode(1, 2, 3); } return s; }');
  L.push('tRow("fcc-4arg", function () { fccOnly(B_N); });');
  L.push('tRow("fcc-3arg", function () { fcc3Only(B_N); });');
  // reference packed channel (for unpack rows + correctness self-check)
  L.push('var fv = f1;');  // pack-v1
  L.push('var packed = fv(mixedFull, B_N);');
  L.push('bRow("packed-len-2", packed.length, "chars");');
  // correctness cross-check: unpack-u8 result must equal the source (v1 pack of the same src)
  L.push('var chk = u8O(packed, B_N, new Array(B_N)); var same = true; for (q = 0; q < B_N; q++) { if (chk[q] !== mixedFull[q]) { same = false; } } bRow("correct-u8-rt", same ? 1 : 0, "bool");');
  L.push(close(n, 'packvars'));
  return L.join('\n');
}

function genBase2048(n) {
  var L = preamble(n, repsFor(n), warmFor(n));
  L.push('var B_DLL_OK = false;');
  L.push(UI);
  L.push('var p4 = ' + packFn(1, CLS_FAST, BODY_SHIFT, false) + ';');
  L.push('var p3 = ' + pack3Fn() + ';');
  L.push('var u4 = ' + unpackFn(1) + ';');
  L.push('var u3 = ' + unpack3Fn() + ';');
  L.push('tRow("pack4-fastshift", function () { var s = p4(mixedFull, B_N); if (s.length !== B_N * 4) { throw new Error("len"); } });');
  L.push('tRow("pack3-fastshift", function () { var s = p3(mixedFull, B_N); if (s.length !== B_N * 3) { throw new Error("len"); } });');
  L.push('var packed4 = p4(mixedFull, B_N);');
  L.push('var packed3 = p3(mixedFull, B_N);');
  L.push('bRow("packed4-len", packed4.length, "chars");');
  L.push('bRow("packed3-len", packed3.length, "chars");');
  L.push('tRow("unpack4-fresh", function () { u4(packed4, B_N, new Array(B_N)); });');
  L.push('tRow("unpack3-fresh", function () { u3(packed3, B_N, new Array(B_N)); });');
  L.push('var pO4 = makePool(asc, B_REPS + B_WARM);');
  L.push('var pO3 = makePool(asc, B_REPS + B_WARM);');
  L.push('tRow("unpack4-into-O", function () { u4(packed4, B_N, next(pO4)); });');
  L.push('tRow("unpack3-into-O", function () { u3(packed3, B_N, next(pO3)); });');
  // correctness: 3-char round trip must equal source
  L.push('var chk = u3(packed3, B_N, new Array(B_N)); var same = true; for (q = 0; q < B_N; q++) { if (chk[q] !== mixedFull[q]) { same = false; } } bRow("correct-3char-rt", same ? 1 : 0, "bool");');
  L.push(close(n, 'base2048'));
  return L.join('\n');
}

function genChunked(n) {
  var L = preamble(n, repsFor(n), warmFor(n));
  L.push('var B_DLL_OK = false;');
  // chunked pack: 16k-elem bounded loops; v1-inner and u8-fastshift-inner
  L.push('function packChunked(vals, len, chunk, inner) { var s = "", base, end, k, v; for (base = 0; base < len; base += chunk) { end = base + chunk; if (end > len) { end = len; } if (inner === 8) { for (k = base; k + 7 < end; k += 8) { v = vals[k]; if (v !== (v | 0)) { return ""; } s += String.fromCharCode(((v >>> 24) & 255) + 1, ((v >>> 16) & 255) + 1, ((v >>> 8) & 255) + 1, ((v >>> 0) & 255) + 1); v = vals[k + 1]; if (v !== (v | 0)) { return ""; } s += String.fromCharCode(((v >>> 24) & 255) + 1, ((v >>> 16) & 255) + 1, ((v >>> 8) & 255) + 1, ((v >>> 0) & 255) + 1); v = vals[k + 2]; if (v !== (v | 0)) { return ""; } s += String.fromCharCode(((v >>> 24) & 255) + 1, ((v >>> 16) & 255) + 1, ((v >>> 8) & 255) + 1, ((v >>> 0) & 255) + 1); v = vals[k + 3]; if (v !== (v | 0)) { return ""; } s += String.fromCharCode(((v >>> 24) & 255) + 1, ((v >>> 16) & 255) + 1, ((v >>> 8) & 255) + 1, ((v >>> 0) & 255) + 1); v = vals[k + 4]; if (v !== (v | 0)) { return ""; } s += String.fromCharCode(((v >>> 24) & 255) + 1, ((v >>> 16) & 255) + 1, ((v >>> 8) & 255) + 1, ((v >>> 0) & 255) + 1); v = vals[k + 5]; if (v !== (v | 0)) { return ""; } s += String.fromCharCode(((v >>> 24) & 255) + 1, ((v >>> 16) & 255) + 1, ((v >>> 8) & 255) + 1, ((v >>> 0) & 255) + 1); v = vals[k + 6]; if (v !== (v | 0)) { return ""; } s += String.fromCharCode(((v >>> 24) & 255) + 1, ((v >>> 16) & 255) + 1, ((v >>> 8) & 255) + 1, ((v >>> 0) & 255) + 1); v = vals[k + 7]; if (v !== (v | 0)) { return ""; } s += String.fromCharCode(((v >>> 24) & 255) + 1, ((v >>> 16) & 255) + 1, ((v >>> 8) & 255) + 1, ((v >>> 0) & 255) + 1); } for (; k < end; k++) { v = vals[k]; if (v !== (v | 0)) { return ""; } s += String.fromCharCode(((v >>> 24) & 255) + 1, ((v >>> 16) & 255) + 1, ((v >>> 8) & 255) + 1, ((v >>> 0) & 255) + 1); } } else { for (k = base; k < end; k++) { v = vals[k]; if (v !== (v | 0)) { return ""; } s += String.fromCharCode(((v >>> 24) & 255) + 1, ((v >>> 16) & 255) + 1, ((v >>> 8) & 255) + 1, ((v >>> 0) & 255) + 1); } } } return s; }');
  L.push('tRow("pack-chunked-16k", function () { var s = packChunked(mixedFull, B_N, 16384, 1); if (s.length !== B_N * 4) { throw new Error("len"); } });');
  L.push('tRow("pack-chunked-16k-u8", function () { var s = packChunked(mixedFull, B_N, 16384, 8); if (s.length !== B_N * 4) { throw new Error("len"); } });');
  L.push('tRow("pack-chunked-8k", function () { var s = packChunked(mixedFull, B_N, 8192, 1); if (s.length !== B_N * 4) { throw new Error("len"); } });');
  // builtin lanes at this size (the builtin side of the crossing table)
  L.push('var pS = makePool(mixedFull, B_REPS + B_WARM);');
  L.push('var pR = makePool(mixedFull, B_REPS + B_WARM);');
  L.push('tRow("builtin-sort", function () { var c = next(pS); c.sort(); });');
  L.push('tRow("builtin-reverse", function () { var c = next(pR); c.reverse(); });');
  L.push('tRow("builtin-join", function () { mixedFull.join(","); });');
  // wedge-safety self-check: packed channel must be fully materialized
  L.push('var wc = packChunked(mixedFull, B_N, 16384, 8);');
  L.push('bRow("wedge-safe-materialized", wc.length, "chars");');
  L.push('bRow("wedge-safe-ok", wc.length === B_N * 4 ? 1 : 0, "bool");');
  L.push(close(n, 'chunked'));
  return L.join('\n');
}

function genBigsort(n) {
  var L = preamble(n, repsFor(n), warmFor(n));
  L.push('var B_DLL_OK = false;');
  L.push('var lib = null; try { lib = new ExternalObject("lib:' + DLL.replace(/\\/g, '/') + '"); } catch (e) { lib = null; }');
  L.push('var libOk = lib !== null && Number(lib.ping(0)) === 42;');
  L.push('B_DLL_OK = libOk;');
  // chunked pack helpers (v1-inner and u8-fastshift-inner) + unpack helpers
  L.push('function packC(vals, len) { var s = "", base, end, k, v; for (base = 0; base < len; base += 16384) { end = base + 16384; if (end > len) { end = len; } for (k = base; k < end; k++) { v = vals[k]; if (v !== (v | 0)) { return ""; } s += String.fromCharCode(((v >>> 24) & 255) + 1, ((v >>> 16) & 255) + 1, ((v >>> 8) & 255) + 1, ((v >>> 0) & 255) + 1); } } return s; }');
  L.push('function packCU8(vals, len) { var s = "", base, end, k, v; for (base = 0; base < len; base += 16384) { end = base + 16384; if (end > len) { end = len; } for (k = base; k + 7 < end; k += 8) { v = vals[k]; if (v !== (v | 0)) { return ""; } s += String.fromCharCode(((v >>> 24) & 255) + 1, ((v >>> 16) & 255) + 1, ((v >>> 8) & 255) + 1, ((v >>> 0) & 255) + 1); v = vals[k + 1]; if (v !== (v | 0)) { return ""; } s += String.fromCharCode(((v >>> 24) & 255) + 1, ((v >>> 16) & 255) + 1, ((v >>> 8) & 255) + 1, ((v >>> 0) & 255) + 1); v = vals[k + 2]; if (v !== (v | 0)) { return ""; } s += String.fromCharCode(((v >>> 24) & 255) + 1, ((v >>> 16) & 255) + 1, ((v >>> 8) & 255) + 1, ((v >>> 0) & 255) + 1); v = vals[k + 3]; if (v !== (v | 0)) { return ""; } s += String.fromCharCode(((v >>> 24) & 255) + 1, ((v >>> 16) & 255) + 1, ((v >>> 8) & 255) + 1, ((v >>> 0) & 255) + 1); v = vals[k + 4]; if (v !== (v | 0)) { return ""; } s += String.fromCharCode(((v >>> 24) & 255) + 1, ((v >>> 16) & 255) + 1, ((v >>> 8) & 255) + 1, ((v >>> 0) & 255) + 1); v = vals[k + 5]; if (v !== (v | 0)) { return ""; } s += String.fromCharCode(((v >>> 24) & 255) + 1, ((v >>> 16) & 255) + 1, ((v >>> 8) & 255) + 1, ((v >>> 0) & 255) + 1); v = vals[k + 6]; if (v !== (v | 0)) { return ""; } s += String.fromCharCode(((v >>> 24) & 255) + 1, ((v >>> 16) & 255) + 1, ((v >>> 8) & 255) + 1, ((v >>> 0) & 255) + 1); v = vals[k + 7]; if (v !== (v | 0)) { return ""; } s += String.fromCharCode(((v >>> 24) & 255) + 1, ((v >>> 16) & 255) + 1, ((v >>> 8) & 255) + 1, ((v >>> 0) & 255) + 1); } for (; k < end; k++) { v = vals[k]; if (v !== (v | 0)) { return ""; } s += String.fromCharCode(((v >>> 24) & 255) + 1, ((v >>> 16) & 255) + 1, ((v >>> 8) & 255) + 1, ((v >>> 0) & 255) + 1); } } return s; }');
  L.push(UI);
  L.push('function unpackC(ch, len, target) { var k = 0, i4 = 0; for (k = 0; k + 7 < len; k += 8) { target[k] = ui(ch, i4); i4 += 4; target[k + 1] = ui(ch, i4); i4 += 4; target[k + 2] = ui(ch, i4); i4 += 4; target[k + 3] = ui(ch, i4); i4 += 4; target[k + 4] = ui(ch, i4); i4 += 4; target[k + 5] = ui(ch, i4); i4 += 4; target[k + 6] = ui(ch, i4); i4 += 4; target[k + 7] = ui(ch, i4); i4 += 4; } for (; k < len; k++) { target[k] = ui(ch, i4); i4 += 4; } return target; }');
  // builtin side
  L.push('var pS = makePool(mixedFull, B_REPS + B_WARM);');
  L.push('var pR = makePool(mixedFull, B_REPS + B_WARM);');
  L.push('tRow("builtin-sort", function () { var c = next(pS); c.sort(); });');
  L.push('tRow("builtin-reverse", function () { var c = next(pR); c.reverse(); });');
  L.push('tRow("builtin-join", function () { mixedFull.join(","); });');
  // native side: chunked pack (v1 and u8) + single-call DLL op + unpack into O
  L.push('if (libOk) {');
  L.push('  var pN1 = makePool(mixedFull, B_REPS + B_WARM);');
  L.push('  var pN2 = makePool(mixedFull, B_REPS + B_WARM);');
  L.push('  var pN3 = makePool(mixedFull, B_REPS + B_WARM);');
  L.push('  var pN4 = makePool(mixedFull, B_REPS + B_WARM);');
  L.push('  tRow("native-sort-v1", function () { var c = next(pN1); var p = packC(c, B_N); var o = lib.arrSort(p, B_N); if (typeof o !== "string") { throw new Error("op"); } unpackC(o, B_N, c); });');
  L.push('  tRow("native-sort-u8", function () { var c = next(pN2); var p = packCU8(c, B_N); var o = lib.arrSort(p, B_N); if (typeof o !== "string") { throw new Error("op"); } unpackC(o, B_N, c); });');
  L.push('  tRow("native-reverse-v1", function () { var c = next(pN3); var p = packC(c, B_N); var o = lib.arrReverse(p, B_N); if (typeof o !== "string") { throw new Error("op"); } unpackC(o, B_N, c); });');
  L.push('  tRow("native-reverse-u8", function () { var c = next(pN4); var p = packCU8(c, B_N); var o = lib.arrReverse(p, B_N); if (typeof o !== "string") { throw new Error("op"); } unpackC(o, B_N, c); });');
  L.push('  tRow("native-join-v1", function () { var p = packC(mixedFull, B_N); lib.arrJoin(p, B_N, ","); });');
  L.push('  tRow("native-join-u8", function () { var p = packCU8(mixedFull, B_N); lib.arrJoin(p, B_N, ","); });');
  // op-only on pre-packed (wire floor removed)
  L.push('  var prep = packCU8(mixedFull, B_N);');
  L.push('  tRow("native-sort-op", function () { lib.arrSort(prep, B_N); });');
  L.push('  tRow("native-reverse-op", function () { lib.arrReverse(prep, B_N); });');
  L.push('  tRow("native-join-op", function () { lib.arrJoin(prep, B_N, ","); });');
  L.push('  // correctness self-check: native sort of a small known array');
  L.push('  var t1 = [10, 9, 1, 2]; var p1 = packC(t1, 4); var o1 = unpackC(lib.arrSort(p1, 4), 4, new Array(4));');
  L.push('  bRow("correct-native-sort", (o1[0] === 1 && o1[1] === 10 && o1[2] === 2 && o1[3] === 9) ? 1 : 0, "bool");');
  L.push('  bRow("dll-version", String(lib.version(0)), "str");');
  L.push('} else {');
  L.push('  bRow("dll-load-fail", 1, "bool");');
  L.push('}');
  L.push(close(n, 'bigsort'));
  return L.join('\n');
}

function genPipe(n) {
  var L = preamble(n, repsFor(n), warmFor(n));
  L.push('var B_DLL_OK = false;');
  // load the vendored ESARR from the SNAPSHOT (decoupled from peer rebuilds)
  L.push('$.evalFile(File("' + SNAPSHOT.replace(/\\/g, '/') + '"));');
  L.push('var lib = null; try { lib = new ExternalObject("lib:' + DLL.replace(/\\/g, '/') + '"); } catch (e) { lib = null; }');
  L.push('var libOk = lib !== null && Number(lib.ping(0)) === 42;');
  L.push('B_DLL_OK = libOk;');
  // wire helpers (lane-wire replica: byte+1, v1)
  L.push('function packInt32(v) { var n = v < 0 ? v + 4294967296 : v; return String.fromCharCode(((n >>> 24) & 255) + 1, ((n >>> 16) & 255) + 1, ((n >>> 8) & 255) + 1, (n & 255) + 1); }');
  L.push('function packArray(vals, len) { var s = "", i; for (i = 0; i < len; i++) { s += packInt32(vals[i]); } return s; }');
  L.push(UI);
  L.push('function unpackArray(s, len) { var out = new Array(len), i; for (i = 0; i < len; i++) { out[i] = ui(s, i * 4); } return out; }');
  // engine pipe vs pack-once pipe vs per-call
  L.push('var pE = makePool(mixedFull, B_REPS + B_WARM);');
  L.push('var pP = makePool(mixedFull, B_REPS + B_WARM);');
  L.push('tRow("pipe-engine", function () { var c = next(pE); c.sort(); c.reverse(); c.join(","); });');
  L.push('if (libOk) {');
  L.push('  tRow("pipe-packonce", function () { var c = next(pP); var p = packArray(c, B_N); var s1 = lib.arrSort(p, B_N); var s2 = lib.arrReverse(p, B_N); var j = lib.arrJoin(p, B_N, ","); var out = unpackArray(s1, B_N); });');
  L.push('  tRow("pack-only", function () { packArray(mixedFull, B_N); });');
  L.push('  var packed = packArray(mixedFull, B_N);');
  L.push('  tRow("unpack-only", function () { unpackArray(packed, B_N); });');
  L.push('  tRow("native-sort-op", function () { lib.arrSort(packed, B_N); });');
  L.push('  tRow("native-reverse-op", function () { lib.arrReverse(packed, B_N); });');
  L.push('  tRow("native-join-op", function () { lib.arrJoin(packed, B_N, ","); });');
  // per-call ESARR-gated pipe (3 separate packs via the real dispatch)
  L.push('  var capsOn = ESARR.enableNativeGate({ lib: lib, dllPath: "' + DLL.replace(/\\/g, '/') + '" });');
  L.push('  ESARR.setBands({ sort: [1, 48000], toSorted: [1, 48000], reverse: [1, 48000], toReversed: [1, 48000], join: [1, 48000] });');
  L.push('  var gateOn = !!(capsOn && capsOn.enabled);');
  L.push('  bRow("gate-on", gateOn ? 1 : 0, "bool");');
  L.push('  var pC = makePool(mixedFull, B_REPS + B_WARM);');
  L.push('  var pG = makePool(mixedFull, B_REPS + B_WARM);');
  L.push('  tRow("pipe-percall", function () { var c = next(pC); ESARR.sort(c); ESARR.reverse(c); ESARR.join(c, ","); });');
  L.push('  tRow("gated-sort-full", function () { var c = next(pG); ESARR.sort(c); });');
  L.push('}');
  L.push('bRow("dll-ok", libOk ? 1 : 0, "bool");');
  L.push(close(n, 'pipe'));
  return L.join('\n');
}

function genBoundaryNative(n) {
  // FRANKENSTEIN ROUTER gap: small-n boundary sweep, gate ON — the REAL
  // shipped dispatch (round-1 code) vs the engine builtin. Sets the router's
  // per-lane small-n thresholds. Separate pools per lane.
  var L = preamble(n, repsFor(n), warmFor(n));
  L.push('var B_DLL_OK = false;');
  L.push('$.evalFile(File("' + SNAPSHOT.replace(/\\/g, '/') + '"));');
  L.push('var capsOn = ESARR.enableNativeGate({ dir: "' + DLL_DIR.replace(/\\/g, '/') + '", libName: "' + DLL_NAME.replace(/\.dll$/i, '') + '" });');
  L.push('ESARR.setBands({ sort: [1, 48000], toSorted: [1, 48000], reverse: [1, 48000], toReversed: [1, 48000], join: [1, 48000] });');
  L.push('var gateOn = !!(capsOn && capsOn.enabled);');
  L.push('bRow("gate-on", gateOn ? 1 : 0, "bool");');
  L.push('B_DLL_OK = gateOn;');
  L.push('var pBs = makePool(mixedFull, B_REPS + B_WARM);');
  L.push('var pBr = makePool(mixedFull, B_REPS + B_WARM);');
  L.push('var pNs = makePool(mixedFull, B_REPS + B_WARM);');
  L.push('var pNr = makePool(mixedFull, B_REPS + B_WARM);');
  L.push('tRow("builtin-sort", function () { var c = next(pBs); c.sort(); });');
  L.push('tRow("builtin-reverse", function () { var c = next(pBr); c.reverse(); });');
  L.push('tRow("builtin-join", function () { mixedFull.join(","); });');
  L.push('tRow("native-sort", function () { var c = next(pNs); ESARR.sort(c); });');
  L.push('tRow("native-reverse", function () { var c = next(pNr); ESARR.reverse(c); });');
  L.push('tRow("native-join", function () { ESARR.join(mixedFull, ","); });');
  L.push(close(n, 'boundary-native'));
  return L.join('\n');
}

function genBoundaryJsx(n) {
  // small-n sweep, gate OFF — the pure-JSX ESARR fallback (what the router
  // routes to when the DLL/native lane is disengaged at small n).
  var L = preamble(n, repsFor(n), warmFor(n));
  L.push('var B_DLL_OK = false;');
  L.push('$.evalFile(File("' + SNAPSHOT.replace(/\\/g, '/') + '"));');
  L.push('ESARR.disableNativeGate();');
  L.push('var pJs = makePool(mixedFull, B_REPS + B_WARM);');
  L.push('var pJr = makePool(mixedFull, B_REPS + B_WARM);');
  L.push('tRow("jsx-sort", function () { var c = next(pJs); ESARR.sort(c); });');
  L.push('tRow("jsx-reverse", function () { var c = next(pJr); ESARR.reverse(c); });');
  L.push('tRow("jsx-join", function () { ESARR.join(mixedFull, ","); });');
  L.push(close(n, 'boundary-jsx'));
  return L.join('\n');
}

function genScan(n) {
  // FRANKENSTEIN ROUTER gap: packed-payload scan lanes at scale. The router
  // routes indexOf-family to the DLL scan ONLY when the payload is already a
  // packed string (pack-once regime); on a raw array the up-front pack kills
  // short-circuit (round-1 verdict). Measures the DLL scan (miss/hit-first/
  // hit-last, indexOf/lastIndexOf/includes) vs the JSX scan, + the pack cost
  // (the amortization threshold). Guaranteed-miss value computed at setup.
  var L = preamble(n, repsFor(n), warmFor(n));
  L.push('var B_DLL_OK = false;');
  L.push('$.evalFile(File("' + SNAPSHOT.replace(/\\/g, '/') + '"));');
  L.push('ESARR.disableNativeGate();');
  L.push('var lib = null; try { lib = new ExternalObject("lib:' + DLL.replace(/\\/g, '/') + '"); } catch (e) { lib = null; }');
  L.push('var libOk = lib !== null && Number(lib.ping(0)) === 42;');
  L.push('B_DLL_OK = libOk;');
  L.push('function packInt32(v) { var n = v < 0 ? v + 4294967296 : v; return String.fromCharCode(((n >>> 24) & 255) + 1, ((n >>> 16) & 255) + 1, ((n >>> 8) & 255) + 1, (n & 255) + 1); }');
  L.push('function packArray(vals, len) { var s = "", i; for (i = 0; i < len; i++) { s += packInt32(vals[i]); } return s; }');
  L.push('var packed = packArray(mixedFull, B_N);');
  // guaranteed-miss search value (setup scan, once)
  L.push('var miss = 2147483647; while (ESARR.indexOf(mixedFull, miss) >= 0) { miss--; }');
  L.push('bRow("miss-value", miss, "int");');
  L.push('tRow("jsx-indexOf-miss", function () { ESARR.indexOf(mixedFull, miss); });');
  L.push('tRow("jsx-indexOf-hitfirst", function () { ESARR.indexOf(mixedFull, mixedFull[0]); });');
  L.push('tRow("jsx-indexOf-hitlast", function () { ESARR.indexOf(mixedFull, mixedFull[B_N - 1]); });');
  L.push('tRow("jsx-lastIndexOf-miss", function () { ESARR.lastIndexOf(mixedFull, miss); });');
  L.push('tRow("jsx-includes-miss", function () { ESARR.includes(mixedFull, miss); });');
  L.push('tRow("pack-only", function () { packArray(mixedFull, B_N); });');
  L.push('if (libOk) {');
  L.push('  tRow("packscan-indexOf-miss", function () { lib.arrIndexOf(packed, B_N, miss); });');
  L.push('  tRow("packscan-indexOf-hitfirst", function () { lib.arrIndexOf(packed, B_N, mixedFull[0]); });');
  L.push('  tRow("packscan-indexOf-hitlast", function () { lib.arrIndexOf(packed, B_N, mixedFull[B_N - 1]); });');
  L.push('  tRow("packscan-lastIndexOf-miss", function () { lib.arrLastIndexOf(packed, B_N, miss); });');
  L.push('  tRow("packscan-includes-miss", function () { lib.arrIncludes(packed, B_N, miss); });');
  L.push('  tRow("packscan-includes-hitfirst", function () { lib.arrIncludes(packed, B_N, mixedFull[0]); });');
  L.push('  // correctness: scan results must agree with the JSX authority');
  L.push('  bRow("correct-idx", lib.arrIndexOf(packed, B_N, mixedFull[0]) === 0 ? 1 : 0, "bool");');
  L.push('  bRow("correct-idx-last", lib.arrLastIndexOf(packed, B_N, miss) === -1 ? 1 : 0, "bool");');
  L.push('  bRow("correct-includes", lib.arrIncludes(packed, B_N, mixedFull[B_N - 1]) === 1 ? 1 : 0, "bool");');
  L.push('} else { bRow("dll-load-fail", 1, "bool"); }');
  L.push(close(n, 'scan'));
  return L.join('\n');
}

function genPipeband(n) {
  // FRANKENSTEIN ROUTER gap: packRun chains vs the engine pipe at EVERY size
  // band (2k/4k here + 8k/16k/32k from round-1/B5 + 48k chunked). packArray
  // is CHUNKED (16k loops) so 48k is wedge-safe — matches the API design.
  var L = preamble(n, repsFor(n), warmFor(n));
  L.push('var B_DLL_OK = false;');
  L.push('$.evalFile(File("' + SNAPSHOT.replace(/\\/g, '/') + '"));');
  L.push('var lib = null; try { lib = new ExternalObject("lib:' + DLL.replace(/\\/g, '/') + '"); } catch (e) { lib = null; }');
  L.push('var libOk = lib !== null && Number(lib.ping(0)) === 42;');
  L.push('B_DLL_OK = libOk;');
  L.push('function packInt32(v) { var n = v < 0 ? v + 4294967296 : v; return String.fromCharCode(((n >>> 24) & 255) + 1, ((n >>> 16) & 255) + 1, ((n >>> 8) & 255) + 1, (n & 255) + 1); }');
  L.push('function packArrayChunked(vals, len) { var s = "", base, end, k, v; for (base = 0; base < len; base += 16384) { end = base + 16384; if (end > len) { end = len; } for (k = base; k < end; k++) { v = vals[k]; s += packInt32(v); } } return s; }');
  L.push(UI);
  L.push('function unpackArray(s, len) { var out = new Array(len), i; for (i = 0; i < len; i++) { out[i] = ui(s, i * 4); } return out; }');
  L.push('var pE = makePool(mixedFull, B_REPS + B_WARM);');
  L.push('var pP = makePool(mixedFull, B_REPS + B_WARM);');
  L.push('tRow("pipe-engine", function () { var c = next(pE); c.sort(); c.reverse(); c.join(","); });');
  L.push('if (libOk) {');
  L.push('  tRow("pipe-packonce", function () { var c = next(pP); var p = packArrayChunked(c, B_N); var s1 = lib.arrSort(p, B_N); var s2 = lib.arrReverse(p, B_N); var j = lib.arrJoin(p, B_N, ","); var out = unpackArray(s1, B_N); });');
  L.push('  var capsOn = ESARR.enableNativeGate({ lib: lib, dllPath: "' + DLL.replace(/\\/g, '/') + '" });');
  L.push('  ESARR.setBands({ sort: [1, 48000], toSorted: [1, 48000], reverse: [1, 48000], toReversed: [1, 48000], join: [1, 48000] });');
  L.push('  var pC = makePool(mixedFull, B_REPS + B_WARM);');
  L.push('  tRow("pipe-percall", function () { var c = next(pC); ESARR.sort(c); ESARR.reverse(c); ESARR.join(c, ","); });');
  L.push('}');
  L.push('bRow("dll-ok", libOk ? 1 : 0, "bool");');
  L.push(close(n, 'pipeband'));
  return L.join('\n');
}

function genPayloads2(n) {
  // FRANKENSTEIN ROUTER gap: array-like {length:n} payloads through the
  // native lanes vs the engine (ES5.1 ToObject) + string-payload classify
  // behavior (the lane must classify OUT non-int32 element stores, and
  // strings are array-likes).
  var L = preamble(n, repsFor(n), warmFor(n));
  L.push('var B_DLL_OK = false;');
  L.push('$.evalFile(File("' + SNAPSHOT.replace(/\\/g, '/') + '"));');
  L.push('var like = { length: B_N }; for (i = 0; i < B_N; i++) { like[i] = B_N - 1 - i; }');
  L.push('function likePool(src, count) { var p = [], j, o, k; for (j = 0; j < count; j++) { o = { length: B_N }; for (k = 0; k < B_N; k++) { o[k] = src[k]; } p[p.length] = o; } return { p: p, i: 0 }; }');
  L.push('var capsOn = ESARR.enableNativeGate({ dir: "' + DLL_DIR.replace(/\\/g, '/') + '", libName: "' + DLL_NAME.replace(/\.dll$/i, '') + '" });');
  L.push('ESARR.setBands({ sort: [1, 48000], toSorted: [1, 48000], reverse: [1, 48000], toReversed: [1, 48000], join: [1, 48000] });');
  L.push('var gateOn = !!(capsOn && capsOn.enabled);');
  L.push('bRow("gate-on", gateOn ? 1 : 0, "bool");');
  L.push('B_DLL_OK = gateOn;');
  L.push('var pLb1 = likePool(like, B_REPS + B_WARM);');
  L.push('var pLb2 = likePool(like, B_REPS + B_WARM);');
  L.push('var pLb3 = likePool(like, B_REPS + B_WARM);');
  L.push('var pLn1 = likePool(like, B_REPS + B_WARM);');
  L.push('var pLn2 = likePool(like, B_REPS + B_WARM);');
  L.push('var pLn3 = likePool(like, B_REPS + B_WARM);');
  L.push('tRow("like-sort-builtin", function () { Array.prototype.sort.call(next(pLb1)); });');
  L.push('tRow("like-reverse-builtin", function () { Array.prototype.reverse.call(next(pLb2)); });');
  L.push('tRow("like-join-builtin", function () { Array.prototype.join.call(like, ","); });');
  L.push('tRow("like-sort-native", function () { ESARR.sort(next(pLn1)); });');
  L.push('tRow("like-reverse-native", function () { ESARR.reverse(next(pLn2)); });');
  L.push('tRow("like-join-native", function () { ESARR.join(like, ","); });');
  // string payload: a string is an array-like; the lane packs its charCodes
  // (int32) — but join/sort on a STRING would mutate a String object. Check
  // classify OUT (JSX fallback) for the mutating lanes, and the read path for
  // join (which must NOT be engaged on a string — spec: join(ToObject) reads
  // charCodes, which ARE int32, so the lane COULD ride — measure it).
  L.push('var str = ""; for (i = 0; i < B_N; i++) { str += String.fromCharCode((i % 200) + 1); }');
  L.push('tRow("str-join-builtin", function () { str.split("").join(","); });');
  L.push('tRow("str-join-gated", function () { ESARR.join(str, ","); });');
  L.push('bRow("str-sort-classify", (function () { var s2 = str; ESARR.sort(s2); return typeof s2 === "string" ? 1 : 0; })(), "bool");');
  L.push(close(n, 'payloads2'));
  return L.join('\n');
}

var GENERATORS = {
  packvars: genPackvars,
  base2048: genBase2048,
  chunked: genChunked,
  bigsort: genBigsort,
  pipe: genPipe,
  'boundary-native': genBoundaryNative,
  'boundary-jsx': genBoundaryJsx,
  scan: genScan,
  pipeband: genPipeband,
  payloads2: genPayloads2
};

// ---- COM runner (mirrors round-1) --------------------------------------------
function runProbe(probePath, label, timeoutSec) {
  console.log('arch: ' + label + '...');
  var pyOut;
  try {
    pyOut = execFileSync('python', [TOOL, 'eval', '--file', probePath.replace(/\\/g, '/'),
      '--timeout', String(timeoutSec)], {
      encoding: 'utf8', timeout: (timeoutSec + 120) * 1000, maxBuffer: 128 * 1024 * 1024
    });
  } catch (e) {
    console.error('arch: COM tool failed for ' + label + ': ' + String((e.stdout || e.message) + '').slice(0, 3000));
    return null;
  }
  var env;
  try { env = JSON.parse(pyOut.trim()); } catch (e) {
    console.error('arch: tool output not JSON for ' + label + ': ' + pyOut.slice(0, 500));
    return null;
  }
  if (!env.ok) {
    console.error('arch: tool/engine error for ' + label + ': ' + JSON.stringify(env).slice(0, 2000));
    return null;
  }
  var res = env.result;
  if (res && typeof res === 'object' && !res.rows && res.result && typeof res.result === 'object') {
    res = res.result;
  }
  if (res && typeof res === 'object' && res.path && res.bytes && res._note) {
    res = JSON.parse(readFileSync(res.path, 'utf8'));
  }
  if (!res || !res.rows) {
    console.error('arch: unexpected result shape for ' + label + ': ' + JSON.stringify(env).slice(0, 1500));
    return null;
  }
  return res;
}

// ---- run ----------------------------------------------------------------------
if (MERGE_ONLY) {
  var st = loadStatus();
  var reports = [];
  for (var k in st.done) {
    try {
      var rep = JSON.parse(readFileSync(join(BENCH, st.done[k].file), 'utf8'));
      if (rep && !rep.rows && rep.result && rep.result.rows) { rep = rep.result; }
      if (rep && rep.rows) { reports[reports.length] = rep; }
    } catch (e) { console.error('arch: skipping bad raw ' + st.done[k].file); }
  }
  console.log('arch: merge-only loaded ' + reports.length + ' reports');
  for (var r = 0; r < reports.length; r++) {
    var rep = reports[r];
    console.log('--- ' + rep.lane + ' @' + rep.sizes[0] + ' (reps ' + rep.reps + ' warm ' + rep.warm + ') host ' + rep.host + ' ---');
    for (var rr = 0; rr < rep.rows.length; rr++) {
      var row = rep.rows[rr];
      var vs = row.u === 'us' ? (row.v >= 10000 ? (Math.round(row.v / 1000) + 'ms') : (Math.round(row.v) + 'us')) : (row.v + ' ' + row.u);
      console.log('  ' + row.lane + ': ' + vs);
    }
  }
  process.exit(0);
}

if (!existsSync(TOOL)) { console.error('arch: COM tool not found'); process.exit(1); }
if (!existsSync(DLL)) { console.error('arch: ESARRArray.dll not found at ' + DLL); process.exit(1); }
if (!GENERATORS[BATTERY]) { console.error('arch: unknown battery ' + BATTERY); process.exit(1); }

// pipe battery: snapshot the vendor at harness start (peer-rebuild isolation)
if (BATTERY === 'pipe') {
  if (!existsSync(VENDOR)) { console.error('arch: dist/vendor-esarr.js missing — run npm run build'); process.exit(1); }
  if (!existsSync(SNAPSHOT) || FORCE) { copyFileSync(VENDOR, SNAPSHOT); console.log('arch: vendor snapshot -> ' + SNAPSHOT); }
}

var status = loadStatus();
var collected = [];
for (var si = 0; si < SIZES.length; si++) {
  var n = SIZES[si];
  var key = BATTERY + '-' + n;
  if (!FORCE && status.done[key]) {
    console.log('arch: skip ' + key + ' (done ' + status.done[key].file + ')');
    try { collected[collected.length] = JSON.parse(readFileSync(join(BENCH, status.done[key].file), 'utf8')); } catch (e) { }
    continue;
  }
  var gen = GENERATORS[BATTERY];
  var probe = join(probeDir, 'arch-' + BATTERY + '-' + n + '.jsx');
  writeFileSync(probe, gen(n));
  if (GEN_ONLY) { console.log('arch: gen-only wrote ' + probe); continue; }
  markStarted(status, key);
  var tSec = timeoutFor(BATTERY, n);
  var r = runProbe(probe, 'battery=' + BATTERY + ' n=' + n + ' (reps ' + repsFor(n) + ' warm ' + warmFor(n) + ')', tSec);
  if (r) {
    var rawFile = 'arch-raw-' + BATTERY + '-' + n + '.json';
    writeFileSync(join(BENCH, rawFile), JSON.stringify(r, null, 1));
    markDone(status, key, rawFile);
    collected[collected.length] = r;
    console.log('arch: checkpointed ' + rawFile);
  } else {
    console.error('arch: FAILED ' + key + ' — not checkpointed (resume will retry; check the instance did not wedge)');
  }
}

console.log('arch: status markers in ' + STATUS);
