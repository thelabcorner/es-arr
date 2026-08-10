// ESARR Node conformance — FULL-SURFACE differential harness.
//
// Sections:
//   1. shared fixed vectors vs the PURE JSX core (deepStrictEquals, incl. the
//      post-mutation state for mutating ops)
//   2. the same vectors vs the DISPATCH facade (gate off in Node) — must be
//      byte-identical to the PURE results (mode equality)
//   3. seeded random differential vs Node's native Array methods (the spec
//      oracle) over ALL landed ops, with per-op corpus counters
//   4. PURE vs DISPATCH random differential (gate-off equality at scale)
//   5. isArray differential
//
// Deterministic: sections 3/4 use mulberry32 seeds (env ESARR_DIFF_SEED /
// ESARR_DIFF_ITERS). Ops that have not landed in the core are reported as
// PENDING and never compared.
import * as core from './core-adapter';
import { VECTORS } from './vectors';
import {
  rebuildInput, isArrayProtocol, runVector, runNativeVector, deepStrictEquals, carveOutAccept
} from './callbacks';
import { coreHas, landedOps, ALL_METHODS } from './surface';
import { genInput, genArgs, pickOp, mulberry32, isMutating } from './opgen';

var PURE = core.PURE;
var DISPATCH = core.DISPATCH;
var GATE = core.GATE;

var failures: string[] = [];
var passed = 0;
var pending = 0;

var NATIVE: any = {
  forEach: Array.prototype.forEach,
  map: Array.prototype.map,
  filter: Array.prototype.filter,
  every: Array.prototype.every,
  some: Array.prototype.some,
  indexOf: Array.prototype.indexOf,
  lastIndexOf: Array.prototype.lastIndexOf,
  reduce: Array.prototype.reduce,
  reduceRight: Array.prototype.reduceRight,
  concat: Array.prototype.concat,
  join: Array.prototype.join,
  pop: Array.prototype.pop,
  push: Array.prototype.push,
  reverse: Array.prototype.reverse,
  shift: Array.prototype.shift,
  slice: Array.prototype.slice,
  sort: Array.prototype.sort,
  splice: Array.prototype.splice,
  unshift: Array.prototype.unshift,
  toString: Array.prototype.toString,
  copyWithin: Array.prototype.copyWithin,
  fill: Array.prototype.fill,
  find: Array.prototype.find,
  findIndex: Array.prototype.findIndex,
  findLast: Array.prototype.findLast,
  findLastIndex: Array.prototype.findLastIndex,
  flat: Array.prototype.flat,
  flatMap: Array.prototype.flatMap,
  includes: Array.prototype.includes,
  entries: Array.prototype.entries,
  keys: Array.prototype.keys,
  values: Array.prototype.values,
  at: Array.prototype.at,
  toReversed: Array.prototype.toReversed,
  toSorted: Array.prototype.toSorted,
  with: Array.prototype.with,
  isArray: Array.isArray
};

function fail(desc: string, detail: string): void {
  failures[failures.length] = desc + ': ' + detail;
}

// ---- 1. shared vectors vs the PURE core -------------------------------------
var VECTOR_TALLY: any = {};
var landed = landedOps(PURE);
for (var vi = 0; vi < VECTORS.length; vi++) {
  var vec = VECTORS[vi];
  if (!coreHas(vec.op, PURE)) {
    pending++;
    continue;
  }
  VECTOR_TALLY[vec.op] = (VECTOR_TALLY[vec.op] || 0) + 1;
  var out = runVector(vec, PURE);
  if (!out.ok) {
    fail(vec.desc, String(out.result));
    continue;
  }
  var expected = isArrayProtocol(vec.expect) ? rebuildInput(vec.expect) : vec.expect;
  if (vec.expectError) {
    if (String(out.result).indexOf('TypeError') >= 0) { passed++; }
    else { fail(vec.desc, 'expected TypeError, got ' + String(out.result)); }
    continue;
  }
  if (!deepStrictEquals(out.result, expected)) {
    fail(vec.desc, 'result: expected ' + JSON.stringify(expected) + ' got ' + JSON.stringify(out.result));
    continue;
  }
  if (isMutating(vec.op)) {
    if (vec.expectState === void 0) {
      fail(vec.desc, 'CORPUS BUG: mutating op without expectState');
      continue;
    }
    var expState = isArrayProtocol(vec.expectState) ? rebuildInput(vec.expectState) : vec.expectState;
    if (!deepStrictEquals(out.state, expState)) {
      fail(vec.desc, 'state: expected ' + JSON.stringify(expState) + ' got ' + JSON.stringify(out.state));
      continue;
    }
  }
  passed++;
}

// ---- 2. the same vectors vs DISPATCH (gate off -> identical to PURE) --------
for (var vj = 0; vj < VECTORS.length; vj++) {
  var vec2 = VECTORS[vj];
  if (!coreHas(vec2.op, PURE)) { continue; }
  var a = runVector(vec2, PURE);
  var b = runVector(vec2, DISPATCH);
  if (a.ok !== b.ok || !deepStrictEquals(a.result, b.result) ||
    !deepStrictEquals(a.state, b.state)) {
    fail(vec2.desc + ' [PURE vs DISPATCH]', 'PURE ' + JSON.stringify(a) + ' DISPATCH ' + JSON.stringify(b));
  } else {
    passed++;
  }
}

// ---- 3. seeded random differential vs Node natives ---------------------------
var SEED = process.env.ESARR_DIFF_SEED ? Number(process.env.ESARR_DIFF_SEED) : 20260809;
var DIFF_ITERS = process.env.ESARR_DIFF_ITERS ? Number(process.env.ESARR_DIFF_ITERS) : 4000;
var rnd = mulberry32(SEED);
var diffByOp: any = {};
var diffCount = 0;
var carveOuts = 0;
var diffDivergences: string[] = [];
for (var di = 0; di < DIFF_ITERS; di++) {
  var input = genInput(rnd);
  var op = pickOp(landed, rnd);
  var ga = genArgs(op, rnd);
  var dvec = { op: op, cbMode: ga.cbMode, args: ga.args, input: input };
  var ours = runVector(dvec, PURE);
  var theirs = runNativeVector(dvec, NATIVE);
  var base: string = 'diff[' + di + '] ' + op + ' input=' + JSON.stringify(input) + ' cb=' + ga.cbMode + ' args=' + JSON.stringify(ga.args);
  if (ours.ok !== theirs.ok) {
    diffByOp[op] = (diffByOp[op] || 0) + 1;
    diffDivergences[diffDivergences.length] = base + ': ours ' + (ours.ok ? 'ok' : 'threw ' + ours.result) +
      ' native ' + (theirs.ok ? 'ok' : 'threw ' + theirs.result);
    diffCount++;
  } else if (!ours.ok) {
    if (ours.result !== theirs.result) {
      diffByOp[op] = (diffByOp[op] || 0) + 1;
      diffDivergences[diffDivergences.length] = base + ': error name ours=' + ours.result + ' native=' + theirs.result;
      diffCount++;
    } else {
      passed++;
    }
  } else {
    var bad = !deepStrictEquals(ours.result, theirs.result);
    if (isMutating(op) && !deepStrictEquals(ours.state, theirs.state)) { bad = true; }
    if (bad && carveOutAccept(dvec, ours, theirs)) { bad = false; carveOuts++; }
    if (bad) {
      diffByOp[op] = (diffByOp[op] || 0) + 1;
      diffDivergences[diffDivergences.length] = base + ': ours ' + JSON.stringify(ours) + ' native ' + JSON.stringify(theirs);
      diffCount++;
    } else {
      passed++;
    }
  }
}

// ---- 4. PURE vs DISPATCH random differential (gate-off mode equality) -------
var MODE_ITERS = process.env.ESARR_MODE_ITERS ? Number(process.env.ESARR_MODE_ITERS) : 2000;
var modeRnd = mulberry32(SEED ^ 0x5DEECE66D);
var modeDivergences = 0;
for (var mi = 0; mi < MODE_ITERS; mi++) {
  var inputM = genInput(modeRnd);
  var opM = pickOp(landed, modeRnd);
  var gaM = genArgs(opM, modeRnd);
  var vecM = { op: opM, cbMode: gaM.cbMode, args: gaM.args, input: inputM };
  var o = runVector(vecM, PURE);
  var d = runVector(vecM, DISPATCH);
  if (o.ok !== d.ok || !deepStrictEquals(o.result, d.result) || !deepStrictEquals(o.state, d.state)) {
    modeDivergences++;
    if (modeDivergences <= 10) {
      fail('mode[' + mi + '] ' + opM, 'PURE ' + JSON.stringify(o) + ' DISPATCH ' + JSON.stringify(d));
    }
  } else {
    passed++;
  }
}

// ---- 5. isArray differential -------------------------------------------------
(function (a: any, b: any, c: any): void {
  var cases = arguments;
  var list: any[] = [[], [1], new Array(5), cases, { length: 1 }, 'ab', 7, null, undefined, true, /x/, function () {}];
  for (var ii = 0; ii < list.length; ii++) {
    if (PURE.isArray(list[ii]) !== Array.isArray(list[ii])) {
      fail('isArray mismatch on ' + String(list[ii]), '');
    } else {
      passed++;
    }
  }
})(1, 2, 3);

// ---- 6. native-gate fallback semantics (no DLL in Node) ----------------------
// A lib whose native answers are garbage must be DISQUALIFIED at enable time
// (lane certification vs the JSX authority), and the DISPATCH facade must
// then fall back to the pure-JSX path — never return the garbage. This pins
// "the fallback is hit, not silently wrong results".
(function (): void {
  var garbageLib: any = {
    version: function (): number { return 1; },
    ping: function (): number { return 42; },
    arrSort: function (): string { return 'garbage'; },
    arrJoin: function (): string { return ''; },
    arrReverse: function (): string { return 'zz'; },
    arrConcat: function (): string { return 'xx'; },
    arrSlice: function (): string { return 'yy'; },
    arrIndexOf: function (): number { return 12345; },
    arrLastIndexOf: function (): number { return 12345; },
    unload: function (): void {}
  };
  try {
    var caps = GATE.enableNativeGateState({ provideLib: function (): any { return garbageLib; }, ping: 42 });
    if (caps.enabled) {
      fail('gate fallback', 'garbage lib enabled the gate: ' + JSON.stringify(caps));
    } else {
      passed++;
    }
    if (!caps.reason || caps.reason.indexOf('lane') < 0) {
      fail('gate fallback reason', 'expected lane-certification failure reason, got ' + JSON.stringify(caps));
    } else {
      passed++;
    }
    // the DISPATCH facade must STILL be JSX-identical after the failed enable
    var probe = { op: 'sort', cbMode: 'dCmp', args: [], input: { t: 'array', dense: [3, 1, 2] } };
    var d = runVector(probe, DISPATCH);
    if (d.ok && JSON.stringify(d.result) === JSON.stringify([1, 2, 3])) { passed++; }
    else { fail('gate fallback dispatch', 'DISPATCH sort returned garbage: ' + JSON.stringify(d)); }
    var li = runVector({ op: 'indexOf', cbMode: '', args: [2], input: { t: 'array', dense: [1, 2, 3] } }, DISPATCH);
    if (li.ok && li.result === 1) { passed++; }
    else { fail('gate fallback dispatch indexOf', 'DISPATCH indexOf returned garbage: ' + JSON.stringify(li)); }
  } finally {
    try { GATE.disableNativeGateState(); } catch (e) {}
  }
})();

// ---- report -------------------------------------------------------------------
console.log('ESARR differential: ' + passed + ' checks passed (' + VECTORS.length + ' vectors, ' +
  DIFF_ITERS + ' diff iters, ' + MODE_ITERS + ' mode iters), ' + pending + ' pending, ' +
  failures.length + ' failures, ' + carveOuts + ' carve-outs (D7 NaN-comparator)');
console.log('landed (' + landed.length + '/' + ALL_METHODS.length + '): ' + landed.join(','));
var opNames: string[] = [];
for (var ok2 in diffByOp) { if (Object.prototype.hasOwnProperty.call(diffByOp, ok2)) { opNames[opNames.length] = ok2; } }
if (opNames.length > 0) {
  console.log('divergent ops: ' + opNames.join(','));
}
if (diffDivergences.length > 0) {
  console.error('differential divergences (' + diffDivergences.length + '):');
  for (var dv = 0; dv < diffDivergences.length && dv < 30; dv++) {
    console.error('  ' + diffDivergences[dv]);
  }
}

if (failures.length > 0 || diffCount > 0) {
  console.error('ESARR TEST FAILURES:');
  for (var f = 0; f < failures.length && f < 25; f++) {
    console.error('  ' + failures[f]);
  }
  throw new Error((failures.length + diffCount) + ' ESARR test failure(s)');
}
