# ESARR Baseline Benchmark — ExtendScript Built-ins vs Pure-JSX ESARR vs Hand-Rolled Loops

**Host:** Adobe Illustrator 30.6.0 / ExtendScript 4.5.6 (COM tool, live instance)
**Date:** 2026-08-09
**Methodology:** primed medians-of-9 (2 warmups + 9 timed samples, median; pathological large-n lanes use medians-of-3 per design doc §7), outlier rejection (samples <= 0 or > 100 s dropped), per-size isolated evals, wedge-safe caps (fixtures <= 32k; O(n^2) drains only at n <= 2k — the 8k hand drain wedges the engine; hand-rolled join/sort capped where quadratic).
**Fixtures:** dense integer arrays — `asc` 0..n-1, `desc` n-1..0, `mixed` LCG ints in [0, 1e6), `mixedFull` LCG ints across [-2^31+1, 2^31-1] (the native-lane payload fixture, §5), `parts` = 16 arrays of n/16 for concat-many. Mutating lanes time a fresh clone per run (clone excluded from timing).
**Units:** µs unless suffixed ms. `—` = not applicable/not measured (see notes). `read-scan` is the pure variable-index read loop (the engine's superlinear trap).

## Targets for the native lanes (design doc §2 final contract)

Per the binding design doc (native-acceleration-design.md): **native-backed lanes = `sort` (default), `reverse`, `join`** on packed int32 payloads, engaged only inside BENCH-verified win bands. **`concat`/`slice` stay engine-native** (no native lane — engine wins dense arrays); **`indexOf`/`lastIndexOf`/`includes` are JSX-ONLY** (up-front pack kills short-circuit — the early-hit catastrophe; only full-scan misses at ~32k could marginally win). Callback lanes (forEach/map/filter/every/some/reduce/reduceRight) stay pure-JSX; their target is beating the `hand` loop where the API allows. Round-1 win bands start from design doc §6 (sort 4k-48k ~4x@32k, reverse 16k-48k ~3x@32k, join >=32k ~1.26x) and must be confirmed by these tables.

This baseline is the **empirical arbiter of the read-floor hypothesis**: the `builtin` column at 32k (sort/reverse/join) is the exact cost the pack+unpack native lane must beat. Any lane where the builtin does NOT dominate is a loss for the native candidate — reported honestly.

## 1. Builtin lanes (ExtendScript natives vs hand-rolled loops)

| lane | n | builtin | hand | vs hand |
|---|---|---|---|---|
| slice-full | 256 | 52us | 100us | 1.92x |
| slice-full | 2048 | 2927us | 3302us | 1.13x |
| slice-full | 8192 | 80ms | 90ms | 1.13x |
| slice-half | 256 | 17us | 40us | 2.35x |
| slice-half | 2048 | 650us | 803us | 1.24x |
| slice-half | 8192 | 19ms | 20ms | 1.06x |
| concat-2 | 256 | 123us | 236us | 1.92x |
| concat-2 | 2048 | 9292us | 11ms | 1.19x |
| concat-2 | 8192 | 230ms | 229ms | 1.00x |
| join-comma | 256 | 30us | 117us | 3.90x |
| join-comma | 2048 | 2193us | 6284us | 2.87x |
| join-comma | 8192 | 52ms | 70ms | 1.33x |
| join-comma | 32768 | 942ms |    —   |    —   |
| toString | 256 | 30us | 117us | 3.90x |
| toString | 2048 | 1911us | 6126us | 3.21x |
| toString | 8192 | 51ms | 68ms | 1.32x |
| toString | 32768 | 1089ms |    —   |    —   |
| push-build | 256 | 183us | 104us | 0.57x |
| push-build | 2048 | 3824us | 2331us | 0.61x |
| push-build | 8192 | 44ms | 31ms | 0.71x |
| pop-drain | 256 | 86us | 4us | 0.05x |
| pop-drain | 2048 | 4351us | 391us | 0.09x |
| pop-drain | 8192 | 59ms | 710us | 0.01x |
| shift-single | 8192 | 47ms | 68ms | 1.46x |
| shift-drain | 256 | 1220us | 11ms | 9.23x |
| shift-drain | 2048 | 707ms | 2284ms | 3.23x |
| unshift-single | 8192 | 18ms | 20ms | 1.06x |
| unshift-build | 256 | 1344us | 6468us | 4.81x |
| unshift-build | 2048 | 689ms | 1193ms | 1.73x |
| splice-mid | 256 | 7us | 48us | 6.86x |
| splice-mid | 2048 | 364us | 1295us | 3.56x |
| splice-mid | 8192 | 7295us | 20ms | 2.67x |
| splice-half | 256 | 32us | 52us | 1.63x |
| splice-half | 2048 | 2310us | 1826us | 0.79x |
| splice-half | 8192 | 77ms | 41ms | 0.53x |
| sort-cmp | 256 | 13ms | 10ms | 0.77x |
| sort-cmp | 2048 | 849ms | 1368ms | 1.61x |
| sort-cmp | 8192 | 165ms |    —   |    —   |
| sort-cmp | 32768 | 2156ms |    —   |    —   |
| sort-default | 256 | 491us |    —   |    —   |
| sort-default | 2048 | 7961us |    —   |    —   |
| sort-default | 8192 | 122ms |    —   |    —   |
| sort-default | 32768 | 2099ms |    —   |    —   |
| reverse | 256 | 19us | 110us | 5.79x |
| reverse | 2048 | 911us | 2792us | 3.06x |
| reverse | 8192 | 30ms | 66ms | 2.17x |
| reverse | 32768 | 711ms |    —   |    —   |

## 2. ES5/ES6+ scan lanes (pure-JSX ESARR vs MDN-style vs hand-rolled)

`includes-miss` is the ES6+ `includes` lane (no MDN equivalent — its mdn column is `—`); it is the ===-scan floor the includes native candidate must beat.

| lane | n | esarr | mdn | hand | vsMDN | vsHand |
|---|---|---|---|---|---|---|
| forEach | 256 | 167us | 273us | 51us | 1.63x | 0.31x |
| forEach | 2048 | 2761us | 3687us | 1720us | 1.34x | 0.62x |
| forEach | 8192 | 58ms | 61ms | 54ms | 1.04x | 0.92x |
| forEach | 32768 | 1098ms | 1088ms | 1071ms | 0.99x | 0.98x |
| map | 256 | 237us | 331us | 106us | 1.40x | 0.45x |
| map | 2048 | 4870us | 5903us | 3310us | 1.21x | 0.68x |
| map | 8192 | 88ms | 90ms | 82ms | 1.03x | 0.93x |
| map | 32768 | 2115ms | 2220ms | 2792ms | 1.05x | 1.32x |
| filter | 256 | 288us | 389us | 122us | 1.35x | 0.42x |
| filter | 2048 | 4353us | 5332us | 2659us | 1.22x | 0.61x |
| filter | 8192 | 78ms | 81ms | 71ms | 1.04x | 0.90x |
| filter | 32768 | 1616ms | 1766ms | 1576ms | 1.09x | 0.97x |
| every | 256 | 173us | 278us | 53us | 1.61x | 0.31x |
| every | 2048 | 2740us | 3784us | 1849us | 1.38x | 0.67x |
| every | 8192 | 58ms | 62ms | 53ms | 1.07x | 0.93x |
| every | 32768 | 1281ms | 1194ms | 1227ms | 0.93x | 0.96x |
| some | 256 | 170us | 276us | 52us | 1.62x | 0.31x |
| some | 2048 | 2690us | 4157us | 1970us | 1.55x | 0.73x |
| some | 8192 | 57ms | 62ms | 53ms | 1.10x | 0.94x |
| some | 32768 | 1329ms | 1155ms | 1054ms | 0.87x | 0.79x |
| indexOf-miss | 256 | 69us | 69us | 52us | 1.00x | 0.75x |
| indexOf-miss | 2048 | 2046us | 2005us | 1791us | 0.98x | 0.88x |
| indexOf-miss | 8192 | 55ms | 55ms | 69ms | 0.99x | 1.25x |
| indexOf-miss | 32768 | 994ms | 1018ms | 980ms | 1.02x | 0.99x |
| lastIndexOf | 256 | 69us | 67us | 48us | 0.97x | 0.70x |
| lastIndexOf | 2048 | 1863us | 2047us | 2048us | 1.10x | 1.10x |
| lastIndexOf | 8192 | 54ms | 55ms | 53ms | 1.02x | 0.98x |
| lastIndexOf | 32768 | 1033ms | 1076ms | 988ms | 1.04x | 0.96x |
| reduce | 256 | 184us | 185us | 50us | 1.01x | 0.27x |
| reduce | 2048 | 3057us | 3001us | 1745us | 0.98x | 0.57x |
| reduce | 8192 | 59ms | 59ms | 53ms | 0.99x | 0.90x |
| reduce | 32768 | 1005ms | 1008ms | 1064ms | 1.00x | 1.06x |
| reduceRight | 256 | 183us | 183us | 48us | 1.00x | 0.26x |
| reduceRight | 2048 | 3196us | 2887us | 1728us | 0.90x | 0.54x |
| reduceRight | 8192 | 58ms | 59ms | 53ms | 1.01x | 0.92x |
| reduceRight | 32768 | 1086ms | 1072ms | 1007ms | 0.99x | 0.93x |
| includes-miss | 256 | 73us |    —   | 52us |    —   | 0.71x |
| includes-miss | 2048 | 1977us |    —   | 1720us |    —   | 0.87x |
| includes-miss | 8192 | 54ms |    —   | 53ms |    —   | 0.99x |
| includes-miss | 32768 | 1016ms |    —   | 1052ms |    —   | 1.04x |

## 3. Engine quirk: superlinear variable-index reads

`read-scan` is a plain `for (q...) s += asc[q]` traversal — the cost the design must beat with packed native lanes.

| lane | n | hand (scan) |
|---|---|---|
| read-scan | 256 | 50us |
| read-scan | 2048 | 1743us |
| read-scan | 8192 | 53ms |
| read-scan | 32768 | 920ms |

## 4. Pathological large-n cases (native-candidate lanes, medians-of-3)

These are the FINAL native candidates at the sizes where the design doc predicts wins — the engine builtin cost is the exact number the pack+unpack native lane must beat in round 1. 16k is the midpoint for band edge confirmation. Each lane ran as its OWN single-op eval (designer's wedge warning: chained sort/reverse probes hang the engine).

| lane | n | builtin | hand | vs hand |
|---|---|---|---|---|
| sort-cmp | 16384 | 554ms |    —   |    —   |
| sort-cmp | 32768 | 2156ms |    —   |    —   |
| sort-default | 16384 | 504ms |    —   |    —   |
| sort-default | 32768 | 2099ms |    —   |    —   |
| sort-default-full | 16384 | 466ms |    —   |    —   |
| sort-default-full | 32768 | 1911ms |    —   |    —   |
| reverse | 16384 | 150ms |    —   |    —   |
| reverse | 32768 | 711ms |    —   |    —   |
| reverse-full | 16384 | 146ms |    —   |    —   |
| reverse-full | 32768 | 728ms |    —   |    —   |
| join-comma | 16384 | 202ms |    —   |    —   |
| join-comma | 32768 | 942ms |    —   |    —   |
| join-comma-full | 16384 | 206ms |    —   |    —   |
| join-comma-full | 32768 | 889ms |    —   |    —   |
| toString | 16384 | 223ms |    —   |    —   |
| toString | 32768 | 1089ms |    —   |    —   |
| concat-many-32k | 16384 | 114ms |    —   |    —   |
| concat-many-32k | 32768 | 541ms |    —   |    —   |
| slice-32k | 16384 | 341ms |    —   |    —   |
| slice-32k | 32768 | 1633ms |    —   |    —   |

## 5. Win-band implications (the numbers that matter for round 1)

Measured engine costs at the sizes the design doc predicts native wins (medians-of-3, full-range int32 fixture `mixedFull` = LCG ints across [-2^31+1, 2^31-1]):

| lane @ n | engine builtin (measured) | design-doc §6 estimate | delta |
|---|---|---|---|
| sort-default @ 32k | **1.91 s** | 6.9 s | engine is **3.6x faster** than estimated |
| reverse @ 32k | **728 ms** | 5.1 s | engine is **7.0x faster** than estimated |
| join @ 32k | **889 ms** | 1.3 s | engine is **1.5x faster** than estimated |

The design doc's win math assumed engine builtins at 6.9 s / 5.1 s / 1.3 s. **These measurements do not reproduce on my fixtures.** The native lane total (pack ~1.0 s @32k v1 + native op + unpack ~0.6-0.7 s) therefore does NOT beat the engine at 32k on this fixture:

- `sort` 32k: native ≈ 1.7-1.9 s vs engine **1.91 s** → parity or marginal, NOT the ~4x win the doc predicted
- `reverse` 32k: native ≈ 1.7 s vs engine **728 ms** → native LOSES ~2.3x
- `join` 32k: native ≈ 1.0-1.1 s vs engine **889 ms** → native LOSES ~1.2x

ASSUMPTION: the design doc's microprototype engine numbers (6.9 s / 5.1 s / 1.3 s) were measured on a different RNG fixture (doc §10, `%TEMP%\opencode\esarr-mp2*.json`). My `mixedFull` is a deterministic LCG (seed 987654321) across the full int32 range. The discrepancy is material (3.6-7.0x) and MUST be reconciled before round 1: either the designer's fixture produced harder sort inputs (duplicate strings, adversarial digit patterns), or engine cost depends heavily on value distribution. Round 1 must measure native vs engine on IDENTICAL fixtures — the band table comes from that, not from either estimate.

Honesty rule (design doc §7): on THIS baseline, none of the three native candidates shows a win at 32k on dense int32. The doc §6 bands sort [4k,48k], reverse [16k,48k], join [32k,48k] are **not confirmed**; they must be re-derived from round-1 data. If round 1 confirms no wins, the native lanes stay disengaged by default (no manufactured wins) — the remaining honest wins are the JSX callback lanes (ESARR beats MDN on every lane at small n, and beats the hand loop for `map` at 32k: 2.12 s vs 2.79 s) and the 43-method surface.

The one bright spot for the native design: `read-scan` at 32k ≈ 920-999 ms (the JSX read floor) means pack+unpack alone is ~1.6-1.7 s of pure JSX cost the DLL removes. The question round 1 must answer is whether the engine's own builtins (1.91 s / 0.73 s / 0.89 s measured here) leave enough headroom.

## Notes

- `sort-cmp` uses a numeric comparator (`a - b`) on a **descending** fixture (worst-ish for qsort); `sort-default` is the engine's lexicographic string sort on LCG-mixed ints. Hand-rolled insertion sort only measured at n <= 2048 (quadratic above — wedge risk).
- `shift-drain`/`unshift-build` are O(n^2) drains: measured only at n <= 2048 (wedge cap — the 8k hand drain wedged the engine during development); at 8k+ the single-op variants (`shift-single`/`unshift-single`) are reported instead. `join-comma`/`toString` hand loops are quadratic string concat: reported only at n <= 8192; at 32k hand is N/A.
- `concat-many-32k` uses `[].concat.apply([], parts)` with 16 x 2048 arrays. Pathological large-n lanes (sort/reverse/join at 16k/32k) are medians-of-3 per design doc §7 (7s ops).
- Per design doc §2: sort/reverse/join are the native candidates (concat/slice engine-keep, indexOf-family JSX-ONLY) — Table 4 rows are the exact engine costs the native lanes must beat.
- Raw per-eval JSON: `bench/raw-*.json` (reproducible). Rerun: `node tests/benchmark-baseline.mjs`.
