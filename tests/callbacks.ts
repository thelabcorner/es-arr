// Canonical callback implementations + input rebuilders + the FULL-SURFACE
// vector runners shared by the Node harness (tests/esarr-test-entry.ts), the
// fuzz (tests/fuzz-entry.ts) and the live probe (tests/esarr-live-verify.mjs +
// probe-glue.ts). The literal expectations in vectors.ts were derived from
// these; keeping them in one place guarantees engine agreement implies
// literal agreement.
//
// runVector   -> runs a vector against a core (the ESM bundle in Node, or the
//                ESARR facade in the engine). Pure-function, array-first.
// runNativeVector -> runs the SAME vector against Node's native Array methods
//                (the spec oracle). Both return { ok, result, state? } where
//                state is the post-mutation snapshot for mutating ops.
// deepStrictEquals -> strict structural compare (NaN===NaN, +0!==-0, holes vs
//                undefined, nested arrays/objects). Replaces JSON stringify
//                everywhere fidelity matters.
//
// All ES3-style (var/function): this file is bundled for Node (ESM) and for
// the ExtendScript probe (IIFE, target es5).

import { coreHas } from './surface';
import { isMutating } from './opgen';

/** Rebuild an array-like from the transport protocol (host-neutral). */
export function rebuildInput(p: any): any {
  switch (p.t) {
    case 'array': return p.dense.slice(0);
    case 'string': return p.s;
    case 'null': return null;
    case 'like': {
      var o: any = { length: p.len };
      for (var k in p.set) { if (Object.prototype.hasOwnProperty.call(p.set, k)) { o[k] = p.set[k]; } }
      return o;
    }
    case 'sparse': {
      var a: any[] = [];
      a.length = p.len;
      for (var j in p.set) {
        if (Object.prototype.hasOwnProperty.call(p.set, j)) {
          a[Number(j)] = p.set[j];
        }
      }
      return a;
    }
    default: throw new Error('rebuildInput: unknown protocol ' + p.t);
  }
}

export function isArrayProtocol(p: any): boolean {
  return p && typeof p === 'object' && typeof p.t === 'string';
}

/** Make the callback for a cbMode (with optional arg + thisArg tag). */
export function makeCallback(mode: string, arg: any, state: any): any {
  switch (mode) {
    // ---- existing ES5 modes ----
    case 'sum': return function (v: any): any { return v; };
    case 'prod': return function (v: any): any { return v; };
    case 'concat': return function (v: any): any { return v; };
    case 'count': return function (v: any): any { return v; };
    case 'concatIdx': return function (v: any): any { return v; };
    case 'thisTag': return function (v: any): any { return v; };
    case 'double': return function (v: any): any { return v * 2; };
    case 'doubleSkipUndef': return function (v: any): any { return v === void 0 ? void 0 : v * 2; };
    case 'bang': return function (v: any): any { return v + '!'; };
    case 'idx': return function (v: any): any { return v; };
    case 'plus1': return function (v: any): any { return v + 1; };
    case 'thisTagMap': return function (v: any): any { return v; };
    case 'even': return function (v: any): any { return v % 2 === 0; };
    case 'truthy': return function (v: any): any { return !!v; };
    case 'gt15': return function (v: any): any { return v > 15; };
    case 'gt0': return function (v: any): any { return v > 0; };
    case 'failAt3': return function (v: any): any { return v > 0 && state && state.count !== 3; };
    case 'eq': return function (v: any): any { return v === arg; };
    case 'number': return arg; // non-callable placeholder
    // ---- full-surface random modes (differential + fuzz) ----
    case 'dCb': return function (v: any, i: number): any { return typeof v === 'number' ? v + i : String(v) + '|' + i; };
    case 'dPred': return function (v: any): any { return typeof v === 'number' ? v % 3 === 0 : !!v; };
    case 'dRed': return function (a: any, b: any, i: number): any { return String(a) + '~' + String(b) + '@' + i; };
    case 'dCmp': return function (a: any, b: any): any {
      if (typeof a === 'number' && typeof b === 'number') { return a - b; }
      var sa = String(a), sb = String(b);
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    };
    case 'cmpByK': return function (a: any, b: any): any { return a.k - b.k; };
    case 'dFromMap': return function (v: any, i: number): any { return typeof v === 'number' ? v * 2 + i : String(v) + i; };
    // this-binding probe: 'T' iff `this` is the supplied thisArg. arg = T.
    case 'thisDiff': return function (this: any, v: any, i: number): any { return this === arg ? 'T' : 'U'; };
    // ---- fixed-vector modes for the new methods ----
    case 'firstEven': return function (v: any): any { return typeof v === 'number' && v % 2 === 0; };
    case 'big5': return function (v: any): any { return typeof v === 'number' && v > 5; };
    case 'flatDup': return function (v: any, i: number): any {
      return typeof v === 'number' ? [v, v * 10] : [String(v) + i];
    };
    case 'flatStr': return function (v: any, i: number): any { return [String(v), i]; };
    case 'strIdx': return function (v: any, i: number): any { return String(v) + '#' + i; };
    default: throw new Error('makeCallback: unknown mode ' + mode);
  }
}

/** Snapshot the post-mutation state of an array/array-like (holes preserved). */
export function snapshot(v: any): any {
  if (v === null || v === void 0 || typeof v !== 'object') { return v; }
  if (Object.prototype.toString.call(v) === '[object Array]') {
    var len = v.length >>> 0;
    var out: any[] = [];
    out.length = len;
    var i = 0;
    for (i = 0; i < len; i++) { if (i in v) { out[i] = v[i]; } }
    return out;
  }
  var o: any = {};
  var k: string;
  for (k in v) {
    if (Object.prototype.hasOwnProperty.call(v, k)) { o[k] = v[k]; }
  }
  return o;
}

function isArrayTag(v: any): boolean {
  return Object.prototype.toString.call(v) === '[object Array]';
}

/**
 * Strict structural equality: NaN equals NaN, +0 does NOT equal -0, array
 * holes are distinct from undefined elements, arrays vs plain objects differ,
 * nested values recurse. The faithful comparator for the differential/fuzz
 * (JSON stringify cannot tell NaN from null, -0 from +0, or a hole from an
 * undefined element — all of which the full-surface corpus must catch).
 */
export function deepStrictEquals(a: any, b: any): boolean {
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    if (a !== a && b !== b) { return true; }            // NaN === NaN
    if (a === 0 && b === 0) { return 1 / a === 1 / b; } // -0 vs +0
    return a === b;
  }
  if (isArrayTag(a) !== isArrayTag(b)) { return false; }
  if (isArrayTag(a)) {
    var la = a.length >>> 0, lb = b.length >>> 0;
    if (la !== lb) { return false; }
    for (var i = 0; i < la; i++) {
      var ha = i in a, hb = i in b;
      if (ha !== hb) { return false; }
      if (ha && !deepStrictEquals(a[i], b[i])) { return false; }
    }
    return true;
  }
  var ka: string[] = [], kb: string[] = [], k: string;
  for (k in a) { if (Object.prototype.hasOwnProperty.call(a, k)) { ka[ka.length] = k; } }
  for (k in b) { if (Object.prototype.hasOwnProperty.call(b, k)) { kb[kb.length] = k; } }
  if (ka.length !== kb.length) { return false; }
  for (var j = 0; j < ka.length; j++) {
    if (kb.indexOf(ka[j]) < 0) { return false; }
    if (!deepStrictEquals(a[ka[j]], b[ka[j]])) { return false; }
  }
  return true;
}

/** Collect an iterator (entries/keys/values) via next() — engine-portable. */
export function collectIter(iter: any): any[] {
  var out: any[] = [];
  for (;;) {
    var r = iter.next();
    if (r.done) { return out; }
    out[out.length] = r.value;
  }
}

function nameOf(e: any): string {
  // ExtendScript reports name: "Error" for every error type; instanceof is the
  // only reliable discriminator (same code runs in Node where name works too).
  if (e instanceof TypeError) { return 'TypeError'; }
  var s = String(e && e.name ? e.name : e);
  if (s.indexOf('TypeError') >= 0) { return 'TypeError'; }
  return s;
}

// ---- stateful trace wrappers (fixed-vector modes) ---------------------------
// The wrappers implement the fixed-vector trace semantics (sum/count/...);
// unknown modes pass through to the underlying callback (the differential and
// fuzz rely on this: 'dCb'/'dPred'/'dRed'/'thisDiff' run through the same
// wrapper on BOTH the core side and the native side, so the compared result is
// produced by identical code).

function wrapForTrace(cb: any, mode: string, T: any, state: any): any {
  return function (v: any, i: number, arr: any): void {
    state.count++;
    state.lastIdx = i;
    if (mode === 'sum') {
      if (typeof v === 'number') { state.sum += v; }
      state.out = state.sum;
    } else if (mode === 'count') {
      state.out = state.count;
    } else if (mode === 'concatIdx') {
      state.out = (state.out || '') + v + (i + 1);
    } else if (mode === 'thisTag') {
      var bound = T && typeof T === 'object' && T.tag === 'T';
      state.out = (bound ? 'T' : 'U') + '@' + i;
    } else {
      state.trace[state.trace.length] = cb(v, i, arr);
    }
  };
}

function wrapForMap(cb: any, mode: string, T: any, state: any): any {
  return function (v: any, i: number, arr: any): any {
    state.count++;
    state.lastIdx = i;
    var bound = T && typeof T === 'object' && T.tag === 'T';
    if (mode === 'idx') { return v + (i + 1); }
    if (mode === 'thisTagMap') { return (bound ? 'T' : 'U') + v + i; }
    if (mode === 'failAt3') { return v > 0 && state.count !== 3; }
    return cb(v, i, arr);
  };
}

function wrapReduce(cb: any, mode: string, state: any): any {
  return function (a: any, b: any, i: number, arr: any): any {
    state.count++;
    state.lastIdx = i;
    if (mode === 'sum') { return a + b; }
    if (mode === 'prod') { return a * b; }
    if (mode === 'concat') { return a + b; }
    return cb(a, b, i, arr);
  };
}

function makeState(): any {
  return { count: 0, lastIdx: -1, trace: [], sum: 0, out: null };
}

// Does the op consume a callback selected by cbMode?
function needsCb(op: string, cbMode: string): boolean {
  switch (op) {
    case 'forEach': case 'map': case 'filter': case 'every': case 'some':
    case 'find': case 'findIndex': case 'findLast': case 'findLastIndex':
    case 'flatMap': case 'reduce': case 'reduceRight':
      return true;
    case 'sort': case 'toSorted':
      return cbMode === 'dCmp' || cbMode === 'cmpByK';
    case 'from':
      return cbMode === 'dFromMap' || cbMode === 'strIdx';
    default:
      return false;
  }
}

// The thisArg for the ops that take one (args[0] = thisArg by vector convention).
function thisArgOf(vec: any): any {
  var op = vec.op;
  if (op === 'forEach' || op === 'map' || op === 'filter' || op === 'every' ||
    op === 'some' || op === 'find' || op === 'findIndex' || op === 'findLast' ||
    op === 'findLastIndex' || op === 'flatMap' || op === 'from') {
    return vec.args.length > 0 ? vec.args[0] : void 0;
  }
  return void 0;
}

function buildCb(vec: any, state: any): any {
  var arg0 = vec.args.length > 0 ? vec.args[0] : void 0;
  if (!needsCb(vec.op, vec.cbMode)) { return null; }
  if (vec.cbMode === 'number') { return 5; } // handled in the non-callable branch
  return makeCallback(vec.cbMode, arg0, state);
}

// ---- core (facade) runner ---------------------------------------------------

function callCore(core: any, vec: any, input: any, cb: any, T: any): any {
  var op = vec.op;
  var args = vec.args;
  var mode = vec.cbMode;
  var state = makeState();
  var i = 0;
  switch (op) {
    // ---- ES3 ----
    case 'concat': {
      var ca: any[] = [input];
      for (i = 0; i < args.length; i++) { ca[ca.length] = args[i]; }
      return core.concat.apply(null, ca);
    }
    case 'join': return core.join(input, args.length > 0 ? args[0] : undefined);
    case 'pop': return core.pop(input);
    case 'push': {
      var pa: any[] = [input];
      for (i = 0; i < args.length; i++) { pa[pa.length] = args[i]; }
      return core.push.apply(null, pa);
    }
    case 'reverse': return core.reverse(input);
    case 'shift': return core.shift(input);
    case 'slice': return core.slice(input, args.length > 0 ? args[0] : undefined, args.length > 1 ? args[1] : undefined);
    case 'sort': return core.sort(input, cb === null ? undefined : cb);
    case 'splice': {
      var sp: any[] = [input, args[0]];
      if (args.length > 1) { sp[sp.length] = args[1]; }
      for (i = 2; i < args.length; i++) { sp[sp.length] = args[i]; }
      return core.splice.apply(null, sp);
    }
    case 'unshift': {
      var ua: any[] = [input];
      for (i = 0; i < args.length; i++) { ua[ua.length] = args[i]; }
      return core.unshift.apply(null, ua);
    }
    case 'toString': return core.toString(input);
    // ---- ES5 ----
    case 'forEach':
      core.forEach(input, wrapForTrace(cb, mode, T, state), T);
      return state.out !== null ? state.out : state.trace;
    case 'map': return core.map(input, wrapForMap(cb, mode, T, state), T);
    case 'filter': return core.filter(input, wrapForMap(cb, mode, T, state), T);
    case 'every': return core.every(input, wrapForMap(cb, mode, T, state), T);
    case 'some': return core.some(input, wrapForMap(cb, mode, T, state), T);
    case 'indexOf':
      return core.indexOf(input, args.length > 0 ? args[0] : void 0, args.length > 1 ? args[1] : void 0);
    case 'lastIndexOf':
      if (args.length > 1) { return core.lastIndexOf(input, args[0], args[1]); }
      return core.lastIndexOf(input, args[0]);
    case 'reduce':
      if (args.length > 0) { return core.reduce(input, wrapReduce(cb, mode, state), args[0]); }
      return core.reduce(input, wrapReduce(cb, mode, state));
    case 'reduceRight':
      if (args.length > 0) { return core.reduceRight(input, wrapReduce(cb, mode, state), args[0]); }
      return core.reduceRight(input, wrapReduce(cb, mode, state));
    case 'isArray':
      return core.isArray(args.length > 0 ? args[0] : input);
    // ---- ES6+ ----
    case 'copyWithin':
      if (args.length > 2) { return core.copyWithin(input, args[0], args[1], args[2]); }
      if (args.length > 1) { return core.copyWithin(input, args[0], args[1]); }
      return core.copyWithin(input, args[0]);
    case 'fill':
      if (args.length > 2) { return core.fill(input, args[0], args[1], args[2]); }
      if (args.length > 1) { return core.fill(input, args[0], args[1]); }
      return core.fill(input, args[0]);
    case 'find': return core.find(input, wrapForMap(cb, mode, T, state), T);
    case 'findIndex': return core.findIndex(input, wrapForMap(cb, mode, T, state), T);
    case 'findLast': return core.findLast(input, wrapForMap(cb, mode, T, state), T);
    case 'findLastIndex': return core.findLastIndex(input, wrapForMap(cb, mode, T, state), T);
    case 'flat': return args.length > 0 ? core.flat(input, args[0]) : core.flat(input);
    case 'flatMap': return core.flatMap(input, wrapForMap(cb, mode, T, state), T);
    case 'at': return core.at(input, args.length > 0 ? args[0] : void 0);
    case 'toReversed': return core.toReversed(input);
    case 'toSorted': return core.toSorted(input, cb === null ? undefined : cb);
    case 'with': return core.with(input, args.length > 0 ? args[0] : void 0, args.length > 1 ? args[1] : void 0);
    case 'includes':
      return core.includes(input, args.length > 0 ? args[0] : void 0, args.length > 1 ? args[1] : void 0);
    case 'entries': return collectIter(core.entries(input));
    case 'keys': return collectIter(core.keys(input));
    case 'values': return collectIter(core.values(input));
    case 'from': {
      var fa: any[] = [input];
      if (cb !== null) { fa[fa.length] = cb; }
      if (args.length > 0) { fa[fa.length] = args[0]; }
      return core.from.apply(null, fa);
    }
    case 'of': return core.of.apply(null, args);
    default:
      throw new Error('callCore: unknown op ' + op);
  }
}

/** Concrete input: rebuild protocol shapes, use raw values directly. For
 * mutating ops the input is CLONED per run — the runners must never share a
 * mutable input across the two sides of a comparison. */
function toInput(p: any, mutating: boolean): any {
  var raw = isArrayProtocol(p) ? rebuildInput(p) : p;
  if (!mutating) { return raw; }
  if (raw === null || raw === void 0 || typeof raw !== 'object') { return raw; }
  if (Object.prototype.toString.call(raw) === '[object Array]') {
    var len = raw.length >>> 0;
    var out: any[] = [];
    out.length = len;
    for (var i = 0; i < len; i++) { if (i in raw) { out[i] = raw[i]; } }
    return out;
  }
  var o: any = {};
  var k: string;
  for (k in raw) { if (Object.prototype.hasOwnProperty.call(raw, k)) { o[k] = raw[k]; } }
  return o;
}

/** Run one vector against a core (ESARR facade, array-first). */
export function runVector(vec: any, core: any): any {
  var input = toInput(vec.input, isMutating(vec.op));
  var op = vec.op;
  var T = thisArgOf(vec);
  var state = makeState();
  var cb = buildCb(vec, state);

  if (vec.cbMode === 'number') {
    try {
      switch (op) {
        case 'forEach': core.forEach(input, 5, T); break;
        case 'map': core.map(input, 5, T); break;
        case 'filter': core.filter(input, 5, T); break;
        case 'every': core.every(input, 5, T); break;
        case 'some': core.some(input, 5, T); break;
        case 'find': core.find(input, 5, T); break;
        case 'findIndex': core.findIndex(input, 5, T); break;
        case 'flatMap': core.flatMap(input, 5, T); break;
        case 'sort': core.sort(input, 5); break;
        case 'reduce': core.reduce(input, 5); break;
        case 'reduceRight': core.reduceRight(input, 5); break;
        case 'from': core.from(input, 5, T); break;
        default: break;
      }
      return { ok: false, result: 'NO THROW' };
    } catch (e) {
      return { ok: true, result: nameOf(e) };
    }
  }
  if (vec.expectError) {
    try {
      callCore(core, vec, input, cb, T);
      return { ok: false, result: 'NO THROW' };
    } catch (e) {
      return { ok: true, result: nameOf(e) };
    }
  }
  try {
    var out = callCore(core, vec, input, cb, T);
    if (isMutating(op)) {
      return { ok: true, result: out, state: snapshot(input) };
    }
    return { ok: true, result: out };
  } catch (e) {
    return { ok: false, result: nameOf(e) };
  }
}

// ---- Node-native mirror ------------------------------------------------------

function callNative(NATIVE: any, vec: any, input: any, cb: any, T: any): any {
  var op = vec.op;
  var args = vec.args;
  var mode = vec.cbMode;
  var state = makeState();
  var i = 0;
  switch (op) {
    // ---- ES3 ----
    case 'concat': return NATIVE.concat.apply(input, args);
    case 'join': return NATIVE.join.call(input, args.length > 0 ? args[0] : undefined);
    case 'pop': return NATIVE.pop.call(input);
    case 'push': return NATIVE.push.apply(input, args);
    case 'reverse': return NATIVE.reverse.call(input);
    case 'shift': return NATIVE.shift.call(input);
    case 'slice': return NATIVE.slice.call(input, args.length > 0 ? args[0] : undefined, args.length > 1 ? args[1] : undefined);
    case 'sort': return NATIVE.sort.call(input, cb === null ? undefined : cb);
    case 'splice': return NATIVE.splice.apply(input, args);
    case 'unshift': return NATIVE.unshift.apply(input, args);
    case 'toString': return NATIVE.toString.call(input);
    // ---- ES5 ----
    case 'forEach':
      NATIVE.forEach.call(input, wrapForTrace(cb, mode, T, state), T);
      return state.out !== null ? state.out : state.trace;
    case 'map': return NATIVE.map.call(input, wrapForMap(cb, mode, T, state), T);
    case 'filter': return NATIVE.filter.call(input, wrapForMap(cb, mode, T, state), T);
    case 'every': return NATIVE.every.call(input, wrapForMap(cb, mode, T, state), T);
    case 'some': return NATIVE.some.call(input, wrapForMap(cb, mode, T, state), T);
    case 'indexOf':
      return NATIVE.indexOf.call(input, args.length > 0 ? args[0] : void 0, args.length > 1 ? args[1] : void 0);
    case 'lastIndexOf':
      if (args.length > 1) { return NATIVE.lastIndexOf.call(input, args[0], args[1]); }
      return NATIVE.lastIndexOf.call(input, args[0]);
    case 'reduce':
      if (args.length > 0) { return NATIVE.reduce.call(input, wrapReduce(cb, mode, state), args[0]); }
      return NATIVE.reduce.call(input, wrapReduce(cb, mode, state));
    case 'reduceRight':
      if (args.length > 0) { return NATIVE.reduceRight.call(input, wrapReduce(cb, mode, state), args[0]); }
      return NATIVE.reduceRight.call(input, wrapReduce(cb, mode, state));
    case 'isArray':
      return NATIVE.isArray(args.length > 0 ? args[0] : input);
    // ---- ES6+ ----
    case 'copyWithin':
      if (args.length > 2) { return NATIVE.copyWithin.call(input, args[0], args[1], args[2]); }
      if (args.length > 1) { return NATIVE.copyWithin.call(input, args[0], args[1]); }
      return NATIVE.copyWithin.call(input, args[0]);
    case 'fill':
      if (args.length > 2) { return NATIVE.fill.call(input, args[0], args[1], args[2]); }
      if (args.length > 1) { return NATIVE.fill.call(input, args[0], args[1]); }
      return NATIVE.fill.call(input, args[0]);
    case 'find': return NATIVE.find.call(input, wrapForMap(cb, mode, T, state), T);
    case 'findIndex': return NATIVE.findIndex.call(input, wrapForMap(cb, mode, T, state), T);
    case 'findLast': return NATIVE.findLast.call(input, wrapForMap(cb, mode, T, state), T);
    case 'findLastIndex': return NATIVE.findLastIndex.call(input, wrapForMap(cb, mode, T, state), T);
    case 'flat': return args.length > 0 ? NATIVE.flat.call(input, args[0]) : NATIVE.flat.call(input);
    case 'flatMap': return NATIVE.flatMap.call(input, wrapForMap(cb, mode, T, state), T);
    case 'at': return NATIVE.at.call(input, args.length > 0 ? args[0] : void 0);
    case 'toReversed': return NATIVE.toReversed.call(input);
    case 'toSorted': return NATIVE.toSorted.call(input, cb === null ? undefined : cb);
    case 'with': return NATIVE.with.call(input, args.length > 0 ? args[0] : void 0, args.length > 1 ? args[1] : void 0);
    case 'includes':
      return NATIVE.includes.call(input, args.length > 0 ? args[0] : void 0, args.length > 1 ? args[1] : void 0);
    case 'entries': return collectIter(NATIVE.entries.call(input));
    case 'keys': return collectIter(NATIVE.keys.call(input));
    case 'values': return collectIter(NATIVE.values.call(input));
    case 'from': {
      var fa: any[] = [input];
      if (cb !== null) { fa[fa.length] = cb; }
      if (args.length > 0) { fa[fa.length] = args[0]; }
      return (Array.from as any).apply(null, fa);
    }
    case 'of': return Array.of.apply(null, args);
    default:
      throw new Error('callNative: unknown op ' + op);
  }
}

/** Node-native mirror of runVector: Array.prototype[op].call semantics. */
export function runNativeVector(vec: any, NATIVE: any): any {
  var input = toInput(vec.input, isMutating(vec.op));
  var op = vec.op;
  var T = thisArgOf(vec);
  var state = makeState();
  var cb = buildCb(vec, state);

  if (vec.cbMode === 'number') {
    try {
      switch (op) {
        case 'forEach': NATIVE.forEach.call(input, 5, T); break;
        case 'map': NATIVE.map.call(input, 5, T); break;
        case 'filter': NATIVE.filter.call(input, 5, T); break;
        case 'every': NATIVE.every.call(input, 5, T); break;
        case 'some': NATIVE.some.call(input, 5, T); break;
        case 'find': NATIVE.find.call(input, 5, T); break;
        case 'findIndex': NATIVE.findIndex.call(input, 5, T); break;
        case 'flatMap': NATIVE.flatMap.call(input, 5, T); break;
        case 'sort': NATIVE.sort.call(input, 5); break;
        case 'reduce': NATIVE.reduce.call(input, 5); break;
        case 'reduceRight': NATIVE.reduceRight.call(input, 5); break;
        case 'from': (Array.from as any)(input, 5, T); break;
        default: break;
      }
      return { ok: false, result: 'NO THROW' };
    } catch (e) {
      return { ok: true, result: nameOf(e) };
    }
  }
  try {
    var outN = callNative(NATIVE, vec, input, cb, T);
    if (isMutating(op)) {
      return { ok: true, result: outN, state: snapshot(input) };
    }
    return { ok: true, result: outN };
  } catch (e) {
    return { ok: false, result: nameOf(e) };
  }
}

/** True when the vector's op is available in the given core. */
export function vectorRunnable(vec: any, core: any): boolean {
  return coreHas(vec.op, core);
}

/**
 * DOCUMENTED DEVIATIONS from the Node oracle (design-doc carve-outs, each
 * pinned by a dedicated trap vector in vectors.ts — see
 * docs/verification-report.md):
 *
 *  D3 — lastIndexOf returns ±0: ES5.1 arithmetic yields k = -0 for fromIndex
 *       in (-1, 0) with a hit at index 0 (ToInteger(-0.5) = -0, min(-0,
 *       len-1) = -0); Node v22 normalizes to +0. The ESARR contract is
 *       ES5.1-exact (binding decision, doc §4.5) — pinned by the
 *       'lastIndexOf from -0.5/-0' vectors. Carve-out: accept a ±0
 *       difference in lastIndexOf results ONLY (any other mismatch still
 *       fails).
 *  D7 — sort/toSorted with a comparator that returns NaN for some pair:
 *       ES5.1 §15.4.4.11 makes the order of elements whose comparison
 *       yields NaN implementation-defined; V8's TimSort run-detection
 *       happens to never compare certain pairs (e.g. [3,NaN,1].sort(a-b)
 *       -> V8 [3,NaN,1], ESARR stable-merge -> [1,3,NaN]). ESARR pins a
 *       deterministic order — pinned by the 'sort comparator NaN ...'
 *       vector. Carve-out: when the comparator is non-transitive (input
 *       contains NaN, or mixes numbers with non-numbers — dCmp's
 *       numeric/String hybrid is not a strict weak ordering there) and the
 *       results are permutations of each other, accept. Homogeneous inputs
 *       are still strictly compared.
 */
export function carveOutAccept(vec: any, ours: any, theirs: any): boolean {
  var op = vec.op;
  if (ours.ok && theirs.ok) {
    // D3: lastIndexOf ±0 result difference (ES5.1-exact lane).
    if (op === 'lastIndexOf' && typeof ours.result === 'number' &&
      typeof theirs.result === 'number' && ours.result === 0 && theirs.result === 0) {
      return true;
    }
    // D7: NaN/mixed-type comparator on sort/toSorted — any permutation accepted.
    if ((op === 'sort' || op === 'toSorted') && vec.cbMode === 'dCmp') {
      var input = toInput(vec.input, false);
      if (input !== null && typeof input === 'object' &&
        (containsNaN(input) || mixesTypes(input)) &&
        sameValueMultiset(ours.result, theirs.result)) {
        return true;
      }
    }
  }
  return false;
}

function containsNaN(v: any): boolean {
  if (typeof v === 'number') { return v !== v; }
  if (v === null || typeof v !== 'object') { return false; }
  var len = v.length >>> 0;
  for (var i = 0; i < len; i++) {
    if (i in v && v[i] !== v[i]) { return true; }
  }
  return false;
}

// dCmp is non-transitive when numbers mix with non-numbers (numeric verdicts
// for number pairs, String verdicts otherwise) — the sort order is then
// implementation-defined (same class as the NaN verdicts).
function mixesTypes(v: any): boolean {
  if (v === null || typeof v !== 'object') { return false; }
  var len = v.length >>> 0;
  var hasNum = false;
  var hasNonNum = false;
  for (var i = 0; i < len; i++) {
    if (!(i in v)) { continue; }
    if (typeof v[i] === 'number') { hasNum = true; } else { hasNonNum = true; }
  }
  return hasNum && hasNonNum;
}

/** Collect the sorted present values of an array OR an array-like object
 * result (keys except 'length') for multiset comparison. */
function collectValues(v: any): any[] {
  var out: any[] = [];
  if (Array.isArray(v)) {
    for (var i = 0; i < v.length; i++) {
      if (i in v) { out[out.length] = v[i]; }
    }
    return out;
  }
  for (var k in v) {
    if (Object.prototype.hasOwnProperty.call(v, k) && k !== 'length') {
      out[out.length] = v[k];
    }
  }
  return out;
}

function sameValueMultiset(a: any, b: any): boolean {
  var av = collectValues(a);
  var bv = collectValues(b);
  if (av.length !== bv.length) { return false; }
  var seen: boolean[] = new Array(bv.length);
  var i = 0;
  for (i = 0; i < bv.length; i++) { seen[i] = false; }
  for (i = 0; i < av.length; i++) {
    var found = false;
    for (var j = 0; j < bv.length; j++) {
      if (!seen[j] && Object.is(av[i], bv[j])) { seen[j] = true; found = true; break; }
    }
    if (!found) { return false; }
  }
  return true;
}

/** Serialize a result to a JSON-safe protocol (holes -> null, undefined -> null). */
export function toProtocol(v: any): any {
  return v;
}
