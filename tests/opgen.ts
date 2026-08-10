// Per-op argument/callback generators for the RANDOM differential sweep and
// seeded fuzz. Produces vector-shaped records { op, cbMode, args } consumed by
// the shared runners (tests/callbacks.ts runVector / runNativeVector), so the
// fixed battery, the differential sweep, the fuzz and the live probe all
// exercise the IDENTICAL semantics.
//
// All functions here are ES3-style (var/function) — the same file is bundled
// for Node (ESM) and for the ExtendScript probe (IIFE, target es5).

import { ALL_METHODS, METHOD_SET } from './surface';

// Deterministic PRNG (mulberry32) — same as the original fuzz.
export function mulberry32(seed: number): () => number {
  var a = seed >>> 0;
  return function (): number {
    a = (a + 0x6D2B79F5) | 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Full value pool incl. the spec edges: NaN, ±Infinity, -0, null, strings. */
export var VALUES: any[] = [
  0, 1, 2, 3, 5, -1, -7, 13, 42, 0.5, -2.5,
  '', 'a', 'two', '0', '10', '1',
  null, undefined, true, false,
  NaN, Infinity, -Infinity, -0,
  {}, []
];

// Mutating ops: the input array/array-like is modified in place; the runner
// snapshots the post-state and the harness compares it too.
export var MUTATING_OPS: string[] = [
  'sort', 'reverse', 'splice', 'push', 'pop', 'shift', 'unshift',
  'fill', 'copyWithin'
];

// Callback-driven ops whose cbMode drives callback construction via
// makeCallback (tests/callbacks.ts).
export var CALLBACK_OPS: string[] = [
  'forEach', 'map', 'filter', 'every', 'some',
  'find', 'findIndex', 'flatMap', 'reduce', 'reduceRight', 'sort', 'from'
];

export function isMutating(op: string): boolean {
  return MUTATING_OPS.indexOf(op) >= 0;
}

export function isCallbackOp(op: string): boolean {
  return CALLBACK_OPS.indexOf(op) >= 0;
}

function pick(rnd: () => number, pool: any[]): any {
  return pool[(rnd() * pool.length) | 0];
}

/** Random input: 10 shapes covering dense/undefined/sparse/strings/mixed/
 * nested/all-holes/empty/array-like. */
export function genInput(rnd: () => number): any {
  var shape = (rnd() * 10) | 0;
  var len = (rnd() * 12) | 0;
  var a: any[] = [];
  var o: any;
  var i: number;
  switch (shape) {
    case 0: case 1: // dense VALUES mix (incl NaN/±Inf/-0/strings/bools)
      for (i = 0; i < len; i++) { a[a.length] = pick(rnd, VALUES); }
      return a;
    case 2: { // sparse with VALUES
      var s: any[] = [];
      s.length = len;
      for (i = 0; i < len; i++) { if (rnd() < 0.35) { s[i] = pick(rnd, VALUES); } }
      return s;
    }
    case 3: { // undefined-heavy dense
      var t: any[] = [];
      for (i = 0; i < len; i++) { t[t.length] = rnd() < 0.4 ? undefined : pick(rnd, VALUES); }
      return t;
    }
    case 4: { // array-like object (holes allowed)
      o = { length: len };
      for (i = 0; i < len; i++) { if (rnd() < 0.6) { o[i] = pick(rnd, VALUES); } }
      return o;
    }
    case 5: // string array-like
      return pick(rnd, ['xyz', 'abc', 'a', '']);
    case 6: { // dense ints (the classic pool)
      var d: any[] = [];
      for (i = 0; i < len; i++) { d[d.length] = ((rnd() * 20) | 0) - 10; }
      return d;
    }
    case 7: { // nested arrays (join/concat/flat/flatMap/toString)
      var n: any[] = [];
      var depth = (rnd() * 3) | 0;
      for (i = 0; i < len; i++) {
        if (depth > 0 && i % 3 === 0) {
          var inner: any[] = [];
          var ilen = (rnd() * 3) | 0;
          var j: number;
          for (j = 0; j < ilen; j++) { inner[inner.length] = pick(rnd, VALUES); }
          n[n.length] = inner;
        } else {
          n[n.length] = pick(rnd, VALUES);
        }
      }
      return n;
    }
    case 8: { // all-holes sparse
      var h: any[] = [];
      h.length = len;
      return h;
    }
    default: // empty or single-element
      return rnd() < 0.5 ? [] : [pick(rnd, VALUES)];
  }
}

/** Generate a random (op, cbMode, args) triple for a landed op. */
export function genArgs(op: string, rnd: () => number): any {
  var r = rnd();
  var v = function (): any { return pick(rnd, VALUES); };
  var num = function (): any {
    switch ((rnd() * 6) | 0) {
      case 0: return ((rnd() * 20) | 0) - 10;
      case 1: return Infinity;
      case 2: return -Infinity;
      case 3: return NaN;
      case 4: return -0;
      default: return rnd() * 10 - 5;
    }
  };
  switch (op) {
    case 'forEach': case 'map': case 'filter': case 'every': case 'some':
    case 'find': case 'findIndex': case 'findLast': case 'findLastIndex': case 'flatMap': {
      var mode: string;
      var roll = rnd();
      if (roll < 0.22) { mode = 'thisDiff'; } // this-binding probe (observable via forEach/map/flatMap/from values)
      else if (op === 'filter' || op === 'every' || op === 'some' || op === 'find' || op === 'findIndex' ||
        op === 'findLast' || op === 'findLastIndex') { mode = 'dPred'; }
      else { mode = 'dCb'; }
      return { cbMode: mode, args: rnd() < 0.5 ? [{ z: 1 }] : [] };
    }
    case 'reduce': case 'reduceRight': {
      var hasInit = rnd() < 0.5;
      var init = hasInit ? v() : undefined;
      return { cbMode: 'dRed', args: hasInit ? [init] : [] };
    }
    case 'sort':
      return { cbMode: rnd() < 0.5 ? 'dCmp' : '', args: [] };
    case 'join':
      return { cbMode: '', args: rnd() < 0.4 ? [] : [pick(rnd, [undefined, ',', '', '-', '|', '::', 0, null])] };
    case 'concat': {
      var items: any[] = [];
      var ni = (rnd() * 3) | 0;
      var i: number;
      for (i = 0; i < ni; i++) {
        items[items.length] = rnd() < 0.5 ? pick(rnd, VALUES) : genInput(rnd);
      }
      return { cbMode: '', args: items };
    }
    case 'push': case 'unshift': {
      var its: any[] = [];
      var n2 = (rnd() * 3) | 0;
      var k: number;
      for (k = 0; k < n2; k++) { its[its.length] = pick(rnd, VALUES); }
      return { cbMode: '', args: its };
    }
    case 'pop': case 'shift': case 'reverse': case 'toString':
    case 'entries': case 'keys': case 'values': case 'isArray':
      return { cbMode: '', args: [] };
    case 'slice':
      return { cbMode: '', args: rnd() < 0.5 ? [] : [num(), rnd() < 0.5 ? num() : undefined] };
    case 'splice': {
      var spl: any[] = [num()];
      var dcRoll = rnd();
      if (dcRoll < 0.25) { spl[spl.length] = undefined; }      // explicit undefined deleteCount (Node: -> 0, NOT absent)
      else if (dcRoll < 0.6) { spl[spl.length] = (rnd() * 8) | 0; } // numeric deleteCount
      // else: deleteCount ABSENT (delete to end)
      var ni2 = (rnd() * 3) | 0;
      var j2: number;
      for (j2 = 0; j2 < ni2; j2++) { spl[spl.length] = pick(rnd, VALUES); }
      return { cbMode: '', args: spl };
    }
    case 'fill': {
      var f: any[] = [v()];
      if (rnd() < 0.6) { f[f.length] = num(); }
      if (rnd() < 0.6) { f[f.length] = num(); }
      return { cbMode: '', args: f };
    }
    case 'copyWithin': {
      var c: any[] = [num()];
      if (rnd() < 0.7) { c[c.length] = num(); }
      if (rnd() < 0.7) { c[c.length] = num(); }
      return { cbMode: '', args: c };
    }
    case 'flat':
      return { cbMode: '', args: rnd() < 0.5 ? [] : [pick(rnd, [0, 1, 2, 3, Infinity, -1, 0.7])] };
    case 'includes':
      return { cbMode: '', args: rnd() < 0.6 ? [v()] : [v(), num()] };
    case 'indexOf': case 'lastIndexOf':
      return { cbMode: '', args: rnd() < 0.6 ? [v()] : [v(), num()] };
    case 'from':
      return { cbMode: rnd() < 0.5 ? 'dFromMap' : '', args: rnd() < 0.3 ? [{ z: 1 }] : [] };
    case 'of': {
      var ofs: any[] = [];
      var n3 = (rnd() * 4) | 0;
      var m: number;
      for (m = 0; m < n3; m++) { ofs[ofs.length] = pick(rnd, VALUES); }
      return { cbMode: '', args: ofs };
    }
    case 'at':
      return { cbMode: '', args: [num()] };
    case 'toSorted':
      return { cbMode: rnd() < 0.5 ? 'dCmp' : '', args: [] };
    case 'toReversed':
      return { cbMode: '', args: [] };
    case 'with': {
      var w: any[] = [num(), v()];
      return { cbMode: '', args: w };
    }
    default:
      return { cbMode: '', args: [] };
  }
}

/** Pick a random landed op, weighted across the whole surface. */
export function pickOp(landed: string[], rnd: () => number): string {
  return landed[(rnd() * landed.length) | 0];
}

export function methodSetOf(op: string): string {
  return METHOD_SET[op] || '?';
}

export { ALL_METHODS };
