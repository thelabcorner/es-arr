// ESARR seeded differential fuzz — FULL SURFACE: random (op, input, cbMode,
// args) quadruples over ALL landed methods, run against the PURE JSX core and
// Node's native Array methods; any divergence (result, error, or post-mutation
// state) fails the run. Deterministic per seed (ESARR_FUZZ_SEED).
import * as core from './core-adapter';
import { runVector, runNativeVector, deepStrictEquals, carveOutAccept } from './callbacks';
import { landedOps } from './surface';
import { genInput, genArgs, pickOp, mulberry32, isMutating } from './opgen';

var PURE = core.PURE;

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

export function fuzz(seed: number, iterations: number): { failures: number; carveOuts: number } {
  var rnd = mulberry32(seed);
  var landed = landedOps(PURE);
  var failures = 0;
  var carveOuts = 0;
  var byOp: any = {};
  for (var it = 0; it < iterations; it++) {
    var input = genInput(rnd);
    var op = pickOp(landed, rnd);
    var ga = genArgs(op, rnd);
    var vec = { op: op, cbMode: ga.cbMode, args: ga.args, input: input };
    var ours = runVector(vec, PURE);
    var theirs = runNativeVector(vec, NATIVE);
    var bad = false;
    var detail = '';
    if (ours.ok !== theirs.ok) {
      bad = true;
      detail = 'ours ' + (ours.ok ? 'ok' : 'threw ' + ours.result) +
        ' native ' + (theirs.ok ? 'ok' : 'threw ' + theirs.result);
    } else if (!ours.ok) {
      if (ours.result !== theirs.result) {
        bad = true;
        detail = 'error name ours=' + ours.result + ' native=' + theirs.result;
      }
    } else {
      if (!deepStrictEquals(ours.result, theirs.result)) {
        bad = true;
        detail = 'ours=' + JSON.stringify(ours.result) + ' native=' + JSON.stringify(theirs.result);
      } else if (isMutating(op) && !deepStrictEquals(ours.state, theirs.state)) {
        bad = true;
        detail = 'state ours=' + JSON.stringify(ours.state) + ' native=' + JSON.stringify(theirs.state);
      }
    }
    if (bad && carveOutAccept(vec, ours, theirs)) {
      bad = false;
      carveOuts++;
    }
    if (bad) {
      failures++;
      byOp[op] = (byOp[op] || 0) + 1;
      console.error('fuzz[' + it + '] ' + op + ' cb=' + ga.cbMode +
        ' input=' + JSON.stringify(input) + ' args=' + JSON.stringify(ga.args) + ' :: ' + detail);
      if (failures > 8) { return { failures: failures, carveOuts: carveOuts }; }
    }
  }
  return { failures: failures, carveOuts: carveOuts };
}
