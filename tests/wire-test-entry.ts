// ESARR lane-wire tests: pack/unpack round-trip + payload boundaries. The
// wire is the packed int32 channel between JSX and the ESARRArray DLL
// (src/lane-wire.ts). Per the design doc, the wire format may be adjusted in
// lane-wire.ts only — this harness imports the module, so it adapts
// automatically, and pins the boundary properties the channel must satisfy:
//   - round-trip exactness (every int32 in the full range)
//   - NUL-free and surrogate-window-free output (channel rules: code 0
//     truncates, 0xD8-0xDF are dropped) — every char must be in [1,16]
//   - odd counts, empty, 1 element, 65535, 131071, 1e6 element payloads
import { packInt32, unpackInt32At, packArray, unpackArray } from '../src/lane-wire';

var failures: string[] = [];
var passed = 0;
function ok(cond: boolean, name: string, detail?: string): void {
  if (cond) { passed++; } else { failures[failures.length] = name + (detail ? ' :: ' + detail : ''); }
}

// ---- single-value round-trips across the int32 range -------------------------
var edgeVals = [0, 1, -1, 2, -2, 127, 128, -128, 255, 256, -256,
  32767, 32768, -32768, -32769, 65535, 65536, -65536,
  16777215, 16777216, -16777216, 1073741823, -1073741824,
  2147483647, -2147483648];
var i = 0;
for (i = 0; i < edgeVals.length; i++) {
  var s = packInt32(edgeVals[i]);
  ok(unpackInt32At(s, 0) === edgeVals[i], 'roundtrip ' + edgeVals[i]);
  // channel safety: units must be NUL-free and outside the TRUE surrogate
  // window 0xD800-0xDFFF (16-bit code units). The family's shorthand "0xD8-
  // 0xDF" is a hex-truncated transcription of that window; the designer's
  // live replication on a fresh instance (per-unit sweep through the real
  // DLL) showed units 0..255 all survive EXCEPT unit 0 (catchable 10001) —
  // byte+1 units ∈ [1,256] are therefore channel-safe by construction, and
  // any unit-based wire with units ≤ 256 cannot reach the window.
  var j = 0;
  var safe = true;
  for (j = 0; j < s.length; j++) {
    var c = s.charCodeAt(j);
    if (c === 0 || (c >= 0xD800 && c <= 0xDFFF)) { safe = false; break; }
  }
  ok(safe, 'channel-safe ' + edgeVals[i], 'codes=' + s.charCodeAt(0) + ',' + s.charCodeAt(1));
  ok(s.length === 4, 'packed length 4 ' + edgeVals[i], 'len=' + s.length);
}

// ---- randomized round-trips ---------------------------------------------------
var rnd = (function (seed: number): () => number {
  var a = seed >>> 0;
  return function (): number {
    a = (a + 0x6D2B79F5) | 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})(0xC0FFEE);
for (i = 0; i < 5000; i++) {
  var v = (rnd() * 4294967296) | 0;
  var n = v >= 2147483648 ? v - 4294967296 : v;
  ok(unpackInt32At(packInt32(n), 0) === n, 'random roundtrip ' + n);
}

// ---- payload boundaries --------------------------------------------------------
function arrOf(len: number, fn: (k: number) => number): number[] {
  var a: number[] = new Array(len);
  for (var k = 0; k < len; k++) { a[k] = fn(k); }
  return a;
}
function roundtrip(len: number, tag: string): void {
  var a = arrOf(len, function (k: number): number { return ((k * 2654435761) | 0) % 2147483647; });
  var packed = packArray(a, len);
  ok(packed.length === len * 4, tag + ' packed length', 'len=' + packed.length);
  var out = unpackArray(packed, len);
  var same = out.length === a.length;
  for (var k = 0; same && k < a.length; k++) { if (out[k] !== a[k]) { same = false; } }
  ok(same, tag + ' roundtrip');
}
roundtrip(0, 'empty');
roundtrip(1, 'single');
roundtrip(2, 'odd-2');
roundtrip(3, 'odd-3');
roundtrip(65535, '65535');
roundtrip(131071, '131071');
roundtrip(1000000, '1e6');

// ---- large negative values in the payload -------------------------------------
var neg = arrOf(4096, function (k: number): number { return -2147483648 + (k % 1000); });
ok(JSON.stringify(unpackArray(packArray(neg, neg.length), neg.length)) === JSON.stringify(neg), 'negative payload roundtrip');

// ---- CHANNEL SAFETY — structural gate (extendscript -> DLL boundary) ----------
// The TRUE surrogate window is 0xD800-0xDFFF (16-bit code units); the family
// shorthand "0xD8-0xDF" is a truncated transcription (designer's live
// replication: units 0..255 survive the real channel except unit 0). A wire
// is channel-safe iff its packed units NEVER fall in {0} ∪ [0xD800,0xDFFF] —
// byte+1 units ∈ [1,256] and nibble units ∈ [1,16] both satisfy this by
// construction. This gate pins it exhaustively (every byte value in every
// position + random int32s).
function unitSafe(c: number): boolean {
  return c !== 0 && !(c >= 0xD800 && c <= 0xDFFF);
}
function packedUnitsSafe(packed: string): boolean {
  for (var ui = 0; ui < packed.length; ui++) {
    if (!unitSafe(packed.charCodeAt(ui))) { return false; }
  }
  return true;
}
// exhaustive single-byte coverage: every byte value 0x00-0xFF in each of the
// 4 byte positions of an int32 must pack to channel-safe units.
var bb = 0;
var bj = 0;
var badBytes: string[] = [];
for (bb = 0; bb < 256; bb++) {
  for (bj = 0; bj < 4; bj++) {
    var bval = bb << (bj * 8);
    var ps = packInt32(bval);
    if (!packedUnitsSafe(ps)) {
      badBytes[badBytes.length] = '0x' + bb.toString(16) + '@pos' + bj +
        ' -> ' + ps.charCodeAt(0).toString(16) + ',' + ps.charCodeAt(1).toString(16) + ',' +
        ps.charCodeAt(2).toString(16) + ',' + ps.charCodeAt(3).toString(16);
    }
  }
}
ok(badBytes.length === 0, 'all 1024 single-byte-position int32s pack channel-safe units',
  badBytes.slice(0, 8).join(' | '));
var anyUnsafe = false;
var unsafeVal = 0;
for (bb = 0; bb < 5000; bb++) {
  var rv = (Math.random() * 4294967296) >>> 0;
  var rp = packInt32(rv);
  if (!packedUnitsSafe(rp)) { anyUnsafe = true; unsafeVal = rv; break; }
}
ok(!anyUnsafe, '5000 random int32s all pack channel-safe units',
  anyUnsafe ? 'hit 0x' + unsafeVal.toString(16) : '');

// ---- PACK-ONCE PUBLIC API (round-2/3 — spec §5.2 + §10.4) -------------------
// Node runs gate-off: pack/unpack/unpackInto are pure JSX (fully testable
// here); packRun/scanPacked return undefined without the DLL (the fallback
// contract); pipe runs the ENGINE pipe path (the native path needs the
// gate — exercised by the live gate-on differential).
import { pack, unpack, unpackInto, packRun, scanPacked, pipe } from '../src/native-dispatch';

// pack: dense int32 -> channel, len*4 chars; roundtrip via unpack
var pk = pack([1, 2, 3, -5, 2147483647, -2147483648, 0]);
ok(typeof pk === 'string' && pk.length === 7 * 4, 'pack dense length', 'len=' + String(pk && pk.length));
if (pk !== void 0) {
  var pkOut = unpack(pk);
  ok(pkOut !== void 0 && pkOut.length === 7 && pkOut[0] === 1 && pkOut[3] === -5 &&
    pkOut[4] === 2147483647 && pkOut[5] === -2147483648 && pkOut[6] === 0, 'pack/unpack roundtrip');
}
ok(pack([]) === '', 'pack empty channel');
// pack classify-outs: hole, non-int32, float, NaN, Infinity, out-of-int32
var holeArr: any[] = [1, 2, 3];
delete holeArr[1];
ok(pack(holeArr) === void 0, 'pack hole -> undefined');
ok(pack([1, 'x']) === void 0, 'pack string -> undefined');
ok(pack([1, NaN]) === void 0, 'pack NaN -> undefined');
ok(pack([1, 1.5]) === void 0, 'pack float -> undefined');
ok(pack([1, Infinity]) === void 0, 'pack Infinity -> undefined');
ok(pack([1, 2147483648]) === void 0, 'pack out-of-int32 -> undefined');
ok(pack([1, null]) === void 0, 'pack null elem -> undefined');
ok(pack([1, undefined]) === void 0, 'pack undefined elem -> undefined');
// -0 classifies as 0 (identical to isLaneInt) and round-trips as 0
var negZero = pack([-0, 1]);
if (negZero !== void 0) {
  var nz = unpack(negZero);
  ok(nz !== void 0 && nz[0] === 0, 'pack -0 -> 0');
}
// chunk boundaries: 65536 (4x16k chunks) and 65537 (4 chunks + 1)
var bigA: number[] = new Array(65536);
for (var bk = 0; bk < bigA.length; bk++) { bigA[bk] = ((bk * 2654435761) | 0) % 2147483647; }
var bigP = pack(bigA);
ok(typeof bigP === 'string' && bigP.length === 65536 * 4, 'pack 65536 chunked length');
if (bigP !== void 0) {
  var bigO: number[] = unpack(bigP) as number[];
  var bigSame = bigO.length === bigA.length;
  for (var bq = 0; bigSame && bq < bigA.length; bq++) { if (bigO[bq] !== bigA[bq]) { bigSame = false; } }
  ok(bigSame, 'pack 65536 chunked roundtrip');
}
var bigA2: number[] = new Array(65537);
for (var bk2 = 0; bk2 < bigA2.length; bk2++) { bigA2[bk2] = ((bk2 * 1103515245) | 0) % 1000000007; }
var bigP2 = pack(bigA2);
ok(typeof bigP2 === 'string' && bigP2.length === 65537 * 4, 'pack 65537 chunked length');
if (bigP2 !== void 0) {
  var bigO2: number[] = unpack(bigP2) as number[];
  var bigSame2 = bigO2.length === bigA2.length;
  for (var bq2 = 0; bigSame2 && bq2 < bigA2.length; bq2++) { if (bigO2[bq2] !== bigA2[bq2]) { bigSame2 = false; } }
  ok(bigSame2, 'pack 65537 chunked roundtrip');
}
// unpack: len default + validation
ok(unpack('') !== void 0 && (unpack('') as number[]).length === 0, 'unpack empty');
ok(unpack(pack([7, 8, 9]) as string) !== void 0, 'unpack default len');
ok(unpack(pack([7, 8, 9]) as string, 3) !== void 0, 'unpack explicit len');
ok(unpack(pack([7, 8, 9]) as string, 2) === void 0, 'unpack wrong len -> undefined');
ok(unpack((pack([1, 2]) as string).slice(0, 6), 2) === void 0, 'unpack truncated -> undefined');
ok(unpack((pack([1, 2]) as string).slice(0, 6)) === void 0, 'unpack truncated default len -> undefined');
ok(unpack(123 as any) === void 0, 'unpack non-string -> undefined');
ok(unpack(pack([1]) as string, 1.5) === void 0, 'unpack float len -> undefined');
// unpackInto: writes into target, returns target
var tgt = new Array(3);
ok(unpackInto(tgt, pack([4, 5, 6]) as string, 3) === tgt && tgt[0] === 4 && tgt[2] === 6, 'unpackInto writes target');
ok(unpackInto(tgt, pack([4, 5, 6]) as string, 2) === void 0, 'unpackInto bad len -> undefined');
ok(unpackInto(null, pack([1]) as string, 1) === void 0, 'unpackInto null target -> undefined');
// packRun/scanPacked: gate off (no DLL in Node) -> undefined, never throw
ok(packRun('sort', pk as string, 7) === void 0, 'packRun sort gate-off -> undefined');
ok(packRun('reverse', pk as string, 7) === void 0, 'packRun reverse gate-off -> undefined');
ok(packRun('join', pk as string, 7) === void 0, 'packRun join gate-off -> undefined');
ok(packRun('bogus', pk as string, 7) === void 0, 'packRun invalid op -> undefined');
ok(scanPacked('indexOf', pk as string, 7, 2) === void 0, 'scanPacked gate-off -> undefined');
ok(scanPacked('includes', pk as string, 7, 2) === void 0, 'scanPacked includes gate-off -> undefined');
ok(scanPacked('indexOf', pk as string, 7, 'x') === void 0, 'scanPacked non-int32 search -> undefined');
ok(scanPacked('bogus', pk as string, 7, 1) === void 0, 'scanPacked invalid op -> undefined');
// pipe: gate off -> ENGINE pipe path (engine builtins on a clone); pure
var pipeIn = [3, 1, 2];
var pipeSorted = pipe(pipeIn, ['sort']);
ok(pipeSorted !== void 0 && (pipeSorted as number[]).length === 3 &&
  (pipeSorted as number[])[0] === 1 && (pipeSorted as number[])[2] === 3, 'pipe sort');
ok(pipeIn[0] === 3 && pipeIn[2] === 2, 'pipe does not mutate input');
var pipeRev = pipe([3, 1, 2], ['sort', 'reverse']);
ok(pipeRev !== void 0 && (pipeRev as number[])[0] === 3 && (pipeRev as number[])[2] === 1, 'pipe sort+reverse');
ok(pipe([3, 1, 2], ['sort', 'join']) === '1,2,3', 'pipe sort+join');
ok(pipe([1, 2, 3], ['join']) === '1,2,3', 'pipe single join');
ok(pipe([], ['sort', 'reverse']) !== void 0 && (pipe([] , ['sort', 'reverse']) as number[]).length === 0, 'pipe empty');
ok(pipe([3, 1, 2], ['sort', 'join', 'reverse']) === void 0, 'pipe join-not-last -> undefined');
ok(pipe([3, 1, 2], ['bogus']) === void 0, 'pipe invalid op -> undefined');
ok(pipe([3, 1, 2], []) === void 0, 'pipe empty ops -> undefined');
ok(pipe([3, 1, 2], null as any) === void 0, 'pipe null ops -> undefined');
// pipe engine path equals the engine chained reference on mixed payloads
var pipeMix = [10, 9, 1, 2, '3', null];
var pipeRef = pipeMix.slice(0).sort();
pipeRef.reverse();
var pipeMixOut = pipe(pipeMix, ['sort', 'reverse']);
var pipeMixSame = pipeMixOut !== void 0 && (pipeMixOut as any[]).length === pipeRef.length;
for (var pm = 0; pipeMixSame && pm < pipeRef.length; pm++) {
  if ((pipeMixOut as any[])[pm] !== pipeRef[pm]) { pipeMixSame = false; }
}
ok(pipeMixSame, 'pipe mixed payload equals engine chained reference');

if (failures.length > 0) {
  console.error('WIRE TESTS FAILED (' + failures.length + '):');
  for (var f = 0; f < failures.length && f < 12; f++) { console.error('  ' + failures[f]); }
  process.exit(1);
}
console.log('WIRE TESTS PASSED: ' + passed + ' assertions');
