# ESARR Native Acceleration — Design Document

**Status:** CONTRACT (v1) — members must honor the lane partition, the wire
protocol, and the espack adapter contract below. All engine claims measured
live on **Illustrator 30.6.0 / ExtendScript 4.5.6** (COM `DoJavaScript`,
`$.hiresTimer` medians) unless marked `ASSUMPTION:`.

**Owner:** DESIGN (designer). **Consumers:** NATIVE (DLL), JSX (gate +
dispatch + full-surface polyfill), BENCH (gates + batteries), VERIFY
(differential oracle).

---

## 0. Executive summary

ESARR becomes an **entire polyfill for the whole Array object** — ES3
built-ins + ES5 set + ES6+ set — with **native-backed lanes where the
measured engine behavior says they win**. The hard boundary: **the DLL
cannot read or write JS arrays**; all bulk traffic is the packed-string
channel (`ESABI_TYPE_STRING`, UTF-8), scalar arguments are numbers/strings.

The decisive measured facts (this document's evidence base):

| Fact | Measurement (30.6.0) |
|---|---|
| JSX variable-index array reads are superlinear ("read floor") | 53 µs @256, 1.68 ms @2k, 49.5 ms @8k, **1.03 s @32k** |
| Packing (v1 direct-`+=` `fromCharCode`) costs ≈ the read floor at scale | 1.02 s @32k vs 1.03 s read — ratio → 1.0 as n grows; 1.4× at 8k |
| Array+join packing (v3) is 2.3× worse than direct `+=` | 160 ms vs 70 ms @8k — **mandatory pack pattern** |
| Packing loop **wedges the engine at ≥ ~64k elements** (≥131k `fromCharCode` units) | reproduced twice; hard hang, process restart |
| The engine's OWN built-ins are pathologically slow on large dense arrays | **sort 32k = 6.9 s, reverse 32k = 5.1 s, join 32k = 1.3 s** (random int32) |
| The engine does NOT escape the slow access machinery — its built-ins pay it too | sort/join/reverse all superlinear in n (4× size → 19-25× cost) |
| ESABI_TYPE_SCRIPT (tag 125) is fine ≤ ~2k, superlinear beyond | 0.39 ms @256, 1.8 ms @2048; unusable for bulk |
| Packed-string channel round-trips byte-exact through a real DLL | ESChars.dll `packBytes`/`unpackBytes`: 8k AND 64k elements, 0 mismatches |
| Boundary cost is small | per-call fixed ~0-2 µs; native pack/unpack ~0.2-0.4 ms @8k, ~2-3 ms @64k |

**Therefore the native lane partition is:**

- **NATIVE-BACKED (candidate, measurement-gated):** `sort` (default
  comparator), `toSorted` (no-arg), `reverse`, `toReversed` — packed int32
  payloads; win bands at large n (sort ≈4× @32k, reverse ≈3× @32k,
  computed from measured components, to be confirmed by BENCH).
- **MARGINAL CANDIDATE (gate at ≥32k only):** `join` (≈1.26× @32k, no
  unpack needed — string result). BENCH decides.
- **JSX-ONLY (hard reasons):** every callback method (callbacks cannot
  cross the boundary); `indexOf`/`lastIndexOf`/`includes`/`at` (pack adds
  cost on top of the identical read floor AND the pack is up-front — no
  short-circuit: an early hit that JSX finds in µs would pay a 1 s pack);
  `fill`/`copyWithin`/`flat`/`from`/`of`/`keys`/`values`/`entries`/`with`
  (array memory or trivial per-element work).
- **ENGINE-KEEP (default):** the 11 ES3 built-ins `slice` `concat` `join`
  (small n) `push` `pop` `shift` `unshift` `splice` `toString`, and
  `sort`/`reverse` outside their win bands. `install({forceReplace:true})`
  covers the full surface anyway.

**Fallback semantics:** per-call dispatch. A native lane engages only when
*gate loaded AND classify passes (dense, int32, no holes, no custom
comparator) AND n inside the BENCH-verified win band AND the native call
succeeds AND the result validates*. Every other path uses the JSX
implementation (ES5/ES6+ sets) or the engine native (ES3 set). Correctness
never depends on the DLL.

---

## 1. DLL method contract (`ESARRArray.dll`)

### 1.1 Mandatory exports (family pattern, esb64/eschars-verified)

The native boundary is defined by the pinned **ESABI v0.3.0** dependency (`deps/esabi`). Production code does not redeclare `TaggedData` or vendor Adobe's historical ABI header.

```c
ESABI_INITIALIZE_FUNCTION   /* signature string; see 1.2 */
ESABI_VERSION_FUNCTION      /* returns 1 */
ESABI_FREE_FUNCTION         /* frees DLL-owned strings */
ESABI_TERMINATE_FUNCTION    /* no persistent state */
ESABI_DIRECT_FUNCTION(name) /* every business method */
```

On Windows, ESABI selects its verified LONG32 profile: `esabi_value` is 16 bytes with 8-byte alignment, the type tag at byte 8, and the reserved field at byte 12. Positive custom errors `>= 10000` only — **never negative codes** (fatal/uncatchable). Returned strings are DLL-allocated UTF-8 and freed by the host through `ESFreeMem`.

Build: freestanding clang+lld (`-O3 -ffreestanding -fno-builtin
-march=x86-64-v2 -flto`, `/nodefaultlib /entry:DllMain /timestamp:0`) with
MSVC fallback — copy `esb64/native/build.ps1`, adapt the pool allocator
(`espk-b64.c` BSS-pool first-fit; size 16 MiB), hand-declared kernel32
imports only. Numbered iteration names: `powershell -File build.ps1 -Name
ESARRArray2.dll` (loaded DLLs lock until host exit). Re-probe bindings
after every build (per-DLL-build binding flakiness is real).

### 1.2 `ESInitialize` signature string

```
"arrSort_sd,arrReverse_sd,arrJoin_sds,arrIndexOf_sdd,arrLastIndexOf_sdd,arrIncludes_sdd,ping_d,version_s"
```

- `_s` = string arg, `_d` = int32 arg (host delivers `ESABI_TYPE_INTEGER`).
- Method names with a bare name are avoided (POC found no-arg methods
  unreliable) — every method takes at least a dummy `_d` where needed;
  here all methods are naturally parameterized.
- Critical methods first (binding flakiness mitigation).

### 1.3 Method semantics

All payload arguments are **packed strings** (protocol in §3). For EVERY
method, `len` is the element count of the payload slice (NOT the string
length) — the DLL must validate `payloadUnitCount === len * 4` (byte+1
wire, §3.2) and reject otherwise (error `10001`). Uniform: `arrSort`/
`arrReverse`/`arrJoin` take the full payload; the scan methods
(`arrIndexOf`/`arrLastIndexOf`/`arrIncludes`) take a **JSX-pre-sliced
payload** (see below).

| Export | Args | Returns | Semantics |
|---|---|---|---|
| `ping_d` | dummy | `ESABI_TYPE_INTEGER` 42 | load/binding smoke |
| `version_s` | dummy | `ESABI_TYPE_STRING` | family-style banner (optional) |
| `arrSort_sd` | packed, len | packed | **default-comparator sort** in ES ToString order (§4): decode int32, format each to decimal, lexicographic compare. NOT required to be stable (ES allows non-stable). |
| `arrReverse_sd` | packed, len | packed | reverse element order |
| `arrJoin_sds` | packed, len, sep | `ESABI_TYPE_STRING` | decimal-format each + `sep` join (sep is an arbitrary JS string) |
| `arrIndexOf_sdd` | packed, len, search | `ESABI_TYPE_INTEGER` | first index of `search` (int32 `===`) within the slice, or -1 (0-based; NaN can never match an int32 payload). |
| `arrLastIndexOf_sdd` | packed, len, search | `ESABI_TYPE_INTEGER` | last index within the slice scanning DOWN from `len-1`, or -1. |
| `arrIncludes_sdd` | packed, len, search | `ESABI_TYPE_INTEGER` | 1 if present in the slice else 0 (SameValueZero; for int32 payloads identical to `===`; `-0`/`0` compare equal, matching ES). |

**Canonical scan contract (adopted 2026-08-09 — supersedes the earlier
"fromIndex-as-arg" draft):** `arrIndexOf_sdd` / `arrLastIndexOf_sdd` /
`arrIncludes_sdd` = **(packed, len, searchInt)**. The DLL performs a plain
0-based bounded scan of the given slice and returns the index INTO THE
SLICE (or -1); all ES5/ES2016 `fromIndex` normalization happens on the
**JSX side** (§1.3.1), which:
- computes `k` (indexOf/includes) or `kEnd` (lastIndexOf) per the spec
  math, and returns -1 WITHOUT a native call when the spec short-circuits
  (`n >= len`, `k < 0`);
- pre-packs only the relevant range — `indexOf`/`includes` pack
  `[k .. len)`, `lastIndexOf` packs `[0 .. kEnd]` — so the payload is
  smaller (pack cost saved on the skipped prefix) and `len` = slice
  element count;
- re-bases the returned index by `+k` for `indexOf`/`includes`
  (lastIndexOf needs no re-base: the slice starts at 0).

This makes the DLL scan methods identical in shape to the other methods
(no derived-len special case, no fromIndex math in C) and matches the
uniform explicit-len protocol. If a shipped DLL build implements the
earlier fromIndex-arg reading, it must be rebuilt (numbered DLL) to the
slice-scan form above — the arg roles are part of the binding contract.

**Uniform len contract (all six methods):** `len` is always the element
count of the payload actually passed. `units % 4 === 0` and
`units === len * 4` are validated on every method; malformed → `10001`.
The scan methods' payload is the JSX-pre-sliced range, so `len` there is
the slice length (≤ the array length) — never the array length.

### 1.3.1 fromIndex normalization contract (JSX side)

ES5.1 §15.4.4.14 / §15.4.4.15 / ES2016 §22.1.3.14 (includes):

```
indexOf:   n = ToInteger(fromIndex)            // JSX core already implements
           if (n >= len) return -1             // this; send k below
           k = (n < 0) ? max(len + n, 0) : n
lastIndexOf: n = ToInteger(fromIndex)          // absent fromIndex = len-1
           k = (n >= 0) ? min(n, len - 1) : len + n
           if (k < 0) return -1
includes:  same as indexOf
```

JSX sends the final `k` as the `_d` fromIndex argument. `-0` as fromIndex
is `ToInteger(-0) = 0` — indistinguishable, correct per spec.

`arrSort`/`arrReverse` return a **new** packed payload (never mutate input —
the DLL has no input handle; the input is a fresh string per call anyway).

### 1.4 Errors (all catchable)

| Code | Meaning |
|---|---|
| `10001` | payload/len mismatch or malformed payload |
| `10002` | sep too long / internal arg error |
| `10003` | allocator pool exhausted |
| `20` | `ESABI_ERR_BAD_ARGUMENTS` (host-side) |

Errors surface as `Error #` with `.number` — the JSX wrapper maps them to
lane fallback (never a throw to the consumer).

### 1.5 What the DLL deliberately does NOT do

- No array memory access (impossible by ABI).
- No callbacks, no function args (impossible by ABI).
- No ESABI_TYPE_SCRIPT returns (§3.5 — dead end for the sizes the lanes engage).
- No `ESABI_TYPE_LIVE_OBJECT`, no tag experiments (host destabilization).
- No consumer-facing extras (no min/max/sum — not Array methods).

---

## 2. Lane-partition table (full surface)

Legend: **N** = native-backed candidate (gated), **J** = JSX-ONLY,
**E** = engine-native (kept by default; forceReplace can override),
**N→** = routes through a native lane, **E→** = routes through engine ops.

### 2.1 ES3 built-ins (engine-native today)

| Method | Lane | Rationale |
|---|---|---|
| `toString` | E | engine; trivial |
| `toLocaleString` | E | engine |
| `join` | N (n ≥ 32k band) / E | engine join is 1.3 s @32k; native pack+join ≈1.03 s (string result, no unpack). Small/medium n: engine wins. BENCH decides threshold. |
| `concat` | E | engine native; JSX-side packed-string concat is O(1) string op anyway |
| `slice` | E | engine native; substring of a packed payload is a native string op — no DLL needed |
| `push`/`pop`/`shift`/`unshift` | E | engine native, cheap, mutating (DLL cannot write arrays) |
| `splice` | E | engine native, mutating |
| `reverse` | N (n ≥ ~16k band) / E | engine reverse 5.1 s @32k vs native ≈1.65 s (measured components) |
| `sort` (default) | N (n ≥ ~4k band) / E | engine sort 6.9 s @32k vs native ≈1.7 s (measured components); native must reproduce ES ToString order (§4) |
| `sort(compareFn)` | E/J | custom comparator is a JS callback — cannot cross; use engine sort with the callback |

### 2.2 ES5 set (pure JSX today)

| Method | Lane | Rationale |
|---|---|---|
| `forEach` | J | callback — cannot cross the boundary, period |
| `map` | J | callback |
| `filter` | J | callback |
| `every` | J | callback (short-circuit needed anyway) |
| `some` | J | callback (short-circuit needed anyway) |
| `indexOf` | J | no callback, but the pack is **up-front**: a hit at index 0 costs a full 1 s pack @32k vs 1 µs in JSX. Only full-scan misses at ≥32k could win (~1.18×) — the early-hit catastrophe rules it out. |
| `lastIndexOf` | J | same as `indexOf` |
| `reduce` | J | callback |
| `reduceRight` | J | callback |
| `isArray` | J | O(1) check, no payload |

### 2.3 ES6+ set (new, JSX implementations)

| Method | Lane | Rationale |
|---|---|---|
| `find` / `findIndex` / `findLast` / `findLastIndex` | J | callback |
| `includes` | J | same structural argument as `indexOf` (up-front pack, no short-circuit) |
| `at` | J | single constant-index read (~0.1 µs); a boundary crossing would be ~100× slower |
| `copyWithin` | J | in-place element moves; DLL cannot touch the array |
| `fill` | J | writes only; DLL cannot write |
| `flat` / `flatMap` | J | recursion + callback (flatMap) / array memory |
| `from` / `of` | J | constructors; callbacks (`from(mapFn)`); no payload source |
| `keys` / `values` / `entries` | J | iterator objects; ES3 has no generators — JSX index arrays/closures |
| `toSorted()` (no-arg) | N→ | copy+default-sort semantics; routes through `arrSort` (DLL returns a fresh payload — the "copy" is free); same band as `sort` |
| `toSorted(compareFn)` | J/E | callback comparator → engine sort on a JSX copy |
| `toReversed` | N→ | routes through `arrReverse`; same band |
| `toSpliced` | J | array memory (copy + splice) |
| `with(index, value)` | J | copy + one write |

### 2.4 Numeric-payload scope rules

The native lanes engage **only** for payloads that classify as:

1. **dense** — no holes (`k in O` check happens during the same pass as
   packing; any hole → JSX);
2. **int32** — every element `typeof === 'number'` with
   `(v|0) === v` (fits signed 32-bit, no fraction, not NaN/±Infinity);
   non-int32 element → JSX;
3. **no exotic receiver** — plain `Array` instances (prototype-chain
   injection aside, matching the JSX classify); `arguments`/strings/array-
   likes → JSX;
4. **band** — `n` inside the BENCH-verified win band for the lane (§7);
5. **args** — `sort` with a custom comparator → JSX/engine; `join` with a
   separator is fine (sep crosses as `_s`).

The one-pass classify+pack reads every element exactly once (the read
floor) and doubles as the hole/number check — spec-correctness of the
fallback is preserved because any doubt falls through to JSX.

---

## 3. Packed transport protocol

### 3.1 The channel

- All bulk traffic is a single `ESABI_TYPE_STRING` (UTF-8, NUL-terminated at the
  C boundary). Verified: ~360 KB+ per direction; NUL truncates; the
  surrogate window (code units 0xD800-0xDFFF) cannot cross.
- The JSX side therefore packs numbers into a JS string whose code units
  are **guaranteed ∈ [1, 256]** — NUL-free and surrogate-free **by
  construction, no escape cases** (§3.2). After UTF-8 encoding, units
  1-127 cross as 1 byte, units 128-256 as 2 bytes (`C2`/`C3` + continuation)
  — the DLL recovers the original code units via the eschars 1/2-byte
  UTF-8 recovery pattern (never assumes Latin1).
- 1.5× wire inflation for units > 127 is expected and harmless (measured:
  8k int32 elements → 24,576 input bytes → 12,303 packed chars).

### 3.2 Canonical int32 wire — byte+1 (ADOPTED); nibble (REJECTED)

**Protocol constraints (binding):** 4 code units per int32 value; every
unit offset by +1 so no unit is 0 (NUL-free) and no unit falls in the
surrogate window (surrogate-free) **by construction**; bijective decode
(`unit - 1`); explicit `len` (or derived `len = units/4` with
`units % 4 === 0` validation); symmetric in/out.

**Adopted wire (byte+1):** for each int32 value `v` (after `v >>> 0`),

```
c0 = ((v >>> 24) & 0xFF) + 1     // ∈ [1,256]
c1 = ((v >>> 16) & 0xFF) + 1
c2 = ((v >>> 8)  & 0xFF) + 1
c3 = (v & 0xFF) + 1
```

Adoption decision (2026-08-09, supersedes the earlier "nibble adopted"
line — that was a misread of NATIVE's codec plan): **NATIVE shipped
`ESARRArray.dll` with byte+1 per this section** (locally verified 32/32
including the §4.3 ToString-order vectors); **VERIFY's wire round-trip
suite pins byte+1**; the earlier nibble preference was based on a stale
plan statement, not the shipped codec. JSX's `lane-wire.ts` currently
carries the int32-nibble variant — it is the isolated seam and MUST be
rewired to byte+1 (single pass; jsx-integration already committed to
rewiring if the doc mandated a different format; the pack cost is
identical — one `fromCharCode(c0,c1,c2,c3)` per element, measured
70 ms @8k).

**Adjudication replication (2026-08-09, live on Illustrator 30.6.0,
against the shipped DLL):** a per-unit sweep 0..255 through `arrReverse`
found **only unit 0 (NUL) fails** — catchably (`Error #` number 10001,
the DLL's own length validation — correct behavior). Units 216-223
(0xD8-0xDF) pass `arrReverse`/`arrSort`/`arrJoin`; units 1..255 were
corroborated byte-exact at 64k elements (probe 1, ESChars channel). The
true channel hazard is the surrogate window **0xD800-0xDFFF**
(55296-57343, per the skill's measured channel rules) — **unreachable by
byte+1**, whose units are capped at 256. A claimed adjudication of
"byte+1 units 0xD8-0xDF throw host-bypass" did NOT reproduce; the
probable artifact is a 16-bit-half-offset payload (`(hi+1) | ((lo+1)<<8)`
— the rejected optional variant, whose units DO reach the real surrogate
window and genuinely fail host-bypass). **byte+1 stands as the adopted
wire**; no rebuild/rewire is warranted on wire grounds.

**WIRE DECISION LOG (read before re-litigating — the coordinator's
final adjudication probes were confounded by per-session binding
flakiness, not the wire):** 1) byte+1 is the canonical form. 2) A
coordinator decision proposed "8-char nibble, units 1..16" and named
jsx's original "4-char nibble" (c0/c2 12-bit halves +1 ≤ 4096, c1/c3
nibbles +1) as superseded. 3) That decision was REVERSED after the
designer's live replication (the adjudication probe's failures were
per-session binding flakiness — even safe control units 1..8 threw while
ping worked). 4) **BINDING FINAL (blackboard decisions/wire-final v3):
byte+1 stands** — the shipped DLL, the jsx lane-wire, and the verifier
suite all pin it. 5) The "0xD8-0xDF" window in ABI notes is a
hex-truncation of the true window 0xD800-0xDFFF; single units 216-223
are ordinary Latin-1 and DO round-trip (verified live). Any 4-char-per-
value wire whose units stay in [1,256] (byte+1) or [1,4095] (the v1
nibble layout) is outside the true window and safe; byte+1 is the
adopted one. **Do not rebuild, rewire, or re-pin on nibble grounds — the
decision is closed; the acceptance gate is VERIFY's gate-on live
differential with real int32 payloads including window bytes.**

**Rejected variant (nibble, documented for history):** split `v` into 8
nibbles `n7..n0`, emit 4 chars of 2 nibbles each with +1 offset
(`c0 = ((n7+1) | ((n6+1) << 4))`, `c1..c3` likewise, units ∈ [1,272]).
It satisfied every protocol constraint but is NOT the wire — the shipped
DLL, the verification suite, and this contract all use byte+1. Any future
variant must be certified by the wire round-trip test
(`tests/wire-test-entry.mjs`) and the differential corpus.

- **JSX pack** (mandatory pattern, measured 2.3× faster than array+join):
  one `String.fromCharCode(c0, c1, c2, c3)` per element, accumulated with
  **direct `s += ...` concatenation** (v1; the engine's string concat is
  rope-based — 70 ms @8k vs 160 ms for push+join; `apply` chunks are 6×
  worse, 436 ms @8k — never use).
- **DLL decode**: recover units from UTF-8 (1-byte + C2/C3 pairs), then
  reverse the byte+1 assembly; **length validation:** count units,
  require `units === len * 4` (or `units % 4 === 0` for the scan methods)
  else `10001`; a unit count not divisible by 4, or any unit of 0, is
  malformed.
- **JSX unpack** (result arrays): 4 `charCodeAt` + shifts per value into
  a **preallocated** `new Array(len)` with indexed writes (measured 1.4×
  faster than push: 528 ms vs 731 ms @32k). Result values are written
  back as numbers; `-0` cannot survive int32 packing (it becomes 0) —
  acceptable: every native lane's result is spec-identical for int32
  inputs (`-0` vs `0` is only observable through `Object.is`, and the
  lanes engage on int32 payloads where the input had no `-0`).
- **Symmetric in/out** — the DLL returns result payloads in the same
  wire. (NATIVE may add a 2-char-per-value output variant
  `c = (hi+1) | ((lo+1) << 8)` as an optimization — measured unpack 731 vs
  833 ms @32k — but the canonical wire is 4-chars/value, and any variant
  must be length-validated and certified by the differential corpus.)

### 3.3 Number classification (per element, JSX side)

During the classify+pack pass, per element `v`:

- `typeof v !== 'number'` → non-numeric → JSX fallback.
- `v !== v` (NaN) or `v === Infinity || v === -Infinity` → JSX fallback.
- `(v|0) !== v` (fractional or out of int32) → JSX fallback.
- else packable int32.

The **search element** for `arrIndexOf`/`arrLastIndexOf`/`arrIncludes`
crosses as a `_d` (int32) argument; a non-int32 search value (NaN,
fractional, ±Infinity, string) means the call routes to JSX (where NaN
never matches anyway — `===` semantics — and string search elements match
strings, which cannot be in an int32 payload).

### 3.4 Length validation

- JSX always sends `len` explicitly.
- DLL rejects `units % 4 !== 0`, `units !== len*4`, `len < 0`,
  `len > 1e9` (sanity cap) with `10001`.
- JSX validates the returned payload length (and, for small results, spot
  values) before trusting it; any anomaly → JSX fallback (see §5.4).

### 3.5 ESABI_TYPE_SCRIPT (tag 125) — measured, and rejected for the lanes

Microprototype (c): `charCodes` via ArcFitEso7 (real evaluated Array,
byte-perfect): 256 ≈ 0.39 ms, 1024 ≈ 0.80 ms, 2048 ≈ 1.8 ms — **2.5×
faster than packed+unpack at 1-2k**. But the cost is superlinear (verified
by this probe + skill's earlier 16k ≈ 101-308 ms), and every native lane
engages at large n where it is a dead end. **Conclusion:** ESABI_TYPE_SCRIPT is
documented as a niche result transport for hypothetical small-n lanes
(≤2k) only; the packed channel is the canonical result transport. It is
also an eval of returned text — trust boundary — never used with
unvalidated native data.

### 3.6 Boundary cost (measured)

Per-call fixed cost ~0-2 µs (tiny b64 call). Native pack/unpack of the
payload: ~0.2-0.4 ms @8k elements, ~2-3 ms @64k (ESChars.dll equivalents).
The JSX-side pack (the read floor + fromCharCode) dominates every native
lane's cost — see §6.

---

## 4. SPEC-EXACTNESS strategy (the differential oracle's catch net)

### 4.1 The rule

`Array.prototype.sort`'s default comparator is **ToString order**:
`[10,9,1,2].sort() === [1,10,2,9]`. The native `arrSort` lane MUST produce
exactly the order a spec-exact JS engine produces, or the differential
oracle catches it. For int32 payloads:

1. C side formats each value with the **ES Number→String decimal
   representation** (integer digits only for int32 — no exponent form:
   ES Number::toString of an int32 never uses exponential notation because
   |v| < 10²¹);
2. compares the decimal strings **lexicographically** (strcmp semantics,
   which for ASCII digits equals ES string `<` ordering);
3. `-0` and `0` format identically to `"0"` — ES ToString agrees.

So `[10,9,1,2]` → tokens `"10","9","1","2"` → lexicographic order
`"1","10","2","9"` → `[1,10,2,9]` ✓. Negative values: `"-5"` sorts before
`"-2"` before `"0"` — strcmp of the decimal strings reproduces ES exactly.

### 4.2 Stability

ES allows non-stable sort. The native lane may use any sort (introsort/
qsort); the differential corpus must NOT assert stability (neither for the
engine sort nor the native lane).

### 4.3 Certification vectors (VERIFY)

The differential corpus (Node natives as oracle) must include at least:
`[10,9,1,2]`, powers of 10 mixed with small ints, negative ints mixed with
positives, `[0, -0]`-adjacent values, mixed digit lengths, duplicates,
max int32/min int32, arrays with holes (fallback path), non-int32 elements
(fallback path), and the ES5/ES6+ full-surface vectors. Live parity runs
both modes: JSX authority vs native lane on the 15-case numeric corpus
(jsx-integration's `native-lane.ts` per-lane certification pattern), and
Node-vs-live byte-for-byte.

### 4.4 Join exactness

`arrJoin` formats each int32 to its ES decimal form and joins with the
given separator verbatim — byte-identical to `Array.prototype.join` for
int32 payloads (the engine's ToString is the spec; the C decimal formatter
is the contract — differential corpus must include separators `""`, `","`,
multi-char, and values that produce negative numbers).

### 4.5 Implementation-defined behavior: pinned carve-outs (FINAL, coordinator-approved)

When a custom comparator is inconsistent (non-transitive, or returns
NaN/non-number), the ES spec leaves the result **implementation-defined**
(ES5.1 §15.4.4.11 note / ES2015 §22.1.3.25). Final binding decision:

1. **D7 (sort with inconsistent/NaN-returning comparator):** ESARR pins a
   **deterministic order** (its own stable merge sort order) and documents
   a **carve-out** from the Node differential: "order of elements whose
   comparison yields NaN is engine-unspecified; ESARR pins a deterministic
   order, not V8's". Do NOT chase V8 TimSort's exact permutation
   (over-fitting — engines differ). VERIFY pins a deterministic trap
   vector so the carve-out can never silently regress.
2. **D3 (lastIndexOf `-0`) — FINAL (re-affirmed 2026-08-09 by the
   coordinator):** ES5.1 uses `===` (`-0 !== +0`); Node v22 uses
   SameValueZero (ES2015+, `-0 === +0`). ESARR's documented contract is
   **ES5.1-exact** — KEEP `===` (jsx-integration reverts any SameValueZero
   implementation in lastIndexOf; verifier re-pins the trap vector to
   `===`), record the carve-out ("ES5.1 strict equality vs modern
   SameValueZero; only `-0` vs `+0` is affected"), carve from the Node
   differential. `includes` stays SameValueZero (both specs agree there).
3. **Default-comparator sort and the native `arrSort` lane are
   unaffected:** int32 + default comparator = fully spec-determined
   decimal ToString order (§4.1); `NaN`'s ToString is `"NaN"`, so
   default-comparator position is string order — assertable.

### 4.5b Mixed-type comparator non-transitivity (sameMultiset carve-out)

jsx-integration flagged (2026-08-09): a custom comparator over
**mixed-type** inputs is inherently non-total — e.g. numeric compare
orders `-7 < -1` while string-compare orders `-1 < "-7"`-style pairs,
breaking transitivity. The fuzz/differential harness must therefore
carve out **sameMultiset** inputs too, not just NaN-returning
comparators: when the comparator is provably non-transitive on the input
(the output is a permutation of the input but its exact order is not
spec-determined), the oracle accepts any permutation. This is the same
ES5.1 §15.4.4.11 implementation-defined carve-out as D7, extended to
non-transitive comparators generally. The native `arrSort` lane never
sees these (int32 payloads + default comparator only).

### 4.6 Hole semantics in the sort family (ground truth, Node v22 — D2)

Verified live on Node v22 with `1 in a` checks; binding for the JSX
implementations (the native lanes never see holes — §2.4 classify gates
them to JSX):

- **`sort` on sparse input compacts present values to the front and moves
  holes to the END keeping them HOLES** (not materialized):
  `[3,<hole>,1,<hole>].sort() → [1,3,<hole>,<hole>]` — implement with
  `delete O[j]` for holes (NOT `O[j] = void 0`; the materializing
  write-back was probed and reverts to divergence).
- **ASYMMETRY:** `toSorted`/`toReversed`/`with` (ES2023) DO materialize
  holes as `undefined` elements (V8 + ES2023 agree) — the D6 fixes are
  correct. The differential corpus must assert both behaviors
  separately; `deepStrictEquals` (holes ≠ undefined) is the discriminator.

---

## 5. Fallback semantics

### 5.1 Principle

**Correctness never depends on the DLL.** The polyfill is fully functional
(43+ methods) in pure JSX; the native lanes are an optimization that may
be disabled per-call, per-lane, or wholesale.

### 5.2 Dispatch (per-call, wrapper decides)

For each method with a native candidate:

```
tryNative(array, args):
  1. gate loaded AND ESARR.espack.mode === "native"?         else -> JSX
  2. classify+pack pass (one read per element):
       dense, int32, no holes, in-band n?                    else -> JSX (the
                                                              pass is thrown away)
  3. band check (BENCH table: per-lane n thresholds)         else -> JSX
  4. lib.arrSort(packed, len) wrapped in try/catch:
       success + payload length validates + spot check       -> unpack, return
       any error (host "Error #", bad arg, timeout-ish)      -> JSX fallback
```

Per-lane **certification**: on gate enable, each lane runs the 15-case
numeric corpus against the JSX authority; a failing lane is **disabled for
the session** (`ESARR.nativeLaneStatus[name] = 'disabled'`) — the design
does not ship a lane that fails its own parity check.

### 5.3 Install-time semantics

- `install()` (default): gap-fill + **engine-keep** — the 11 ES3
  built-ins remain the engine's; the ES5/ES6+ methods install JSX
  implementations that internally dispatch to native lanes when engaged.
- `install({ forceReplace: true })`: overrides **ALL** methods including
  the 11 native built-ins with the polyfill wrappers (which still
  dispatch: engine ops for the ES3 set semantics — `arr.slice()` etc. are
  delegated to the engine where the lane table says E — and native lanes
  where they engage). Full-surface override is what the "entire polyfill"
  claim requires; per-lane gates make it safe.
- The facade (`ESARR.*`) and the prototype wrappers share the same
  dispatch core.

### 5.4 Failure containment

- The DLL never returns negative codes (fatal/uncatchable) — contract.
- Host-bypass errors (`"Error #"`, `"is not a function"`) can escape
  try/catch (measured class of failures) — the wrapper checkpoints state
  and treats any anomaly as lane-disabled for the session, then falls
  back; benchmark/probe results are file-logged (wedge safety).
- No sleep, retry, or file-I/O games in production dispatch.

---

## 6. Win-band math (computed from measured components — BENCH must confirm)

Native lane total = **pack** (read floor + fromCharCode, v1) + **native
op** (~µs-ms) + **unpack** (charCodeAt + preallocated writes), all
measured components:

| Lane @ n | Native estimate | Engine/JSX baseline | Verdict |
|---|---|---|---|
| sort 32k | 1.02 s + ~10 ms + ~0.6 s ≈ **1.7 s** | engine **6.9 s** | **~4× WIN** |
| sort 8k | 70 ms + ~2 ms + ~85 ms ≈ **157 ms** | engine 214 ms | **1.36× win** |
| sort 2k | ~9 + ~1 + ~20 ≈ **30 ms** | engine 16.7 ms | lose |
| sort 256 | ~0.5 + ~0 + ~2.5 ≈ **3.5 ms** | engine 0.88 ms | lose |
| reverse 32k | ≈ **1.65 s** | engine **5.1 s** | **~3× WIN** |
| reverse 8k | ≈ **157 ms** | engine 114 ms | lose |
| reverse 2k/256 | lose | engine 4.5 ms / 0.13 ms | lose |
| join 32k | pack + native join ≈ **1.03 s** (no unpack) | engine 1.3 s | **~1.26× win** |
| join 8k/2k/256 | 72/9.3/0.6 ms | 53/2.0/0.07 ms | lose |
| toSorted 32k | ≈ **1.7 s** (via sort lane) | engine copy+sort 5.0 s | **~3× WIN** |
| toReversed 32k | ≈ **1.65 s** | engine copy+reverse ≈5 s | **~3× WIN** |
| indexOf 32k miss | 1.02 s (no unpack) | JSX 1.2 s | marginal win, but **early-hit catastrophe** (up-front pack) → JSX-ONLY |

**Bands (initial, BENCH-verified):** sort/toSorted n ∈ [4k, 48k];
reverse/toReversed n ∈ [16k, 48k]; join n ∈ [32k, 48k]. **WEDGE CAP =
HARD DISPATCH UPPER BOUND (48k, explicit):** the classify+pack loop
itself wedges at ≥ ~64k elements (reproduced twice) — the dispatch MUST
never run a pack loop at/above the wedge threshold. Enforcement is
twofold: (a) the band check (§5.2 step 3) refuses n > 48k for every
native lane; (b) the upper bound is `high << 64k` by construction. Above
the band → **engine built-in / JSX** (correct, slow); NEVER chunked packs
for `sort` (a chunked sort is incorrect — the sort key spans chunks);
chunked `reverse`/`join` are round-2 candidates only, BENCH-gated.
Bands are configurable constants in the dispatch (`ESARR.bands`), driven
by the BENCH tables, not hardcoded folklore.

### 6.1 Round-2 win candidates (coordinator mandate — BENCH to hunt)

The round-1 opening is dense int32 arrays at scale. Round 2 should hunt:

1. **Pack-once / multi-op amortization:** repeated operations on ONE
   array amortize the read floor (pack once, run many native ops).
   Bench pipelines like `sort → reverse → join` on the same array vs
   repeated per-call packs. If multi-op pipelines win, expose the packed
   form as a **public `ESARR.pack(arr)` / `ESARR.unpack(packed)` API**
   (documented, opt-in; prototype methods accept a pre-packed payload
   only via an internal cache keyed by array identity + length +
   mutation-generation — do NOT cache against mutation by default).
2. **Array-likes / typed-ish payloads:** `arguments`, `{length:n}`
   objects with int32 values — the same packed lane applies (classify
   must handle the array-like boxing per ES5.1 ToObject). Sparse arrays
   stay JSX in round 1 (holes are spec-meaningful); round 2 may carry a
   hole-bitmap alongside the payload if BENCH shows a win.
3. **Per-call `indexOf`-family comparison:** the coordinator's note —
   measure `fromCharCode`-write (pack+scan) vs `===` scan directly per
   call at small n before finalizing the JSX-ONLY verdict; the current
   verdict (JSX-ONLY, early-hit catastrophe) stands unless BENCH shows a
   per-call regime that wins. Do not re-engage without data.

All round-2 items are gated exactly like round 1: measured win required,
no manufactured wins.

---

## 7. Benchmark methodology (BENCH member's charter, contract from here)

- **Sizes:** 256 / 2k / 8k / 32k (+ 48k edge for band caps; NEVER 64k+
  pack lanes in live probes — wedge).
- **Inputs:** dense int32 random (LGC), sorted, reverse-sorted, uniform
  small ints, ±max-int32, int32-with-holes (fallback), mixed (fallback).
- **Protocol:** primed `$.hiresTimer` medians-of-9 (min 3 at 32k), reject
  negative/implausible samples, per-size bounded COM evals, wedge-safe
  **file-logged** probes, disposable instances, cap 2 concurrent
  Illustrator instances machine-wide (announce on `instances/active`
  before launching; use the shared ROT instance serially via the
  cross-agent lock otherwise).
- **Lanes:** engine builtin vs JSX ESARR vs native lane (gated) — for
  every row of §2. Publish per-lane per-size tables; the dispatch bands
  are derived from them, not the reverse.
- **Honesty rule:** report loses. A lane that loses everywhere gets
  disabled in the default config (contract: no manufactured wins).
- RACE independent lanes in parallel instances where safe (never two
  probes in one engine — the dual-DLL probe wedged the shared instance
  during this design's microprototyping; one DLL per probe).

---

## 8. ESPACK integration (mirrors ESON, verbatim pattern)

### 8.1 Build

```
esarr-build.mjs --accel:
  node ../espack/espack-build.mjs --embed native/bin/ESARRArray.dll \
       --out dist/.esarr-accel-bundle.jsx --name esarr --quiet
  bundle + dist/ESARR.jsx + ESARR_ACCELERATOR footer
    -> dist/ESARR.accel.jsx
  minify (adobe-extendscript-minification conservative pipeline, banner
  preserved) -> dist/ESARR.accel.min.jsx
  vendor copy -> agent-skills/illustrator-com-automation-skill/vendor/
                 ESARR.accel.jsx / ESARR.accel.min.jsx
```

The espack "1+n" model gives the shared `ESB64Native` accelerator + the
`ESARRArray` payload; extraction is native (`b64decodeToFile`, ~3-10 µs);
the bundle degrades to pure ES3 if extraction/load fails.

### 8.2 Runtime adapter (the footer, ESON-shaped)

```jsx
if (typeof ESPAK === "object" && ESPAK && typeof ESPAK.load === "function" &&
    typeof ESARR === "object" && ESARR && typeof ESARR.enableNativeGate === "function") {
  function useEspack() {
    var l = ESPAK.load(0);
    if (!l.ok || l.mode !== "native" || !l.lib) {
      return { ok: false, reason: (l && l.error) || "ESPAK load failed" };
    }
    var caps = ESARR.enableNativeGate({ lib: l.lib, dllPath: l.path });
    return { ok: caps.native && caps.native.enabled === true, caps: caps.native, path: l.path };
  }
  ESARR.useEspack = useEspack;          // idempotent opt-in form
  ESARR.espack = useEspack();           // auto-enable on eval
  // persist on $.global: ESARR + ESPAK (COM-session stability)
}
```

`enableNativeGate({lib, dllPath})` (jsx-integration's `native-lane.ts`
state machine, ESON pattern):
1. `ping_d` smoke → 42? else gate off (binding flakiness containment);
2. per-lane binding check + 15-case numeric certification vs JSX
   authority; disable failing lanes;
3. set `ESARR.mode = 'native'`, expose `ESARR.nativeLaneStatus`,
   `ESARR.espack` outcome.

### 8.3 Vendor contract

`agent-skills/illustrator-com-automation-skill/vendor/ESARR.accel.jsx`
(+ `.min.jsx`) — the COM tool's session bootstrap may eval it like ESON's;
a vendor-sync guard (espack `tests/vendor-sync-test.mjs` pattern) prevents
drift. `ESARR.accel.jsx` must be self-contained (no `$.evalFile`, no
`#include`).

---

## 9. Install contract (full-surface gap-fill)

`ESARR.install(options)`:

- **default:** gap-fill only where absent + engine-keep for the ES3 set;
  returns the pre-install census (extends `capabilities()` to the full 43+
  surface, grouped ES3/ES5/ES6+).
- **`forceReplace: true`:** overrides every method — the 11 ES3 built-ins
  AND the ES5/ES6+ sets — with polyfill wrappers. The ES3-set wrappers
  delegate to the engine's implementation where the lane table says E
  (so `forceReplace` is behavior-preserving, not a downgrade), and to the
  native lanes where engaged.
- Prototype wrappers preserve **call arity** (spec-critical for
  `reduce`/`reduceRight`/`lastIndexOf` — existing ESARR pattern).
- Absent-vs-`undefined` arguments: the current arity-based wrappers are
  the model for all new methods (`with`, `at`, `fill`, ...).
- `capabilities()` gains: engine nativeList, missing list, lane status
  (`native`, `disabled:reason`, `es3`), win bands active.

---

## 10. Microprototype results (recorded evidence)

All live, Illustrator 30.6.0, COM `DoJavaScript`, `$.hiresTimer` medians
(3-9 samples). Files: `%TEMP%\opencode\esarr-mp*.json` (design session
artifacts).

### (a) Packed numeric round-trip through an EXISTING DLL — PASS

ESChars.dll `packBytes`/`unpackBytes` (the exact 2-bytes-per-char channel
family), Latin1-safe NUL-free payload:

| n elements | native pack | native unpack | round-trip |
|---|---|---|---|
| 8192 | 141-386 µs | 110-308 µs | byte-exact (0 mismatches) |
| 65536 | 1.1-2.5 ms | 0.9-3.1 ms | byte-exact (0 mismatches) |

b64 transport (v2 run): enc/dec ~140-215 µs @8k, ~1.4-1.6 ms @64k.
Per-call fixed: ~0-2 µs. **The channel carries 64k-element numeric payloads
correctly at millisecond native cost — feasibility confirmed.**

### (b) JSX pack-loop floor vs plain-read floor — DECISIVE

| n | read floor | pack v3 (push+join) | pack v1 (direct `+=`) | ratio v1/read |
|---|---|---|---|---|
| 256 | 53 µs | 533 µs | (n/a) | ~10× (v3) |
| 2048 | 1.68 ms | 9.1 ms | (n/a) | 5.4× (v3) |
| 8192 | 49.5 ms | 154 ms | 70 ms | 1.4× |
| 32768 | 1.03 s | wedge-risk (skipped) | 1.02 s | **1.0×** |

**Packing costs ≈ the read floor at scale with the direct-`+=` pattern** —
the pack loop is NOT a 3-10× penalty (the earlier array+join pattern is;
it is banned). Pack variants measured: direct `+=` 70 ms @8k, array+join
160 ms, `fromCharCode.apply` chunks 436 ms (never).
**Wedge:** the pack loop at 64k elements (131k `fromCharCode` units)
**wedged the engine twice** (hard hang; process restart) — hard upper
bound for native lanes ≈ 48k elements.

### (c) ESABI_TYPE_SCRIPT for SMALL result arrays — USABLE ≤ 2k

| n | ESABI_TYPE_SCRIPT (charCodes) | packed+unpack | verdict |
|---|---|---|---|
| 256 | 0.25-0.50 ms | 0.48-0.58 ms | parity |
| 1024 | 0.64-1.02 ms | 2.04-2.19 ms | **kTS 2.6× faster** |
| 2048 | 1.73-2.19 ms | 4.57-4.90 ms | **kTS 2.5× faster** |

Real evaluated Arrays (`instanceof Array`, byte-perfect). Superlinear:
unusable beyond ~4k — and the native lanes engage only at ≥4k, so the
packed channel remains the canonical result transport. ESABI_TYPE_SCRIPT is a
documented niche for small-n lanes (none active).

### Engine baselines (random dense int32, medians)

| n | sort (default) | sort (num cmp) | join | reverse | toSorted |
|---|---|---|---|---|---|
| 256 | 0.88 ms | 1.98 ms | 0.07 ms | 0.13 ms | 0.84 ms |
| 2048 | 16.7 ms | 32.5 ms | 2.0 ms | 4.5 ms | 17.3 ms |
| 8192 | 214 ms | 268 ms | 53 ms | 114 ms | 214 ms |
| 32768 | **6.9 s** | 5.8 s | **1.3 s** | **5.1 s** | 5.0 s |

(sort on sorted input: 4.4 s @32k — the engine sort is bad on both
patterns; the native lane is input-independent.)

### Unpack (result arrays)

2-char wire: 119 ms @8k, 731 ms @32k; 4-char (byte+1) wire: 833 ms @32k;
preallocated `new Array(n)` + indexed writes: 528 ms @32k (1.4× faster
than push — mandatory result pattern).

---

## 11. Hard constraints recap (do-not lists)

- **NEVER** design a lane that needs callbacks or JS array memory across
  the boundary — it cannot work (ABI).
- **NEVER** ESABI_TYPE_SCRIPT for bulk results; **NEVER** negative error codes;
  **NEVER** tag experiments; **NEVER** multi-megabyte return strings.
- **NEVER** the array+push+join pack pattern (2.3× slower, wedge-prone);
  **NEVER** pack lanes ≥ 64k elements in probes (wedge).
- **NEVER** claim a win without the BENCH table (components + full lane
  runs, medians, environment).

## 12. Open items (ASSUMPTION:)

- 16k/48k sort/reverse/join interpolations are computed from measured 8k
  and 32k components, not measured end-to-end — BENCH must fill.
- `new Array(len)` preallocation for unpack at 32k+ is extrapolated from
  8k/32k push-vs-prealloc ratios — verify in the native-lane battery.
- The 2-char output wire variant (native optimization) is optional;
  byte+1 remains canonical until BENCH shows the unpack delta matters.

## 13. Handoff obligations

- **NATIVE:** build `ESARRArray.dll` per §1 (freestanding, numbered
  builds, probe after every build); decimal formatter + strcmp sort per
  §4; byte+1 wire per §3.2.
- **JSX:** keep the lane-wire seam; implement byte+1 (replace int32-nibble);
  v1 direct-`+=` pack + preallocated unpack; per-call gated dispatch §5;
  ESPACK footer §8; full-surface install §9; `ESARR.bands` configurable.
- **BENCH:** §7 battery; produce the band tables; no manufactured wins.
- **VERIFY:** §4.3 corpus (ToString-order sort vectors are mandatory);
  lane certification; accel bundle e2e; vendor-sync guard.
