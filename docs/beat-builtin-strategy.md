# ESARR Beat-Builtin Strategy — Architect Hypothesis Funnel (Round 2)

**Author:** architect (stream STRATEGY, swarm `esarr-beat-builtin`)
**Date:** 2026-08-10
**Host:** Adobe Illustrator 30.6.0 / ExtendScript 4.5.6, **fresh disposable instance** (PID 115140 — the degraded round-1 bench instance PID 117556 was reclaimed and NOT used, per the coordinator's degraded-instance lesson)
**Methodology:** primed `$.hiresTimer` medians-of-9 (≤8k) / -of-3 (>8k), warmups (2 ≤64k, 1 @128k, 0 @256k), outlier rejection (samples ≤0 or >1e8 µs dropped), ONE DLL per probe (canonical `ESARRArray.dll`, byte+1 wire), file-logged raws + resume markers (`bench/architect-status.json`), mutating lanes time fresh clones (pre-built pools, clone excluded from timing). Numbers below are labeled `host=AI 30.6.0 / fixture=mixedFull (LCG seed 987654321, full int32 range) / n / median-µs` unless stated. All raws: `bench/arch-raw-*.json`.
**Fixture note:** `mixedFull` (dense int32, LCG) for pack/unpack/native lanes; `asc` for mutating-lane pools. Engine-builting comparisons use the same fixture per row.

---

## 0. Bottom line (read this first)

**The mission's central hypothesis — a sort crossing at 64k–128k once the wedge cap is lifted — is REFUTED by direct measurement.** Chunked 16k-elem packing is wedge-safe at 64k and 128k, but the native wire floor grows **faster** than the engine builtin at scale (measured exponents 32k→64k: wire ≈ n^2.38, builtin sort ≈ n^1.97), so the sort gap does not close below 1.0 — it is 1.05–1.23x @32k–64k and widens beyond. No JSX wire micro-optimization (unrolled literal-offset reads, fast classify, branchless shift-pack, base-2048 3-char wire) changes that verdict; stacked best-case they bring @32k to ~0.97x (parity, within run-to-run noise) but @64k re-widens to ~1.13x.

**The legitimate measured win is PACK-ONCE AMORTIZATION — a public `ESARR.pack/unpack` + `ESARR.packRun` API** that beats the engine's chained pipe (`sort();reverse();join()`) on dense int32 at every measured size: **0.73x @8k → 0.56x @16k → 0.54x @32k** (141→194ms, 429→770ms, 1,577→2,917ms), and 3.3x faster than per-call gated ESARR at 32k. The win grows with n because the engine pipe pays per-op ToString/array-traversal while the native pipe pays the wire once (pack + 3 in-wire DLL ops + unpack). **This is the recommended product path; the sort/reverse/join single-op lanes stay engine-keep.**

---

## 1. Hypothesis funnel — ranked, with verdicts

| # | Hypothesis (lever) | Priority | Verdict | Evidence |
|---|---|---|---|---|
| H1 | **Literal-offset unrolled reads** `a[k+0..k+7]` hit the engine IC fast path, collapsing the wire floor | 1 (highest upside) | **REFUTED** | read-scan 46 vs 45 ms @8k; 798 vs 821 ms @32k (unrolled ≡ variable). pack-u4/u8/u16-full ≡ pack-v1 (75–78 ms @8k, 1.02–1.10 s @32k). The IC fast path applies to literal constants only, not variable+offset expressions. `bench/arch-raw-packvars-*.json` |
| H2 | **Chunked wedge-safe packing** (16k loops) unlocks n>48k and finds the sort crossing | 2 | **PARTIALLY CONFIRMED / CROSSING REFUTED** | Chunked pack is wedge-safe at 64k (262,144-char channel materialized), 128k (single-row probe, 524,288 chars ✓) and **256k (1,048,576 chars ✓, 536.5 s single pack)**; the full multi-pool battery @128k wedged the engine (memory pressure, not the pattern). BUT the superlinear read counter does **NOT** reset per chunk: pack-chunked-16k @64k = 5.38 s ≈ single-loop extrapolation (4.2 s), not the reset prediction (~1.1 s). Native-vs-builtin @64k: sort 1.20x, join 1.39x, reverse 3.3x — all losses. The wire's superlinearity bends (n^3.79 64k→128k, n^2.85 128k→256k) but stays prohibitive at scale. `bench/arch-raw-chunked-65536.json`, `arch-raw-bigsort-65536.json`, `arch-min-chunk-{131072,262144}` |
| H3 | **Pack-once amortization** — public pack/unpack API; pipe beats engine pipe | 3 | **CONFIRMED — THE WIN** | pipe-packonce 0.73x @8k, 0.56x @16k (round-1), **0.54x @32k (1,577 vs 2,917 ms)**; 3.3x vs per-call. DLL ops total ~12 ms @32k (0.8% of pipe). `bench/arch-raw-pipe-32768.json` |
| H4 | **Fast classify + branchless shift-pack** (`v === (v|0)`; `>>>0` without the `n<0?n+2^32:n` temp) | 4 | **CONFIRMED (small, free)** | pack-v1 1,071 → pack-u8-fastshift 992 ms @32k (−7.4%); 75→69 ms @8k. Behavior-identical: Node-verified byte-equal output, holes/NaN/float/-0/out-of-range all classify OUT identically to `isLaneInt`. Safe for `packLanePass`. |
| H5 | **Base-2048 3-char wire** (25% fewer charCodeAt/fromCharCode) | 5 | **MODEST; not a crossing creator** | pack3 −4.1% (72.8→69.8 ms @8k), unpack3-into-O −12.5% (75.7→66.2 ms), unpack3-fresh −20.7% (48.7→38.6 ms). Stacked with H4: ~0.97x parity @32k (within noise), ~1.13x @64k projected — loses. Needs a C decode change (native-c: ~30-line diff, ESARRArray4) to be usable by the DLL pipe. Hold unless the public API ships AND a robust <1.0 margin is required. `bench/arch-raw-base2048-8192.json` |
| H6 | **Open ideation** — split-phase reads, native staged payloads, string-transport reads, cross-lane fusion | 6 | **DEAD ENDS (measured-adjacent)** | Split-phase = extra array touch (banned by the fused-pass design). Staged payloads: DLL op is ~0.1–0.8% of gated cost — C-side fusion can't move the number. String-transport reads: no engine path exists for int32 without per-element conversion. Cross-lane fusion = H3 (the pipe), which is the win. |

**Funnel process note:** every idea above was either measured in the live engine or had its exact mechanism measured (e.g. read-scan isolation, fromCharCode-only isolation, op-only rows) before any src/ change was proposed. No code was committed from this funnel; wire-jsx/native-c await the verdicts above.

---

## 2. Wire-floor decomposition (measured, fresh instance)

The single-op native lane cost at any n = **pack (JSX) + DLL op + unpack (JSX) + dispatch**. Measured components:

| component | @8k | @32k | @64k (chunked) | notes |
|---|---|---|---|---|
| read-scan (variable index) | 46 ms | 798 ms | ~4.0 s (est) | superlinear n^2.06 (8k→32k), n^2.38+ (32k→64k); **unrolling does not help** |
| fromCharCode+concat (4-arg) | 22–48 ms* | 145 ms | — | *run-to-run variance (engine warm/GC); 3-arg is 17–30% cheaper |
| **pack (v1)** | 75–84 ms* | 1,071 ms | 5,377 ms (chunked-16k) | *two runs; instance state matters |
| **pack (u8-fastshift)** | 69 ms | 992 ms | 4,972 ms (chunked-16k-u8) | best measured pack |
| unpack into fresh | 49 ms | 524 ms | ~2.2 s (est) | fresh-array fast path |
| unpack into O (mutating) | 77 ms | 943 ms | ~3.9 s (est) | ES5.1 in-place contract |
| DLL sort op | 1.5 ms | 6.4 ms | 12.2 ms | 0.1–0.8% of gated total |
| dispatch/gate overhead | ~8 ms | ~20 ms (est) | ~30 ms (est) | round-1 measured 4.2% @8k |

**Read floor dominates and is irreducible via JSX.** The engine's variable-index array read cost (~7.5e-4 µs × distinct indices accessed) is the binding constraint; the packed-string charCodeAt path is 7.4x cheaper (round-1), which is why the wire is read-bound on the array side (pack) and write-bound on the array side (unpack-into-O).

**Write floor:** unpack-into-O (77 ms @8k) vs unpack-fresh (49 ms) — the engine's existing-array write path costs ~1.6x a fresh-array write. Unrolled writes (`target[k+0..7]`) do NOT help (75–77 ms @8k) — same IC conclusion as reads.

---

## 3. The crossing analysis — refuted by direct 64k measurement

The mission's crossing model ("builtin sort ToString-per-comparison grows ~n·log n, wire grows ~n², crossing plausibly at 64k–128k") assumed builtin growth ~n·log n. **Direct measurement refutes the model:**

| n | builtin sort (fresh instance) | native sort (gated/chunked) | native/builtin |
|---|---|---|---|
| 2,048 | 8.5 ms (round-1) | 19.7 ms (round-1) | 2.32x |
| 8,192 | 126 ms (round-1) | ~168 ms (round-1) | 1.33x |
| 32,768 | 1,838 ms (round-1) | 2,044–2,233 ms | 1.11x |
| **65,536** | **7,237 ms (measured)** | **8,707 ms (measured)** | **1.20x** |

Measured exponents (32k→64k): builtin sort n^1.97, native wire n^2.38 (pack 992→4,972 ms). The wire's superlinearity **bends** beyond 64k (pack alone: 4.97 s @64k → 74.5 s @128k = n^3.79 → 536.5 s @256k = n^2.85) but stays prohibitive: a single chunked pack @256k costs 536.5 s (measured, wedge-safe, channel materialized 1,048,576 chars). **The gap widens beyond 64k, it does not cross.** The builtin's default sort is itself ~quadratic here (ToString-per-comparison in a string-compare-heavy engine), and the wire is worse-than-quadratic — two superlinears, native's the worse one.

The 128k/256k native-vs-builtin rows were not run (the 128k pack alone is 74.5 s; 256k builtin sort would be ~3+ min/rep). Projection from the measured anchors: native sort @256k ≈ 536.5 s (pack) + ~200 s (unpack-into-O) ≈ 735 s vs builtin sort @256k ≈ 190–270 s (n^1.97–2.4 extrapolation) → ~3x loss. The mission's "crossing plausibly 64k–128k" is settled: it does not exist.

**Wedge-cap answer for the shipping dispatch:** the hard 48k band cap can be lifted to a soft ~96k cap with chunked packing (wedge-safe by construction; the 128k battery wedge was memory pressure from multi-pool evals, not the pattern). But since the native lane loses everywhere on single ops, the cap only matters for the pack/unpack public API (which is chunked from the start) — see §5.

---

## 4. Single-op lanes — final three-way verdict @64k (raw-backed)

`bench/arch-raw-bigsort-65536.json` (DLL engaged, ToString-order certified `correct-native-sort=1`):

| lane @64k | builtin | native (chunked v1) | native (chunked u8) | ratio (best native / builtin) |
|---|---|---|---|---|
| sort | 7,237 ms | 8,707 ms | 8,887 ms | **1.20x — LOSES** |
| reverse | 2,580 ms | 8,532 ms | 8,620 ms | **3.31x — LOSES** |
| join | 3,421 ms | 4,746 ms | 4,738 ms | **1.39x — LOSES** |

DLL ops alone: sort 12.2 ms, reverse 5.1 ms, join 6.4 ms — 0.1–0.3% of gated cost. The wire is the entire problem; no C-side work moves these numbers (consistent with round-1's conclusion, now at 64k).

**Dispatch recommendation (unchanged from round-1, now 64k-validated):** `sort/reverse/join` = engine-keep at all n; `toSorted/toReversed` = native (no engine builtin exists; native ~19x vs the JSX fallback). `DEFAULT_BANDS` in `src/native-lane.ts` already encodes this. `ESARR.setBands` remains the documented force-native opt-in.

---

## 5. THE WIN: pack-once amortization + public API spec

### 5.1 Measured evidence (fresh instance, gate ON, DLL engaged)

| pipe lane | @8k (round-1) | @16k (round-1) | @32k (measured) |
|---|---|---|---|
| engine pipe (`sort();reverse();join()`) | 194 ms | 770 ms | 2,917 ms |
| **pipe-packonce** (pack + 3 DLL ops + unpack) | 141 ms | 429 ms | **1,577 ms** |
| ratio | **0.73x** | **0.56x** | **0.54x** |
| per-call ESARR-gated (3 packs) | 458 ms | 1,577 ms | 5,231 ms |
| packonce/percall | 3.2x | 3.7x | **3.3x** |

The win's mechanism: the engine pipe pays per-op cost (sort's ToString comparisons + reverse's traversal + join's concat — all superlinear), while the native pipe pays the wire once (pack ~1.4 s @32k + 3 DLL ops ~12 ms + unpack ~0.5 s) and the DLL does the three ops in C on one payload. **The win grows with n** (0.73→0.54x) because the wire amortizes while the engine's per-op superlinearity compounds. `bench/arch-raw-pipe-32768.json`.

**Prediction vs SHIPPED (wire-jsx handoff 2026-08-10, all gates green, fresh instance):** the shipped `ESARR.pipe` measured **105.9 / 279 / 1,170 ms vs engine pipe 283.6 / 1,030 / 4,163 ms @8k/16k/32k = 0.37x / 0.27x / 0.28x** — better than the funnel's probe estimates (0.73x / 0.56x / 0.54x) because the shipped pipe folds in the H4 fast lane (−7.4% wire), the H2 chunked pack, and a pure in-wire path. The funnel's recommendations were conservative; direction and monotonicity confirmed. Manual `pack + 3× packRun` measured identical to `ESARR.pipe`.

**Engagement doctrine for the pipe:** engage only for dense int32 (the pack classifies; non-int32/holes fall back to a JSX pipe with identical semantics) and only when the user requests ≥2 ops on the SAME array (a single op should stay engine-keep). No manufactured wins: the pack-once path must beat `min(builtin pipe, JSX pipe)` at the measured n — it does at every size measured (8k–32k).

### 5.2 Public API spec draft (folded: wire-jsx's draft + architect's design verdicts)

```jsx
// ---- ESARR.pack / ESARR.unpack / ESARR.packRun — PACK-ONCE PIPELINE ----
// Purpose: amortize the JSX wire across repeated native ops on ONE dense
// int32 array. ES3-safe facade (var-only), mirrors lane-wire.ts signatures.

ESARR.pack(arr) -> string | undefined
  // Classify+pack in one pass (the fast lane: `v === (v|0)` classify +
  // branchless `>>>0` shift-pack — H4 verdict, byte-identical wire).
  // Returns the byte+1 channel string (4 chars/int32, units 1..256,
  // NUL/surrogate-free by construction); length inferable = arr.length.
  // undefined => non-int32 element / hole / out-of-range (caller falls back
  // to the JSX pipe). For n > 48k the pack is CHUNKED (16k-elem bounded
  // loops, wedge-safe by construction, byte-identical channel — H2 verdict).

ESARR.unpack(packed, len?) -> int32[] | undefined
  // Fresh preallocated array + indexed writes (the mandated 1.4x-faster
  // pattern). len defaults to packed.length >>> 2 (4 chars/elem); when len
  // is supplied, validates units === len*4 (truncated/corrupt channel =>
  // undefined, never OOB). ES5.1 note: unpack produces a FRESH array —
  // non-mutating; to write into an existing array use ESARR.unpackInto.

ESARR.packRun(op, packed, len) -> string | undefined
  // op is a STRING KEY: 'sort' | 'reverse' | 'join' (by-key — no higher-order
  // fns on packed data; arbitrary JS fns cannot read the wire). Runs ONE
  // in-wire DLL op directly on the channel string (no repack, single DLL
  // call) and returns a PACKED result string. Multi-op workflows:
  //   var p = ESARR.pack(a);            // once
  //   p = ESARR.packRun('sort', p, n);  // in-wire
  //   p = ESARR.packRun('reverse', p, n);
  //   p = ESARR.packRun('join', p, n);  // string result stays packed
  //   var out = ESARR.unpack(p, n);     // once
  // undefined => op not engaged / DLL op failed (caller falls back).
  // For the join op the returned "packed" value is the plain joined string.

ESARR.unpackInto(target, packed, len) -> target
  // Mutating-write variant for in-place workflows (ES5.1 style); measured
  // cost 1.6x unpack-fresh (engine existing-array write path).

ESARR.pipe(arr, ops[]) -> result
  // (optional convenience) pack -> packRun each op -> unpack; ops validated
  // against the 'sort'|'reverse'|'join' key set; falls back to a JSX pipe
  // (identical semantics) for non-int32/holes/any failure.
```

**Design decisions (coordinator-confirmed direction, wire-jsx draft + architect verdicts):**
- **packRun is by-key** (`'sort'|'reverse'|'join'`), not a higher-order fn — the doc/type surface enumerates exactly the 3 DLL exports; arbitrary functions on packed data are a misuse magnet.
- **Bare `(string, len)` args, no wrapper object** — zero allocation in the hot path, mirrors `lane-wire.ts` (`packArray`/`unpackArray`), len optional on unpack (inferable: 4 chars/elem) with validation.
- **Chunked >48k by construction** (16k-elem loops) — wedge-safe (H2), byte-identical to single-shot pack (Node-verified).
- **Semantics:** `pack`/`unpack`/`packRun` are pure — they do NOT mutate the input array (pack reads, unpack writes a fresh array, packRun is in-wire). ES5.1 semantics of the ARRAY methods they feed remain untouched (sort/reverse stay single-call in-wire; the pipe's sort is still ONE arrSort on the full payload — no chunked sort).
- **Certification:** `packRun` lanes certify against the JSX authority at gate enable (the existing per-lane corpus + a pipe-specific differential: `ESARR.pipe(a,['sort','reverse','join'])` === engine pipe result on a numeric corpus, cloned inputs).

---

## 6. Base-2048 3-char wire — evaluation for the record

- Measured JSX-side deltas @8k (medians-of-9): pack3 −4.1%, unpack3-fresh −20.7%, unpack3-into-O −12.5%. Correct round-trip verified (Node + live), max unit 2048, surrogate-window clear by 53,248 (safe even across chunk boundaries — native-c confirmed the C decode would be a ~30-line change, ESARRArray4 numbered rebuild, parity 4k–256k as the gate).
- **Verdict: hold.** Stacked with fast-classify, base-2048 brings single-op sort to ~0.97x @32k — parity, but within ±10% run-to-run noise, and @64k the gap re-widens to ~1.13x (projected). It cannot create a robust crossing. Its real value is for the public pack/unpack API if shipping short channels matters (25% less storage/transport for packed strings + faster unpack-fresh). **Recommendation:** ship the public API on byte+1 first (no C change, pipe-packonce already wins at 0.54x @32k); revisit base-2048 only if a future measurement shows the pipe win needs the extra margin or packed-string size matters to users.

---

## 7. Recommendations (implementation handoff)

1. **wire-jsx — adopt the fast lane in `packLanePass`** (H4): `v === (v|0)` classify + branchless `>>>0` shift-pack, dropping the `n<0?n+2^32:n` temp. Behavior-identical (Node byte-equal + live certification corpus must re-pass). −7.4% wire @32k. Do NOT unroll the pack loop (H1 refuted — no gain, code bloat).
2. **wire-jsx — implement the public pack/unpack/packRun API** per §5.2 (pack-once is the measured win; chunked >48k by construction; by-key packRun; certification per §5.2). This is the product feature the funnel greenlights.
3. **native-c — no changes required.** DLL op is 0.1–0.8% of gated cost; base-2048 decode held pending §6. High-n readiness (64k/128k/256k) already verified.
4. **Dispatch config unchanged:** sort/reverse/join engine-keep (now 64k-validated: 1.20x/3.31x/1.39x losses); toSorted/toReversed native; `ESARR.setBands` opt-in force-native. New: the pipe API engages when ≥2 ops on one dense int32 array (documented; min(builtin-pipe, JSX-pipe) gate).
5. **README Performance section:** add the pipe table (§5.1) and the pack/unpack API cost table; update the native-lanes table with the 64k rows (§4).

---

## 8. Honesty notes, limitations, unverified assumptions

- **Numbers are instance-state-sensitive.** pack-v1 @8k measured 75–84 ms across runs on the same fresh instance (engine warm/GC); ratios WITHIN an eval (pipe-engine vs pipe-packonce, builtin vs native) are robust; cross-eval absolute deltas carry ±10% noise. All rows labeled host/fixture/n/median.
- **The 128k full battery wedged the instance** (5 × 131k pools + 512KB strings + builtin rows). Recovery = CloseMainWindow + Stop-Process. The single-row probes (pack-only) at 128k and 256k completed cleanly — the chunked pattern is safe at every size tested; heavy multi-pool evals at 128k+ are not (memory pressure).
- **256k wedge-safety: MEASURED, not extrapolated** — single chunked pack @256k = 536.5 s (n=262144, fixture=mixedFull, medians n/a — single rep), channel materialized 1,048,576 chars, no lockup. The 256k native-vs-builtin rows remain projections (see §3) — running them would cost ~15 min/row for a foregone 3x loss.
- **`v === (v|0)` classify equivalence is Node-verified**, including holes (undefined fails), NaN, floats, ±Infinity, out-of-int32, and `-0` (classifies as 0 — identical to the shipped `isLaneInt`, which also passes `-0`). The live gate certification corpus must confirm on the engine before shipping.
- **Degraded-instance exclusion:** all round-2 rows are from the fresh disposable instance (115140). No degraded-instance artifacts.
- **`ESARR.pipe`'s engine-pipe fallback semantics** (hole/type handling in the JSX pipe) must be differential-validated against Node before shipping — spec'd in §5.2, not yet implemented.
- **fcc (fromCharCode-only) rows were run-to-run noisy** (22–48 ms @8k across evals) — used only as qualitative decomposition, not for ratio claims.

---

## 9. Deliverables / artifacts

- Probes: `bench/architect-probes.mjs` (generator + COM runner + resume markers; batteries: `packvars`, `base2048`, `chunked`, `bigsort`, `pipe`, `boundary-native`, `boundary-jsx`, `scan`, `pipeband`, `payloads2`; rerun with `node bench/architect-probes.mjs --battery X --sizes N [--force]`, merge with `--merge-only`).
- Raws: `bench/arch-raw-{packvars,base2048,chunked,bigsort,pipe,boundary-native,boundary-jsx,scan,pipeband,payloads2}-*.json`, `bench/architect-status.json`, `bench/vendor-esarr.snapshot.js` (B5 baseline isolation), minimal wedge probes in `%TEMP%/esarr-arch/` (`arch-min-chunk-{131072,262144}.jsx` → 128k: 74.5 s pack, 256k: 536.5 s pack — both wedge-safe).
- Harness: `bench/architect-probes.mjs` — batteries `packvars|base2048|chunked|bigsort|pipe`; rerun with `node bench/architect-probes.mjs --battery X --sizes N [--force]`, render with `--merge-only`.

---

## 10. FRANKENSTEIN ROUTER — the full decision matrix (user directive, round 3)

**Directive:** ESARR must automatically use the FASTEST approach for EVERY scenario — engine builtin, native DLL, or pure-JSX — chosen per method × payload × size × availability, from measured data, never a one-size policy. This section is the measured decision table the dispatch router (`native-dispatch.ts`, wire-jsx) consumes.

### 10.1 Gap-probe results (fresh instance PID 121780, all raws in `bench/arch-raw-*`)

**Small-n boundary sweep (B6)** — the router's per-lane small-n thresholds (medians-of-9, gate ON for native rows):

| n | builtin sort | native sort | JSX sort | builtin rev | native rev | JSX rev | builtin join | native join | JSX join |
|---|---|---|---|---|---|---|---|---|---|
| 128 | 204 µs | 893 µs | 2,942 µs | 6 µs | 887 µs | 50 µs | 17 µs | 440 µs | 142 µs |
| 256 | 517 µs | 1,877 µs | 7,120 µs | 37 µs | 1,867 µs | 104 µs | 34 µs | 886 µs | 298 µs |
| 512 | 1,302 µs | 3,834 µs | 18 ms | 108 µs | 3,734 µs | 229 µs | 104 µs | 1,812 µs | 687 µs |
| 1024 | 3,141 µs | 8,259 µs | 50 ms | 273 µs | 8,064 µs | 548 µs | 342 µs | 3,945 µs | 1,961 µs |
| 2048 | 8,504 µs | 21 ms | 204 ms | 918 µs | 31 ms | 1,638 µs | 1,376 µs | 9,839 µs | 5,680 µs |

**Reading:** the engine builtin wins every single-op lane at every small n (sort 4.4x, reverse 148x, join 26x over native @128). The native lanes are 2–4x behind the builtin across the whole 128–2048 sweep — no small-n win band exists for sort/reverse/join. Native does beat JSX for sort at every n (893 vs 2,942 µs @128 = 3.3x — the toSorted/toReversed rationale holds at small n) and for join at n ≥ 512 (1,812 vs 687 µs @512 is JSX's only join win, below it native wins; the builtin beats both). `boundary-native`/`boundary-jsx` raws.

**Packed-scan indexOf at scale (B7)** — the router's packed-payload scan lanes (DLL scan on a pre-packed string; native-c pre-certified arrIndexOf/arrLastIndexOf/arrIncludes to 256k, 570/570 + 114/114×3, semantics === / from-len-1 / SameValueZero):

| n | JSX scan miss | **packscan miss** | JSX hit-first | packscan hit-first | JSX hit-last | packscan hit-last | pack-only (amortization cost) |
|---|---|---|---|---|---|---|---|
| 2048 | 1,573 µs | **83 µs (19x)** | 5 µs | 75 µs | 1,595 µs | 77 µs | 7,021 µs |
| 8192 | 48 ms | **325 µs (148x)** | 8 µs | 337 µs | 49 ms | 341 µs | 83 ms |
| 32768 | 830 ms | **1,359 µs (611x)** | 17 µs | 1,335 µs | 104 ms | 1,339 µs | 1,024 ms |

**Reading:** the DLL scan on a packed payload is essentially FLAT (75 µs @2k → 1.34 ms @32k) — it never touches the engine's superlinear variable-index read path (C-side scan over a string). **This is the funnel's second legitimate win**: on a packed payload, indexOf/lastIndexOf/includes misses and deep hits beat the JSX scan by 19x–611x. BUT the pack itself (7 ms @2k → 1,024 ms @32k) never amortizes within a single per-call indexOf — so the router routes scan lanes to the DLL **only when the payload is already a packed string** (pack-once regime / explicit API), never a raw array. On a raw array, JSX stays (early-hit short-circuit: 5–17 µs). All correctness rows pass (correct-idx/-last/-includes = 1). `scan` raws.

**Pipe full size band (B8)** — the router's pipe thresholds (engine pipe vs pack-once vs per-call; pack-once CHUNKED at 48k):

| n | pipe-engine | pipe-packonce | packonce/engine | pipe-percall | packonce/percall |
|---|---|---|---|---|---|
| 2048 | 9,734 µs | 16 ms | **1.64x (packonce LOSES)** | 48 ms | 3.0x |
| 4096 | 37 ms | 45 ms | **1.22x (packonce LOSES)** | 132 ms | 2.9x |
| 8192 | 194 ms | 141 ms | **0.73x WINS** | 458 ms | 3.2x |
| 16384 | 770 ms | 429 ms | 0.56x WINS | 1,577 ms | 3.7x |
| 32768 | 2,917 ms | 1,577 ms | 0.54x WINS | 5,231 ms | 3.3x |
| 48000 | 7,832 ms | 3,860 ms | **0.49x WINS (chunked)** | 12,191 ms | 3.2x |

**Reading: the pipe's engagement threshold is n ≈ 6k (between 4k and 8k).** Below it the engine pipe wins (1.22–1.64x); at 8k+ the pack-once pipe wins and the margin grows monotonically (0.73x → 0.49x @48k, chunked wedge-safe). Per-call never wins (2.9–3.7x worse than pack-once everywhere). `pipeband` raws.

**Array-like / string payloads (B9)** @8k (gate ON):

| lane | builtin | native | verdict |
|---|---|---|---|
| array-like sort {length:n} | 142 ms | 163 ms | builtin (1.15x) |
| array-like reverse | 30 ms | 161 ms | builtin (5.4x) |
| array-like join | 46 ms | 83 ms | builtin (1.8x) |
| string join (split+join) | 3.8 ms | 42 ms gated | builtin (11x) |

**Reading:** array-like payloads route to the ENGINE (native loses 1.15–5.4x — the array-like reads add a ToObject indirection the wire doesn't beat). Strings route to the engine's split+join (11x over the gated pack-charCodes join). The mutating lanes on strings classify safely (`str-sort-classify = 1`). `payloads2` raws.

### 10.2 THE DECISION MATRIX (router contract)

| # | scenario | payload class | size band | approach | measured evidence |
|---|---|---|---|---|---|
| 1 | sort | dense int32 | ALL n | **ENGINE** | native 1.06–2.32x loss @2k–32k (round-1), 1.20x @64k (B4b); small-n 4.4x @128 (B6) |
| 2 | reverse | dense int32 | ALL n | **ENGINE** | native 3.31–19.8x loss everywhere (B4b, round-1) |
| 3 | join | dense int32 | ALL n | **ENGINE** | native 1.31–6.3x loss (round-1), 1.39x @64k (B4b) |
| 4 | toSorted / toReversed | dense int32 | [1, 48000] | **NATIVE** | no engine builtin; 3.3x vs JSX @128 (B6), ~19x @8k (round-1) |
| 5 | **multi-op pipe** | dense int32 | n ≥ 6k (measured: ≥8k wins) | **PACK-ONCE NATIVE** | 0.49–0.73x vs engine pipe @8k–48k (B8); chunked wedge-safe |
| 6 | multi-op pipe | dense int32 | n < 6k | **ENGINE PIPE** | packonce 1.22–1.64x loss @2k/4k (B8) |
| 7 | indexOf/lastIndexOf/includes | dense int32 **ARRAY** | any | **JSX** | per-call pack (7 ms–1 s) kills short-circuit; JSX hit-first 5–17 µs (B7, round-1) |
| 8 | indexOf/lastIndexOf/includes | **PACKED payload** | any | **DLL SCAN** | 19x–611x vs JSX on miss/deep-hit, flat 75 µs–1.3 ms (B7) |
| 9 | sort/reverse/join | sparse / mixed / non-int32 | any | **JSX** (spec-exact) | sparse gated is catastrophic fallback (round-1 §3); classify-out |
| 10 | sort/reverse/join | array-like {length:n} int32 | any | **ENGINE** | native 1.15–5.4x loss (B9) |
| 11 | join | string payload | any | **ENGINE** (split+join) | 11x over gated (B9) |
| 12 | any lane | n > 48k single-op | >48k | **ENGINE/JSX** | wire prohibitive (n^2.4–3.8, 536 s pack @256k) |
| 13 | any lane | no DLL / non-Windows | any | **JSX** | gate inert by construction |

**Availability dimension:** rows 4/5/8 require the DLL present AND the lane certified (gate state); rows 1–3, 6, 9–12 do not. The router's decision is `max(measured speedup, availability)`: a row that requires the DLL falls back to the next-fastest available approach (row 8 → 7; row 5 → 6; row 4 → JSX).

### 10.3 Router architecture notes (for wire-jsx's native-dispatch.ts)

1. **Payload class first:** classify the receiver once (dense-int32 / array-like-int32 / sparse / mixed / string) — the existing classify pass already does this; the router consumes its verdict instead of falling back directly.
2. **Size band:** n thresholds from the measured tables — sort/reverse/join: none (engine always); pipe: [6k, 48000]; toSorted/toReversed: [1, 48000]; scan lanes: any n (packed).
3. **Packed-payload scan lanes:** new API family takes the packed string directly (the router cannot retro-detect "this array was packed" in ES3 — no WeakMap; the caller opted into the pack-once regime). Spec addition below.
4. **Pipeline detection** (≥2 ops on one array) is either explicit (`ESARR.pipe(arr, ops)`) or a future opportunistic cache (wire-jsx's call — needs an ES3-safe pack cache with correct invalidation on mutation; NOT in this doc's data).
5. **Certification:** every row's engaged lane certifies against the JSX authority at gate enable (existing per-lane corpus + new scan-lane corpus + pipe differential `ESARR.pipe(a, ops)` === engine pipe result). A lane that disagrees is excluded from the matrix.

### 10.4 API spec additions (fold into §5.2)

```jsx
ESARR.scanPacked(op, packed, len, search) -> number | undefined
  // op: 'indexOf' | 'lastIndexOf' | 'includes' (by-key; maps 1:1 to the DLL
  // arrIndexOf/arrLastIndexOf/arrIncludes exports). Runs the DLL scan on an
  // ALREADY-PACKED channel string — the router's row-8 lane. Returns the
  // index (or -1 / 0|1 for includes). undefined => op not engaged / failure
  // (caller falls back to a JSX scan). Measured: flat 75 µs–1.3 ms across
  // 2k–32k, 19x–611x vs the JSX scan on misses and deep hits (B7).
  // The search range is the whole payload (JSX pre-slice for fromIndex
  // variants stays caller-side per the design doc; a fromIndex ABI tweak
  // would be a C change — native-c holds the numbered rebuild).

ESARR.pipe(arr, ops[]) -> result  // (§5.2, now band-gated)
  // Router row 5/6: engages pack-once NATIVE only for n >= PIPE_BAND (~6k,
  // measured 8k+ = 0.73x..0.49x); below it runs the engine pipe (row 6).
  // ops validated against 'sort'|'reverse'|'join'.
```

**Decision-matrix summary for the README** (coordinator's "README documents the decision table"): a compact table with rows 1–13 (§10.2) under Performance → "Router (auto-dispatch) decision table".


