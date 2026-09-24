<div align="center">

# ESARR: The Full Array Surface for Adobe ExtendScript (ES3)

## ExtendScript ARRay = E.S.ARR

### The drop-in ES3 built-ins + ES5 set + ES6+ additions (`slice` … `findLastIndex`) for Adobe Illustrator, InDesign, Photoshop & any ExtendScript host — with an optional native ExternalObject acceleration gate (ESARRArray.dll) and a self-extracting espack bundle

[![Spec: ES5.1 + ES6+ exact](https://img.shields.io/badge/spec-ES5.1%20%2B%20ES6%2B%20exact-success)](https://262.ecma-international.org/5.1/#sec-15.4)
[![Differential: Node natives](https://img.shields.io/badge/differential-vs%20Node%20natives%206492%2B%20checks-purple)](https://262.ecma-international.org/5.1/#sec-15.4)
[![Engine parity: live](https://img.shields.io/badge/engine%20parity-live%20238%20vectors-green)](https://extendscript.docsforadobe.dev/)
[![Adobe: Creative Suite](https://img.shields.io/badge/Adobe%20-Creative%20Suite-red?logo=adobe&logoColor=white)](https://extendscript.docsforadobe.dev/)
[![Engine](https://img.shields.io/badge/ExtendScript-ES3-green)](#compatibility)
[![Size](https://img.shields.io/badge/runtime-41%20KB-orange)](#which-build-should-i-use)
[![License: GPL-3.0-or-later](https://img.shields.io/badge/license-GPL%203.0--or--later-blue)](https://www.gnu.org/licenses/gpl-3.0.html)

</div>

---

## Part Of The Same Toolkit

> Production-grade infrastructure for Adobe ExtendScript.

<table>
<tr>
<td width="50%" valign="top">

### Runtime Primitives

**[ESON](https://github.com/thelabcorner/eson)**  
Strict RFC 8259 JSON for ExtendScript.

**[ESB64](https://github.com/thelabcorner/es-b64)**  
Base64 and UTF-8 utilities.

**[ESARR](https://github.com/thelabcorner/es-arr)**  
ES5+ Array compatibility methods.

**[ESSTR](https://github.com/thelabcorner/es-str)**  
String whitespace and trim methods.

**[ESCHARS](https://github.com/thelabcorner/es-chars)**  
Native bulk byte operations.

**[ESHTTP](https://github.com/thelabcorner/es-http)**  
HTTP transport for ExtendScript automation.

**[ESTIMER](https://github.com/thelabcorner/es-timer)**  
Microsecond timing for ExtendScript automation.

**[ESRAND](https://github.com/thelabcorner/es-rand)**  
Deterministic random streams and sampling for ExtendScript.

</td>
<td width="50%" valign="top">

### Build & Integration Tools

**[ESPACK](https://github.com/thelabcorner/espack)**  
Self-extracting ExternalObject bundles.

**[ESMIN](https://github.com/thelabcorner/es-min)**  
Minification for shipped JSX bundles.

**[ESABI](https://github.com/thelabcorner/esabi)**  
Modern ExternalObject ABI declarations for native integrations.

**[VectorIPC](https://github.com/thelabcorner/vector-ipc)**  
Bounded local IPC for scripting hosts and native plug-ins.

**[ESTC](https://github.com/thelabcorner/estc)**  
TypeScript-to-ExtendScript build, compatibility, and live-parse tooling.

**[ESDB](https://github.com/thelabcorner/esdb)**  
Native state and durable storage for Adobe tooling.

**ESOBF** <sub>coming soon</sub>  
Obfuscation for hardened JSX distribution.

</td>
</tr>
</table>

Also from the same team: **[ArcFit.dev](https://arcfit.dev)**, deterministic arc warp for Illustrator.

---

## Table of Contents

- [Why ESARR?](#why-esarr)
- [Features](#features)
- [Which build should I use?](#which-build-should-i-use)
- [Get the Release](#get-the-release)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API](#api)
- [Validation](#validation)
- [Performance](#performance)
- [Security Model](#security-model)
- [Compatibility](#compatibility)
- [Engine quirks that shaped the design](#engine-quirks-that-shaped-the-design)
- [Development](#development)
- [Repository layout](#repository-layout)
- [Research corrections](#research-corrections)
- [Credits](#credits)
- [License](#license)

---

## Why ESARR?

**ExtendScript (SpiderMonkey ES3) ships only the ES3 built-ins** — probed live on Illustrator 30.6.0 / ExtendScript 4.5.6: `slice`, `concat`, `join`, `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `toString` exist natively, but every ES5 method (`forEach`, `map`, `filter`, `every`, `some`, `indexOf`, `lastIndexOf`, `reduce`, `reduceRight`, `Array.isArray`) and every ES6+ addition (`find`, `findIndex`, `includes`, `at`, `copyWithin`, `fill`, `flat`, `flatMap`, `from`, `of`, `keys`, `values`, `entries`, `toSorted`, `toReversed`, `with`, `findLast`, `findLastIndex`) is absent. ESARR is the polyfill: the **full 39-method surface** (36 prototype methods + `isArray`/`from`/`of` statics), **spec-exact (ES5.1 §15.4 + ES6/ES2016/ES2019/ES2022/ES2023), differential-validated against Node's native implementations, and tuned to measurements taken in the real Adobe engine** — not to browser folklore.

The engine is the hard part: array element reads with a variable index cost **~7.5e-4 µs × (distinct indices accessed so far)** — a superlinear trap on long traversals (a 32k full traversal measures ~800 ms; loop control alone is ~0.07 µs/iter). Every plausible dodge was benchmarked in the live engine and rejected on evidence (`|0`/`>>>0` coercion, string keys, `for...in`, Mozilla `for each...in`, `hasOwnProperty`, `typeof` guards — all equal or worse). The design therefore does exactly one read per element, nothing else in the hot loop, and keeps the `k in O` sparse guard where the spec requires it (`in`+read measured **identical to read alone**).

**Native acceleration gate (opt-in):** ESARR can wire the hot scalar lanes — `sort`, `reverse`, `join`, `indexOf`, `lastIndexOf`, `includes` — to the ESARRArray ExternalObject DLL over a packed int32 channel (`ESARR.enableNativeGate({lib, dllPath})`), with per-call fallback to the pure-JSX path for non-int32 elements, holes, custom comparefns, or any native failure. The gate is **safe by construction**: every lane is certified against the JSX authority on a numeric corpus at enable, and a lane that disagrees is excluded — never trusted. Without the DLL, the gate is inert and every method runs the identical pure-JSX semantics. **Measured reality (round-1 battery, `docs/benchmark-rounds-1.md`):** on healthy dense int32 the gated native lane beats the pure-JSX fallback ~19x on sort and ~6x on join @32k, and is the ONLY option for the engine-missing ES6+ lanes (`toSorted`/`toReversed` — no builtin exists); but it does NOT beat the engine's own builtins for sort/reverse/join at any measured size (the engine is 1.5–8.3x faster than the design doc's original §6 microprototype estimates), so the default dispatch is **engine-keep for the ES3 lanes, native for the engine-missing lanes** — data-derived, no manufactured wins (see the Performance section for the full three-way matrix).

---

## Features

- **Full surface, spec-exact**: ES3 built-ins (`slice concat join push pop shift unshift splice sort reverse toString` — overridden only with `install({forceReplace:true})`), the ES5 set (`forEach map filter every some indexOf lastIndexOf reduce reduceRight isArray`), and the ES6+ set (`find findIndex includes at copyWithin fill flat flatMap from of keys values entries toSorted toReversed with findLast findLastIndex`) — 36 prototype methods + 3 statics, each per ES5.1/ES6/ES2016/ES2019/ES2022/ES2023 as applicable.
- **Differential-validated against Node natives**: 238 fixed vectors + 4000 seeded differential iterations + 2000 mode-equality iterations + 100k seeded fuzz (`npm test` / `npm run fuzz`), with a strict comparator that distinguishes holes from `undefined` and `-0` from `+0`.
- **Verified in the real engine, not just parsed**: live vectors match the Node-validated core byte-for-byte in ExtendScript 4.5.6, including the installed prototype wrappers (`npm run live-verify`).
- **Measured, not assumed**: every implementation choice comes from live-engine microbenchmarks (see [Performance](#performance) and [Engine quirks](#engine-quirks-that-shaped-the-design)). ESARR **beats the MDN-style polyfill on every callback lane** — up to 1.6x on short arrays, 3-9% at 8000 elements — via a measured two-lane callback invocation: when `thisArg` is absent, ES5.1's `this = undefined` is byte-identical to a plain call in this non-strict engine, so ESARR skips the per-element `.call` machinery entirely (spec-exact; the differential oracle verifies this in Node for strict and sloppy callbacks alike).
- **True polyfill install**: `Array.prototype.*` and `Array.isArray`/`Array.from`/`Array.of` are gap-filled only when absent; `install({ forceReplace: true })` overrides everything including the ES3 natives. The `ESARR` facade (pure functions, array-first) is always available.
- **Array-like support**: strings, `arguments`, plain `{ length: n }` objects, sparse arrays (`new Array(n)` holes and `delete`d elements are handled exactly per spec — holes in → holes out for `map`/`slice`/`concat`/`sort`; holes visited as `undefined` for `find`/`findIndex`/`includes`/`values`/`entries`; holes materialized as `undefined` for `toSorted`/`toReversed`/`with`, matching Node).
- **Spec-correct argument edges**: `indexOf`/`lastIndexOf` handle `NaN`, `±Infinity`, fractional and string `fromIndex` exactly as ES5.1 dictates (including the subtle `-0.5` cases, with `-0` normalized to `+0`); `reduce`/`reduceRight`/`lastIndexOf`/`splice` distinguish "argument absent" from "argument `undefined`" by **call arity** (the wrappers omit the argument), so `[1,2,3].reduce(fn)` and `[1,2,3].reduce(fn, undefined)` behave differently exactly as the spec requires — and `[1,2,3].splice(0)` deletes to the end while `[1,2,3].splice(0, undefined)` deletes nothing (V8 arity semantics, verified live).
- **Never throws on `Array.isArray`**: host objects (Illustrator collections) *throw* on `__class__` access; ESARR catches that and falls back to the `toString` tag, so `Array.isArray(app.documents)` → `false` (probed live).
- **Native acceleration gate**: `ESARR.enableNativeGate({lib, dllPath})` wires `sort`/`reverse`/`join`/`indexOf`/`lastIndexOf`/`includes` to the ESARRArray ExternalObject DLL over a packed int32 channel (byte+1 wire, NUL/surrogate-free by construction). Per-lane certification vs the JSX authority at enable; per-call fallback to JSX for non-int32 elements, holes, custom comparefns, or any native failure. `ESARR.useEspack()` (idempotent) + `ESARR.espack` outcome via the espack self-extracting bundle (`dist/ESARR.accel.jsx`).
- **No runtime dependencies**: one file. Two builds: full (`ESARR.jsx` / `vendor-esarr.js`) and runtime (`vendor-esarr-runtime.js`, methods only) for per-eval injection.

---

## Which build should I use?

| | **Runtime build** | **Full build** | **Accel bundle** |
|---|---|---|---|
| Files | `vendor-esarr-runtime.js` | `vendor-esarr.js`, `ESARR.jsx` | `ESARR.accel.jsx` / `.min.jsx` |
| Size | 41 KB | 61.7 KB | 115 KB (DLL embedded) |
| API | the 39 methods (JSX) | methods + `capabilities()`, `install()`, `benchmark()`, gate | full + self-extracting native gate |
| Installs `Array.prototype.*` | yes (gap-fill) | yes (gap-fill) | yes (gap-fill) |
| Native | no DLL | opt-in `enableNativeGate()` | auto-enables (espack) |
| Best for | per-eval injection, methods only | libraries wanting install control, census, benchmarks | one-file drop-in with the DLL |

**Rule of thumb:** if your script only calls the methods, use the runtime build (41 KB). Reach for the full build for `install({forceReplace})`/`capabilities()`/`benchmark()`/the gate API. Ship the accel bundle when you want the self-extracting `ESARRArray.dll` (native `toSorted`/`toReversed`, ~19x over the JSX fallback) as a single file with no DLL to place — Windows x64 hosts only (see Compatibility).

---

## Get the Release

<div align="center">

**All production bundles ship as GitHub release assets — this repo holds sources. Grab the runnable builds from the [Releases page](https://github.com/thelabcorner/es-arr/releases).**

[![Release: v1.1.0](https://img.shields.io/badge/release-v1.1.0-blue)](https://github.com/thelabcorner/es-arr/releases)
[![Released: 2026-08-10](https://img.shields.io/badge/released-2026--08--10-lightgrey)](https://github.com/thelabcorner/es-arr/releases)
[![Downloads](https://img.shields.io/github/downloads/thelabcorner/es-arr/total?color=blueviolet)](https://github.com/thelabcorner/es-arr/releases)

</div>

**How it works, in three steps:**

1. Open the [Releases page](https://github.com/thelabcorner/es-arr/releases).
2. Pick the **latest stable** tag.
3. Download the asset that matches your use case:

| You are... | Take this release | And this asset |
|---|---|---|
| Dropping one file into the Scripts folder with zero install steps (self-extracting `ESARRArray.dll` + native gate included) | v1.1.0 | `ESARR.accel.min.jsx` |
| Loading the native DLL from your own `ExternalObject` setup | v1.1.0 | `ESARRArray.dll` |
| Building from source / reading the implementation | master | the repo |

---

## Installation

```jsx
// @includepath "path/to/esarr/dist"
#include "vendor-esarr.js"

// Array.prototype.forEach, map, ... and Array.isArray now exist
// (gap-filled only if absent). The facade is also available:
var doubled = ESARR.map([1, 2, 3], function (v) { return v * 2; }); // [2, 4, 6]
```

Or load explicitly in any order / from COM:

```jsx
$.evalFile(File("C:/path/to/esarr/dist/vendor-esarr.js"));
```

---

## Quick Start

```jsx
// facade style: pure functions, array first — the same signatures work in
// Node against the ESM build
ESARR.forEach(items, function (item, i, arr) { /* ... */ });
var names   = ESARR.map(users, function (u) { return u.name; });
var adults  = ESARR.filter(users, function (u) { return u.age >= 18; });
var hasKids = ESARR.some(users, function (u) { return u.children > 0; });
var allPaid = ESARR.every(users, function (u) { return u.paid; });
var first   = ESARR.indexOf(ids, 42);          // fromIndex optional
var last    = ESARR.lastIndexOf(ids, 42);      // fromIndex optional
var total   = ESARR.reduce(nums, function (a, b) { return a + b; }, 0);
var back    = ESARR.reduceRight(strs, function (a, b) { return a + b; });
var isArr   = ESARR.isArray(something);        // also Array.isArray after install
```

---

## API

All methods follow the spec exactly: `ToObject` boxing of array-likes, `ToUint32`/`ToLength` length coercion, `HasProperty` (`k in O`) hole handling where the spec requires it, `ToInteger` `fromIndex`, callback `thisArg` binding, and `TypeError`s on `null`/`undefined` receivers and non-callable callbacks. Prototype wrappers translate the `this`-based calling convention into the pure functions (one closure per method, created once at install).

- **ES3 set** (override with `forceReplace`): `slice concat join push pop shift unshift splice sort reverse toString`
- **ES5 set**: `forEach map filter every some indexOf lastIndexOf reduce reduceRight isArray`
- **ES6+ set**: `find findIndex includes at copyWithin fill flat flatMap from of keys values entries toSorted toReversed with findLast findLastIndex`
- `capabilities()` → `{ engine, nativeList, missing, native }` — census of what the host provides natively + the gate state.
- `install(options?)` → gap-fill `Array.prototype.*` + `Array.isArray`/`from`/`of` (returns the pre-install census; `forceReplace: true` overwrites natives including the ES3 built-ins).
- `enableNativeGate(options?)` → `{ present, enabled, reason, dll, dllVersion, lanes[], certified }` — loads/certifies the ESARRArray DLL lanes (`options.lib` = externally loaded lib, e.g. from `ESPAK.load(0)`; `options.dllPath` informational; `options.provideLib` = Node test hook). `disableNativeGate()` / `nativeGateState()`.
- `benchmark(n?, iterations?)` → `BenchItem[]` medians in the live engine.
- **Pack-once API** (round-2/3 — the measured pack-once win; strategy doc §5.2/§10.4): amortize the JSX wire across repeated native ops on ONE dense int32 array.
  - `ESARR.pack(arr)` → packed byte+1 channel string (4 chars/int32, units 1..256, NUL/surrogate-free), or `undefined` for non-int32 elements/holes. Classify+pack in one pass (fast lane: `v === (v|0)` + branchless `>>>0` shift-pack — measured -7.4% wire @32k); **chunked 16k-elem loops above 48k** (wedge-safe by construction — never one unbounded `fromCharCode` loop; verified live at 64k/128k/256k).
  - `ESARR.unpack(packed, len?)` → fresh int32[] (preallocated + indexed writes), or `undefined` when `len*4 !== packed.length` (truncated/corrupt channel is never read out of bounds). `len` defaults to `packed.length >>> 2`.
  - `ESARR.unpackInto(target, packed, len)` → `target` (mutating-write variant for in-place workflows).
  - `ESARR.packRun(op, packed, len, sep?)` → packed string (or joined string for `'join'`), or `undefined` when the gate is off / the op fails. **By-key**: `'sort' | 'reverse' | 'join'` — runs ONE in-wire DLL op directly on the channel (no repack). Multi-op workflows: `p = ESARR.pack(a); p = ESARR.packRun('sort', p, n); p = ESARR.packRun('reverse', p, n); out = ESARR.unpack(p, n)`.
  - `ESARR.scanPacked(op, packed, len, search)` → index (or -1 / 1|0 for `'includes'`), or `undefined` on fallback. **By-key**: `'indexOf' | 'lastIndexOf' | 'includes'` — the DLL scan on an already-packed payload (flat 75 µs–1.3 ms @2k–32k, 19x–611x vs JSX on misses/deep hits). Only on packed payloads — raw arrays stay JSX (the up-front pack kills short-circuit).
  - `ESARR.pipe(arr, ops[])` → result (array for a `sort`/`reverse`-ended pipe, string for `'join'`-ended), `undefined` for invalid op lists, **pure** (never mutates the input). Ops: `'sort' | 'reverse' | 'join'` (`'join'` must be last). Router rows 5/6: engages pack-once native for n ≥ 6k (≤48k) with ≥ 2 ops (measured 0.49x–0.73x vs the engine pipe @8k–48k, growing with n); below 6k and above 48k it runs the engine pipe on a clone.
- Prototype wrappers preserve call arity for `lastIndexOf`/`reduce`/`reduceRight`/`splice` — that arity is how absent-vs-`undefined` arguments stay spec-correct (see Engine quirks).

---

## Validation

| Check | Command | Result |
|---|---|---|
| TypeScript strict | `npx tsc --noEmit -p .` | clean |
| Fixed vectors + 4000 diff + 2000 mode-equality iters vs Node natives | `npm test` | 6492 checks, 0 failures (1 carve-out: D7 comparator-NaN sort order) |
| Seeded fuzz vs Node natives (100k iterations) | `npm run fuzz` | 0 divergences (seed 1337, 56 D7 carve-outs) |
| Wire suite (byte+1 round-trips, NUL/window-free channel) | `npm test` | 5138 assertions |
| Live engine parity (full surface) | `npm run live-verify` | 238 vectors + wrapper semantics, JSX and gate-on passes |
| Gate-on live differential (final acceptance) | `node tests/gateon-differential.mjs` | ALL PASS — 23 payloads × (lanes + pipe rows + packed scans + purity + in-place mutation), incl. window bytes; scan lanes + pack-once pipe byte-identical to the JSX authority and Node oracle |
| Accel e2e (self-extracting bundle) | `node tests/esarr-accel-e2e.mjs` | all checks passed (extract→load→native→parity→idempotent→versioned) |
| Vendor-sync guard | `npm test` | vendored accel bundle byte-matches dist |
| Live benchmarks (ours vs MDN vs hand-rolled) | `npm run benchmark` | see table |

The differential oracle is Node's native `Array.prototype.*` (the same code V8/SpiderMonkey-class engines ship); engine parity is verified by running the identical bundled code through `ILLUSTRATOR_COM_TOOL.py` and comparing byte-for-byte against the Node-validated core.

---

## Performance

Measured live in Adobe Illustrator 30.6.0 / ExtendScript 4.5.6, best-of-9 primed `$.hiresTimer` medians, dense integer arrays, `npm run benchmark` (reproducible). `vsMDN`/`vsHand` > 1 means ESARR is faster.

| lane | n | ESARR | MDN-style | hand-rolled | vsMDN | vsHand |
|---|---|---|---|---|---|---|
| forEach | 256 | 162 µs | 267 µs | 49 µs | **1.65x** | 0.30x |
| forEach | 2000 | 2.56 ms | 3.24 ms | 1.46 ms | **1.26x** | 0.57x |
| forEach | 8000 | 49.3 ms | 53.0 ms | 44.9 ms | **1.07x** | 0.91x |
| map | 2000 | 3.92 ms | 4.80 ms | 2.79 ms | **1.23x** | 0.71x |
| map | 8000 | 76.6 ms | 80.5 ms | 72.5 ms | **1.05x** | 0.95x |
| filter | 2000 | 3.95 ms | 4.63 ms | 2.88 ms | **1.17x** | 0.73x |
| filter | 8000 | 66.6 ms | 68.6 ms | 60.6 ms | **1.03x** | 0.91x |
| every | 2000 | 2.40 ms | 3.27 ms | 1.49 ms | **1.36x** | 0.62x |
| every | 8000 | 49.3 ms | 53.0 ms | 45.0 ms | **1.07x** | 0.91x |
| some (full scan) | 2000 | 2.43 ms | 3.28 ms | 1.47 ms | **1.35x** | 0.60x |
| some (full scan) | 8000 | 49.3 ms | 53.7 ms | 44.9 ms | **1.09x** | 0.91x |
| indexOf (miss) | 2000 | 1.59 ms | 1.61 ms | 1.46 ms | 1.02x | 0.92x |
| indexOf (miss) | 8000 | 45.2 ms | 45.7 ms | 45.0 ms | 1.01x | 1.00x |
| lastIndexOf | 2000 | 1.57 ms | 1.58 ms | 1.46 ms | 1.00x | 0.93x |
| reduce | 2000 | 2.52 ms | 2.53 ms | 1.46 ms | 1.00x | 0.58x |
| reduce | 8000 | 49.7 ms | 50.9 ms | 44.7 ms | 1.02x | 0.90x |
| reduceRight | 2000 | 2.48 ms | 2.45 ms | 1.42 ms | 0.99x | 0.57x |

**Reading:** ESARR is faster than the MDN-style polyfill on **every callback lane** — up to 1.65x on short arrays, 3–9% at 8000 elements — because the no-`thisArg` lane skips the per-element `.call` (measured ~0.4–0.6 µs/element, which dominates at small n where reads are cheap). `indexOf`/`lastIndexOf`/`reduce`/`reduceRight` carry no callback: both implementations run the identical read scan, so they sit at parity (0.99–1.02x, ±1% run-to-run noise on a read-bound floor). The gap to a hand-rolled loop on full traversals is the callback invocation the API requires (0–10% at scale); on trivial short-circuits a hand-rolled loop wins outright — the inherent cost of any functional Array API.

### Native lanes (ESARRArray DLL) — measured, data-derived bands

Round-1 battery (swarm task T6), healthy instance, primed medians (2k/4k/8k: 9 samples; 16k/32k: 3), `ESARRArray.dll` (byte+1 wire, fused 2-pass dispatch: classify+pack in one loop, unpack straight into the target — no intermediate arrays, no writeback pass). Full tables + methodology: `docs/benchmark-rounds-1.md`. The DLL op is ~1% of the gated total at 8k (sort-op 1.5 ms vs ~167 ms gated); the binding constraint is the ExtendScript JSX wire floor (pack+unpack+classify ≈ 200 ms @8k — the engine's superlinear variable-index access), not the C algorithm.

| lane | n | builtin | native (gated) | native/builtin | pure-JSX ESARR | native/JSX |
|---|---|---|---|---|---|---|
| sort (mixedFull) | 2048 | 8.5 ms | 19.7 ms | 2.32x | 206 ms | **0.10x** |
| sort (mixedFull) | 8192 | 126 ms | 168 ms | 1.33x | 3495 ms | **0.05x** |
| sort (mixedFull) | 16384 | 462 ms | 582 ms | 1.26x | 16.6 s | **0.04x** |
| sort (mixedFull) | 32768 | 1838 ms | 2233 ms | 1.21x | 94.1 s | **0.02x** |
| sort (mixedFull) | 65536 | 7237 ms | 8707 ms | 1.20x | — | — |
| sort (asc) | 8192 | 158 ms | 169 ms | 1.07x | — | — |
| sort (asc) | 32768 | 2004 ms | 2155 ms | 1.08x | — | — |
| reverse | 2048 | 0.9 ms | 17 ms | 19.8x | 1.7 ms | 10.2x |
| reverse | 32768 | 617 ms | 2381 ms | 3.86x | 699 ms | 3.4x |
| reverse | 65536 | 2580 ms | 8532 ms | 3.31x | — | — |
| join | 2048 | 1.5 ms | 9.6 ms | 6.30x | 5.9 ms | 1.6x |
| join | 32768 | 860 ms | 1131 ms | 1.31x | 6839 ms | **0.17x** |
| join | 65536 | 3421 ms | 4738 ms | 1.39x | — | — |

**The honest headline (design doc §6 refuted by data):** on healthy dense int32, the gated native lane does **not** beat the engine builtin for `sort`/`reverse`/`join` at any measured size — the engine's builtins are 1.5–8.3x faster than the doc's §6 microprototype estimates (sort 32k ≈ 1.84 s measured vs 6.9 s est; reverse 0.62 s vs 5.1 s est; join 0.86 s vs 1.3 s est), and the wire floor closes the gap (sort 2.32x → 1.33x → 1.26x → 1.21x @32k) without crossing <1.0. Round-2 (swarm `esarr-beat-builtin`, `docs/beat-builtin-strategy.md`) lifted the 48k wedge cap with chunked 16k-elem packing (wedge-safe, byte-identical wire) and measured 64k directly: sort 1.20x, join 1.39x, reverse 3.31x — the gap **widens** beyond 64k (wire grows n^2.38 vs builtin n^1.97, 32k→64k), so no crossing exists. **Default dispatch is therefore engine-keep for these three** — no manufactured wins. But the native lane **beats the pure-JSX fallback ~19x** on sort (0.05x @8k) and ~6x on join @32k — which is the honest win for `install({forceReplace:true})` users (engine-keep + forceReplace both route non-native calls through ESARR's JSX). And for the **ES6+ lanes with no engine builtin at all** — `toSorted`/`toReversed` — the native lane engages by construction (strict-engagement guarantee): their only alternative is the JSX fallback, which the native path beats ~19x. The other measured win is the **pack-once pipeline** (see below) — repeated native ops on ONE array amortize the wire and beat the engine's chained pipe at every measured size. `ESARR.setBands` overrides any band (opt-in force-native).

**Pack-once pipelines** (measured; round-2 strategy `docs/beat-builtin-strategy.md` §5.1): repeated ops on ONE array amortize the wire — `pipe-packonce` (pack once + 3 DLL ops + unpack once) beats the engine's chained `sort();reverse();join()` pipe at every measured size: **141 ms vs 194 ms @8k (0.73x), 429 vs 770 ms @16k (0.56x), 1,577 vs 2,917 ms @32k (0.54x), 3,860 vs 7,832 ms @48k (0.49x, chunked)** — the win grows with n because the engine pipe pays per-op superlinear traversal/ToString while the native pipe pays the wire once. Below ~6k the engine pipe wins (1.22–1.64x @2k/4k), so the router's pipe band engages pack-once at n ≥ 6k. It is also 3.3x faster than per-call gated ESARR @32k (5,231 ms). A public `ESARR.pack`/`unpack`/`packRun` API (spec draft in the strategy doc §5.2/§10.4) is the round-2 product this data greenlights.

**Packed-payload scan lanes** (strategy doc §10.1 B7): the DLL scan on an ALREADY-PACKED payload is flat (75 µs @2k → 1.3 ms @32k) and beats the JSX `indexOf`/`lastIndexOf`/`includes` scan by **19x–611x on misses and deep hits** — it never pays the engine's superlinear variable-index read cost. On a raw array the up-front pack (7 ms @2k → 1 s @32k) kills short-circuit, so the router scans packed payloads only (explicit `ESARR.scanPacked` API), never raw arrays (JSX stays, hit-first 5–17 µs).

**Router (auto-dispatch) decision table** (strategy doc §10.2 — the full measured matrix): the dispatch chooses per method × payload × size × availability, never a one-size policy.

| scenario | payload | size | approach |
|---|---|---|---|
| sort / reverse / join (single op) | dense int32 | all n | engine (native loses 1.06–2.32x sort, 3.3–19.8x reverse, 1.31–6.3x join) |
| toSorted / toReversed | dense int32 | [1, 48000] | native (no builtin; ~3–19x vs JSX) |
| multi-op pipe | dense int32 | n ≥ 6k | pack-once native (0.49–0.73x vs engine pipe @8k–48k) |
| multi-op pipe | dense int32 | n < 6k | engine pipe |
| indexOf/lastIndexOf/includes | dense int32 ARRAY | any | JSX (per-call pack kills short-circuit) |
| indexOf/lastIndexOf/includes | PACKED payload | any | DLL scan (19–611x on miss/deep-hit) |
| sort/reverse/join | sparse / mixed | any | JSX (spec-exact fallback) |
| sort/reverse/join | array-like {length:n} | any | engine (native loses 1.15–5.4x) |
| join | string | any | engine split+join (11x over gated) |
| any lane | n > 48k single-op | >48k | engine/JSX (wire prohibitive) |
| any lane | no DLL / non-Windows | any | JSX (gate inert) |

**Wire cost (why the floor is what it is — final component decomposition @8k):** the fused lane touches the array twice — read for pack (fused-pack-only 110 ms) and write for unpack-into-O (76 ms) — at the engine's variable-index access cost (reads and writes are **symmetric**, ~47–50 ms per full pass; writes are *not* superlinear-pathological). Sum with the DLL op (1.5 ms) = 188 ms vs the measured gated total 196 ms → **dispatch/gate overhead is only ~8 ms (4.2%)**. The double array-touch (~186 ms) vs the builtin's single touch (126 ms @8k) is the irreducible floor for mutating lanes (ES5.1 in-place contract); the C side (sort-op 1.5 ms @8k, ~1014x faster than the pre-iteration-1 O(n²) walk — 5.06 s → 4,989 µs @32k) is not the bottleneck in any lane.

---

## Security Model

Two modes, clearly separated:

- **Pure-JSX (the default, and the only mode without the DLL):** ESARR is a pure data-transform library — plain function definitions installed onto `Array.prototype`/`Array.isArray`/`from`/`of`. No `eval`, no native code, no disk writes, no network access. The one host interaction is defensive read-only probing — `Array.isArray` catches the host-object `__class__` access error (uncatchable by ordinary `try/catch`, so it is guarded structurally) and falls back to the `toString` tag, so host collections report `false` instead of throwing.
- **Native gate (opt-in: `enableNativeGate()` or the accel bundle):** the ESARRArray ExternalObject DLL is loaded only when explicitly enabled, and it is **never trusted blindly**:
  - **Per-lane certification at enable** — every lane is run against the JSX authority on a numeric corpus (with cloned inputs so a mutating lane cannot self-certify); any lane that disagrees is excluded and stays JSX. The gate is inert without the DLL.
  - **Per-call fallback** — non-int32 elements, holes, custom `comparefn`s, out-of-band sizes, and any native failure route to the identical pure-JSX semantics; the native lane engages only when it beats `min(builtin, JSX)` at the measured size (strict-engagement guarantee, data-derived bands; `ESARR.setBands` can override).
  - **Channel rules** — the packed int32 wire is NUL-free and outside the surrogate window by construction (byte+1, units 1..256); payloads are length-validated and malformed input returns a catchable error, never OOB access.
  - **The accel bundle** (espack) writes the byte-verified DLL to a per-user cache directory on first eval, versioned (a loaded DLL stays locked until the host exits, so bundles re-extract under a versioned name), skip-if-exists idempotent; if the cache is unwritable the bundle stays in pure-JSX mode with a surfaced warning — it never fails silently and never runs unverified bytes.
  - **No network access** in any mode. `install({ forceReplace: true })` is the only override surface and is deliberate.

---

## Compatibility

| Target | Status |
|---|---|
| ExtendScript ES3 (no `let`/`const`/arrows/`Promise`/`Map` in the bundle; `"use strict"` stripped) | Bundled |
| Any ExtendScript host (Illustrator, InDesign, Photoshop, After Effects, InCopy, Bridge) | Works; Windows/macOS, no host-specific APIs |
| Native gate DLL (`ESARRArray.dll`) | Windows x64 only; verified live on Illustrator 30.6.0; freestanding (0 imports), deterministic build |
| Node.js v18+ | Build and test harnesses |

---

## Engine quirks that shaped the design

All measured live on ExtendScript 4.5.6 (Illustrator 30.6.0); re-probe other hosts.

- **Variable-index array reads are superlinear.** `a[q]` with a live index costs ~7.5e-4 µs × (distinct indices accessed so far in the loop): 512-element traversal ≈ 0.13 ms, 32k ≈ 0.8 s. Loop control is ~0.07 µs/iter; **constant-index reads are ~0.1 µs** regardless of array size. Coercions (`q|0`, `q>>>0`), string keys, `for...in`, and Mozilla `for each...in` (7.6 µs/element) were all measured equal-or-worse — there is no dodge. ESARR therefore does exactly one read per element and nothing else in the hot loop.
- **`k in O` is effectively free.** The `in` guard shares the read's resolution cost: `in`+read measured identical to read alone at every size. Keep the guard (spec requires hole skipping); never use `hasOwnProperty` (~8× the `in` cost).
- **`Function.prototype.call` aliased and invoked bare crashes** ("Function.call() cannot work with instances of this class") — always call `callback.call(...)` directly.
- **A direct callback invocation is cheaper than `.call`.** Measured ~0.4–0.6 µs/element on dense traversals. ES5.1 says an absent `thisArg` means `this = undefined`, and a non-strict engine binds the global object — byte-identical to a plain call. ExtendScript has no strict mode, so the five `thisArg` methods run a **two-lane loop**: plain `callback(v, k, O)` when `thisArg` is absent/`undefined` (the common case — this is the measured edge over MDN-style polyfills, which pay `.call` on every element), `callback.call(T, v, k, O)` when present. `reduce`/`reduceRight` have no `thisArg` per spec and always use plain calls. The Node differential oracle confirms the this-binding matches natives for strict and sloppy callbacks alike.
- **Error names lie.** Every ExtendScript error reports `name: "Error"`; only `instanceof TypeError` discriminates. ESARR throws real `TypeError`s; consumers should test with `instanceof` or message, not `name`.
- **Sparse literals are not sparse.** `[1,,3]` normalizes the elision to an `undefined` *element* at parse time (`1 in [1,,3]` → `true`). Real holes only come from `new Array(n)` or `delete` — and ESARR skips exactly those.
- **Host objects throw on `__class__`.** `app.documents.__class__` → `"No such element"` (an *uncatchable* host error — it bypasses JS `try/catch`). `Array.isArray` therefore never touches `__class__` unguarded; host collections report `false` via the `toString` tag. The same host error hits `in` on collections — snapshot host collections into plain arrays with an indexed loop before using them (the standard ExtendScript pattern).
- **esbuild var-export getters are evaluated at define time.** The engine lacks `__defineGetter__`, so esbuild's `defineProperty`-getter exports of `var` bindings evaluate the getter immediately, when hoisting still leaves the var `undefined` — the export is permanently `undefined`. ESARR ships **no exported var bindings at all**: absent-vs-`undefined` arguments are expressed by call arity, so nothing depends on exported identity.
- **`$.hiresTimer` returns microseconds since its previous access.** Prime it, then read once after the measured operation; reject negative/implausible samples (all ESARR benchmarks do this).
- **ES6+ hole semantics differ from the ES5 set** (verified against Node): `find`/`findIndex`/`findLast`/`findLastIndex`/`includes`/`values`/`entries` have NO `HasProperty` check — holes read as `undefined` and are visited (`[1,,3].includes(undefined)` → `true`). `flat`/`flatMap`/`copyWithin`/`keys` DO skip holes. `toSorted`/`toReversed`/`with` materialize holes as `undefined` (every result index present). `sort`/`slice`/`concat` keep holes as holes (Node: `a=[];a.length=4;a[0]=3;a[2]=1;a.sort()` → `[1,3,hole,hole]`).
- **`splice`'s deleteCount is arity-based in V8** (verified live): `[1,2,3].splice(0)` deletes to the end, but `[1,2,3].splice(0, undefined)` and `[1,2,3].splice(0, null)` delete NOTHING (explicit `undefined`/`null` → `ToInteger` → 0). ESARR's wrappers preserve the arity.
- **`indexOf`/`lastIndexOf` return `-0` for a `-0.5` fromIndex hit** unless normalized (`ToInteger(-0.5)` is `-0`, and `-0 >= 0` is true) — ESARR normalizes to `+0` (Node's `Object.is`-visible behavior).
- **`sort`/`toSorted` with a non-total comparator is implementation-defined.** A comparator that returns inconsistent results on mixed types (e.g. numeric for number pairs, `String()` for mixed pairs — `-7 < -1` numerically but `-1 < [-7]` by string while `[-7] = -7`) or `NaN` for some pair makes the output order algorithm-dependent: ESARR's stable merge sort is comparator-consistent; V8's TimSort may differ. Both are spec-permitted; the differential harness carves these out.
- **`with` is a reserved word in ES3 object literals.** esbuild emits the export map with an unquoted `with:` key (legal ES5, an "Illegal use of reserved word" SyntaxError in ExtendScript) — `esarr-build.mjs` ES3-ifies the bundle by quoting it (`"with": function`). The prototype install uses bracket notation (`p["with"]`).
- **Mixed `&&`/`||` precedence is parsed left-associatively, and esbuild strips the correcting parens.** A live `includes` bug (D9): the engine parses `a || b && c` as `(a || b) && c`, and esbuild elided the explicit parens that would have preserved spec precedence — `includes` returned `false` for every element in the live engine while passing Node. The fix: split the compound condition into separate `if`s (no rely-on-parenthesis in shipped code, and a live-verify vector for it).
- **Per-element `String.fromCharCode` pack loops wedge the engine at large n — unless chunked.** A SINGLE unbounded pack loop (direct `+= String.fromCharCode(...)`) wedges the engine at ≥ ~64k elements (reproduced twice in round 1), so the round-1 dispatch capped lanes at 48k. Round-2 fixed the pattern: **chunked 16k-elem loops** (the `pack`/`pipe` API and every classify+pack lane) are wedge-safe by construction and verified live at 64k/128k/256k (single 256k pack = 536.5 s, channel materialized, no lockup). The single-op lanes stay engine-keep above 48k anyway (the wire is prohibitive at scale — pack alone grows n^2.38+), so the 48k cap only shapes the `pipe` band top.
- **The ES3 engine's built-in `sort`/`reverse`/`join` do NOT throw on a `null` receiver.** ES5.1 requires `ToObject(null)` → `TypeError`; the router delegates default-comparator `sort`/`reverse`/`join` to the engine builtin (captured at module load — `install({forceReplace:true})` replaces the prototype methods after eval, so a live lookup would recurse through the wrapper). The delegation therefore excludes `null`/`undefined` receivers: the JSX authority path provides the spec `TypeError` (pinned by the `sort(null)`/`join(null)` vectors in `tests/vectors.ts` and the live-verify engine-parity pass).
- **ExternalObject method binding is per-DLL-build flaky.** On some DLL builds/host sessions a subset of methods throws "is not a function"/"Error #" while others bind; the set is stable per build, not random per session. The gate therefore probes every lane at enable (critical methods first: `ping`/`version`/`arrSort`…), certifies only what binds correctly, and degrades unbound lanes to JSX — a loaded DLL also stays locked until the host exits (numbered DLL names for iteration).

---

## Development

```bash
git submodule update --init --recursive   # pins ESABI v0.3.0 for the native ABI
npm install            # esbuild + typescript
npm run build          # dist/ESARR.jsx, vendor-esarr.js, vendor-esarr-runtime.js, esarr-core.esm.mjs
npm run native-build   # native/bin/ESARRArray.dll (freestanding clang/lld, deterministic build.ps1)
npm run build:accel    # dist/ESARR.accel.jsx + .min.jsx (espack self-extracting bundle + native gate adapter)
npm test               # vectors + differential vs Node natives (full surface)
npm run fuzz           # 100k seeded differential iterations
npm run live-verify    # vectors + wrapper semantics in the real engine (COM tool)
npm run benchmark      # ours vs MDN-style vs hand-rolled in the real engine
```

**Merge architecture (espack v0.3.0).** `build:accel` also emits two composition
artifacts for hosts that bundle multiple espack consumers in one file (e.g.
ArcFit): `dist/ESARR.manifest.json` (schema v1, payload-only, byte-identical
to `espack-build --manifest-out`) and `dist/ESARR.facade.jsx` (loader-free
facade + adapter, requires `ESPAK` on `$.global`). A composer merges the
manifests with `espack-merge.mjs` into ONE loader and appends the facades.
The adapter loads the payload **by name** (`ESPAK.load("ESARRArray")`) —
index 0 is not a stable API under a merged bundle. The standalone
`ESARR.accel.jsx` is unchanged in composition.

The identical TypeScript core (`src/array-core.ts` ES5 set, `src/array-es3.ts` ES3 set, `src/array-es6.ts` ES6+ set, `src/sort-core.ts` shared merge sort) ships as an ESM bundle for Node (tests, differential oracle) and as the ESARR IIFE for the engine. The native gate lives in `src/native-lane.ts` (state machine + per-lane certification, ESON pattern) with the packed int32 wire isolated in `src/lane-wire.ts` (byte+1 encoding, canonical per the design doc) and the facade dispatch in `src/native-dispatch.ts`. Test vectors live in `tests/vectors.ts` with a transport protocol (`{t:'array'|'sparse'|'string'|'like'|'null'}`) that survives JSON round-trips; `tests/callbacks.ts` holds the single canonical callback/runnable logic shared by the Node harness and the live probe — engine agreement implies spec agreement by construction.

---

## Repository layout

```
esarr/
  src/            TypeScript core (array-core.ts ES5, array-es3.ts, array-es6.ts, sort-core.ts), native gate (native-lane.ts, lane-wire.ts, native-dispatch.ts)
  native/         C source + build.ps1; bin/ = ESARRArray.dll + test drivers
  deps/esabi/     pinned ESABI v0.3.0 submodule; sole ExternalObject ABI authority
  tests/          vectors.ts + callbacks.ts + Node harnesses (custom, no framework) + fuzz + wire + gate-on differential + accel e2e + vendor-sync guard
  bench/          round-1 raw JSON + resume markers (benchmark data)
  docs/           design contract + benchmark rounds + verification report
  dist/           generated bundles (gitignored; produced by npm run build / build:accel)
```

---

## Research corrections

- **The design doc's §6 engine estimates were refuted by measurement.** The microprototype predicted engine sort/reverse/join @32k at 6.9/5.1/1.3 s; the healthy-instance battery measured 1.84/0.62/0.86 s (1.5–8.3x faster), and no native lane beats any engine builtin on dense int32 at any measured size — the doc's predicted win bands do not exist on healthy hardware (full tables in `docs/benchmark-rounds-1.md`). Corrected in the Performance section; the doc's method (measure, don't extrapolate from microprototypes) is retained.
- **Small-n native "wins" (3.4x sort @256) were degraded-instance artifacts** from a sick engine (builtin sort pathologically slow at 7.3 ms @256) and are excluded from every table; healthy-instance data only.
- **The byte+1 wire's channel-safety was re-adjudicated with a live replication.** An early structural gate claimed units 0xD8–0xDF are dropped at the ABI (a hex-truncation of the true surrogate window 0xD800–0xDFFF); a fresh-instance per-unit sweep (0..255 through `arrReverse`) shows only unit 0 fails (catchably, the DLL's own length validation) — byte+1 units (≤256) can never reach the true window. The gate was corrected; the shipped wire stands.
- **`includes` returned false for every element in the live engine** (D9, mixed-`&&`/`||` paren-stripping, see Engine quirks) — caught by the gate-on live differential, fixed by splitting the condition, verified live.

---

## Credits

ESARR stands on the shoulders of the ExtendScript community:

- **[docsforadobe](https://github.com/docsforadobe) and the docsforadobe.dev community:** maintainers of the de-facto reference documentation for the ExtendScript runtime. Their reverse-engineering of the engine's object model and parser quirks made the measured findings in this README possible to write down at all.
- **The ES5.1 spec and the MDN polyfills:** the algorithm this library implements exactly, and the benchmark baseline every implementation choice is measured against.
- **The ESON/ESB64 family:** the ES3 engineering patterns (charCodeAt scanning, `$.hiresTimer` discipline, esbuild quirk handling) carry over directly.

---

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).

---

<p align="center"><small>ESARR: ExtendScript Array Methods. Built for the engine, measured on the engine, spec-exact.</small></p>
