#!/usr/bin/env node
// ESARR accel-bundle END-TO-END verification (mirrors espack-e2e.mjs).
//
// Proves the espack self-extracting bundle works on a FRESH Illustrator
// instance end-to-end:
//   eval dist/ESARR.accel.jsx -> ES3-mode start -> extraction to the cache
//   dir -> ExternalObject load -> native-mode switch (ESARR.enableNativeGate
//   via the espack adapter / useEspack) -> FULL corpus byte-identical in both
//   modes AND vs the Node-validated core -> skip-extract re-run (idempotent:
//   extractMs -1, mtime unchanged) -> versioned re-extract on a bumped bundle
//   -> graceful es3 fallback when the cache dir is unwritable.
//
// PENDING path: until the T3/T4 pipeline lands (native/bin/ESARRArray.dll +
// dist/ESARR.accel.jsx), the harness reports PENDING and exits 0 so it can
// live in the test suite without blocking development.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync, statSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createComToolRunner } from '../../extendscript-toolchain/src/comtool-compat.mjs';
import { buildLiveProbe } from './build-live-probe.mjs';

var ROOT = dirname(fileURLToPath(import.meta.url));
var PROJECT = join(ROOT, '..');
var DIST = join(PROJECT, 'dist');
// The shipped build lands in native/bin/ (native/build.ps1 writes $outDir =
// native/bin). The harness must resolve THE SHIPPED DLL — a PENDING skip here
// would silently skip the acceptance.
var NATIVE = join(PROJECT, 'native', 'bin');
var DLL = join(NATIVE, 'ESARRArray.dll');
var BUNDLE = join(DIST, 'ESARR.accel.jsx');
var MANIFEST = join(DIST, 'ESARR.manifest.json');
var SCRIPTS = process.env.ESARR_DEV_SCRIPTS || 'C:/Program Files/Adobe/Adobe Illustrator 2026/Presets/en_US/Scripts';
var ESPACK_MERGE = join(PROJECT, '..', 'espack', 'espack-merge.mjs');
var CACHE = join(process.env.LOCALAPPDATA || '', 'esarr');
var SHARED_ACCEL_DIR = join(process.env.LOCALAPPDATA || '', 'espack');
var COM = createComToolRunner();

var failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('ok   ' + name);
  else { failures++; console.log('FAIL ' + name + (detail ? '  ' + detail : '')); }
}

// ---- prerequisite detection --------------------------------------------------
if (!existsSync(BUNDLE)) {
  console.log('PENDING: dist/ESARR.accel.jsx not built yet (T4 pipeline) — skipping accel e2e');
  process.exit(0);
}
if (!existsSync(DLL)) {
  console.log('PENDING: native/bin/ESARRArray.dll not built yet (T3 pipeline) — skipping accel e2e');
  process.exit(0);
}
if (!existsSync(MANIFEST)) {
  console.log('PENDING: dist/ESARR.manifest.json not built yet — skipping accel e2e');
  process.exit(0);
}

var dllBytes = readFileSync(DLL);
console.log('E2E: DLL ' + basename(DLL) + ' ' + dllBytes.length + ' bytes; cache ' + CACHE);

// ---- helpers ----------------------------------------------------------------
async function runTool(args, timeoutMs) {
  return COM.run(args, { timeoutMs: timeoutMs || 240000 });
}
async function evalSmoke(bundlePath, smokeSrc, refreshEspack) {
  var env = await runTool(['eval', '--code',
    // The accel bundle is a FACADE + auto native-gate (install is explicit —
    // design §5.3; same contract as ESON.accel). Gap-fill the full surface so
    // the smoke/corpus can exercise prototype wrappers AND the facade.
    '$.evalFile(File("' + bundlePath.replace(/\\/g, '/') + '"));' +
    (refreshEspack ? 'if (typeof ESARR.useEspack === "function") { ESARR.espack = ESARR.useEspack(); }' : '') +
    'ESARR.install({ forceReplace: true }); return ' + smokeSrc]);
  if (!env.ok) throw new Error('eval failed: ' + JSON.stringify(env).slice(0, 1500));
  return env.result;
}
async function killAllAutomation() {
  // Release the V2 target lease and stop only our isolated RuntimeHost before
  // replacing the Illustrator process generation.
  await COM.reset();
  execFileSync('powershell.exe', ['-NoProfile', '-Command',
    '$p = Get-Process -Name Illustrator -ErrorAction SilentlyContinue; if ($p) { $p | Stop-Process -Force }; exit 0'],
    { timeout: 30000 });
}
async function launchFresh() {
  var env = await runTool(['status', '--launch'], 120000);
  if (!env.ok) throw new Error('instance launch failed: ' + JSON.stringify(env).slice(0, 1000));
  return env.result;
}

// ---- build the corpus + Node-validated expectations --------------------------
var core = await import(pathToFileURL(join(DIST, 'esarr-core.esm.mjs')).href);
var CB_BUNDLE = join(ROOT, '.esarr-callbacks.bundle.mjs');
execFileSync(process.execPath, [esbuildBin(), join(ROOT, 'callbacks.ts'),
  '--bundle', '--outfile=' + CB_BUNDLE, '--format=esm', '--platform=node', '--target=es2019',
  '--log-level=warning'], { stdio: 'inherit' });
var cbs = await import(pathToFileURL(CB_BUNDLE).href);
var V_BUNDLE = join(ROOT, '.esarr-vectors.bundle.mjs');
execFileSync(process.execPath, [esbuildBin(), join(ROOT, 'vectors.ts'),
  '--bundle', '--outfile=' + V_BUNDLE, '--format=esm', '--platform=node', '--target=es2019',
  '--log-level=warning'], { stdio: 'inherit' });
var vecs = await import(pathToFileURL(V_BUNDLE).href);

function encode(v) {
  if (v === void 0) { return '~Undef'; }
  if (typeof v === 'number') {
    if (v !== v) { return '~NaN'; }
    if (v === Infinity) { return '~Inf'; }
    if (v === -Infinity) { return '~NInf'; }
    return v;
  }
  if (v === null || typeof v !== 'object') { return v; }
  if (Array.isArray(v)) {
    var a = [];
    for (var i = 0; i < v.length; i++) { a[i] = encode(v[i]); }
    return a;
  }
  var o = {};
  for (var k in v) { if (Object.prototype.hasOwnProperty.call(v, k)) { o[k] = encode(v[k]); } }
  return o;
}

var vectors = vecs.VECTORS;
var nodeResults = [];
for (var vi = 0; vi < vectors.length; vi++) {
  var vv = vectors[vi];
  if (typeof core[vv.op] !== 'function') { nodeResults[nodeResults.length] = { pending: true, op: vv.op }; continue; }
  var r = cbs.runVector(vv, core);
  nodeResults[nodeResults.length] = { pending: false, op: vv.op, ok: r.ok, result: r.result, state: r.state };
}

// ---- probe glue (same as live-verify, but against the accel-installed ESARR) -
var probeDir = join(process.env.TEMP || '', 'esarr-e2e');
mkdirSync(probeDir, { recursive: true });
var probeCorePath = join(probeDir, 'esarr-e2e-probe-core.jsx');
await buildLiveProbe(probeCorePath);

var vectorsJson = JSON.stringify(encode(vectors));
var coreForProbe = probeCorePath.replace(/\\/g, '/');

var RUN_CORPUS = '(function () {' +
  '  var out = { ok: false, error: null, result: null };' +
  '  try {' +
  '    $.evalFile(File("' + coreForProbe + '"));' +
  '    var res = [];' +
  '    var i, v;' +
  '    for (i = 0; i < esarrE2eVectors.length; i++) {' +
  '      v = esarrE2eVectors[i];' +
  '      if (typeof ESARR[v.op] !== "function") { res[res.length] = { pending: true }; continue; }' +
  '      try { var r = PROBECORE.runVec(v, ESARR); res[res.length] = { ok: r.ok, result: r.result, state: r.state }; }' +
  '      catch (e) { res[res.length] = { ok: false, result: "THREW " + e }; }' +
  '    }' +
  '    out.result = res;' +
  '    out.ok = true;' +
  '  } catch (e) { out.error = String(e); }' +
  '  return out;' +
  '}());';

var SMOKE = '(function () {' +
  '  var out = { ok: false, error: null };' +
  '  try {' +
  '    out.esarrVersion = ESARR.version || null;' +
  '    out.gate = ESARR.nativeGateState ? ESARR.nativeGateState() : null;' +
  '    out.espack = ESARR.espack || null;' +
  '    var cap = ESARR.capabilities();' +
  '    out.missing = cap.missing;' +
  '    out.sortVec = [10, 9, 1, 2].sort().join(",");' +
  '    out.lastIdx = [1, 2, 3].lastIndexOf(2);' +
  '    out.findVec = [1, 2, 3, 4].find(function (v) { return v > 2; });' +
  '    out.ok = true;' +
  '  } catch (e) { out.error = String(e); }' +
  '  return out;' +
  '}());';

function compareCorpus(engineResults, tag) {
  var bad = 0;
  for (var i = 0; i < vectors.length; i++) {
    var got = engineResults[i];
    var want = nodeResults[i];
    if (got && got.pending) { if (!want.pending) { bad++; console.error('  FAIL [' + tag + '] ' + vectors[i].desc + ': engine pending, node has it'); } continue; }
    if (want && want.pending) { continue; }
    if (got.ok !== want.ok ||
      JSON.stringify(got.result) !== JSON.stringify(want.result) ||
      JSON.stringify(got.state) !== JSON.stringify(want.state)) {
      // D7 carve-out (same policy as the Node differential — callbacks.ts
      // carveOutAccept): sort/toSorted with the non-transitive dCmp comparator
      // on NaN/mixed-type inputs is implementation-defined (ES5.1 §15.4.4.11);
      // any permutation of the input is valid. The live corpus must accept the
      // same class the Node harness carves out.
      if (cbs.carveOutAccept(vectors[i], { ok: got.ok, result: got.result, state: got.state },
        { ok: want.ok, result: want.result, state: want.state })) { continue; }
      bad++;
      if (bad <= 8) console.error('  FAIL [' + tag + '] ' + vectors[i].desc + ': engine=' + JSON.stringify(got) + ' node=' + JSON.stringify(want));
    }
  }
  return bad;
}

function extractedPath(version) { return join(CACHE, 'ESARRArray_v' + version + '.dll'); }
function bundlePath(version) { return join(DIST, 'esarr-e2e-v' + version + '.jsx'); }

// ---- run ---------------------------------------------------------------------
console.log('E2E: killing leftover automation and launching a fresh instance...');
await killAllAutomation();
var instA = await launchFresh();
check('instance A fresh (' + instA.Version + ')', instA.DocumentsCount === 0);

if (existsSync(CACHE)) rmSync(CACHE, { recursive: true, force: true });
if (existsSync(SHARED_ACCEL_DIR)) rmSync(SHARED_ACCEL_DIR, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// v1: eval the production bundle (fresh cache) -> extract -> load -> native
var s1 = await evalSmoke(BUNDLE, SMOKE);
check('v1: bundle evals, ESARR installed', s1.ok === true, s1.error);
check('v1: full surface present (missing empty)', Array.isArray(s1.missing) && s1.missing.length === 0, JSON.stringify(s1.missing));
check('v1: native gate enabled', !!(s1.gate && s1.gate.enabled), JSON.stringify(s1.gate));
check('v1: sort lane active', !!(s1.gate && s1.gate.lanes && s1.gate.lanes.indexOf('sort') >= 0), JSON.stringify(s1.gate && s1.gate.lanes));
check('v1: lanes certified on the JSX authority', !!(s1.gate && s1.gate.certified > 0), String(s1.gate && s1.gate.certified));
check('v1: smoke vectors correct', s1.sortVec === '1,10,2,9' && s1.lastIdx === 1 && s1.findVec === 3, JSON.stringify({ sort: s1.sortVec, li: s1.lastIdx, f: s1.findVec }));

// run the full corpus through the gate-on facade in ONE eval (atomic)
var e2eVectorsFile = join(probeDir, 'esarr-e2e-vectors.jsx');
writeFileSync(e2eVectorsFile, 'var esarrE2eVectors = ' + vectorsJson + ';');
var corpusEval = '$.evalFile(File("' + e2eVectorsFile.replace(/\\/g, '/') + '"));' +
  '$.evalFile(File("' + BUNDLE.replace(/\\/g, '/') + '"));' +
  'ESARR.install({ forceReplace: true }); return ' + RUN_CORPUS;
var env1 = await runTool(['eval', '--code', corpusEval]);
check('v1: corpus eval ok', env1.ok && env1.result && env1.result.ok, JSON.stringify(env1).slice(0, 600));
var e2eFail = env1.result ? compareCorpus(env1.result.result, 'v1-native') : 999;
check('v1: full corpus matches Node (native mode)', e2eFail === 0, e2eFail + ' mismatch(es)');

// skip-extract re-run: fresh eval, extraction must be skipped (idempotent)
var s1b = await evalSmoke(BUNDLE, SMOKE);
var extracted = extractedPath(1);
var v1mtime = existsSync(extracted) ? statSync(extracted).mtimeMs : 0;
check('v1: DLL extracted byte-exact', existsSync(extracted) && readFileSync(extracted).equals(dllBytes));
var s1c = await evalSmoke(BUNDLE, SMOKE);
check('re-run: native still', !!(s1c.gate && s1c.gate.enabled));
check('re-run: no re-extraction (mtime unchanged)', existsSync(extracted) && statSync(extracted).mtimeMs === v1mtime, 'mtime changed');

// versioned re-extract: clone the *production manifest-v2 composition* and
// change only ESARRArray's payload version. This exercises the same flattened
// ESB64 -> ESARR library closure and one ESPAK control plane as the release
// artifact; no legacy payload-only builder or manually appended facade suffix.
var espackMerge = await import(pathToFileURL(ESPACK_MERGE).href);
var productionManifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
function renderManifestVariant(outPath, cacheDir, payloadVersion) {
  var variant = JSON.parse(JSON.stringify(productionManifest));
  if (payloadVersion) {
    var payload = null;
    for (var vi = 0; vi < variant.payloads.length; vi++) {
      if (variant.payloads[vi].name === 'ESARRArray') { payload = variant.payloads[vi]; break; }
    }
    if (!payload) throw new Error('production manifest missing ESARRArray payload');
    payload.version = String(payloadVersion);
    payload.fileName = 'ESARRArray_v' + String(payloadVersion) + '.dll';
  }
  return espackMerge.merge({
    manifests: [variant],
    out: outPath,
    name: 'esarr',
    cacheDir: cacheDir.replace(/\\/g, '/'),
    entries: productionManifest.entries,
    deferB64: true
  }).outPath;
}

var v2bundle = renderManifestVariant(bundlePath(2), CACHE, '2');
// Library identity is intentionally unchanged, so v2 composition correctly
// deduplicates ESARR@1.2.0 and does not re-run its activation source. Explicitly
// re-adopt the upgraded capability payload through the public idempotent hook.
var s2 = await evalSmoke(v2bundle, SMOKE, true);
check('v2: loaded native with new version', !!(s2.gate && s2.gate.enabled));
check('v2: versioned DLL extracted', existsSync(extractedPath(2)));
check('v2: v1 still present (locked by host)', existsSync(extracted));

// graceful failure: cache dir pointing at an existing FILE -> es3 fallback
var BLOCKER = join(process.env.LOCALAPPDATA || '', 'esarr-e2e-fail.txt');
try { if (existsSync(BLOCKER)) rmSync(BLOCKER); } catch (e) {}
writeFileSync(BLOCKER, 'blocker');
var failBundle = join(DIST, 'esarr-e2e-fail.jsx');
renderManifestVariant(failBundle, BLOCKER, '1');
// The fail-path MUST run on a FRESH instance: the previous evals left a global
// ESPAK (and an already-extracted DLL in %LOCALAPPDATA%/esarr) that would
// otherwise let the gate come up native even when THIS bundle's cache-dir
// extraction must fail. Fresh instance -> only the fail bundle's own state
// exists -> a cache-dir write failure must leave the gate OFF (es3).
console.log('E2E: fresh instance for the fail-path (cache-dir is a FILE -> must stay es3)...');
await killAllAutomation();
await launchFresh();
var sf = await evalSmoke(failBundle, SMOKE);
check('fail-path: stays es3 (graceful)', !(sf.gate && sf.gate.enabled), JSON.stringify(sf.gate));
check('fail-path: no throw, clear error', sf.ok === true, sf.error);
try { if (existsSync(BLOCKER)) rmSync(BLOCKER); } catch (e) {}

// ---- cleanup -------------------------------------------------------------------
console.log('E2E: closing instance...');
await killAllAutomation();
try { rmSync(CACHE, { recursive: true, force: true }); } catch (e) {}
try { rmSync(SHARED_ACCEL_DIR, { recursive: true, force: true }); } catch (e) {}

console.log('\nE2E: ' + (failures ? failures + ' failure(s)' : 'ALL CHECKS PASSED'));
process.exit(failures ? 1 : 0);

function esbuildBin() {
  var direct = join(PROJECT, 'node_modules', 'esbuild', 'bin', 'esbuild');
  if (existsSync(direct)) { return direct; }
  var cacheDirs = [
    join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'),
    join(process.env.USERPROFILE || '', 'AppData', 'Local', 'npm-cache', '_npx')
  ];
  for (var c = 0; c < cacheDirs.length; c++) {
    try {
      var entries = readdirSync(cacheDirs[c]);
      for (var j = 0; j < entries.length; j++) {
        var p = join(cacheDirs[c], entries[j], 'node_modules', 'esbuild', 'bin', 'esbuild');
        if (existsSync(p)) { return p; }
      }
    } catch (ignore) {}
  }
  return 'npx esbuild';
}
