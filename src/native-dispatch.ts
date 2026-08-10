// ESARR native dispatch — the facade wrappers that route the native-backed
// methods through the gate (see native-lane.ts). The pure JSX implementations
// (array-es3.ts / array-es6.ts / array-core.ts) are the authority and the
// fallback: when the gate is off, when the lane cannot handle the call
// (non-int32 elements, holes, custom comparefn, search values outside the
// lane units), when n is outside the BENCH-verified win band, or when the
// native call fails, these wrappers call the pure functions directly —
// identical semantics, no observable difference except speed.
//
// ROUTER (round-3, FRANKENSTEIN directive — decision matrix §10.2 in
// docs/beat-builtin-strategy.md is the binding contract): every routed
// method picks the FASTEST approach per payload class -> size band ->
// availability:
//   sort / reverse / join (default comparator)  -> ENGINE builtin at ALL n
//     for every payload class (rows 1-3, 9-11: the engine is spec-exact —
//     the differential validates the JSX implementation against the same
//     builtin, so delegation never diverges). The native lanes stay
//     disengaged (empty DEFAULT_BANDS); a user-set band (ESARR.setBands)
//     overrides first. Custom-comparator sort NEVER delegates (D7 pinned
//     order — ESARR's own stable merge).
//   toSorted / toReversed -> NATIVE lane [1, 48000] (row 4: no engine
//     builtin exists in ExtendScript; native ~19x vs the JSX fallback);
//     JSX outside the band / gate off.
//   indexOf / lastIndexOf / includes on RAW arrays -> JSX (row 7: the
//     up-front pack kills short-circuit; JSX hit-first is 5-17us).
//   ... on PACKED payloads -> DLL scan via ESARR.scanPacked (row 8:
//     flat 75us-1.34ms, 19x-611x — the caller opted into the pack-once
//     regime; the router cannot retro-detect packed state in ES3).
//   multi-op pipe (ESARR.pipe) -> PACK-ONCE NATIVE for n in [6k, 48k]
//     with >= 2 ops (rows 5: 0.49x-0.73x vs the engine pipe); ENGINE pipe
//     below 6k (row 6: pack-once loses 1.22x-1.64x @2k/4k) and above 48k
//     (row 12: the wire is prohibitive at scale).
//
// ENGINE BUILTIN CAPTURE: the delegation targets are captured at module
// load. install({forceReplace:true}) replaces Array.prototype.sort etc.
// with the ESARR wrappers AFTER eval — a live lookup would recurse through
// the wrapper. The captured references stay the ORIGINAL engine natives.
import {
  join as joinJsx, reverse as reverseJsx, sort as sortJsx
} from './array-es3';
import { toReversed as toReversedJsx, toSorted as toSortedJsx } from './array-es6';
import { indexOf as indexOfJsx, lastIndexOf as lastIndexOfJsx } from './array-core';
import { nativeLanes, nativeScanLanes, nativeBands, nativeOp, packChannel, LaneSet } from './native-lane';
import { unpackArray, unpackArrayInto } from './lane-wire';

var engineSort = Array.prototype.sort;
var engineReverse = Array.prototype.reverse;
var engineJoin = Array.prototype.join;
var engineSlice = Array.prototype.slice;

// Pipe size band (measured, architect B8 — fresh instance, medians):
//   n=2k: packonce/engine 1.64x (LOSS) | 4k: 1.22x (LOSS) | 8k: 0.73x (WIN)
//   | 16k: 0.56x | 32k: 0.54x | 48k: 0.49x (chunked). Engagement threshold
//   ~6k (between the 4k loss and the 8k win). Above 48k the wire is
//   prohibitive (n^2.4-3.8 measured; 536s pack @256k) -> engine pipe.
var PIPE_BAND_LO = 6000;
var PIPE_BAND_HI = 48000;

function lanes(): LaneSet | null {
  try {
    return nativeLanes();
  } catch (e) {
    return null;
  }
}

function inBand(name: string, len: number): boolean {
  var bands = nativeBands();
  var pair = bands[name];
  if (!pair) { return false; }
  return len >= pair[0] && len <= pair[1];
}

export function sort(array: any, comparefn?: any): any {
  // A custom comparefn cannot cross the boundary and NEVER delegates (D7
  // pinned order) — JSX lane always.
  if (comparefn === void 0) {
    var l = lanes();
    var len = (array === null || array === void 0) ? 0 : (Object(array).length >>> 0);
    // user-set band override: explicit force-native opt-in
    if (l && l.sort && inBand('sort', len)) {
      try {
        var r = l.sort(array);
        if (r !== void 0) { return r; }
      } catch (e) { /* fall through */ }
    }
    // ROUTER row 1/9/10: default-comparator sort -> ENGINE builtin (the
    // fastest approach at every measured n; spec-exact for every payload
    // class — the differential proves JSX == builtin on the same corpus).
    // Null/undefined receivers NEVER delegate: the ES3 engine's builtin
    // does not throw on null (live-verify pin), but ES5.1 requires a
    // TypeError — the JSX path (Object(array)) provides it.
    if (array !== null && array !== void 0 && typeof engineSort === 'function') {
      try {
        return engineSort.call(array);
      } catch (e) { /* fall through to JSX */ }
    }
  }
  return sortJsx(array, comparefn);
}

export function reverse(array: any): any {
  var l = lanes();
  var len = (array === null || array === void 0) ? 0 : (Object(array).length >>> 0);
  if (l && l.reverse && inBand('reverse', len)) {
    try {
      var r = l.reverse(array);
      if (r !== void 0) { return r; }
    } catch (e) { /* fall through */ }
  }
  // ROUTER row 2/10: reverse -> ENGINE builtin at all n. Null/undefined
  // receivers never delegate (the ES3 builtin does not throw on null; the
  // JSX path provides the ES5.1 TypeError).
  if (array !== null && array !== void 0 && typeof engineReverse === 'function') {
    try {
      return engineReverse.call(array);
    } catch (e) { /* fall through to JSX */ }
  }
  return reverseJsx(array);
}

export function join(array: any, separator?: any): string {
  var l = lanes();
  var len = (array === null || array === void 0) ? 0 : (Object(array).length >>> 0);
  if (l && l.join && inBand('join', len)) {
    try {
      var r = l.join(array, separator);
      if (r !== void 0) { return r; }
    } catch (e) { /* fall through */ }
  }
  // ROUTER row 3/10/11: join -> ENGINE builtin at all n (strings included:
  // the engine's ToObject char-join is 11x over the gated pack path).
  // Null/undefined receivers never delegate (ES3 builtin does not throw on
  // null; the JSX path provides the ES5.1 TypeError).
  if (array !== null && array !== void 0 && typeof engineJoin === 'function') {
    try {
      return engineJoin.call(array, separator);
    } catch (e) { /* fall through to JSX */ }
  }
  return joinJsx(array, separator);
}

export function toSorted(array: any, comparefn?: any): any[] {
  // A custom comparator cannot cross the boundary — JSX lane always.
  if (comparefn === void 0) {
    var l = lanes();
    if (l && l.toSorted && inBand('toSorted', (array === null || array === void 0) ? 0 : (Object(array).length >>> 0))) {
      try {
        var r = l.toSorted(array);
        if (r !== void 0) { return r; }
      } catch (e) { /* fall through to JSX */ }
    }
  }
  return toSortedJsx(array, comparefn);
}

export function toReversed(array: any): any[] {
  var l = lanes();
  if (l && l.toReversed && inBand('toReversed', (array === null || array === void 0) ? 0 : (Object(array).length >>> 0))) {
    try {
      var r = l.toReversed(array);
      if (r !== void 0) { return r; }
    } catch (e) { /* fall through to JSX */ }
  }
  return toReversedJsx(array);
}

// JSX-ONLY lanes (design doc §2.2, matrix row 7): indexOf/lastIndexOf/
// includes stay pure on RAW arrays (the up-front pack kills short-circuit).
export function indexOf(array: any, searchElement: any, fromIndex?: any): number {
  if (arguments.length > 2) {
    return indexOfJsx(array, searchElement, fromIndex);
  }
  return indexOfJsx(array, searchElement);
}

export function lastIndexOf(array: any, searchElement: any, fromIndex?: any): number {
  if (arguments.length > 2) {
    return lastIndexOfJsx(array, searchElement, fromIndex);
  }
  return lastIndexOfJsx(array, searchElement);
}

export { includes } from './array-es6';

// ---- PACK-ONCE PUBLIC API (round-2/3 — spec §5.2 + §10.4, architect B3/B7/
// B8; THE measured win: 0.73x @8k -> 0.54x @32k vs the engine pipe, 3.3x vs
// per-call). ES3-safe (var-only), bare (string, len) args, chunked > 48k by
// construction, certification per lane at gate enable.

// ESARR.pack(arr) -> channel string | undefined. Classify+pack in ONE pass
// (fast lane: `v === (v|0)` + branchless `>>>0` shift-pack — H4 verdict).
// Returns the byte+1 channel (4 chars/int32, units 1..256, NUL/surrogate-
// free by construction); length inferable = arr.length. undefined =>
// non-int32 element / hole / out-of-range (caller falls back). For n > 48k
// the pack is CHUNKED (16k-elem bounded loops — H2 wedge-safe verdict).
// Non-mutating.
export function pack(array: any): string | void {
  var O = Object(array);
  return packChannel(O, O.length >>> 0);
}

// ESARR.unpack(packed, len?) -> fresh int32[] | undefined. Preallocated +
// indexed writes (the mandated 1.4x-faster pattern). len defaults to
// packed.length >>> 2 (4 chars/elem); when supplied, validates
// units === len*4 (truncated/corrupt channel -> undefined, never OOB).
export function unpack(packed: any, len?: any): number[] | void {
  if (typeof packed !== 'string') return void 0;
  var n = len === void 0 ? (packed.length >>> 2) : len;
  if (!(typeof n === 'number')) return void 0;
  if (n < 0 || Math.floor(n) !== n || n * 4 !== packed.length) return void 0;
  return unpackArray(packed, n);
}

// ESARR.unpackInto(target, packed, len) -> target | undefined. Mutating-
// write variant for in-place workflows (measured 1.6x unpack-fresh — the
// engine's existing-array write path). Same length validation as unpack.
export function unpackInto(target: any, packed: any, len: number): any {
  if (target === null || target === void 0) return void 0;
  if (typeof packed !== 'string') return void 0;
  if (!(typeof len === 'number')) return void 0;
  if (len < 0 || Math.floor(len) !== len || len * 4 !== packed.length) return void 0;
  return unpackArrayInto(target, packed, len);
}

// ESARR.packRun(op, packed, len, sep?) -> packed string | undefined. Runs
// ONE in-wire DLL op directly on the channel string (no repack, single DLL
// call). op is a STRING KEY: 'sort' | 'reverse' | 'join' (by-key — no
// higher-order fns on packed data; arbitrary JS fns cannot read the wire).
// sort/reverse return a PACKED result string (same channel length); join
// returns the plain joined string (sep defaults to ','). undefined => gate
// off / op not engaged / DLL op failed (caller falls back).
export function packRun(op: string, packed: any, len: number, sep?: any): any {
  if (op === 'sort' || op === 'reverse' || op === 'join') {
    return nativeOp(op, packed, len, sep);
  }
  return void 0;
}

// ESARR.scanPacked(op, packed, len, search) -> number | undefined. Runs the
// DLL scan on an ALREADY-PACKED channel string (matrix row 8). op:
// 'indexOf' | 'lastIndexOf' | 'includes' (by-key; maps 1:1 to the DLL
// exports). Returns the index (or -1) for the scan ops, 1|0 for includes.
// undefined => gate off / search not int32 / failure (caller falls back to
// a JSX scan). The search range is the whole payload (fromIndex variants
// stay caller-side per the design doc §1.3.1).
export function scanPacked(op: string, packed: any, len: number, search: any): any {
  if (op === 'indexOf' || op === 'lastIndexOf' || op === 'includes') {
    if (typeof search === 'number' && search === (search | 0)) {
      return nativeOp(op, packed, len, void 0, search);
    }
  }
  return void 0;
}

// ESARR.pipe(arr, ops[]) -> result. Router rows 5/6: multi-op pipeline on
// ONE dense int32 array. ops: array of 'sort'|'reverse'|'join' keys ('join'
// must be last when present; invalid -> undefined). Engages pack-once
// NATIVE only for n in [6k, 48k] with >= 2 ops (measured 0.49x-0.73x vs the
// engine pipe); every other case runs the ENGINE pipe on a clone (engine
// builtins — fastest per the matrix; rows 6/9/10/12). PURE: never mutates
// the input (the engine's chained in-place ops mutate a fresh clone; the
// native pipe is in-wire). The clone treats string receivers as their char
// list (row 11 split+join semantics).
export function pipe(array: any, ops: any): any {
  var O = Object(array);
  var len = O.length >>> 0;
  if (!ops || typeof ops.length !== 'number') return void 0;
  if (ops.length < 1) return void 0;
  var i = 0;
  var lastOp = ops[ops.length - 1];
  for (i = 0; i < ops.length; i++) {
    var op = ops[i];
    if (op !== 'sort' && op !== 'reverse' && op !== 'join') { return void 0; }
    if (op === 'join' && i !== ops.length - 1) { return void 0; }
  }
  var enginePipe = function (): any {
    var clone = engineSlice.call(O);
    var j = 0;
    for (j = 0; j < ops.length; j++) {
      var o = ops[j];
      if (o === 'sort') { engineSort.call(clone); }
      else if (o === 'reverse') { engineReverse.call(clone); }
      else { return engineJoin.call(clone, ','); }
    }
    return clone;
  };
  if (ops.length >= 2 && len >= PIPE_BAND_LO && len <= PIPE_BAND_HI) {
    var p: any = packChannel(O, len);
    if (p !== void 0) {
      var ok = true;
      var k = 0;
      for (k = 0; k < ops.length; k++) {
        var r = nativeOp(ops[k], p, len, ',');
        if (r === void 0) { ok = false; break; }
        p = r;
      }
      if (ok) {
        if (lastOp === 'join') { return p; }
        return unpackArray(p, len);
      }
    }
  }
  return enginePipe();
}
