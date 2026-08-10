#!/usr/bin/env node
// gateon-differential.mjs — FINAL ACCEPTANCE: gate-on LIVE differential.
//
// On a fresh disposable Illustrator instance, loads the SHIPPED
// ESARRArray.dll (strict byte+1 lane-wire, matching the current dist), certifies
// the sort/reverse/join lanes, then runs REAL int32 payloads — including the
// WINDOW BYTES (input bytes 0xD7-0xDE -> units 216-223 under byte+1) — through
// the ESARR facade in BOTH modes:
//   JSX mode   (gate off): results computed by the pure-JSX authority
//   NATIVE mode (gate on): results computed via the DLL lanes (in-band only)
// and compares each native result byte-for-byte against (a) the JSX result and
// (b) the Node-computed oracle (Array.prototype semantics on int32).
//
// Native lanes engage ONLY in-band (sort >= 4096, reverse >= 16000, join >=
// 32000; wedge cap 48k — see native-lane.ts DEFAULT_BANDS), so the payload
// corpus is sized to sit INSIDE the bands (plus out-of-band control cases that
// must fall back to JSX). Any byte mismatch = wire reopened — the harness exits
// 1 with the exact repro.
//
// Usage: node tests/gateon-differential.mjs
// Env:   ESARR_COM_TOOL   path to ILLUSTRATOR_COM_TOOL.py (default: skill path)
//        ESARR_INSTANCE_ANNOUNCED  set to 1 after announcing on instances/active
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

var ROOT = dirname(fileURLToPath(import.meta.url));
var PROJECT = join(ROOT, '..');
var DIST = join(PROJECT, 'dist');
var VENDOR = join(DIST, 'vendor-esarr.js');
var NATIVE_BIN = join(PROJECT, 'native', 'bin').replace(/\\/g, '/');
var DLL = join(PROJECT, 'native', 'bin', 'ESARRArray.dll');
var SCRIPTS = process.env.ESARR_DEV_SCRIPTS || 'C:/Program Files/Adobe/Adobe Illustrator 2026/Presets/en_US/Scripts';
var TOOL = process.env.ESARR_COM_TOOL || SCRIPTS + '/agent-skills/illustrator-com-automation-skill/comtool/ILLUSTRATOR_COM_TOOL.py';

if (!process.env.ESARR_INSTANCE_ANNOUNCED) {
  console.error('gateon-differential: set ESARR_INSTANCE_ANNOUNCED=1 after announcing the fresh instance on blackboard instances/active (cap 2).');
  process.exit(2);
}
if (!existsSync(VENDOR)) { console.error('gateon-differential: build first — ' + VENDOR + ' missing'); process.exit(1); }
if (!existsSync(DLL)) { console.error('gateon-differential: shipped DLL missing at ' + DLL); process.exit(1); }
if (!existsSync(TOOL)) { console.error('gateon-differential: COM tool missing at ' + TOOL); process.exit(1); }

var dllBytes = readFileSync(DLL);
console.log('GATE-ON: DLL ' + DLL + ' (' + dllBytes.length + ' bytes); bands sort>=4096 reverse>=16000 join>=32000, wedge cap 48000');

// ---- deterministic PRNG (mulberry32) ----------------------------------------
function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- payload generation ------------------------------------------------------
// Window bytes: input bytes 0xD7-0xDE (215-222) map to units 0xD8-0xDF (216-223)
// under byte+1. Build int32 values that place these bytes in EVERY byte position
// (signed forms, since 0xD7<<24 exceeds int32 as a JS literal).
var WINDOW_BYTES = [];
for (var wb = 0xD7; wb <= 0xDE; wb++) { WINDOW_BYTES[WINDOW_BYTES.length] = wb; }

function signedOf(unsigned) {
  return unsigned >= 2147483648 ? unsigned - 4294967296 : unsigned;
}
function windowValues() {
  var out = [];
  var wi, bi, pi;
  for (bi = 0; bi < WINDOW_BYTES.length; bi++) {
    for (pi = 0; pi < 4; pi++) {
      var v = WINDOW_BYTES[bi] << (pi * 8);
      out[out.length] = signedOf(v >>> 0);
    }
  }
  // all-four-positions combos (units 216-223 in every unit slot)
  out[out.length] = signedOf(0xD8D8D8D8);
  out[out.length] = signedOf(0xDBDBDBDB);
  out[out.length] = signedOf(0xDFDFDFDF);
  out[out.length] = signedOf(0xD7D7D7D7);
  // interleaved with other bytes
  out[out.length] = signedOf(0xD800D800);
  out[out.length] = signedOf(0x00DF00DF);
  out[out.length] = signedOf(0xD81234D8);
  return out;
}

function genPayload(n, kind, rnd) {
  var a = new Array(n);
  var i, pick;
  var windowSet = windowValues();
  var W = windowSet.length;
  switch (kind) {
    case 'windowBytes': {
      // dense window bytes: every element carries a 0xD7-0xDE byte somewhere
      var tpl = windowSet;
      for (i = 0; i < n; i++) { a[i] = tpl[Math.floor(rnd() * W)]; }
      break;
    }
    case 'random': {
      for (i = 0; i < n; i++) { a[i] = Math.floor(rnd() * 4294967296) - 2147483648; }
      break;
    }
    case 'mixed': {
      // window bytes + random + edges interleaved
      var edgePool = [0, 1, -1, 2147483647, -2147483648, 65535, -65536, 255, -256];
      for (i = 0; i < n; i++) {
        pick = rnd();
        if (pick < 0.4) { a[i] = windowSet[Math.floor(rnd() * W)]; }
        else if (pick < 0.85) { a[i] = Math.floor(rnd() * 4294967296) - 2147483648; }
        else { a[i] = edgePool[Math.floor(rnd() * edgePool.length)]; }
      }
      break;
    }
    case 'sorted': {
      for (i = 0; i < n; i++) { a[i] = i - Math.floor(n / 2); }
      // sprinkle window bytes
      for (i = 0; i < n; i += 7) { a[i] = windowSet[i % W]; }
      break;
    }
    case 'revsorted': {
      for (i = 0; i < n; i++) { a[i] = Math.floor(n / 2) - i; }
      for (i = 0; i < n; i += 11) { a[i] = windowSet[(i * 3) % W]; }
      break;
    }
    case 'dups': {
      for (i = 0; i < n; i++) { a[i] = Math.floor(rnd() * 2001) - 1000; }
      for (i = 0; i < n; i += 5) { a[i] = windowSet[i % W]; }
      break;
    }
    case 'pow10': {
      var p10 = [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000];
      for (i = 0; i < n; i++) {
        a[i] = Math.floor(rnd() * 9 + 1) * p10[Math.floor(rnd() * p10.length)] * (rnd() < 0.5 ? -1 : 1);
      }
      for (i = 0; i < n; i += 13) { a[i] = windowSet[(i * 5) % W]; }
      break;
    }
    default: throw new Error('genPayload: unknown kind ' + kind);
  }
  return a;
}

// ---- Node oracle -------------------------------------------------------------
function oracleSort(a) { return a.slice().sort(); }
function oracleReverse(a) { return a.slice().reverse(); }
function oracleJoin(a, sep) { return a.join(sep); }

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) { if (a[i] !== b[i]) return false; }
  return true;
}

// ---- corpus plan -------------------------------------------------------------
// in-band sizes per lane; kind coverage incl. window bytes in every case
var rnd = mulberry32(0xA11CE);
var payloads = [];
function addPayload(id, n, kinds) {
  for (var ki = 0; ki < kinds.length; ki++) {
    // ids MUST be unique (the JSX/native passes are keyed by id); include size
    payloads[payloads.length] = { id: id + '-' + n + '-' + kinds[ki], n: n, kind: kinds[ki], data: genPayload(n, kinds[ki], rnd) };
  }
}
// sort band [4096, 48000]
addPayload('sort', 4096, ['windowBytes', 'mixed', 'random', 'sorted', 'revsorted', 'dups', 'pow10']);
addPayload('sort', 16384, ['windowBytes', 'mixed']);
addPayload('sort', 32768, ['windowBytes']);
// reverse band [16000, 48000]
addPayload('reverse', 16000, ['windowBytes', 'mixed', 'random', 'sorted', 'dups']);
addPayload('reverse', 32768, ['windowBytes']);
// join band [32000, 48000]
addPayload('join', 32000, ['windowBytes', 'mixed']);
addPayload('join', 48000, ['windowBytes']);
// out-of-band controls (must fall back to JSX — still byte-identical)
addPayload('out-sort', 100, ['windowBytes', 'mixed']);
addPayload('out-reverse', 1000, ['windowBytes']);
addPayload('out-join', 1000, ['mixed']);

// expected results computed with Node natives
// laneOf: id = "<lane>-<size>-<kind>" or "out-<lane>-<size>-<kind>"; the lane
// is the FIRST token (substring matching would misroute e.g. 'reverse-sorted'
// via the 'sort' inside 'sorted').
function laneOf(id) {
  var base = id;
  if (base.indexOf('out-') === 0) { base = base.slice(4); }
  var dash = base.indexOf('-');
  var head = dash < 0 ? base : base.slice(0, dash);
  return head;
}
var expectations = {};
for (var pi = 0; pi < payloads.length; pi++) {
  var p = payloads[pi];
  var key = p.id;
  var lane = laneOf(key);
  var data = p.data;
  var base = {};
  // round-3 pipe oracles (Node chained ops on clones — pipe is pure)
  base.pipeSorRev = oracleSort(data).reverse();
  base.pipeSorJo = oracleJoin(oracleSort(data), ',');
  base.pipeSorRevJo = oracleJoin(oracleReverse(oracleSort(data)), ',');
  // round-3 packed-scan oracles (deep-hit/miss vectors; includes -> 1|0)
  base.scanIdx = data.indexOf(data[data.length - 1]);
  base.scanLast = data.lastIndexOf(data[0]);
  base.scanInc = data.includes(2147483647) ? 1 : 0;
  if (lane === 'sort') { expectations[key] = Object.assign({ sort: oracleSort(data) }, base); }
  else if (lane === 'reverse') { expectations[key] = Object.assign({ reverse: oracleReverse(data) }, base); }
  else { expectations[key] = Object.assign({ join: oracleJoin(data, ','), joinEmpty: oracleJoin(data, ''), joinPipe: oracleJoin(data, ' | ') }, base); }
}

// ---- emit the engine probe ---------------------------------------------------
var probeDir = join(process.env.TEMP || '', 'esarr-gateon');
mkdirSync(probeDir, { recursive: true });
var probePath = join(probeDir, 'gateon-probe.jsx');
var payloadFile = join(probeDir, 'gateon-payloads.jsx');
var resultsFile = join(probeDir, 'gateon-results.json');
var vendorForProbe = VENDOR.replace(/\\/g, '/');
var DLL_NAME = 'ESARRArray'; // THE shipped byte+1 build

// serialize payloads as transport (numbers only — safe for JSON)
var payloadsJson = JSON.stringify(payloads.map(function (p) {
  return { id: p.id, n: p.n, kind: p.kind, data: p.data };
}));

var probeSrc = [
  '#target illustrator',
  '// generated by tests/gateon-differential.mjs - do not edit',
  '$.evalFile(File("' + vendorForProbe + '"));',
  'ESARR.install({ forceReplace: true });',
  'var gateonPayloads = ' + payloadsJson + ';',
  'function gateonByteStr(v) {',
  '  // byte-identical string view: join lanes return strings directly; array',
  '  // lanes are wrapped "ARR[<comma-joined>]" (int32 ToString never contains a',
  '  // comma, so the wrap is unambiguous; printable-only transport — no control',
  '  // chars across the COM JSON boundary).',
  '  if (typeof v === "string") { return v; }',
  '  if (v && v.join) { return "ARR[" + v.join(",") + "]"; }',
  '  return String(v);',
  '}',
  'function gateonRun(mode) {',
  '  var out = [];',
  '  var i, p, r;',
  '  for (i = 0; i < gateonPayloads.length; i++) {',
  '    p = gateonPayloads[i];',
  '    $.global.gateonLast = p.id;',
  '    r = { id: p.id };',
  '    // lane = first token of the id (out-<lane>-... -> <lane>); substring',
  '    // matching would misroute "reverse-sorted" via the "sort" in "sorted".',
  '    var gb = p.id.indexOf("out-") === 0 ? p.id.slice(4) : p.id;',
  '    var gd = gb.indexOf("-");',
  '    var lane = gd < 0 ? gb : gb.slice(0, gd);',
  '    if (lane === "sort") {',
  '      var arr = p.data.slice(0);',
  '      var ret = ESARR.sort(arr);',
  '      r.sort = gateonByteStr(ret);',
  '      // ES5.1: sort must MUTATE the input in place — compare the input state',
  '      // after the call (catches lanes that return a fresh array instead).',
  '      r.sortInput = gateonByteStr(arr);',
  '    } else if (lane === "reverse") {',
  '      var arr2 = p.data.slice(0);',
  '      var ret2 = ESARR.reverse(arr2);',
  '      r.reverse = gateonByteStr(ret2);',
  '      r.reverseInput = gateonByteStr(arr2);',
  '    } else {',
  '      r.join = gateonByteStr(ESARR.join(p.data, ","));',
  '      r.joinEmpty = gateonByteStr(ESARR.join(p.data, ""));',
  '      r.joinPipe = gateonByteStr(ESARR.join(p.data, " | "));',
  '    }',
  '    // ROUND-3 ROWS: pack-once pipe + packed-payload scans (matrix §10.2',
  '    // rows 5/6/8). pipe is PURE — the input must be byte-identical after',
  '    // the pipe rows (the engine path clones; the native path is in-wire).',
  '    r.pipeSorRev = gateonByteStr(ESARR.pipe(p.data, ["sort", "reverse"]));',
  '    r.pipeSorJo = gateonByteStr(ESARR.pipe(p.data, ["sort", "join"]));',
  '    r.pipeSorRevJo = gateonByteStr(ESARR.pipe(p.data, ["sort", "reverse", "join"]));',
  '    r.pipeInput = gateonByteStr(p.data);',
  '    // packed-payload scans: pack once (pure JSX), then scanPacked — the',
  '    // DLL scan lane (row 8). Gate off -> scanPacked MUST be undefined',
  '    // (the fallback contract; never a throw).',
  '    var sp = ESARR.pack(p.data);',
  '    r.scanPackOk = sp !== void 0 ? 1 : 0;',
  '    if (sp !== void 0) {',
  '      r.scanIdx = ESARR.scanPacked("indexOf", sp, p.n, p.data[p.n - 1]);',
  '      r.scanLast = ESARR.scanPacked("lastIndexOf", sp, p.n, p.data[0]);',
  '      r.scanInc = ESARR.scanPacked("includes", sp, p.n, 2147483647);',
  '    }',
  '    out[out.length] = r;',
  '  }',
  '  return out;',
  '}',
  '// pass 1: JSX mode (gate off)',
  'try { ESARR.disableNativeGate(); } catch (e0) {}',
  'var gateonJsx = gateonRun("jsx");',
  '// pass 2: native gate ON — shipped DLL, strict byte+1 lane-wire',
  'var gateonCaps = null;',
  'var gateonNative = null;',
  'try {',
  '  gateonCaps = ESARR.enableNativeGate({ dir: "' + NATIVE_BIN + '", libName: "' + DLL_NAME + '" });',
  '  if (gateonCaps && gateonCaps.enabled) {',
  '    gateonNative = gateonRun("native");',
  '  }',
  '} catch (e1) {',
  '  gateonCaps = { enabled: false, reason: String(e1) };',
  '}',
  'try { ESARR.disableNativeGate(); } catch (e2) {}',
  'var gateonReport = { engine: $.version, host: app.name + " " + app.version, jsx: gateonJsx, "native": gateonNative, caps: gateonCaps };',
  'gateonReport;'
].join('\n');
writeFileSync(probePath, probeSrc);
writeFileSync(payloadFile, payloadsJson);

// ---- run through the COM tool -------------------------------------------------
// The caller (verifier) must have announced the fresh instance and set
// ESARR_INSTANCE_ANNOUNCED=1. We do NOT launch here — the caller owns launch.
console.log('GATE-ON: eval probe on the announced instance (' + payloads.length + ' payloads)...');
var pyOut;
try {
  pyOut = execFileSync('python', [TOOL, 'eval', '--file', probePath.replace(/\\/g, '/')], {
    encoding: 'utf8', timeout: 600000
  });
} catch (e) {
  console.error('GATE-ON: COM tool failed: ' + String((e.stdout || e.message) + '').slice(0, 2000));
  process.exit(1);
}
try { writeFileSync(resultsFile, pyOut); } catch (e) {}

var env;
try { env = JSON.parse(pyOut.trim()); }
catch (e) { console.error('GATE-ON: tool output not JSON: ' + pyOut.slice(0, 800)); process.exit(1); }
if (!env.ok) { console.error('GATE-ON: tool/engine error: ' + JSON.stringify(env).slice(0, 2000)); process.exit(1); }

var report;
if (env.result && typeof env.result.path === 'string' && env.result.path.length > 0) {
  var spill = readFileSync(env.result.path, 'utf8');
  try { report = JSON.parse(spill); } catch (e) { console.error('GATE-ON: spill file not JSON'); process.exit(1); }
} else if (env.result && env.result.result) {
  report = env.result.result;
} else {
  console.error('GATE-ON: unexpected envelope: ' + JSON.stringify(env).slice(0, 1000));
  process.exit(1);
}

// ---- compare -------------------------------------------------------------------
var failures = 0;
function cmp(got, want, id, field) {
  if (got !== want) {
    failures++;
    console.error('  FAIL ' + id + ' ' + field + ': native=' + String(got).slice(0, 120) + ' jsx=' + String(want).slice(0, 120));
  }
}

console.log('GATE-ON: engine ' + report.engine + ', caps=' + JSON.stringify(report.caps));
if (!report.caps || !report.caps.enabled) {
  console.error('GATE-ON: native gate NOT enabled — reason: ' + (report.caps && report.caps.reason ? report.caps.reason : 'no caps'));
  process.exit(1);
}
console.log('GATE-ON: lanes certified: ' + report.caps.lanes.join(',') + ' (certified=' + report.caps.certified + ', dll=' + report.caps.dll + ')');

if (!report.native) {
  console.error('GATE-ON: native pass missing despite enabled gate');
  process.exit(1);
}

var jsxBy = {};
var natBy = {};
for (var ri = 0; ri < report.jsx.length; ri++) { jsxBy[report.jsx[ri].id] = report.jsx[ri]; }
for (var ni = 0; ni < report.native.length; ni++) { natBy[report.native[ni].id] = report.native[ni]; }

var sortLaneHit = 0, reverseLaneHit = 0, joinLaneHit = 0;
var outOfBandChecked = 0;
for (var ci = 0; ci < payloads.length; ci++) {
  var pid = payloads[ci].id;
  var j = jsxBy[pid];
  var n = natBy[pid];
  if (!j || !n) { failures++; console.error('  FAIL ' + pid + ': missing result (jsx=' + !!j + ' native=' + !!n + ')'); continue; }
  var lane = laneOf(pid);
  if (lane === 'sort') {
    cmp(n.sort, j.sort, pid, 'sort');
    cmp(n.sortInput, j.sortInput, pid, 'sortInput(mutation)');
    if (payloads[ci].n >= 4096) sortLaneHit++;
  } else if (lane === 'reverse') {
    cmp(n.reverse, j.reverse, pid, 'reverse');
    cmp(n.reverseInput, j.reverseInput, pid, 'reverseInput(mutation)');
    if (payloads[ci].n >= 16000) reverseLaneHit++;
  } else {
    cmp(n.join, j.join, pid, 'join');
    cmp(n.joinEmpty, j.joinEmpty, pid, 'joinEmpty');
    cmp(n.joinPipe, j.joinPipe, pid, 'joinPipe');
    if (payloads[ci].n >= 32000) joinLaneHit++;
    else outOfBandChecked++;
  }
  // round-3 rows: pipe (JSX-mode = engine pipe, native-mode = pack-once for
  // n>=6000; both must be byte-identical) + pipe purity (input unchanged)
  cmp(n.pipeSorRev, j.pipeSorRev, pid, 'pipe sort+reverse');
  cmp(n.pipeSorJo, j.pipeSorJo, pid, 'pipe sort+join');
  cmp(n.pipeSorRevJo, j.pipeSorRevJo, pid, 'pipe sort+reverse+join');
  cmp(n.pipeInput, j.pipeInput, pid, 'pipe purity (input unchanged)');
  // packed-scan fallback contract: gate-off (JSX) mode MUST return undefined
  if (j.scanPackOk === 1) {
    if (j.scanIdx !== undefined || j.scanLast !== undefined || j.scanInc !== undefined) {
      failures++;
      console.error('  FAIL ' + pid + ': scanPacked engaged with the gate OFF (idx=' + j.scanIdx + ')');
    }
    if (n.scanIdx === undefined || n.scanLast === undefined || n.scanInc === undefined) {
      failures++;
      console.error('  FAIL ' + pid + ': scanPacked returned undefined with the gate ON (idx=' + n.scanIdx + ')');
    }
  }
}

// native-vs-node oracle (byte-level: join strings + sorted arrays)
for (var oi = 0; oi < payloads.length; oi++) {
  var oid = payloads[oi].id;
  var gotN = natBy[oid];
  if (!gotN) continue;
  var exp = expectations[oid];
  var olane = laneOf(oid);
  if (olane === 'sort') {
    var gotArr = String(gotN.sort).indexOf('ARR[') === 0
      ? String(gotN.sort).slice(4, -1).split(',').map(Number)
      : null;
    if (gotArr !== null && !arraysEqual(gotArr, exp.sort)) {
      failures++;
      console.error('  FAIL ' + oid + ' vs Node oracle: first diff in sort');
    } else if (gotArr === null) {
      failures++;
      console.error('  FAIL ' + oid + ': sort result not array-shaped: ' + String(gotN.sort).slice(0, 80));
    }
    // ES5.1 mutation contract: the input array after sort() === sorted result
    var gotIn = String(gotN.sortInput).indexOf('ARR[') === 0
      ? String(gotN.sortInput).slice(4, -1).split(',').map(Number)
      : null;
    if (gotIn === null || !arraysEqual(gotIn, exp.sort)) {
      failures++;
      console.error('  FAIL ' + oid + ' vs Node oracle: sort did NOT mutate input in place');
    }
  } else if (olane === 'reverse') {
    var gotArrR = String(gotN.reverse).indexOf('ARR[') === 0
      ? String(gotN.reverse).slice(4, -1).split(',').map(Number)
      : null;
    if (gotArrR !== null && !arraysEqual(gotArrR, exp.reverse)) {
      failures++;
      console.error('  FAIL ' + oid + ' vs Node oracle: first diff in reverse');
    } else if (gotArrR === null) {
      failures++;
      console.error('  FAIL ' + oid + ': reverse result not array-shaped');
    }
    var gotInR = String(gotN.reverseInput).indexOf('ARR[') === 0
      ? String(gotN.reverseInput).slice(4, -1).split(',').map(Number)
      : null;
    if (gotInR === null || !arraysEqual(gotInR, exp.reverse)) {
      failures++;
      console.error('  FAIL ' + oid + ' vs Node oracle: reverse did NOT mutate input in place');
    }
  } else {
    if (gotN.join !== exp.join || gotN.joinEmpty !== exp.joinEmpty || gotN.joinPipe !== exp.joinPipe) {
      failures++;
      console.error('  FAIL ' + oid + ' vs Node oracle: join mismatch');
    }
  }
  // round-3: pipe rows vs Node oracle (pack-once native path engages for
  // n >= 6000; engine path below — both must equal the Node chained ops).
  // Array results cross as "ARR[<comma-joined>]" — unwrap before comparing.
  function unwrapArr(s) {
    return String(s).indexOf('ARR[') === 0 ? String(s).slice(4, -1).split(',') : null;
  }
  function arrEq(a, b) {
    if (a === null || a.length !== b.length) return false;
    for (var ai = 0; ai < a.length; ai++) { if (a[ai] !== String(b[ai])) return false; }
    return true;
  }
  if (gotN.pipeSorRev !== undefined && !arrEq(unwrapArr(gotN.pipeSorRev), exp.pipeSorRev)) {
    failures++;
    console.error('  FAIL ' + oid + ' vs Node oracle: pipe sort+reverse mismatch');
  }
  if (gotN.pipeSorJo !== undefined && String(gotN.pipeSorJo) !== String(exp.pipeSorJo)) {
    failures++;
    console.error('  FAIL ' + oid + ' vs Node oracle: pipe sort+join mismatch');
  }
  if (gotN.pipeSorRevJo !== undefined && String(gotN.pipeSorRevJo) !== String(exp.pipeSorRevJo)) {
    failures++;
    console.error('  FAIL ' + oid + ' vs Node oracle: pipe sort+reverse+join mismatch');
  }
  // round-3: packed scans vs Node oracle (native mode only)
  if (gotN.scanIdx !== undefined) {
    if (gotN.scanIdx !== exp.scanIdx) {
      failures++;
      console.error('  FAIL ' + oid + ' vs Node oracle: scanPacked indexOf ' + gotN.scanIdx + ' != ' + exp.scanIdx);
    }
    if (gotN.scanLast !== exp.scanLast) {
      failures++;
      console.error('  FAIL ' + oid + ' vs Node oracle: scanPacked lastIndexOf ' + gotN.scanLast + ' != ' + exp.scanLast);
    }
    if (gotN.scanInc !== exp.scanInc) {
      failures++;
      console.error('  FAIL ' + oid + ' vs Node oracle: scanPacked includes ' + gotN.scanInc + ' != ' + exp.scanInc);
    }
  }
}

console.log('GATE-ON: in-band native lane hits — sort=' + sortLaneHit + ' reverse=' + reverseLaneHit + ' join=' + joinLaneHit +
  ' (out-of-band JSX-fallback cases checked: ' + outOfBandChecked + ')');

if (failures > 0) {
  console.error('GATE-ON: ' + failures + ' mismatch(es) — WIRE REOPENED');
  process.exit(1);
}
console.log('GATE-ON: ALL PASS — native lanes byte-identical to JSX authority and Node oracle incl. window bytes (units 216-223)');
process.exit(0);
