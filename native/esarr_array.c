/***************************************************************************
 * ESARRArray — ExternalObject accelerator for the ESARR library.
 *
 * Native packed-int32 lanes for ExtendScript (ES3, Illustrator 2026 /
 * 30.6.0): sort / reverse / join (+ indexOf-family exports, JSX-ONLY
 * dispatch per the design doc) with EXACT ES semantics for the
 * differential oracle. CONTRACT: esarr/docs/native-acceleration-design.md
 * (v1, binding) — §1 method contract, §3.2 byte+1 wire, §4 ToString-order
 * sort.
 *
 * FREESTANDING build: no CRT, no SDK headers, kernel32 imports only (own
 * allocator + libc substitutes). clang+lld with the ArcFit/ESB64 family
 * flags (see build.ps1); MSVC fallback. PE timestamp fixed so rebuilds are
 * byte-identical. Includes esarr_format.c (the ES Number->string engine,
 * differentially validated against Node String(n): 917,044 values / 3
 * seeds / 0 mismatches).
 *
 * Direct-interface ABI is provided by ESABI. Every exported method uses
 * ESABI's ExternalObject direct-function contract.
 * Returned strings are UTF-8, allocated with esarr_malloc, freed by the
 * host via ESFreeMem (== esarr_free). retval is preset to undefined by the
 * host; on error paths it is left untouched. Errors (design doc §1.4):
 *   10001 payload/len mismatch or malformed payload
 *   10002 sep too long / internal arg error
 *   10003 allocator pool exhausted
 *   20    ESABI_ERR_BAD_ARGUMENTS (host-visible, catchable)
 * Negative codes are fatal/uncatchable and NEVER returned.
 *
 * WIRE (BYTE+1 — binding final, decisions/wire-final v3/v4; the nibble
 *   build was SUPERSEDED and is NOT the shipped wire). Each int32 v:
 *   c0 = ((v>>>24)&0xFF)+1 (1..256), c1 = ((v>>>16)&0xFF)+1 (1..256),
 *   c2 = ((v>>>8)&0xFF)+1 (1..256), c3 = (v&0xFF)+1 (1..256). NUL-free
 *   and outside the TRUE surrogate window 0xD800-0xDFFF by construction
 *   (max unit 256 < 55296); units cross as UTF-8 (1-2 bytes). Decode
 *   requires units === len*4 and every unit in [1,256].
 *
 * METHODS (signature string per design doc §1.2):
 *   arrSort_sd      (packed, len) -> packed; default-comparator sort in
 *                    ES ToString order (§4): decimal-format + strcmp.
 *                    Stable (ES allows non-stable; stable matches the JSX
 *                    merge-sort authority and never breaks the oracle).
 *   arrReverse_sd   (packed, len) -> packed, reversed.
 *   arrJoin_sds     (packed, len, sep) -> string; decimal-format each
 *                    element joined with sep verbatim (§4.4).
 *   arrIndexOf_sdd  (packed, len, search) -> int; first index of search
 *                    (int32 ===) or -1. Export kept per §1.2; the lane is
 *                    JSX-ONLY per §2.2 (dispatch disengaged).
 *   arrLastIndexOf_sdd (packed, len, search) -> int; last index or -1.
 *   arrIncludes_sdd (packed, len, search) -> 1 if present else 0
 *                    (SameValueZero; int32 payloads: identical to ===,
 *                    -0/0 compare equal).
 *   ping_d          -> 42 (ESABI_TYPE_INTEGER); load/binding smoke.
 *   version_s       -> banner (ESABI_TYPE_STRING).
 ***************************************************************************/

#include <stddef.h>

#include <esabi/esabi.h>
#include "esarr_format.c" /* ES Number->string engine (validated) */

/* MSVC/clang emits a reference to _fltused when any floating-point code is
   present; freestanding builds must provide it (the CRT normally does).
   __attribute__((used)) keeps LTO from dropping the (otherwise unused)
   definition while the FP code still references it. */
__attribute__((used)) unsigned int _fltused = 0;

/* catchable custom error codes (design doc §1.4; never negative) */
#define ESARR_ERR_BAD_PAYLOAD 10001 /* payload/len mismatch or malformed */
#define ESARR_ERR_SEP         10002 /* sep too long / internal arg error */
#define ESARR_ERR_NO_MEM      10003 /* allocator pool exhausted */

#define ESARR_LEN_CAP 1000000000L /* sanity cap on len (doc §3.4) */
#define ESARR_MAX_ELEMS 1000000L  /* pool-bounded element ceiling */

/* ---- freestanding libc substitutes -------------------------------------- */

static void* esarr_memcpy(void* dst, const void* src, size_t n)
{
    unsigned char* d = (unsigned char*)dst;
    const unsigned char* s = (const unsigned char*)src;
    while (n--) {
        *d++ = *s++;
    }
    return dst;
}

static size_t esarr_strlen(const char* s)
{
    const char* p = s;
    while (*p) {
        p++;
    }
    return (size_t)(p - s);
}

static int esarr_strcmp(const char* a, const char* b)
{
    while (*a && *a == *b) {
        a++;
        b++;
    }
    return (unsigned char)*a - (unsigned char)*b;
}

/*
 * First-fit free-list allocator over a static BSS pool. 64 MiB of
 * zero-initialized data (no file footprint; pages fault in on first
 * touch). Budget for the largest lane at the 48k-element band: wire
 * buffers (~1.2 MB) + decoded values (0.4 MB) + sort keys (~1.5 MB) —
 * trivial; the pool headroom covers oversized direct calls. Exhaustion
 * returns NULL -> ESARR_ERR_NO_MEM (catchable, never a negative code).
 */
#define ESARR_POOL_SIZE (64u << 20)
#define ESARR_ALIGN 8u

typedef struct EsarrHdr {
    size_t size;
    void* next;
} EsarrHdr;

static union {
    unsigned char b[ESARR_POOL_SIZE];
    double align; /* 8-aligned pool base */
} g_pool_u;
#define g_pool (g_pool_u.b)
static size_t g_cursor = 0;
static void* g_free = NULL;

static void* esarr_malloc(size_t n)
{
    size_t need = (n + sizeof(EsarrHdr) + ESARR_ALIGN - 1) & ~(size_t)(ESARR_ALIGN - 1);
    EsarrHdr* h;
    void** pp = &g_free;
    if (need == 0) {
        need = sizeof(EsarrHdr) + ESARR_ALIGN;
    }
    while (*pp != NULL) {
        h = (EsarrHdr*)*pp;
        if (h->size >= need) {
            *pp = h->next;
            h->size = need;
            return (void*)((unsigned char*)h + sizeof(EsarrHdr));
        }
        pp = (void**)&h->next;
    }
    if (g_cursor + need > ESARR_POOL_SIZE) {
        return NULL;
    }
    h = (EsarrHdr*)(g_pool + g_cursor);
    g_cursor += need;
    h->size = need;
    h->next = NULL;
    return (void*)((unsigned char*)h + sizeof(EsarrHdr));
}

static void esarr_free(void* p)
{
    unsigned char* base;
    EsarrHdr* h;
    EsarrHdr* it;
    if (p == NULL) {
        return;
    }
    base = (unsigned char*)p;
    /* Guard against host-side misuse of ESFreeMem (verified crash cause:
       the host freeing a pointer that is not one of ours, or a double
       free). Anything outside the pool, misaligned, or already on the
       free list is ignored. */
    if (base < g_pool + sizeof(EsarrHdr) ||
        base >= g_pool + ESARR_POOL_SIZE ||
        ((size_t)(base - g_pool) & (ESARR_ALIGN - 1)) != 0) {
        return;
    }
    h = (EsarrHdr*)(base - sizeof(EsarrHdr));
    it = (EsarrHdr*)g_free;
    while (it != NULL) {
        if ((void*)it == (void*)h) {
            return; /* double free */
        }
        it = (EsarrHdr*)it->next;
    }
    h->next = g_free;
    g_free = h;
}

static char* esarr_dup_bytes(const unsigned char* p, size_t n)
{
    char* b = (char*)esarr_malloc(n + 1);
    if (b != NULL) {
        esarr_memcpy(b, p, n);
        b[n] = '\0';
    }
    return b;
}

/* ---- numeric argument helper (accept the whole numeric family) ---- */

static long esarr_arg_as_long(const esabi_value* a)
{
    if (a->type == ESABI_TYPE_DOUBLE) {
        double d = a->payload.double_value;
        /* ToInteger: NaN -> 0, +/-Inf stay extreme, truncate toward zero */
        if (d != d) {
            return 0;
        }
        if (d >= 2147483647.0) {
            return 2147483647L;
        }
        if (d <= -2147483648.0) {
            return -2147483648L;
        }
        return (long)d;
    }
    if (a->type == ESABI_TYPE_INTEGER || a->type == ESABI_TYPE_UINTEGER) {
        return a->payload.signed_value;
    }
    return 0; /* non-numeric: treated as 0 (lenient) */
}

/* ---- packed int32 codec — BYTE+1 wire (binding final, decisions/
 * wire-final v3/v4; the NIBBLE variant was the SUPERSEDED experiment and
 * is NOT the shipped wire). Each int32 v (after v >>> 0):
 *   c0 = ((v >>> 24) & 0xFF) + 1   // units 1..256
 *   c1 = ((v >>> 16) & 0xFF) + 1
 *   c2 = ((v >>>  8) & 0xFF) + 1
 *   c3 = ( v        & 0xFF) + 1
 * Units are NUL-free and outside the TRUE surrogate window 0xD800-0xDFFF
 * by construction (max unit 256 < 55296); the channel is UTF-8 (units
 * 1..127 -> 1 byte, 128..256 -> C2/C3/C4 + continuation). Decode:
 * v = ((c0-1)<<24)|((c1-1)<<16)|((c2-1)<<8)|(c3-1), signed. Bijective,
 * symmetric in/out; len must equal units/4.
 */

/* Decode one UTF-8 code point; advances *i. Returns -1 on malformed UTF-8
   (rejects overlong C0/C1 leads and 3-byte sequences below U+0800). */
static long esarr_utf8_next(const char* s, size_t len, size_t* i)
{
    unsigned char c = (unsigned char)s[*i];
    unsigned long cp;
    if (c < 0x80) {
        cp = c;
        *i += 1;
    }
    else if (c >= 0xC2 && c <= 0xDF && *i + 1 < len) {
        unsigned char c2 = (unsigned char)s[*i + 1];
        if ((c2 & 0xC0) != 0x80) {
            return -1;
        }
        cp = ((unsigned long)(c & 0x1F) << 6) | (unsigned long)(c2 & 0x3F);
        *i += 2;
    }
    else if (c >= 0xE0 && c <= 0xEF && *i + 2 < len) {
        unsigned char c2 = (unsigned char)s[*i + 1];
        unsigned char c3 = (unsigned char)s[*i + 2];
        if ((c2 & 0xC0) != 0x80 || (c3 & 0xC0) != 0x80) {
            return -1;
        }
        if (c == 0xE0 && c2 < 0xA0) {
            return -1; /* overlong */
        }
        cp = ((unsigned long)(c & 0x0F) << 12) |
             ((unsigned long)(c2 & 0x3F) << 6) |
             (unsigned long)(c3 & 0x3F);
        *i += 3;
    }
    else {
        return -1;
    }
    return (long)cp;
}

/*
 * Decode a packed channel into int32 values. len is the BYTE length of the
 * channel; *unitsp receives the recovered unit count. Returns the element
 * count, or -1 on malformed input (bad UTF-8, unit out of the wire ranges,
 * units != len*4, count over the cap).
 */
static long esarr_decode_packed(const char* utf8, size_t len, long len_arg,
                                long* out, long max_elems, long* unitsp)
{
    long count = 0;
    long units = 0;
    size_t i = 0;
    if (len_arg < 0 || len_arg > ESARR_LEN_CAP) {
        return -1;
    }
    while (i < len) {
        long c0, c1, c2, c3;
        unsigned long v;
        c0 = esarr_utf8_next(utf8, len, &i);
        c1 = esarr_utf8_next(utf8, len, &i);
        c2 = esarr_utf8_next(utf8, len, &i);
        c3 = esarr_utf8_next(utf8, len, &i);
        if (c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0) {
            return -1;
        }
        /* byte+1 wire: every unit in [1,256] */
        if (c0 < 1 || c0 > 256 || c1 < 1 || c1 > 256 ||
            c2 < 1 || c2 > 256 || c3 < 1 || c3 > 256) {
            return -1;
        }
        v = ((unsigned long)(c0 - 1) << 24) |
            ((unsigned long)(c1 - 1) << 16) |
            ((unsigned long)(c2 - 1) << 8) |
            (unsigned long)(c3 - 1);
        if (count >= max_elems) {
            return -1;
        }
        out[count++] = (v >= 2147483648ul) ? (long)(v - 4294967296ul) : (long)v;
        units += 4;
    }
    if (units != len_arg * 4) {
        return -1; /* payload/len mismatch (doc §3.4) */
    }
    if (unitsp != NULL) {
        *unitsp = units;
    }
    return count;
}

/* Encode int32 values to the byte+1 channel (allocates; NULL on OOM). */
static char* esarr_encode_packed(const long* vals, long count)
{
    /* worst case: 4 units x up to 2 UTF-8 bytes per element */
    char* buf = (char*)esarr_malloc((size_t)count * 8 + 1);
    size_t o = 0;
    long i;
    if (buf == NULL) {
        return NULL;
    }
    for (i = 0; i < count; i++) {
        unsigned long n = (unsigned long)(unsigned int)vals[i]; /* >>> 0 */
        unsigned long units[4];
        int j;
        units[0] = ((n >> 24) & 0xFFul) + 1ul;
        units[1] = ((n >> 16) & 0xFFul) + 1ul;
        units[2] = ((n >> 8) & 0xFFul) + 1ul;
        units[3] = (n & 0xFFul) + 1ul;
        for (j = 0; j < 4; j++) {
            unsigned long u = units[j];
            if (u < 0x80) {
                buf[o++] = (char)u;
            }
            else {
                buf[o++] = (char)(0xC0 | (u >> 6));
                buf[o++] = (char)(0x80 | (u & 0x3F));
            }
        }
    }
    buf[o] = '\0';
    return buf;
}

/* ---- ES ToString-order sort (design doc §4): decimal-format + strcmp ----
 * OPT-ITERATION-1 HYPOTHESIS (2026-08-09, measured request): the sort-op
 * hotspot @8192 was per-element key malloc/free — esarr_free walks the
 * ENTIRE free list on every free (double-free detection), so freeing
 * 8192 keys is O(n^2) (~33M pointer walks) -> the 115.9 ms sort-op vs
 * 0.7 ms reverse-op (same payload, no heap traffic). Fix: inline the ES
 * decimal string in EsarrSortItem (max int32 = "-2147483648" = 11 + NUL
 * = 12 bytes) and drop the per-element allocator entirely. Comparator,
 * stable merge order and output are byte-identical — semantics-neutral.
 */

typedef struct {
    long value;
    char key[12]; /* inline ES decimal (max "-2147483648" = 11 + NUL) */
} EsarrSortItem;

static int esarr_sort_item_cmp(const EsarrSortItem* a, const EsarrSortItem* b)
{
    return esarr_strcmp(a->key, b->key);
}

static void esarr_stable_sort(EsarrSortItem* items, long n)
{
    EsarrSortItem* tmp;
    long width;
    if (n < 2) {
        return;
    }
    tmp = (EsarrSortItem*)esarr_malloc((size_t)n * sizeof(EsarrSortItem));
    if (tmp == NULL) {
        /* OOM fallback: insertion sort in place (still correct, slower) */
        long i, j;
        for (i = 1; i < n; i++) {
            EsarrSortItem v = items[i];
            for (j = i - 1; j >= 0 && esarr_sort_item_cmp(&items[j], &v) > 0; j--) {
                items[j + 1] = items[j];
            }
            items[j + 1] = v;
        }
        return;
    }
    for (width = 1; width < n; width *= 2) {
        long i;
        for (i = 0; i < n; i += 2 * width) {
            long lo = i;
            long mid = i + width < n ? i + width : n;
            long hi = i + 2 * width < n ? i + 2 * width : n;
            long a = lo, b = mid, o = lo;
            if (mid >= n) {
                continue;
            }
            while (a < mid && b < hi) {
                tmp[o++] = (esarr_sort_item_cmp(&items[a], &items[b]) <= 0)
                               ? items[a++]
                               : items[b++];
            }
            while (a < mid) {
                tmp[o++] = items[a++];
            }
            while (b < hi) {
                tmp[o++] = items[b++];
            }
            while (lo < hi) {
                items[lo] = tmp[lo];
                lo++;
            }
        }
    }
    esarr_free(tmp);
}

/* ---- mandatory entry points ---- */

ESABI_INITIALIZE_FUNCTION
{
    (void)argv;
    (void)argc;
    /* Design doc §1.2 — binding. Critical methods first (per-DLL binding
       flakiness mitigation). _s = string arg, _d = int32 arg (host casts). */
    return "arrSort_sd,arrReverse_sd,arrJoin_sds,arrIndexOf_sdd,arrLastIndexOf_sdd,arrIncludes_sdd,ping_d,version_s";
}

ESABI_VERSION_FUNCTION
{
    return 1;
}

ESABI_FREE_FUNCTION
{
    esarr_free(pointer);
}

ESABI_TERMINATE_FUNCTION
{
    /* no persistent native state */
}

/* ---- methods ---- */

/* ping(dummy) -> 42 (ESABI_TYPE_INTEGER); the gate smoke (design doc §8.2). */
ESABI_DIRECT_FUNCTION(ping)
{
    (void)argv;
    if (argc < 1) {
        return ESABI_ERR_BAD_ARGUMENTS;
    }
    esabi_value_set_i32(retval, (esabi_i32)(42));
    return ESABI_OK;
}

/* version(dummy) -> banner string (ESABI_TYPE_STRING); family style per §1.3. */
ESABI_DIRECT_FUNCTION(version)
{
    static const char banner[] = "ESARRArray 1.0.0 (ESARR native lanes; byte+1 wire)";
    (void)argv;
    if (argc < 1) {
        return ESABI_ERR_BAD_ARGUMENTS;
    }
    esabi_value_set_string(retval, esarr_dup_bytes((const unsigned char*)banner,
                                          sizeof(banner) - 1));
    if (retval->payload.string_value == NULL) {
        return ESARR_ERR_NO_MEM;
    }
    return ESABI_OK;
}

/* arrSort(packed, len) -> packed, ES ToString order (§4). */
ESABI_DIRECT_FUNCTION(arrSort)
{
    const char* in;
    size_t inlen;
    long len;
    long count;
    long* vals;
    EsarrSortItem* items;
    char* out;
    long i;
    if (argc != 2 || argv[0].type != ESABI_TYPE_STRING) {
        return ESABI_ERR_BAD_ARGUMENTS;
    }
    len = esarr_arg_as_long(&argv[1]);
    in = argv[0].payload.string_value;
    inlen = esarr_strlen(in);
    vals = (long*)esarr_malloc(ESARR_MAX_ELEMS * sizeof(long));
    if (vals == NULL) {
        return ESARR_ERR_NO_MEM;
    }
    count = esarr_decode_packed(in, inlen, len, vals, ESARR_MAX_ELEMS, NULL);
    if (count < 0) {
        esarr_free(vals);
        return ESARR_ERR_BAD_PAYLOAD;
    }
    items = (EsarrSortItem*)esarr_malloc((size_t)count * sizeof(EsarrSortItem));
    if (items == NULL) {
        esarr_free(vals);
        return ESARR_ERR_NO_MEM;
    }
    for (i = 0; i < count; i++) {
        esarr_int32_to_string(vals[i], items[i].key);
        items[i].value = vals[i];
    }
    esarr_stable_sort(items, count);
    for (i = 0; i < count; i++) {
        vals[i] = items[i].value;
    }
    esarr_free(items);
    out = esarr_encode_packed(vals, count);
    esarr_free(vals);
    if (out == NULL) {
        return ESARR_ERR_NO_MEM;
    }
    esabi_value_set_string(retval, out);
    return ESABI_OK;
}

/* arrReverse(packed, len) -> packed, reversed. */
ESABI_DIRECT_FUNCTION(arrReverse)
{
    const char* in;
    size_t inlen;
    long len;
    long count;
    long* vals;
    char* out;
    long i;
    if (argc != 2 || argv[0].type != ESABI_TYPE_STRING) {
        return ESABI_ERR_BAD_ARGUMENTS;
    }
    len = esarr_arg_as_long(&argv[1]);
    in = argv[0].payload.string_value;
    inlen = esarr_strlen(in);
    vals = (long*)esarr_malloc(ESARR_MAX_ELEMS * sizeof(long));
    if (vals == NULL) {
        return ESARR_ERR_NO_MEM;
    }
    count = esarr_decode_packed(in, inlen, len, vals, ESARR_MAX_ELEMS, NULL);
    if (count < 0) {
        esarr_free(vals);
        return ESARR_ERR_BAD_PAYLOAD;
    }
    for (i = 0; i < count / 2; i++) {
        long t = vals[i];
        vals[i] = vals[count - 1 - i];
        vals[count - 1 - i] = t;
    }
    out = esarr_encode_packed(vals, count);
    esarr_free(vals);
    if (out == NULL) {
        return ESARR_ERR_NO_MEM;
    }
    esabi_value_set_string(retval, out);
    return ESABI_OK;
}

/* arrJoin(packed, len, sep) -> string; elements' ES decimals joined by sep
   verbatim (doc §4.4). */
ESABI_DIRECT_FUNCTION(arrJoin)
{
    const char* in;
    const char* sep;
    size_t inlen, seplen;
    long len;
    long count;
    long* vals;
    char* out;
    size_t outlen = 0;
    long i;
    if (argc != 3 || argv[0].type != ESABI_TYPE_STRING || argv[2].type != ESABI_TYPE_STRING) {
        return ESABI_ERR_BAD_ARGUMENTS;
    }
    len = esarr_arg_as_long(&argv[1]);
    in = argv[0].payload.string_value;
    sep = argv[2].payload.string_value;
    inlen = esarr_strlen(in);
    seplen = esarr_strlen(sep);
    vals = (long*)esarr_malloc(ESARR_MAX_ELEMS * sizeof(long));
    if (vals == NULL) {
        return ESARR_ERR_NO_MEM;
    }
    count = esarr_decode_packed(in, inlen, len, vals, ESARR_MAX_ELEMS, NULL);
    if (count < 0) {
        esarr_free(vals);
        return ESARR_ERR_BAD_PAYLOAD;
    }
    /* pass 1: measure (each int32 string <= 11 chars + separator) */
    {
        char scratch[16];
        for (i = 0; i < count; i++) {
            outlen += esarr_int32_to_string(vals[i], scratch);
            if (i > 0) {
                outlen += seplen;
            }
        }
    }
    /* 48 MB output cap: guards the pool (ESARR_ERR_SEP for an
       unreasonable separator/output per doc §1.4) */
    if (outlen > (48u << 20)) {
        esarr_free(vals);
        return ESARR_ERR_SEP;
    }
    out = (char*)esarr_malloc(outlen + 1);
    if (out == NULL) {
        esarr_free(vals);
        return ESARR_ERR_NO_MEM;
    }
    /* pass 2: fill */
    {
        size_t o = 0;
        char scratch[16];
        for (i = 0; i < count; i++) {
            size_t n = esarr_int32_to_string(vals[i], scratch);
            size_t j;
            if (i > 0) {
                for (j = 0; j < seplen; j++) {
                    out[o++] = sep[j];
                }
            }
            for (j = 0; j < n; j++) {
                out[o++] = scratch[j];
            }
        }
        out[o] = '\0';
    }
    esarr_free(vals);
    esabi_value_set_string(retval, out);
    return ESABI_OK;
}

/* shared indexOf/lastIndexOf/includes core */
static long esarr_find_core(const esabi_value* argv, long argc, int last, int include)
{
    const char* in;
    size_t inlen;
    long len;
    long count;
    long* vals;
    long search;
    long k;
    if (argc != 3 || argv[0].type != ESABI_TYPE_STRING) {
        return -2; /* bad args sentinel */
    }
    len = esarr_arg_as_long(&argv[1]);
    search = esarr_arg_as_long(&argv[2]);
    in = argv[0].payload.string_value;
    inlen = esarr_strlen(in);
    vals = (long*)esarr_malloc(ESARR_MAX_ELEMS * sizeof(long));
    if (vals == NULL) {
        return -3; /* no mem sentinel */
    }
    count = esarr_decode_packed(in, inlen, len, vals, ESARR_MAX_ELEMS, NULL);
    if (count < 0) {
        esarr_free(vals);
        return -4; /* bad payload sentinel */
    }
    if (include) {
        /* SameValueZero: int32 payloads == === (NaN cannot be packed) */
        for (k = 0; k < count; k++) {
            if (vals[k] == search) {
                esarr_free(vals);
                return 1;
            }
        }
        esarr_free(vals);
        return 0;
    }
    if (last) {
        for (k = count - 1; k >= 0; k--) {
            if (vals[k] == search) {
                esarr_free(vals);
                return k;
            }
        }
    }
    else {
        for (k = 0; k < count; k++) {
            if (vals[k] == search) {
                esarr_free(vals);
                return k;
            }
        }
    }
    esarr_free(vals);
    return -1;
}

/* arrIndexOf(packed, len, search) -> int (export kept per §1.2; the lane
   is JSX-ONLY per §2.2 — the dispatch is disengaged) */
ESABI_DIRECT_FUNCTION(arrIndexOf)
{
    long r = esarr_find_core(argv, argc, 0, 0);
    if (r == -2) {
        return ESABI_ERR_BAD_ARGUMENTS;
    }
    if (r == -3) {
        return ESARR_ERR_NO_MEM;
    }
    if (r == -4) {
        return ESARR_ERR_BAD_PAYLOAD;
    }
    esabi_value_set_i32(retval, (esabi_i32)(r));
    return ESABI_OK;
}

/* arrLastIndexOf(packed, len, search) -> int */
ESABI_DIRECT_FUNCTION(arrLastIndexOf)
{
    long r = esarr_find_core(argv, argc, 1, 0);
    if (r == -2) {
        return ESABI_ERR_BAD_ARGUMENTS;
    }
    if (r == -3) {
        return ESARR_ERR_NO_MEM;
    }
    if (r == -4) {
        return ESARR_ERR_BAD_PAYLOAD;
    }
    esabi_value_set_i32(retval, (esabi_i32)(r));
    return ESABI_OK;
}

/* arrIncludes(packed, len, search) -> 1/0 (SameValueZero) */
ESABI_DIRECT_FUNCTION(arrIncludes)
{
    long r = esarr_find_core(argv, argc, 0, 1);
    if (r == -2) {
        return ESABI_ERR_BAD_ARGUMENTS;
    }
    if (r == -3) {
        return ESARR_ERR_NO_MEM;
    }
    if (r == -4) {
        return ESARR_ERR_BAD_PAYLOAD;
    }
    esabi_value_set_i32(retval, (esabi_i32)(r));
    return ESABI_OK;
}

/* ---- DllMain (freestanding: no CRT init needed) ---- */

typedef int BOOL;
typedef void* HINSTANCE;
typedef unsigned long DWORD;
typedef void* LPVOID;
#define WINAPI __stdcall

BOOL WINAPI DllMain(HINSTANCE hinst, DWORD reason, LPVOID reserved)
{
    (void)hinst;
    (void)reason;
    (void)reserved;
    return 1;
}
