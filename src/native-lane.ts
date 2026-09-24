// ESARR native gate — the ExternalObject-accelerated lane dispatcher.
//
// Mirrors ESON's native-lane.ts state machine (ESON is the reference
// template; see eson/src/native-lane.ts):
//   enableNativeGateState({ lib, dllPath }) — disable first, presence-probe
//     ExternalObject, load the lib (externally provided lib wins — that is
//     the espack path), smoke (version/ping), then certify every lane
//     against the JSX authority on a numeric corpus. Per-lane certification:
//     a lane that disagrees with the JSX implementation is excluded, never
//     trusted; if NO lane certifies, the gate is inactive and every method
//     runs the pure-JSX path with byte-identical semantics.
//   disableNativeGateState() — teardown.
//   nativeLanes() — the active lane provider (null when the gate is off).
//   nativeGateSnapshot() — EsarrNativeCaps.
//
// LANE PARTITION (design doc §2, final): the native win is on the engine's
// pathologically slow built-ins over PACKED INT32 payloads only:
//   sort / toSorted / reverse / toReversed / join (n >= band)
// indexOf / lastIndexOf / includes are JSX-ONLY (§2.2 — the pack is
// up-front, so an early hit that JSX finds in µs would pay a 1 s pack; the
// DLL exports arrIndexOf/arrLastIndexOf/arrIncludes but the dispatch does
// NOT engage them). Callback methods (forEach/map/filter/every/some/reduce/
// reduceRight/find/findLast/findLastIndex/flatMap/from) and the read-bound
// lanes (concat/slice/at) are JSX-ONLY too. Every native lane classifies +
// packs in ONE pass (no pre-scan): a non-int32 element, a hole, a non-finite
// number, or a search value outside the lane units sends the call down the
// JSX path (the lane returns undefined). Any native throw or malformed
// result also falls back. The gate is therefore SAFE when the DLL is absent:
// pure JSX with identical semantics is the default state.
//
// BANDS (design doc §6, configurable via ESARR.bands): sort/toSorted n in
// [4k, 48k]; reverse/toReversed n in [16k, 48k]; join n in [32k, 48k].
// WEDGE CAP = 48k elements (HARD upper bound — the classify+pack loop
// wedges the engine at >= ~64k; reproduced twice). Above the band -> JSX/
// engine (correct, slow); NEVER chunked packs for sort (a chunked sort is
// incorrect — the sort key spans chunks).
//
// DLL contract (design doc §1, native-coder): ESARRArray.dll, ESInitialize
// signature "arrSort_sd,arrReverse_sd,arrJoin_sds,arrIndexOf_sdd,
// arrLastIndexOf_sdd,arrIncludes_sdd,ping_d,version_s"; wire = byte+1 int32
// packing (lane-wire.ts); array lanes return packed ESABI_TYPE_STRING, join
// returns a plain string, indexOf-family returns a number; errors >= 10000
// -> JSX fallback. ping(0) === 42; version_s returns a STRING banner (the
// smoke reads it as a string, not a number). The scan methods take
// (packed, len, searchInt) with the payload JSX-pre-sliced to the search
// range; the dispatch does NOT engage them (JSX-ONLY per §2.2).
import { NativeGateOptions, EsarrNativeCaps } from './types';
import { packArray, unpackArray, unpackArrayInto, unpackInt32At } from './lane-wire';
import { join as joinJsx, reverse as reverseJsx, sort as sortJsx } from './array-es3';
import { toReversed as toReversedJsx, toSorted as toSortedJsx } from './array-es6';
import { indexOf as indexOfJsx, lastIndexOf as lastIndexOfJsx } from './array-core';
import { includes as includesJsx } from './array-es6';

// Lane predicate: int32 only (the wire units). Floats, NaN, +/-Infinity,
// strings, objects, undefined/null elements classify OUT (JSX lane).
// FAST CLASSIFY (round-2, H4 verdict — architect, 2026-08-10): `v === (v|0)`
// is behavior-identical to the round-1 floor/range checks (Node-verified:
// holes/NaN/float/-0/out-of-int32 all classify identically — `-0 === 0` is
// true in JS, so -0 classifies as 0 exactly as before) and skips the
// Math.floor + bounds compares in the hot loop.
function isLaneInt(v: any): boolean {
  return typeof v === 'number' && v === (v | 0);
}

export interface LaneFn {
  (a: any, b?: any, c?: any): any;
}

// Per-method lane shape: same calling convention as the pure JSX function
// (array first) so certification can diff lane vs JSX authority directly.
export interface LaneSet {
  sort: LaneFn;
  toSorted: LaneFn;
  reverse: LaneFn;
  toReversed: LaneFn;
  join: LaneFn;
}

// Default win bands (design doc §6; BENCH tables drive these — configurable
// via ESARR.bands). WEDGE CAP is a hard upper bound, never exceeded.
export interface Bands {
  sort: [number, number];
  toSorted: [number, number];
  reverse: [number, number];
  toReversed: [number, number];
  join: [number, number];
  [key: string]: [number, number];
}

// DEFAULT WIN BANDS — ROUND-1 DATA-DERIVED (benchmarker2, T6; replaces the
// doc §6 folklore that round 1 REFUTED). Round-1 measured, healthy instance,
// fused wire, optimized ESARRArray.dll (canonical; pre-promotion name
// ESARRArray3), dense int32 mixedFull/asc/desc:
//   - sort/reverse/join: the gated native lane does NOT beat the engine
//     builtin at ANY measured size (sort 2.32x@2k -> 1.33x@8k -> 1.26x@16k
//     -> 1.06-1.21x@32k measured; reverse 6.3x@8k; join 2.0x@8k — never
//     <1.0). The dispatch keeps these on the ENGINE path by default (empty
//     band = never engage). Honest-win doctrine: no manufactured wins.
//   - toSorted/toReversed: NO ENGINE BUILTIN EXISTS (ES2023 methods missing
//     in ExtendScript). Their only alternative is the pure-JSX fallback,
//     which the native lane beats ~19x (0.05x ratio @8k). The native lane
//     engages for THESE by construction — strict-engagement guarantee: the
//     DLL path wins against the only competitor wherever it engages.
// Users can override any band via ESARR.setBands (documented, opt-in).
export var DEFAULT_BANDS: Bands = {
  sort: [1, 0],        // disengaged: engine builtin wins at all measured n
  toSorted: [1, 48000],// engaged: no builtin exists; native ~19x vs JSX
  reverse: [1, 0],     // disengaged: engine reverse is linear-cheap
  toReversed: [1, 48000], // engaged: no builtin exists; native ~19x vs JSX
  join: [1, 0]         // disengaged: engine join wins at all measured n
};

var WEDGE_CAP = 48000;

var state: {
  present: boolean;
  active: boolean;
  reason: string;
  lib: any;
  dll: string;
  dllVersion: string;
  lanes: LaneSet | null;
  activeNames: string[];
  scanLanes: ScanLaneSet | null;
  scanActiveNames: string[];
  certified: number;
  bands: Bands;
} = {
  present: false,
  active: false,
  reason: '',
  lib: null,
  dll: '',
  dllVersion: '',
  lanes: null,
  activeNames: [],
  scanLanes: null,
  scanActiveNames: [],
  certified: 0,
  bands: DEFAULT_BANDS
};

// Packed-payload scan lanes (round-3 router, matrix §10.2 row 8 — architect
// B7): the DLL scan exports (arrIndexOf/arrLastIndexOf/arrIncludes) run on an
// ALREADY-PACKED channel string and are essentially FLAT (75us @2k ->
// 1.34ms @32k, 19x-611x vs the JSX scan on misses/deep hits). The router
// engages them ONLY on packed payloads (ESARR.scanPacked) — never a raw
// array (the up-front pack kills per-call short-circuit; JSX hit-first is
// 5-17us). Same shape as the array lanes: (packed, len, search) -> number.
// DLL semantics (native-c verified 570/570 + 114/114x3 to 256k): indexOf =
// first index or -1; lastIndexOf = last index scanning down or -1; includes
// = 1 if present else 0. Full-range scans; fromIndex normalization is
// caller-side (JSX) per the design doc §1.3.1.
export interface ScanLaneSet {
  indexOf: LaneFn;
  lastIndexOf: LaneFn;
  includes: LaneFn;
}

// ---- lane builders: classify+pack in ONE pass, native op, unpack ----
//
// PASS FUSION (benchmarker2, T6 opt): the round-1 component data showed the
// JSX wire dominates the native lanes (classify 55ms + pack 77ms + unpack
// 50ms + writeback 107ms @8k = 289ms total). The original builders ran FOUR
// passes over the data (classify into vals[], pack from vals[], unpack into
// res[], writeback res[] -> O). These builders run TWO: classify+pack fused
// into a single loop that packs directly from O (no vals[] intermediate),
// and unpack writes straight into the target (for mutating lanes the target
// IS O — no res[] intermediate, no writeback pass). Semantics identical:
// sort/reverse mutate O and return it; toSorted/toReversed return a fresh
// array; join returns the string. The certification corpus + the gate-on
// differential (incl. in-place mutation checks) guard the fusion.

// classify+pack fused: returns the channel string, or void 0 on the first
// non-lane element/hole (fall back to JSX).
// CHUNKED (round-2, H2 verdict): the inner loop is bounded at
// PACK_CHUNK_ELEMS elements (16k -> 64k channel chars); the outer loop
// concatenates chunk strings. Wedge-safe by construction — never one
// unbounded String.fromCharCode loop (round-1: the single pack loop wedged
// the engine at >= ~64k elements, reproduced twice). Byte-identical channel
// (Node-verified + live at 64k/128k/256k — architect B4/B5).
// BRANCHLESS (round-2, H4 verdict): `v === (v|0)` classify + `>>>0` shift
// pack, no two's-complement temp; -7.4% wire @32k.
var PACK_CHUNK_ELEMS = 16384;

export function packChannel(O: any, len: number): string | void {
  var s = '';
  var k = 0;
  while (k < len) {
    var end = k + PACK_CHUNK_ELEMS;
    if (end > len) { end = len; }
    var c = '';
    for (; k < end; k++) {
      if (!(k in O)) return void 0;
      var v = O[k];
      if (!isLaneInt(v)) return void 0;
      // Types-for-Adobe declares fromCharCode with one parameter; the engine's
      // varargs form is the hot path here (compile-time declaration-shape cast
      // only, same pattern as ESB64).
      c += (String.fromCharCode as any)(((v >>> 24) & 255) + 1, ((v >>> 16) & 255) + 1, ((v >>> 8) & 255) + 1, (v & 255) + 1);
    }
    s += c;
  }
  return s;
}

// unpack: writes into `target` directly (mutating lanes pass O — one pass,
// no intermediate array, no separate writeback). Returns target.
function unpackLaneInto(target: any, channel: string, len: number): any {
  var k = 0;
  for (k = 0; k < len; k++) {
    target[k] = unpackInt32At(channel, k * 4);
  }
  return target;
}

// mutate=true: sort/reverse write the result back into O (ES5.1 in-place)
// and return O. mutate=false: toSorted/toReversed build a fresh array.
function makeSortLane(lib: any, mutate: boolean): LaneFn {
  return function (array: any): any {
    var O = Object(array);
    var len = O.length >>> 0;
    var packed = packChannel(O, len);
    if (packed === void 0) return void 0;
    try {
      var out = lib.arrSort(packed, len);
      if (typeof out !== 'string') return void 0;
      if (mutate) {
        return unpackLaneInto(O, out, len);
      }
      return unpackLaneInto(new Array(len), out, len);
    } catch (e) {
      return void 0;
    }
  };
}

function makeReverseLane(lib: any, mutate: boolean): LaneFn {
  return function (array: any): any {
    var O = Object(array);
    var len = O.length >>> 0;
    var packed = packChannel(O, len);
    if (packed === void 0) return void 0;
    try {
      var out = lib.arrReverse(packed, len);
      if (typeof out !== 'string') return void 0;
      if (mutate) {
        return unpackLaneInto(O, out, len);
      }
      return unpackLaneInto(new Array(len), out, len);
    } catch (e) {
      return void 0;
    }
  };
}

function makeJoinLane(lib: any): LaneFn {
  return function (array: any, separator: any): any {
    var O = Object(array);
    var len = O.length >>> 0;
    var sep = separator === void 0 ? ',' : String(separator);
    var packed = packChannel(O, len);
    if (packed === void 0) return void 0;
    try {
      var out = lib.arrJoin(packed, len, sep);
      if (typeof out !== 'string') return void 0;
      return out;
    } catch (e) {
      return void 0;
    }
  };
}

// ---- certification (per-lane vs the JSX authority) ----

function arraysEqual(a: any, b: any): boolean {
  if (a.length !== b.length) return false;
  var i = 0;
  for (i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Each case: [lane name, jsx authority, input, args, expected].
var CORPUS: any[] = [
  ['sort', sortJsx, [3, 1, 2], [], [1, 2, 3]],
  ['sort', sortJsx, [-5, 0, 7, 4], [], [-5, 0, 4, 7]],
  ['sort', sortJsx, [2, 2, 1, 1], [], [1, 1, 2, 2]],
  // default sort is ToString-lexicographic — "-1" < "-5" (a numeric sort
  // would give [-5,-1] and must be disqualified)
  ['sort', sortJsx, [-1, -5, 3], [], [-1, -5, 3]],
  // mandatory ToString-order vectors (design doc §4.3)
  ['sort', sortJsx, [10, 9, 1, 2], [], [1, 10, 2, 9]],
  ['sort', sortJsx, [1000, 100, 10, 1], [], [1, 10, 100, 1000]],
  // surrogate-window byte values (verifier-mandated): bytes 0xD7-0xDE map
  // to units 0xD8-0xDF under a byte+1 wire (dropped at the UTF-8 boundary) —
  // the 8-nibble wire packs these safely, and the corpus must exercise them
  // so a broken wire self-disqualifies at enable. Values are SIGNED int32
  // (0xD7000000 as a JS literal is +3607101440, outside int32; the signed
  // form -687865856 carries the same 0xD7 byte in the top position).
  ['sort', sortJsx, [0x0000D700, 1, 2], [], [1, 2, 0x0000D700]],
  ['sort', sortJsx, [0x00D70000, -1, 5], [], [-1, 5, 0x00D70000]],
  ['sort', sortJsx, [-687865856, 0, 3], [], [-687865856, 0, 3]],
  ['sort', sortJsx, [0x7FFFFFD7, -2, 9], [], [-2, 9, 0x7FFFFFD7]],
  ['sort', sortJsx, [-3000000, 1, 7], [], [-3000000, 1, 7]],
  ['reverse', reverseJsx, [1, 2, 3], [], [3, 2, 1]],
  ['reverse', reverseJsx, [5], [], [5]],
  ['toSorted', toSortedJsx, [3, 1, 2], [], [1, 2, 3]],
  ['toSorted', toSortedJsx, [10, 9, 1, 2], [], [1, 10, 2, 9]],
  ['toReversed', toReversedJsx, [1, 2, 3], [], [3, 2, 1]],
  ['join', joinJsx, [1, 2, 3], [], '1,2,3'],
  ['join', joinJsx, [], [], ''],
  ['join', joinJsx, [1, 2, 3], ['-'], '1-2-3'],
  ['join', joinJsx, [-5, 0, 7], [','], '-5,0,7']
];

var LANE_BUILDERS: any = {
  sort: function (lib: any): LaneFn { return makeSortLane(lib, true); },
  toSorted: function (lib: any): LaneFn { return makeSortLane(lib, false); },
  reverse: function (lib: any): LaneFn { return makeReverseLane(lib, true); },
  toReversed: function (lib: any): LaneFn { return makeReverseLane(lib, false); },
  join: makeJoinLane
};

function certifyLanes(lib: any): { lanes: LaneSet; activeNames: string[]; certified: number; failures: string[] } {
  var lanes: any = {};
  var activeNames: string[] = [];
  var certified = 0;
  var failures: string[] = [];
  var i = 0;
  for (i = 0; i < CORPUS.length; i++) {
    var name = CORPUS[i][0];
    if (lanes[name] === undefined) {
      // build once per lane name
      var built: LaneFn | null = null;
      try {
        built = LANE_BUILDERS[name](lib);
      } catch (e) {
        built = null;
      }
      if (!built) {
        failures[failures.length] = name + ': lane builder failed';
        lanes[name] = null;
        continue;
      }
      lanes[name] = built;
    }
    var laneFn = lanes[name];
    if (laneFn === null) continue; // already failed
    var jsxFn = CORPUS[i][1];
    var input = CORPUS[i][2];
    var args = CORPUS[i][3];
    var expected = CORPUS[i][4];
    var laneOut: any;
    var jsxOut: any;
    // MUTATION-SAFE CERTIFICATION: the mutating lanes (sort/reverse) now
    // write back into the input array (ES5.1 in-place). Calling the lane
    // FIRST on the shared corpus input would mutate it, so the JSX authority
    // would then sort the ALREADY-MUTATED array and "agree" with a broken
    // lane (a garbage lib certifies — reproduced in the T6 fusion). Each
    // side gets its OWN copy of the input; the corpus compares VALUES (the
    // in-place mutation contract itself is asserted by the live gate-on
    // differential, not by this value comparison).
    // Call both with the EXACT corpus args (apply — never append extra
    // undefined arguments).
    try { laneOut = laneFn.apply(null, [input.slice(0)].concat(args)); } catch (e) { laneOut = void 0; }
    try { jsxOut = jsxFn.apply(null, [input.slice(0)].concat(args)); } catch (e) { jsxOut = void 0; }
    var ok = false;
    if (laneOut !== void 0 && jsxOut !== void 0) {
      if (typeof laneOut === 'string' && typeof jsxOut === 'string') {
        ok = laneOut === jsxOut;
      } else if (typeof laneOut === 'number' && typeof jsxOut === 'number') {
        ok = laneOut === jsxOut;
      } else if (typeof laneOut === 'boolean' && typeof jsxOut === 'boolean') {
        ok = laneOut === jsxOut;
      } else if (laneOut.length !== void 0 && jsxOut.length !== void 0) {
        ok = arraysEqual(laneOut, jsxOut);
      }
    }
    if (ok) {
      certified++;
    } else {
      failures[failures.length] = name + ': corpus case "' + String(expected) + '" -> native ' + String(laneOut) + ' jsx ' + String(jsxOut);
      lanes[name] = null; // a single mismatch disqualifies the lane
    }
  }
  // a lane is active iff every corpus case for it passed
  var names = ['sort', 'toSorted', 'reverse', 'toReversed', 'join'];
  var n2 = 0;
  for (n2 = 0; n2 < names.length; n2++) {
    if (lanes[names[n2]] !== null && lanes[names[n2]] !== undefined) {
      activeNames[activeNames.length] = names[n2];
    }
  }
  return { lanes: lanes as LaneSet, activeNames: activeNames, certified: certified, failures: failures };
}

// ---- packed-payload scan lanes (matrix row 8) --------------------------------

// Scan lane builder: (packed, len, search) -> number. The DLL scan exports
// take the ALREADY-PACKED channel string (no classify — the caller packed);
// the lane validates the channel length (units === len*4) and the result
// type. Errors >= 10000 (host error) or malformed results -> void 0 (fallback).
function makeScanLane(lib: any, op: string): LaneFn {
  return function (packed: any, len: number, search: any): any {
    if (typeof packed !== 'string') return void 0;
    if (!(typeof len === 'number')) return void 0;
    if (len < 0 || len * 4 !== packed.length) return void 0;
    try {
      var out: any;
      if (op === 'indexOf') { out = lib.arrIndexOf(packed, len, search); }
      else if (op === 'lastIndexOf') { out = lib.arrLastIndexOf(packed, len, search); }
      else { out = lib.arrIncludes(packed, len, search); }
      if (typeof out !== 'number') return void 0;
      return out;
    } catch (e) {
      return void 0;
    }
  };
}

// Scan certification corpus. Shape: [name, jsxAuthority(values, search), values, search, expected].
// The lane side gets the PACKED channel (packArray) + len; the authority gets
// the values array + search. includes authority returns boolean; the lane
// returns 1/0 (DLL contract) — the comparison normalizes.
var SCAN_CORPUS: any[] = [
  ['indexOf', indexOfJsx, [1, 2, 3], 2, 1],
  ['indexOf', indexOfJsx, [1, 2, 3], 9, -1],
  ['indexOf', indexOfJsx, [1, 2, 3, 2], 2, 1],
  ['indexOf', indexOfJsx, [], 1, -1],
  ['indexOf', indexOfJsx, [-5, 0, 7], 0, 1],
  ['indexOf', indexOfJsx, [1, 2, 3], -1, -1],
  // surrogate-window byte values (verifier-mandated — the wire must round-trip
  // units 216-223, incl. in the top byte of a SIGNED int32)
  ['indexOf', indexOfJsx, [-687865856, 0, 3], -687865856, 0],
  ['indexOf', indexOfJsx, [0x00D70000, 1, 2], 1, 1],
  ['lastIndexOf', lastIndexOfJsx, [1, 2, 3, 2], 2, 3],
  ['lastIndexOf', lastIndexOfJsx, [1, 2, 3], 9, -1],
  ['lastIndexOf', lastIndexOfJsx, [], 1, -1],
  ['lastIndexOf', lastIndexOfJsx, [2, 2, 2], 2, 2],
  ['lastIndexOf', lastIndexOfJsx, [0x7FFFFFD7, -2, 9], -2, 1],
  ['includes', includesJsx, [1, 2, 3], 2, true],
  ['includes', includesJsx, [1, 2, 3], 9, false],
  ['includes', includesJsx, [], 1, false],
  ['includes', includesJsx, [-687865856, 0, 3], 0, true],
  ['includes', includesJsx, [0x00D70000, 1, 2], 0x00D70000, true]
];

var SCAN_BUILDERS: any = {
  indexOf: function (lib: any): LaneFn { return makeScanLane(lib, 'indexOf'); },
  lastIndexOf: function (lib: any): LaneFn { return makeScanLane(lib, 'lastIndexOf'); },
  includes: function (lib: any): LaneFn { return makeScanLane(lib, 'includes'); }
};

function certifyScanLanes(lib: any): { lanes: ScanLaneSet; activeNames: string[]; certified: number; failures: string[] } {
  var lanes: any = {};
  var activeNames: string[] = [];
  var certified = 0;
  var failures: string[] = [];
  var i = 0;
  for (i = 0; i < SCAN_CORPUS.length; i++) {
    var name = SCAN_CORPUS[i][0];
    if (lanes[name] === undefined) {
      var built: LaneFn | null = null;
      try {
        built = SCAN_BUILDERS[name](lib);
      } catch (e) {
        built = null;
      }
      if (!built) {
        failures[failures.length] = name + ': scan lane builder failed';
        lanes[name] = null;
        continue;
      }
      lanes[name] = built;
    }
    var laneFn = lanes[name];
    if (laneFn === null) continue;
    var jsxFn = SCAN_CORPUS[i][1];
    var values = SCAN_CORPUS[i][2];
    var search = SCAN_CORPUS[i][3];
    var expected = SCAN_CORPUS[i][4];
    var packed = packArray(values, values.length);
    var laneOut: any;
    var jsxOut: any;
    try { laneOut = laneFn(packed, values.length, search); } catch (e) { laneOut = void 0; }
    try { jsxOut = jsxFn(values, search); } catch (e) { jsxOut = void 0; }
    var ok = false;
    if (laneOut !== void 0 && jsxOut !== void 0) {
      if (name === 'includes') {
        ok = (laneOut === 1) === jsxOut;
      } else {
        ok = laneOut === jsxOut;
      }
    }
    if (ok) {
      certified++;
    } else {
      failures[failures.length] = name + ': scan corpus case search=' + String(search) +
        ' -> native ' + String(laneOut) + ' jsx ' + String(jsxOut);
      lanes[name] = null;
    }
  }
  var snames = ['indexOf', 'lastIndexOf', 'includes'];
  var s2 = 0;
  for (s2 = 0; s2 < snames.length; s2++) {
    if (lanes[snames[s2]] !== null && lanes[snames[s2]] !== undefined) {
      activeNames[activeNames.length] = snames[s2];
    }
  }
  return { lanes: lanes as ScanLaneSet, activeNames: activeNames, certified: certified, failures: failures };
}

// ---- host glue (ExternalObject; never touched in Node tests) --------------

export function enableNativeGateState(options?: NativeGateOptions): EsarrNativeCaps {
  disableNativeGateState();
  var opts = options || {};
  var present = false;
  if (!opts.provideLib && !opts.lib) {
    try {
      present = typeof ExternalObject !== 'undefined' && ExternalObject !== null;
    } catch (e) {
      present = false;
    }
  } else {
    present = true;
  }
  state.present = present;
  if (!present) {
    state.reason = 'ExternalObject not available in this engine';
    return snapshot();
  }
  var lib: any = null;
  if (opts.lib) {
    lib = opts.lib;
    state.dll = opts.dllPath || 'external';
  } else if (opts.provideLib) {
    try {
      lib = opts.provideLib();
    } catch (e) {
      lib = null;
    }
  } else {
    try {
      var dir = opts.dir || '';
      if (dir.length > 0) {
        // Types-for-Adobe's ExternalObjectConstructor omits searchFolders;
        // the engine provides it (compile-time declaration-shape cast only).
        var eo: any = ExternalObject;
        eo.searchFolders = dir + ';' + (eo.searchFolders || '');
      }
      var libName = opts.libName || 'ESARRArray';
      lib = new ExternalObject('lib:' + libName);
      state.dll = libName;
    } catch (e) {
      lib = null;
      state.dll = opts.libName || 'ESARRArray';
    }
  }
  if (!lib) {
    state.reason = 'ESARRArray DLL failed to load (is it built? native/bin/ESARRArray.dll)';
    return snapshot();
  }
  state.lib = lib;

  // smoke: the methods the gate actually uses must bind and answer
  // (version/ping FIRST — per-DLL binding flakiness: keep critical methods
  // early in the probe order). version_s returns a STRING banner (design
  // doc §1.3) — read as a string, never Number()-coerced.
  var ver = '';
  var ping = -1;
  var expectedPing = opts.ping === void 0 ? 42 : opts.ping;
  try {
    ver = String(lib.version(0));
    ping = Number(lib.ping(0));
  } catch (e) {
    state.reason = 'smoke failed: ' + String(e);
    return teardown();
  }
  if (ping !== expectedPing) {
    state.reason = 'smoke failed: ping returned ' + String(ping) + ' (wrong DLL?)';
    return teardown();
  }
  state.dllVersion = ver;

  var cert = certifyLanes(lib);
  if (cert.activeNames.length === 0) {
    state.reason = 'no lane certified against the JSX authority (' + cert.failures.length + ' failures): ' +
      (cert.failures.length > 0 ? cert.failures[0] : 'empty corpus');
    return teardown();
  }
  state.lanes = cert.lanes;
  state.activeNames = cert.activeNames;
  state.certified = cert.certified;
  // packed-payload scan lanes (matrix row 8): certified separately; scan
  // failure alone does NOT disable the gate (the array lanes carry the
  // gate), it just leaves scanPacked in the JSX-fallback state.
  var scanCert = certifyScanLanes(lib);
  state.scanLanes = scanCert.activeNames.length > 0 ? scanCert.lanes : null;
  state.scanActiveNames = scanCert.activeNames;
  state.certified += scanCert.certified;
  state.active = true;
  state.reason = '';
  return snapshot();
}

// Override the win bands (design doc §6: bands are configurable constants
// driven by the BENCH tables, not hardcoded folklore). The wedge cap is a
// hard upper bound and can never be raised above 48k.
export function setNativeBands(bands: any): void {
  var b = bands || {};
  var lo: number;
  var hi: number;
  var keys = ['sort', 'toSorted', 'reverse', 'toReversed', 'join'];
  var i = 0;
  for (i = 0; i < keys.length; i++) {
    var pair = b[keys[i]];
    if (pair && typeof pair[0] === 'number' && typeof pair[1] === 'number') {
      lo = pair[0] < 0 ? 0 : pair[0];
      hi = pair[1] > WEDGE_CAP ? WEDGE_CAP : pair[1];
      if (hi <= lo) { continue; }
      state.bands[keys[i]] = [lo, hi];
    }
  }
}

export function nativeBands(): Bands {
  return state.bands;
}

export function disableNativeGateState(): void {
  if (state.lib) {
    try {
      state.lib.unload();
    } catch (e) {
      // a loaded DLL stays locked until the session ends regardless
    }
  }
  state.lib = null;
  state.lanes = null;
  state.activeNames = [];
  state.scanLanes = null;
  state.scanActiveNames = [];
  state.active = false;
  state.reason = '';
  state.dll = '';
  state.dllVersion = '';
  state.certified = 0;
}

// Failure teardown: unload the lib and reset gate state while PRESERVING
// state.reason (the caller sets it before calling teardown).
function teardown(): EsarrNativeCaps {
  try {
    if (state.lib && typeof state.lib.unload === 'function') state.lib.unload();
  } catch (e) {
    // unload failure is not worth reporting over the enable failure
  }
  state.lib = null;
  state.lanes = null;
  state.activeNames = [];
  state.scanLanes = null;
  state.scanActiveNames = [];
  state.certified = 0;
  return snapshot();
}

export function nativeLanes(): LaneSet | null {
  return state.active ? state.lanes : null;
}

export function nativeScanLanes(): ScanLaneSet | null {
  return state.active ? state.scanLanes : null;
}

// Raw in-wire DLL op for the pack-once API (ESARR.packRun / ESARR.scanPacked).
// Runs ONE certified DLL call directly on a packed channel string — no
// classify, no repack. Validation is on both sides of the boundary:
//   - the input channel must be a string with units === len*4 (else void 0);
//   - sort/reverse must return a string of the SAME channel length (a
//     malformed/short result is void 0 — never trusted);
//   - join returns a plain string; indexOf-family return numbers;
//   - any host throw (catchable errors >= 10000) -> void 0 (caller falls
//     back to JSX/engine with identical semantics).
// ops: 'sort' | 'reverse' | 'join' | 'indexOf' | 'lastIndexOf' | 'includes'.
// search is required for the scan ops, ignored otherwise.
export function nativeOp(op: string, packed: any, len: number, sep?: any, search?: any): any {
  if (!state.active) return void 0;
  if (!state.lib) return void 0;
  if (typeof packed !== 'string') return void 0;
  if (!(typeof len === 'number')) return void 0;
  if (len < 0 || len * 4 !== packed.length) return void 0;
  try {
    var r: any;
    if (op === 'sort') {
      r = state.lib.arrSort(packed, len);
      if (typeof r !== 'string' || r.length !== packed.length) return void 0;
      return r;
    }
    if (op === 'reverse') {
      r = state.lib.arrReverse(packed, len);
      if (typeof r !== 'string' || r.length !== packed.length) return void 0;
      return r;
    }
    if (op === 'join') {
      r = state.lib.arrJoin(packed, len, sep === void 0 ? ',' : String(sep));
      if (typeof r !== 'string') return void 0;
      return r;
    }
    if (op === 'indexOf') {
      r = state.lib.arrIndexOf(packed, len, search);
      if (typeof r !== 'number') return void 0;
      return r;
    }
    if (op === 'lastIndexOf') {
      r = state.lib.arrLastIndexOf(packed, len, search);
      if (typeof r !== 'number') return void 0;
      return r;
    }
    if (op === 'includes') {
      r = state.lib.arrIncludes(packed, len, search);
      if (typeof r !== 'number') return void 0;
      return r === 1 ? 1 : 0;
    }
  } catch (e) {
    return void 0;
  }
  return void 0;
}

export function nativeGateSnapshot(): EsarrNativeCaps {
  return snapshot();
}

function snapshot(): EsarrNativeCaps {
  var present = state.present;
  if (!present) {
    try {
      present = typeof ExternalObject !== 'undefined' && ExternalObject !== null;
    } catch (e) {
      present = false;
    }
  }
  var activeList: string[] = state.activeNames.slice(0);
  var si = 0;
  for (si = 0; si < state.scanActiveNames.length; si++) {
    activeList[activeList.length] = state.scanActiveNames[si];
  }
  return {
    present: present,
    enabled: state.active,
    reason: state.reason,
    dll: state.dll,
    dllVersion: state.dllVersion,
    lanes: activeList,
    certified: state.certified
  };
}