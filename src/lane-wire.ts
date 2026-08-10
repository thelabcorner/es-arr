// ESARR lane wire — packed int32 transport between JSX and the ESARRArray
// ExternalObject DLL.
//
// WIRE FORMAT (BINDING FINAL — blackboard decisions/wire-final v3,
// coordinator-confirmed, ends all churn): byte+1. Each int32 is FOUR chars,
// one byte per char with +1 offset:
//   c0 = ((v >>> 24) & 0xFF) + 1     // v >>> 0 (two's complement)
//   c1 = ((v >>> 16) & 0xFF) + 1
//   c2 = ((v >>>  8) & 0xFF) + 1
//   c3 = ( v        & 0xFF) + 1
// Units are 1..256 — NUL-free by construction (+1 offset) and outside the
// TRUE surrogate window 0xD800-0xDFFF (which starts at unit 55296 —
// unreachable: every unit <= 256). Decode: v = (c0-1)<<24 | (c1-1)<<16 |
// (c2-1)<<8 | (c3-1), then |0 for the signed int32. Symmetric in/out;
// payloads are length-validated on both sides (units === len*4, else the
// lane falls back).
//
// Evidence chain (wire-final v3): the family "0xD8-0xDF" ABI note is a
// hex-truncation of the real window 0xD800-0xDFFF. DESIGN's fresh-instance
// per-unit sweep 0..255 through the shipped DLL: ONLY unit 0 fails
// (catchable 10001, correct validation); units 216-223 pass
// arrReverse/arrSort/arrJoin; units 1..255 byte-exact at 64k (ESChars).
// VERIFY's structural gate uses the corrected true-window predicate and
// certifies byte+1: 5092 assertions PASS. NATIVE's lane-parity: 210/0.
// byte+1 is safe for EVERY int32 (safe set [1,256], 256^4 > 2^32).
//
// CHUNKED PACK (round-2, H2 verdict — architect, 2026-08-10): packArray /
// the classify+pack lanes build the channel string in bounded 16k-element
// loops (PACK_CHUNK_ELEMS). Wedge-safe by construction — never one
// unbounded String.fromCharCode loop (the engine wedges at >= ~64k elements
// with a single loop; reproduced twice in round 1). Byte-identical channel
// output (Node-verified + live at 64k/128k/256k — architect B4/B5). The
// superlinear read counter does NOT reset per chunk (pack n^2.38+) — the
// chunk structure is about wedge safety, not read-floor escape.
//
// BRANCHLESS SHIFT-PACK (round-2, H4 verdict — architect, 2026-08-10):
// `>>>` converts to unsigned 32-bit directly, so the pack needs no
// `n<0 ? n+4294967296 : n` two's-complement temp. Byte-identical output,
// -7.4% wire @32k (pack-v1 1071ms -> u8-fastshift 992ms, fresh instance).
export function packInt32(v: number): string {
  return String.fromCharCode(((v >>> 24) & 255) + 1, ((v >>> 16) & 255) + 1, ((v >>> 8) & 255) + 1, (v & 255) + 1);
}

export function unpackInt32At(s: string, i: number): number {
  var v = ((s.charCodeAt(i) - 1) << 24) | ((s.charCodeAt(i + 1) - 1) << 16) |
    ((s.charCodeAt(i + 2) - 1) << 8) | (s.charCodeAt(i + 3) - 1);
  return v | 0; // 32-bit two's complement
}

// Pack loop chunk bound: 16k elements per inner loop (64k channel chars).
// Module-private constant — no exported var bindings (bundle constraint).
var PACK_CHUNK_ELEMS = 16384;

// Pack an array of int32s (caller has already classified). Returns the
// channel string. MANDATORY pattern (design doc §3.2/§10b): direct `c +=
// String.fromCharCode(c0,c1,c2,c3)` per element — the engine's string concat
// is rope-based (measured 70 ms @8k vs 160 ms for array+push+join, which is
// BANNED; `fromCharCode.apply` chunks are 6x worse — never). The
// classify+pack pass reads each element exactly once (the read floor).
// Chunked (H2): the inner loop is bounded at PACK_CHUNK_ELEMS elements, the
// outer loop concatenates chunk strings — same byte-identical channel.
export function packArray(values: number[], len: number): string {
  var s = '';
  var i = 0;
  while (i < len) {
    var end = i + PACK_CHUNK_ELEMS;
    if (end > len) { end = len; }
    var c = '';
    for (; i < end; i++) {
      c += packInt32(values[i]);
    }
    s += c;
  }
  return s;
}

// Unpack a channel string into a plain JS array of int32s. MANDATORY result
// pattern (design doc §3.2): preallocated `new Array(len)` + indexed writes
// (measured 1.4x faster than push: 528 ms vs 731 ms @32k).
export function unpackArray(channel: string, len: number): number[] {
  var out: number[] = new Array(len);
  var i = 0;
  for (i = 0; i < len; i++) {
    out[i] = unpackInt32At(channel, i * 4);
  }
  return out;
}

// Unpack a channel string into an EXISTING array (mutating-write variant for
// in-place workflows; measured 1.6x unpack-fresh — the engine's
// existing-array write path). Returns target. Caller validates channel len.
export function unpackArrayInto(target: any, channel: string, len: number): any {
  var i = 0;
  for (i = 0; i < len; i++) {
    target[i] = unpackInt32At(channel, i * 4);
  }
  return target;
}
