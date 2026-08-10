# ESARR Verification Report

QA/differential engineering (VERIFY stream, T8 — FINAL ACCEPTANCE). Living
document — updated as the implementation lands and divergences are fixed. The
ground truth is the corpus + harnesses in `tests/`; this file records the
matrix and the divergence log.

## How to run

| Check | Command | Scope |
|---|---|---|
| TypeScript strict | `npx tsc --noEmit -p .` | all src + tests |
| Fixed vectors + seeded differential vs Node natives | `npm test` | 238 vectors, 4000 diff iters (seed 20260809), 2000 mode-equality iters + lane-wire round-trip + vendor-sync guard |
| Seeded fuzz vs Node natives (100k default) | `npm run fuzz` | seed 1337 (env `ESARR_FUZZ_SEED`/`ESARR_FUZZ_ITERS`) |
| Lane-wire pack/unpack round-trip | `node tests/wire-test.mjs` | int32 edges, channel safety (NUL/surrogate-free), payload boundaries 0/1/2/3/65535/131071/1e6 |
| Native-gate fallback semantics | `npm test` (section 6) | garbage lib → certification disqualified → DISPATCH falls back to JSX |
| Live engine parity (full surface, both modes) | `npm run live-verify` | needs dist build + COM tool + one Illustrator instance |
| **Gate-on live differential (FINAL ACCEPTANCE)** | `node tests/gateon-differential.mjs` | fresh instance, shipped DLL, in-band int32 payloads incl. **window bytes (units 216-223)** + in-place mutation check for sort/reverse + out-of-band fallback control |
| Accel bundle end-to-end | `npm run accel-e2e` | needs `dist/ESARR.accel.jsx` + `native/bin/ESARRArray.dll` |
| Vendor-sync guard | `npm run vendor-sync-check` | byte-exactness of the vendored accel bundle |

## Method surface (39 landed methods)

ES3 (11): concat join pop push reverse shift slice sort splice unshift
toString — ES5 (10): every filter forEach indexOf isArray lastIndexOf map
reduce reduceRight some — ES6+ (18): at copyWithin entries fill find findIndex
findLast findLastIndex flat flatMap from includes keys of toReversed toSorted
values with.

Excluded by design: `toLocaleString` (locale-dependent; not part of the
spec-exact polyfill contract). The facade additionally exports the install /
capabilities / gate control surface (`install`, `capabilities`,
`enableNativeGate`, `disableNativeGate`, `nativeGateState`, `benchmark`).

## Corpus design

- `tests/surface.ts` — canonical manifest (auto-detection: harnesses validate
  exactly the ops that have landed, `landedOps(core)`).
- `tests/vectors.ts` — 238 fixed vectors (incl. post-mutation state for the 9
  mutating ops: sort reverse splice push pop shift unshift fill copyWithin).
  Required spec edges: `[10,9,1,2].sort()` ToString ordering, mixed-type
  arrays, NaN/±Infinity/-0, negative/string/fractional fromIndex,
  arity-sensitive reduce/lastIndexOf/splice/fill/copyWithin/flat, holes vs
  elisions, string array-likes, array-like objects. **D3 two-case trap**:
  `lastIndexOf from -0.5 -> -0` (ES5.1-exact carve-out) and
  `lastIndexOf from -0 -> +0` (ToInteger(-0) = +0 — matches Node).
- `tests/callbacks.ts` — shared runners: `runVector` (core facade) +
  `runNativeVector` (Node natives, the spec oracle) + `deepStrictEquals`
  (NaN===NaN, +0!==-0, holes≠undefined, nested). JSON stringify is NOT used
  for Node-side comparisons (it hides NaN/-0/hole-vs-undefined).
- `tests/opgen.ts` — random vector generation (10 input shapes incl. sparse,
  nested, all-hole; per-op arg generators incl. NaN/±Inf/-0/undefined/absent
  arity variants; `thisDiff` this-binding probe mode).
- `tests/core-adapter.ts` — merged facade (PURE = JSX authority; DISPATCH =
  gate-routed facade) so the differential runs against the landed modules
  independently of the src/index.ts wiring.
- `tests/gateon-differential.mjs` — the final-acceptance live harness: JSX
  (gate off) vs native (gate on, shipped DLL) vs Node oracle on in-band int32
  payloads (sort 4k-48k, reverse 16k-48k, join 32k-48k), every payload
  exercising window bytes (input bytes 0xD7-0xDE → units 0xD8-0xDF = 216-223
  under byte+1), with the **in-place mutation check** for sort/reverse (input
  array state after the call) and out-of-band controls that must fall back to
  JSX byte-identically.
- Deterministic: mulberry32 seeds; divergences reproducible byte-for-byte.

## Full matrix (final — 2026-08-09, Node v22.23.2 oracle + Illustrator live)

| Set | Methods | Node diff | Live parity | PURE vs DISPATCH (gate off) | Native-backed mode diff |
|---|---|---|---|---|---|
| ES3 | concat join pop push reverse shift slice sort splice unshift toString | GREEN | GREEN (live-verify + gateon) | equal | gate-on GREEN (sort/reverse/join) |
| ES5 | forEach map filter every some indexOf lastIndexOf reduce reduceRight isArray | GREEN | GREEN (live-verify + gateon) | equal | — (indexOf-family JSX-ONLY) |
| ES6+ | at copyWithin entries fill find findIndex findLast findLastIndex flat flatMap from includes keys of values | GREEN | GREEN (live-verify + gateon; includes D9-fixed) | equal | — |
| ES6+ immutables | toReversed toSorted with | GREEN | GREEN (live-verify + gateon) | equal | gate-on GREEN (toSorted/toReversed) |

**Node-side validation FULLY GREEN (2026-08-09, final):** `npm test` = 6492
checks (238 vectors + 4000 seeded diff + 2000 mode-equality iters), 0
failures, 1 D7 carve-out; `npm run fuzz` = 100,000 iterations, 0 divergences,
56 D7 carve-outs; lane-wire round-trip 5092 assertions; vendor-sync guard ok
(vendored accel bundle byte-matches dist); `npx tsc --noEmit` clean. All 39
landed methods are byte-identical to Node's natives within the documented D7
carve-out.

**Standalone native scale parity (no Illustrator):** `node native/lane-parity.mjs`
= 210 commands (sort/reverse/join × 4k/8k/16k/32k/48k × random/small/sorted/
revsorted/pow10/bounds), 0 mismatches vs Node natives — the shipped
`ESARRArray.dll` is byte-correct at scale.

**Live acceptance:** see the acceptance results section below.

## Divergence log (each with repro; fixed ones struck)

### L1 — bundle does not parse in ExtendScript (FIXED)
~~`src/index.ts:141` capabilities() returns `{ engine, nativeList, missing,
native: nativeGateSnapshot() }` — `native` is an ES3 reserved word and cannot
be an unquoted object-literal key; the ENTIRE dist/vendor-esarr.js failed with
`SyntaxError: Illegal use of reserved word 'native'` at load.~~ Fixed by
quoting the key (`"native": nativeGateSnapshot()`); verified present in
dist/vendor-esarr.js (the bundle loads, installs, and runs the live battery).

### W1 — byte+1 wire channel-safety (RESOLVED — closed by the gate-on live differential)
Initial finding: byte+1 emits units 0xD8–0xDF for input bytes 0xD7–0xDE,
flagged as channel-unsafe per the family's "0xD8-0xDF surrogate window" note.
RESOLVED: the true surrogate window is 0xD800-0xDFFF (16-bit code units),
unreachable by byte+1 units (≤ 256); the family shorthand is a hex-truncated
transcription. **FINAL ACCEPTANCE (closed):** the gate-on live differential ran
real int32 payloads carrying the window bytes (units 216-223) through the
shipped DLL on a live instance — sort/reverse/join results byte-identical to
the JSX authority and the Node oracle, in-band and out-of-band. Wire stands.

### D3 — `lastIndexOf` ±0: two-case trap (FINAL, ES5.1-exact per binding)
ESARR's contract is ES5.1-exact. The two observable cases are pinned by
dedicated trap vectors and both verified green:
- `fromIndex = -0.5` (in (-1, 0)) with a hit at index 0 → **-0** (ES5.1
  ToInteger(-0.5) = -0, min(-0, len-1) = -0; Node v22 normalizes to +0).
  Vector: `'lastIndexOf from -0.5 returns -0 (ES5.1-exact, carve-out D3)'`
  expects `-0`. The differential accepts a ±0 difference in lastIndexOf
  results ONLY (carve-out in `callbacks.ts carveOutAccept`); every other
  mismatch still fails.
- `fromIndex = -0` → **+0** (ES5.1 §9.4 ToInteger(-0) = +0 — matches Node;
  the `+fromIndex || 0` fast path). Vector: `'lastIndexOf from -0 returns +0
  (matches Node; || 0 fast path)'` expects `+0`.
The jsx implementation (`array-core.ts lastIndexOf`: `+fromIndex || 0`,
`Math.ceil/floor`, `min(n, len-1)` — returns the computed `k`) is verified
correct with `Object.is` semantics; no `k === 0 → 0` normalization exists in
src or dist. `===` (ES5.1 strict) is used for the element comparison (`-0`
never matches `+0` as a SEARCH target); `includes` stays SameValueZero (both
specs agree there). NOTE: the `===` vs SameValueZero framing is moot for ±0 as
search values (`-0 === 0` is true since ES1) — the only observable is the
return value, which the two-case trap pins.

### D8 — `splice` deleteCount null/undefined handling (FIXED 4:02 PM)
~~jsx-integration's 4:01 change treated `deleteCount === void 0 || === null`
as ABSENT~~ — Node v22 ToIntegerOrInfinity maps explicit null/undefined to 0.
Fixed with the arity-based approach (`arguments.length <= 2` → delete-to-end;
explicit null/undefined/NaN → 0). Differential green incl. the 25%
explicit-undefined generator coverage.

### D7 — `sort` NaN-comparator order (CARVE-OUT per coordinator decision, doc §4.5)
ES5.1 §15.4.4.11: the order of elements whose comparison yields NaN is
implementation-defined (V8 TimSort run-detection never compares certain
pairs: [3,NaN,1].sort(a-b) → V8 [3,NaN,1], ESARR stable-merge → [1,3,NaN]).
ESARR pins a deterministic order — pinned by the trap vector 'sort comparator
NaN pins deterministic order (carve-out D7)'. The differential accepts any
permutation when the comparator is non-transitive (input contains NaN, or
mixes numbers with non-numbers — dCmp's numeric/String hybrid is not a strict
weak ordering there); all-number and all-string inputs remain strictly
compared. Verified: 1 carve-out in 4000 diff iters, 56 in 100k fuzz — no
false-carves (a genuinely broken comparator sort on homogeneous inputs still
fails). Default-comparator NaN position IS spec-determined (NaN ToString =
"NaN") and remains asserted; the native `arrSort` lane never sees comparator
calls (int32 payloads + default comparator only).

### D2 — `sort` holes (FIXED 4:02 PM)
V8-verified asymmetry (probed with `1 in`): Array.prototype.sort COMPACTS
present values to the front and moves holes to the end **keeping them HOLES**
([3,hole,1,hole].sort() → [1,3,HOLE,HOLE]); toSorted/toReversed/with
MATERIALIZE holes as undefined elements. jsx reverted the write-back to
`delete O[j]` — differential + trap vector green.

### D1 — `splice` itemCount = -1 (FIXED 3:44 PM)
`itemCount = arguments.length > 3 ? arguments.length - 3 : 0` — verified green.

### D4 — `slice` loses result length on hole ranges (FIXED 3:53 PM)
Verified: slice differential green ('slice preserves holes' vector + all-hole
differential cases pass).

### D5 — `concat` same length-loss pattern (FIXED 3:53 PM)
Verified: concat differential green (all-hole receiver/args match Node).

### D6 — `toSorted`/`toReversed`/`with` hole materialization (FIXED)
~~`var a=[]; a.length=3; a[2]=1; a.toSorted()` → Node [1,undefined,undefined]
(all indices present); ESARR [1,hole,hole].~~ Fixed per design doc §4.6:
toSorted/toReversed/with materialize holes as `undefined` (the ES2023
behavior, V8-verified); the sort-family asymmetry (mutating sort keeps holes)
is asserted separately with `deepStrictEquals` (holes ≠ undefined). Verified in
dist: `toSorted`/`toReversed`/`with` write `void 0` for holes.

### D9 — `includes` always false in the live engine (FIXED 2026-08-09 — found by accel e2e)
`[1,2,3].includes(2)` returned `false` in the REAL engine while the Node
differential was green. Root cause (probed live on Illustrator 30.6.0):
ExtendScript evaluates `a || b && c` as `(a || b) && c` (equal precedence,
left-to-right) instead of ES5's `a || (b && c)`. The src
(`src/array-es6.ts`) had the correct parenthesized form, but **esbuild strips
the parens as ES5-redundant during bundling** — correct for Node (which
honors precedence), fatal for this engine. So `v === searchElement ||
searchElement !== searchElement && v !== v` became
`(v === searchElement || searchElement !== searchElement) && v !== v` → false
for every non-NaN hit. Fix: split into two separate `if` conditions
(`if (v === searchElement) return true; if (v !== v && searchElement !==
searchElement) return true;`) — paren-strip-proof. Verified live: hit, miss,
-0, NaN, undefined elements, holes-as-undefined, string array-like all match
Node. **Engine-precedence landmine:** any future `X || Y && Z` expression in
src MUST be written paren-strip-proof (split or restructure); the build has no
paren-preservation guarantee.

### Mutation write-back through the native lanes (FIXED 2026-08-09 — benchmarker2 finding, verifier-verified)
FINDING (T6): the gated native sort/reverse returned a fresh unpacked array
and left the input UNMUTATED — the enable-time certification corpus compared
only return values and missed it. Fixed in `src/native-dispatch.ts`
(`writeBackMutating`: writes the native result back into `Object(array)` and
returns it; toSorted/toReversed unchanged — non-mutating). DLL unchanged
(JSX-side fix only). The gate-on live differential now compares the INPUT
array state after each sort/reverse call (JSX vs native vs Node oracle) — the
mutation contract is asserted live, not just the return value.

### ~~lastIndexOf absent-fromIndex → -1~~ (FIXED by jsx-integration 3:39 PM)
`native-dispatch.lastIndexOf` forwarded 3 args unconditionally, destroying the
absent-vs-undefined arity. Verified fixed: 'lastIndexOf hit/absent' vectors +
differential lastIndexOf clean.

## Engine-parity / bundle work (final state)

- **Native scale parity (independent Node-side gate, no Illustrator):**
  `native/lane-parity.mjs` + `lane-test.exe` (freestanding b64-framed loader of
  the real DLL) — sort/reverse/join vs Node natives at 4k/8k/16k/32k/48k ×
  patterns. **210 commands, 0 mismatches** with the shipped `ESARRArray.dll`
  (byte+1). NOTE: `ESARRArray2.dll` is the SUPERSEDED nibble build (left over
  from the wire churn; kept for comparison only — the gate probes
  `ESARRArray` first and engages the first that certifies).
- **Live parity (full surface)**: `tests/esarr-live-verify.mjs` runs all 238
  vectors in the real engine (JSX pass + gate-on second pass when a DLL
  certifies) and compares against the Node-validated core byte-for-byte.
  First run caught L1 (bundle parse blocker); L1 is fixed.
- **Gate-on live differential (FINAL ACCEPTANCE)**: `tests/gateon-differential.mjs`
  — see acceptance results below.
- **Accel e2e**: `tests/esarr-accel-e2e.mjs` — eval → ES3 start → extract →
  load → native switch → corpus parity both modes → skip-extract idempotence →
  versioned re-extract → unwritable-cache fallback. The harness resolves the
  SHIPPED DLL from `native/bin/` (the `native/build/` path in an earlier draft
  was stale — build.ps1 writes to `native/bin/`).
- **Vendor-sync guard**: `esarr-vendor-sync.mjs --check` + `tests/vendor-sync-
  test.mjs` — ok, vendored accel bundle byte-matches dist.

## Acceptance results (T8 — final, 2026-08-09)

**Verdict: PASS — the native acceleration ships.**

1. **D3 two-case trap** — vectors.ts:347-348 pinned (`-0.5 -> -0`, `-0 -> +0`);
   `npm test` FULLY GREEN: 6492 checks (238 vectors + 4000 diff + 2000 mode),
   0 failures, 1 D7 carve-out; wire 5092; vendor-sync ok; tsc clean; fuzz
   100k, 0 divergences.

2. **Gate-on live differential** (`node tests/gateon-differential.mjs`,
   fresh instance, Illustrator 30.6.0): the shipped `ESARRArray.dll` (11,264
   bytes, ESARRArray 1.0.0, byte+1 wire) certified ALL FIVE lanes
   (sort,toSorted,reverse,toReversed,join; certified=20). 23 int32 payloads at
   in-band sizes (sort 4k/16k/32k, reverse 16k/32k, join 32k/48k) — every
   payload exercising **window bytes (input 0xD7-0xDE -> units 216-223)** —
   byte-identical between the native lane and the JSX authority AND the Node
   oracle. **In-place mutation asserted** for sort/reverse (input array state
   after the call — the class of bug benchmarker2's T6 finding caught).
   Out-of-band controls (n < band) fell back to JSX byte-identically.
   **W1 is CLOSED by live acceptance: the byte+1 wire stands.**

3. **Accel e2e** (`npm run accel-e2e`, fresh instance per phase): ALL CHECKS
   PASSED — v1: bundle evals, ESARR installed (missing empty), native gate
   enabled, sort lane active, lanes certified, smoke vectors correct, **full
   238-vector corpus byte-identical to Node in native mode**, DLL extracted
   byte-exact; re-run: gate still native, **no re-extraction (mtime
   unchanged)** — skip-extract idempotent; v2: versioned re-extract loaded the
   bumped DLL and v1 stayed (locked by host); fail-path (cache dir = an
   existing FILE): **stays es3 gracefully, no throw**.

4. **Real product bug found + fixed by the acceptance:** the shipped
   `includes` returned `false` for every present element in the live engine
   (see D9 below). The Node differential could not see it (Node honors ES5
   precedence; the engine does not). Fixed in `src/array-es6.ts`, dist +
   accel rebuilt, verified live.

5. **Native scale parity (no Illustrator):** `node native/lane-parity.mjs`
   = 210 commands, 0 mismatches (4k-48k, all patterns) against the shipped
   DLL.

**Remaining notes:** the pure-JSX `sort` at 32k/48k is multi-minute (object-
heavy stable merge) — benchmark-only concern, not correctness; the gated
native sort is ~ms. See benchmark-rounds-1.md for win bands.

## Divergence triage policy

Never weaken a test to make a change pass. Vector expectations are derived
from Node v22 natives (the oracle); where the engine's own quirks differ
(elision normalization, host-object `__class__`), those are probed separately
in the live extras, not folded into the differential. The gate-on live
differential asserts the JSX authority vs the native lane vs the Node oracle
on the SAME payloads — a wire/lane regression cannot hide behind a return-only
comparison (mutation state is compared too).
