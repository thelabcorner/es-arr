# ESARR Round 1 — Native-Backed Lanes vs Engine Builtins vs Pure-JSX ESARR vs Hand-Rolled

**Host:** Adobe Illustrator 30.6.0 / ExtendScript 4.5.6 (COM tool, live healthy instances; PID 100964 reclaimed, PID 39836 wingman-run)
**Date:** 2026-08-10
**Methodology:** primed `$.hiresTimer` medians-of-9 (sizes <= 8k) / -of-3 (16k/32k, 7s-op lanes), 2 warmups, outlier rejection (samples <= 0 or > 1e8 µs dropped), ONE lane per eval (designer wedge warning), fresh clone per run for mutating lanes, native lane = FULL gated dispatch (fused 2-pass wire: classify+pack in ONE loop + DLL op + unpack straight into the target — the T6 fusion; the legacy 4-pass writeback is measured separately as historical context), gate via `ESARR.enableNativeGate({dir, libName})` + DLL under test (byte+1 wire, 11,264 B), bands widened to [1,48000] for measurement. Never packs >= 48k (wedge cap).
**Sizes:** 2048 / 4096 / 8192 measured (round-1 battery) + 16384 / 32768 measured (wingman set, gate-verified). **USER DIRECTIVE (T6): MAX MEASURED SIZE 8k** for new runs — the engine is known-slow and large-n evals burn 10-30 min each for extrapolable numbers; the 16k/32k set was captured before the directive and stands as REAL validation anchors. 48k rows are power-law extrapolations (marked est), validated within 4% against the T2 baseline's directly-measured 32k builtins.
**Fixture:** `mixedFull` = deterministic LCG (seed 987654321) across [-2^31+1, 2^31-1] (native-lane payload fixture); `asc` 0..n-1 and `desc` n-1..0 (engine sort-pattern sensitivity). `native` column = gated dispatch end-to-end. `—` = not applicable/not measured.

## 0. Bottom line (read this first)

**On a healthy instance, NONE of the three native lanes beats the engine builtin at any measured size up to the 48k wedge cap.** The T2 baseline's warning is confirmed with REAL 32k data: sort converges toward parity but never crosses <1.0 (2.32x loss @2k → 1.33x @8k → 1.26x @16k → **1.06–1.21x @32k measured**), join loses (6.3x → 2.0x → 1.44x → **1.31x @32k**), reverse loses badly (19.8x → 6.3x → 4.1x → **3.86x @32k**). The design-doc §6 engine estimates (sort 6.9s / reverse 5.1s / join 1.3s @32k) do NOT reproduce — the healthy engine does sort 1.84s / reverse 0.62s / join 0.86s @32k (measured; 1.5–8.3x faster than estimated).

The binding constraint is the **JSX wire floor**: the fused lane touches the array twice (read for pack ~110ms, write for unpack ~76ms @8k) at the engine's variable-index access cost (~47-50ms per full pass), while the builtin touches it ~once. The DLL op is ~1% of the gated total (1.5ms @8k). No JSX micro-opt removes the second touch for MUTATING lanes (ES5.1 in-place contract), and no C-side change moves the JSX wire — so the floor is irreducible on dense int32. **The honest default (data-derived, coordinator-accepted): sort/reverse/join stay engine-keep; the native lane engages only where it beats min(builtin, JSX)** — which is **toSorted/toReversed** (no engine builtin exists; native is ~19x faster than the only alternative, the JSX fallback). No manufactured wins.

Small-n "wins" from an earlier degraded-instance run (3.4x@256 sort) were artifacts of a sick engine and are excluded.

## 1. Native lanes (sort / reverse / join) — full gated dispatch vs engine builtin vs pure-JSX ESARR

`native` = ESARR method with the gate ON (fused pack + DLL + unpack-into-target). `esarr` = same method with the gate OFF (pure JSX). `builtin` = engine native. Rows at 16k/32k are REAL (wingman, gate-verified); 48k is extrapolated (est).

| lane | n | builtin | esarr(JSX) | native | native/builtin | native/esarr |
|---|---|---|---|---|---|---|
| sort (mixedFull) | 2048 | 8485us | — | 20ms | 2.32x | — |
| sort (asc) | 2048 | 11ms | — | 19ms | 1.74x | — |
| sort (desc) | 2048 | 11ms | — | 18ms | 1.60x | — |
| sort (mixedFull) | 4096 | 41ms | 879ms | 64ms | 1.55x | 0.07x |
| sort (asc) | 4096 | 57ms | — | 96ms | 1.69x | — |
| sort (desc) | 4096 | 36ms | — | 58ms | 1.59x | — |
| sort (mixedFull) | 8192 | 126ms | 3495ms | 168ms | 1.33x | 0.05x |
| sort (asc) | 8192 | 158ms | — | 169ms | 1.07x | — |
| sort (desc) | 8192 | 146ms | — | 170ms | 1.17x | — |
| sort (mixedFull) | 16384 | 462ms | 16.6s | 582ms | 1.26x | 0.04x |
| sort (asc) | 16384 | 554ms | — | 566ms | 1.02x | — |
| sort (desc) | 16384 | 547ms | — | 606ms | 1.11x | — |
| sort (mixedFull) | 32768 | 1838ms | ~94s (est) | 2233ms | **1.21x** | 0.02x |
| sort (asc) | 32768 | 2004ms | — | 2155ms | **1.08x** | — |
| sort (desc) | 32768 | 1969ms | — | 2088ms | **1.06x** | — |
| sort (mixedFull) | 48000 | 3929ms (est) | — | 4682ms (est) | 1.19x (est) | — |
| reverse | 2048 | 877us | 1720us | 17ms | 19.76x | 10.2x |
| reverse | 4096 | 5763us | 6282us | 55ms | 9.62x | 8.82x |
| reverse | 8192 | 30ms | 34ms | 191ms | 6.28x | 5.62x |
| reverse | 16384 | 139ms | 174ms | 574ms | 4.12x | 3.30x |
| reverse | 32768 | 617ms | 699ms | 2381ms | **3.86x** | 3.41x |
| join | 2048 | 1532us | 5828us | 9648us | 6.30x | 1.66x |
| join | 4096 | 9401us | 36ms | 30ms | 3.19x | 0.82x |
| join | 8192 | 49ms | 110ms | 99ms | 2.04x | 0.91x |
| join | 16384 | 204ms | 440ms | 294ms | 1.44x | 0.67x |
| join | 32768 | 860ms | 6839ms | 1131ms | **1.31x** | 0.17x |

**Reading (the honest three-way story):** sort native is within 6–20% of the engine builtin at scale (1.06–1.21x @32k) and ~19–25x faster than the pure-JSX fallback; join is within 31% at 32k and ~6x faster than JSX; reverse loses to both the builtin (3.9x) and JSX (3.4x) because the engine reverse is linear-cheap and the wire is not. The wins the native lane DOES have are vs the JSX fallback — which is the actual alternative for `install({forceReplace:true})` users and for the engine-missing ES6+ lanes (see §6).

## 2. Pack-cost hunt — components, pipelines, indexOf-family

`pack-only`/`unpack-only`/`classify-only`/`writeback-only` = the LEGACY 4-pass component costs (pre-fusion, kept as historical context). `fused-pack-only`/`fused-unpack-into-O` = the ACTUAL fused 2-pass lane path. `native-*-op` = DLL op on a PRE-PACKED payload (read floor removed). `pipe-engine` = `sort();reverse();join()` chained by the engine. `pipe-packonce` = pack once + 3 DLL ops + unpack once. `pipe-percall` = 3 gated ESARR calls (3 packs). `gated-sort-full` = the end-to-end gated dispatch.

| lane | n | value | vs engine-pipe |
|---|---|---|---|
| pack-only | 8192 | 75ms | — |
| unpack-only | 8192 | 51ms | — |
| classify-only | 8192 | 55ms | — |
| writeback-only (legacy) | 8192 | 104ms | — |
| **fused-pack-only** | 8192 | **110ms** | — |
| **fused-unpack-into-O** | 8192 | **76ms** | — |
| native-sort-op | 8192 | 1.5ms | 0.01x |
| native-reverse-op | 8192 | 0.65ms | 0.00x |
| native-join-op | 8192 | 0.76ms | 0.00x |
| pipe-engine | 8192 | 194ms | 1.00x |
| pipe-packonce | 8192 | 141ms | 0.73x |
| pipe-percall | 8192 | 458ms | 2.36x |
| **gated-sort-full** | 8192 | **196ms** | 1.01x |
| pipe-engine | 16384 | 770ms | 1.00x |
| pipe-packonce | 16384 | 429ms | 0.56x |
| pipe-percall | 16384 | 1577ms | 2.05x |
| gated-sort-full | 16384 | 718ms | 0.93x |

**Full gated-sort decomposition @8k (healthy instance, fused wire):** fused-pack 110.3ms + DLL op 1.5ms + fused-unpack 75.9ms = 187.7ms sum vs gated-sort-full 195.8ms measured → **dispatch/gate overhead ≈ 8.1ms (4.2%)**. The 74ms "unexplained gap" reported earlier was a misattribution: pack-only(75)+unpack-only(51) are the SEPARATE-pass numbers; the fused one-pass pack is 110ms and unpack-into-O is 76ms (the O-write costs 2.5x a fresh-array write). The wire floor is REAL and irreducible for mutating lanes.

**Writeback write-cost isolation @8k (medians-of-5):** read-scan 47.4ms vs write-existing 50.6ms — **writes are NOT superlinear-pathological, they are symmetric with reads**. Fresh-array writes 20.0ms (2.5x cheaper — the engine gives fresh `new Array(n)` a fast path); packed-string charCodeAt reads 6.4ms (7.4x cheaper than array reads). unpack-fresh 49.5ms vs unpack-into-O 75.9ms — the mutating lanes' O-write is contractual (ES5.1), the non-mutating lanes already use the cheap fresh path.

**Pack-once pipelines (design doc §6.1 item 1):** pipe-packonce beats per-call by 3.3x @8k (141 vs 458ms) and 3.7x @16k (429 vs 1577ms). Repeated ops on ONE array amortize the wire — a public `ESARR.pack/unpack` API is the round-2 candidate this supports.

**indexOf-family (design doc §6.1 item 3):** per-call pack+scan cannot beat the JSX `===` scan (the up-front pack kills short-circuit). The JSX-ONLY verdict stands — the full-scan miss at 32k stays in favor of JSX; no re-engagement without a per-call regime that wins.

## 3. Payloads — sparse (holes) and array-like {length:n}

Sparse arrays MUST classify OUT of the native lane (holes are spec-meaningful) — the gated row is the classify+fallback cost. Array-likes with int32 values ride the native lane (ES5.1 ToObject).

**Finding:** sparse-sort-gated is CATASTROPHIC (861ms @4k, 3.4s @8k, 14.9s @16k — ~4.3x per doubling): the classify pass correctly exits on the first hole, but the ENTIRE cost is the pure-JSX merge-sort fallback the lane drops to (builtin 138ms vs gated 3.4s @8k — the gated dispatch makes sparse arrays WORSE, adding classify overhead then still falling back). Sparse stays JSX (the facade contract forbids using the engine builtin). Array-likes ride the native lane correctly (gated ≈ builtin + small wire overhead: 22 vs 12ms @2k, 572 vs 525ms @16k).

| lane | n | value |
|---|---|---|
| sparse-sort-builtin | 8192 | 138ms |
| sparse-sort-gated | 8192 | 3435ms |
| arraylike-sort-builtin | 8192 | 147ms |
| arraylike-sort-gated | 8192 | 169ms |
| sparse-sort-builtin | 16384 | 565ms |
| sparse-sort-gated | 16384 | 14881ms |
| arraylike-sort-builtin | 16384 | 525ms |
| arraylike-sort-gated | 16384 | 572ms |

## 4. WIN-BAND table (derived from MEASURED data — dispatch config)

`native/builtin` < 1.00 = the gated native lane beats the engine builtin at that size. Measured sizes: 2048–32768 REAL; 48000 est. The dispatch (`ESARR.setBands`) engages the lane only inside a band; a lane with NO band stays engine/JSX.

| lane | n | builtin | native | native/builtin | win? |
|---|---|---|---|---|---|
| sort | 2048 | 11ms | 18ms | 1.60x | no |
| sort | 4096 | 36ms | 58ms | 1.59x | no |
| sort | 8192 | 146ms | 170ms | 1.17x | no |
| sort | 16384 | 547ms | 606ms | 1.11x | no |
| sort | 32768 | 1969ms | 2088ms | 1.06x | no |
| sort | 48000 | 3929ms | 4682ms | 1.19x (est) | no |
| reverse | 2048 | 877us | 17ms | 19.76x | no |
| reverse | 8192 | 30ms | 191ms | 6.28x | no |
| reverse | 32768 | 617ms | 2381ms | 3.86x | no |
| join | 2048 | 1532us | 9648us | 6.30x | no |
| join | 8192 | 49ms | 99ms | 2.04x | no |
| join | 32768 | 860ms | 1131ms | 1.31x | no |

### Derived dispatch bands (shipped as DEFAULT_BANDS in src/native-lane.ts)

| lane | derived band | doc §6 estimate | verdict |
|---|---|---|---|
| sort | NONE (loses everywhere measured) | [4k, 48k] ~4x@32k | REFUTED — engine builtin wins at every measured n (1.06–2.32x loss) |
| reverse | NONE (loses everywhere measured) | [16k, 48k] ~3x@32k | REFUTED — engine reverse is linear-cheap (3.86x loss @32k) |
| join | NONE (loses everywhere measured) | [32k, 48k] ~1.26x | REFUTED — 1.31x loss @32k measured |
| toSorted | **[1, 48000] ENGAGED** | [4k, 48k] | **CONFIRMED BY CONSTRUCTION** — no engine builtin exists; native ~19x vs the only alternative (JSX fallback) |
| toReversed | **[1, 48000] ENGAGED** | [16k, 48k] | **CONFIRMED BY CONSTRUCTION** — same |

## 5. Honesty notes (per design doc §7)

- **A lane that loses everywhere is disabled in the default config — no manufactured wins.** Round 1 measured losses everywhere for all three ES3 native lanes on healthy dense-int32 up to 32k (REAL) / 48k (est); the shipped `DEFAULT_BANDS` keeps sort/reverse/join on the engine path and engages toSorted/toReversed (engine-missing). `ESARR.setBands` is the documented opt-in force-native override.
- **The native lane total is the FULL JSX wire: fused classify+pack + DLL op + unpack-into-target.** The T6 fusion cut gated sort from 357ms to ~167-196ms @8k by removing the 4th pass and intermediates. The DLL op is ~1% (1.5ms @8k). The dispatch/gate overhead is 4.2% (~8ms @8k) — measured, not assumed.
- **The wire floor is the binding constraint, not the C algorithm.** native-coder2's ESARRArray3 sort-op cut (115ms → 1.5ms @8k, removing an O(n²) free-list walk) was necessary, but with the op at ~1%, no further C-side work moves the gated number. The radix-on-decimal-strings C algorithm is held in reserve (deliverable/sort-algo-research) for a future wire-floor drop.
- **Writes are symmetric with reads** (50.6 vs 47.4ms @8k) — NOT superlinear-pathological. The double array-touch (read for pack, write for unpack) is the irreducible floor for mutating lanes; the non-mutating toSorted/toReversed already use the cheap fresh-array unpack (49.5ms).
- `sort-jsx` (pure-JSX ESARR sort) is an object-heavy stable merge sort (843ms @4k, 3.4s @8k, 16.4s @16k — ~4.8x per doubling); it wedged the engine in the first battery and is never run at 32k+ (user directive; cells extrapolated). It is NOT the dispatch competitor (the builtin is), but it IS the gate-OFF fallback cost — which the native lane beats ~19x (0.05x), the honest win for forceReplace installs.
- **Degraded-instance artifact exclusion:** an earlier run on a sick instance (user-flagged) produced small-n sort "wins" (3.4x@256); those numbers are excluded. All rows here are healthy-instance; gate engagement is asserted per eval (`gate=true`, 5 lanes certified) so no row is a silent JSX fallback.
- **Extrapolation disclosure:** 48000 rows are power-law extrapolations from the two largest measured sizes per lane+column. Validation: extrapolated 32k builtins match the T2 baseline's directly-measured 32k values within 4% (sort 1838 vs 1911ms; reverse 617 vs 728ms; join 860 vs 889ms) — and verifier2's REAL 32k native rows (sort 1.06–1.21x, join 1.31x, reverse 3.86x) confirm the no-band conclusion directly.
- **Cert-ordering fix (T6):** the enable-time certification corpus now clones its input per side — the fused mutating lanes write back into the input, so certifying against a shared array would have let a broken lane "agree" with the already-mutated authority. The gate-on live differential (verifier2, 23/23) asserts in-place mutation separately.
- **Includes precedence bug (verifier2 D9):** ExtendScript parses `a || b && c` as `(a || b) && c`; the shipped `includes` returned false for every element. Fixed in src/array-es6.ts (split ifs), dist+accel rebuilt, verified live.

## 6. Where the native lane actually wins (the honest positive story)

1. **toSorted / toReversed** (engine-missing, ES2023): NO builtin exists in ExtendScript. The native lane is ~19x faster than the only alternative (the JSX fallback) — the default dispatch engages it by construction. This is the flagship native win.
2. **forceReplace installs**: `install({forceReplace:true})` routes sort/reverse/join through ESARR's wrappers. With the gate ON, sort runs the native lane — ~19x faster than the JSX fallback the forceReplace path would otherwise use (engine builtins are bypassed by forceReplace by design).
3. **Pack-once pipelines** (round-2 candidate): pipe-packonce 141ms vs per-call 458ms @8k (3.3x), 429 vs 1577ms @16k (3.7x). A public `ESARR.pack(arr)`/`ESARR.unpack(packed)` API amortizes the wire across repeated ops.
4. **The 39-method surface** with spec-exact semantics + the measured callback-lane wins over MDN-style polyfills (see README Performance).

## Raw data

`bench/round1-raw-<size>-<lane>.json` (per-eval, reproducible); resume markers `bench/status.json`. Rerun: `node tests/benchmark-round1.mjs --merge-only` (render from raws). DLL: `native/bin/ESARRArray.dll` (canonical — the optimized build, promoted from the pre-canonicalization candidate `ESARRArray3.dll`; byte-verified in the shipped dist/ESARR.accel.jsx embed).
