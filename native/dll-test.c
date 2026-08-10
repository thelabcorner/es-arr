/***************************************************************************
 * dll-test.c — FREESTANDING local ABI test for ESARRArray.dll (no
 * Illustrator, no CRT needed).
 *
 * Loads the built DLL via LoadLibrary and drives every exported method
 * through the documented TaggedData ABI per the DESIGN DOC contract v1
 * (byte+1 wire §3.2, method semantics §1.3, error codes §1.4), checking
 * against known vectors (the differential corpus's ToString-order sort
 * cases plus edge cases). Catches logic/codec errors before the COM probe.
 *
 * Build (clang+lld, kernel32 only):
 *   clang --target=x86_64-pc-windows-msvc -O2 -ffreestanding -fno-builtin \
 *     -fno-stack-protector -mno-stack-arg-probe -c dll-test.c -o dll-test.obj
 *   lld -flavor link /subsystem:console /entry:mainCRTStartup /nodefaultlib \
 *     /machine:x64 /out:dll-test.exe dll-test.obj kernel32.lib
 * Usage: dll-test.exe <path-to-ESARRArray.dll>
 * Exit 0 = all vectors pass.
 ***************************************************************************/

#include <stddef.h>

typedef unsigned long DWORD;
typedef int BOOL;
typedef void* HANDLE;
typedef void* HMODULE;
typedef void* LPVOID;

#define WINAPI __stdcall
#define STD_OUTPUT_HANDLE ((DWORD)-11)

__declspec(dllimport) HANDLE WINAPI GetStdHandle(DWORD nStdHandle);
__declspec(dllimport) BOOL WINAPI WriteFile(
    HANDLE hFile, const void* lpBuffer, DWORD nNumberOfBytesToWrite,
    DWORD* lpNumberOfBytesWritten, LPVOID lpOverlapped);
__declspec(dllimport) void WINAPI ExitProcess(unsigned int uExitCode);
__declspec(dllimport) HMODULE WINAPI LoadLibraryA(const char* lpFileName);
__declspec(dllimport) void* WINAPI GetProcAddress(HMODULE hModule, const char* lpProcName);
__declspec(dllimport) BOOL WINAPI FreeLibrary(HMODULE hLibModule);
__declspec(dllimport) DWORD WINAPI GetLastError(void);
__declspec(dllimport) char* __cdecl GetCommandLineA(void);

/* MSVC/clang FP marker for freestanding builds */
unsigned int _fltused = 0;

/* ---- TaggedData ABI (SoSharedLibDefs.h, pack 8) ---- */
typedef struct TaggedData {
    union {
        long intval;
        double fltval;
        char* string;
        void* hObject;
    } data;
    long type;
    long filler;
} TaggedData;

#define kTypeUndefined 0
#define kTypeDouble    3
#define kTypeString    4
#define kTypeInteger   123
#define kTypeUInteger  124

#define K_ESOK 0
#define K_ERR_BAD_ARGS   20
#define K_ERR_PAYLOAD    10001
#define K_ERR_SEP        10002
#define K_ERR_NO_MEM     10003

typedef char* (*ESInitFn)(TaggedData*, long);
typedef long (*ESVerFn)(void);
typedef void (*ESFreeFn)(void*);
typedef void (*ESTermFn)(void);
typedef long (*ESFunc)(TaggedData*, long, TaggedData*);

static int g_fail = 0;
static int g_pass = 0;

/* ---- minimal output ---- */
static char g_out[8192];
static size_t g_outlen = 0;

static void out_c(char c)
{
    if (g_outlen < sizeof(g_out) - 1) {
        g_out[g_outlen++] = c;
    }
}

static void out_str(const char* s)
{
    while (*s) {
        out_c(*s++);
    }
}

static void out_long(long v)
{
    char tmp[16];
    int j = 0;
    unsigned long u;
    if (v < 0) {
        out_c('-');
        u = (unsigned long)(-(v + 1)) + 1ul;
    }
    else {
        u = (unsigned long)v;
    }
    do {
        tmp[j++] = (char)('0' + (u % 10));
        u /= 10;
    } while (u != 0);
    while (j-- > 0) {
        out_c(tmp[j]);
    }
}

static void flush_out(void)
{
    HANDLE h = GetStdHandle(STD_OUTPUT_HANDLE);
    DWORD written = 0;
    size_t off = 0;
    while (off < g_outlen) {
        if (!WriteFile(h, g_out + off, (DWORD)(g_outlen - off), &written, NULL) || written == 0) {
            break;
        }
        off += (size_t)written;
    }
    g_outlen = 0;
}

static void check(int cond, const char* what)
{
    if (cond) {
        g_pass++;
    }
    else {
        g_fail++;
        out_str("FAIL: ");
        out_str(what);
        out_c('\n');
    }
}

static size_t str_len(const char* s)
{
    const char* p = s;
    while (*p) {
        p++;
    }
    return (size_t)(p - s);
}

static int str_eq(const char* a, const char* b)
{
    while (*a && *a == *b) {
        a++;
        b++;
    }
    return (unsigned char)*a - (unsigned char)*b;
}

static int str_contains(const char* hay, const char* needle)
{
    size_t hn = str_len(hay), nn = str_len(needle);
    size_t i;
    if (nn > hn) {
        return 0;
    }
    for (i = 0; i + nn <= hn; i++) {
        size_t j;
        int ok = 1;
        for (j = 0; j < nn; j++) {
            if (hay[i + j] != needle[j]) {
                ok = 0;
                break;
            }
        }
        if (ok) {
            return 1;
        }
    }
    return 0;
}

/* ---- byte+1 wire helpers (FINAL wire, decisions/wire-final v3) ---- */
static void utf8_write(char* out, size_t* o, unsigned long u)
{
    if (u < 0x80) {
        out[(*o)++] = (char)u;
    }
    else {
        /* 128..256 -> C2/C3/C4 + continuation */
        out[(*o)++] = (char)(0xC0 | (u >> 6));
        out[(*o)++] = (char)(0x80 | (u & 0x3F));
    }
}

static long utf8_unit_at(const char* s, long* i)
{
    unsigned char b = (unsigned char)s[*i];
    if (b < 0x80) {
        *i += 1;
        return b;
    }
    if ((b == 0xC2 || b == 0xC3 || b == 0xC4) && ((unsigned char)s[*i + 1] & 0xC0) == 0x80) {
        long u = (long)((b & 0x1F) << 6) | (s[*i + 1] & 0x3F);
        *i += 2;
        return u;
    }
    return -1;
}

/* pack v into 4 units (c0..c3 = bytes+1), UTF-8 encoded; returns bytes written */
static long pack_int32(char* out, long v)
{
    unsigned long n = (unsigned long)(unsigned int)v;
    unsigned long units[4];
    size_t o = 0;
    int j;
    units[0] = ((n >> 24) & 0xFFul) + 1ul;
    units[1] = ((n >> 16) & 0xFFul) + 1ul;
    units[2] = ((n >> 8) & 0xFFul) + 1ul;
    units[3] = (n & 0xFFul) + 1ul;
    for (j = 0; j < 4; j++) {
        utf8_write(out, &o, units[j]);
    }
    return (long)o;
}

/* pack n values at 8 bytes/value stride (max) into out; returns total bytes */
static long pack_array(char* out, const long* vals, long n)
{
    long i, total = 0;
    for (i = 0; i < n; i++) {
        total += pack_int32(out + total, vals[i]);
    }
    return total;
}

/* decode 4 units at *cur (advancing), reconstruct int32 */
static long unpack_int32_cur(const char* s, long* cur)
{
    long c0 = utf8_unit_at(s, cur);
    long c1 = utf8_unit_at(s, cur);
    long c2 = utf8_unit_at(s, cur);
    long c3 = utf8_unit_at(s, cur);
    unsigned long v = ((unsigned long)(c0 - 1) << 24) |
                      ((unsigned long)(c1 - 1) << 16) |
                      ((unsigned long)(c2 - 1) << 8) |
                      (unsigned long)(c3 - 1);
    return v >= 2147483648ul ? (long)(v - 4294967296ul) : (long)v;
}

void mainCRTStartup(void)
{
    const char* dllpath;
    HMODULE h;
    char* cmd = GetCommandLineA();
    char* p = cmd;
    int in_quote = 0;

    /* parse dllpath from the command line (quoted token after the exe) */
    while (*p) {
        if (*p == '"') {
            in_quote = !in_quote;
        }
        else if (*p == ' ' && !in_quote) {
            break;
        }
        p++;
    }
    while (*p == ' ') {
        p++;
    }
    if (*p == '"') {
        p++;
        dllpath = p;
        while (*p && *p != '"') {
            p++;
        }
        *p = '\0';
    }
    else {
        dllpath = (*p != '\0') ? p : "bin\\ESARRArray.dll";
    }

    h = LoadLibraryA(dllpath);
    if (!h) {
        out_str("FATAL: cannot load ");
        out_str(dllpath);
        out_str(" (err ");
        out_long((long)GetLastError());
        out_str(")\n");
        flush_out();
        ExitProcess(2);
    }
    {
        ESInitFn ESInitialize = (ESInitFn)GetProcAddress(h, "ESInitialize");
        ESVerFn ESGetVersion = (ESVerFn)GetProcAddress(h, "ESGetVersion");
        ESFreeFn ESFreeMem = (ESFreeFn)GetProcAddress(h, "ESFreeMem");
        ESTermFn ESTerminate = (ESTermFn)GetProcAddress(h, "ESTerminate");
        ESFunc version = (ESFunc)GetProcAddress(h, "version");
        ESFunc ping = (ESFunc)GetProcAddress(h, "ping");
        ESFunc arrSort = (ESFunc)GetProcAddress(h, "arrSort");
        ESFunc arrJoin = (ESFunc)GetProcAddress(h, "arrJoin");
        ESFunc arrReverse = (ESFunc)GetProcAddress(h, "arrReverse");
        ESFunc arrIndexOf = (ESFunc)GetProcAddress(h, "arrIndexOf");
        ESFunc arrLastIndexOf = (ESFunc)GetProcAddress(h, "arrLastIndexOf");
        ESFunc arrIncludes = (ESFunc)GetProcAddress(h, "arrIncludes");

        check(ESInitialize && ESGetVersion && ESFreeMem && ESTerminate &&
              version && ping && arrSort && arrJoin && arrReverse &&
              arrIndexOf && arrLastIndexOf && arrIncludes,
              "all 12 exports resolve");
        check(GetProcAddress(h, "arrConcat") == NULL, "arrConcat not exported (engine-keep per doc)");
        check(GetProcAddress(h, "arrSlice") == NULL, "arrSlice not exported (engine-keep per doc)");

        if (ESInitialize && arrSort && arrJoin) {
            char* sig;
            check(ESGetVersion() == 1, "ESGetVersion() == 1");
            sig = ESInitialize(NULL, 0);
            check(sig != NULL &&
                  str_contains(sig, "arrSort_sd") &&
                  str_contains(sig, "arrJoin_sds") &&
                  str_contains(sig, "arrIncludes_sdd") &&
                  str_contains(sig, "ping_d") &&
                  str_contains(sig, "version_s"),
                  "ESInitialize signature matches doc §1.2");

            /* ---- ping/version ---- */
            {
                TaggedData argv[1], rv;
                argv[0].type = kTypeInteger;
                argv[0].data.intval = 0;
                rv.type = kTypeUndefined;
                check(ping(argv, 1, &rv) == K_ESOK && rv.data.intval == 42,
                      "ping(0) -> 42");
                rv.type = kTypeUndefined;
                check(version(argv, 1, &rv) == K_ESOK &&
                      rv.data.string && str_contains(rv.data.string, "ESARRArray"),
                      "version(0) -> banner string");
                ESFreeMem(rv.data.string);
            }

            /* ---- arrSort(packed, len) ---- */
            {
                char packed[64] = {0};
                TaggedData argv[2], rv;
                long vals[3] = { 3, 1, 2 };
                long expect[3] = { 1, 2, 3 };
                long nbytes = pack_array(packed, vals, 3);
                long cur = 0;
                (void)nbytes;
                argv[0].type = kTypeString;
                argv[0].data.string = packed;
                argv[1].type = kTypeInteger;
                argv[1].data.intval = 3;
                rv.type = kTypeUndefined;
                if (arrSort(argv, 2, &rv) == K_ESOK) {
                    char* s = rv.data.string;
                    check(s && unpack_int32_cur(s, &cur) == expect[0] &&
                          unpack_int32_cur(s, &cur) == expect[1] &&
                          unpack_int32_cur(s, &cur) == expect[2],
                          "arrSort [3,1,2] -> [1,2,3]");
                    ESFreeMem(s);
                }
                else {
                    check(0, "arrSort [3,1,2] returns OK");
                }
            }
            /* ToString-order (doc §4 mandatory vectors) */
            {
                char packed[64] = {0};
                TaggedData argv[2], rv;
                long vals[4] = { 10, 9, 1, 2 };
                long expect[4] = { 1, 10, 2, 9 };
                long i, ok = 1;
                long cur = 0;
                pack_array(packed, vals, 4);
                argv[0].type = kTypeString;
                argv[0].data.string = packed;
                argv[1].type = kTypeInteger;
                argv[1].data.intval = 4;
                rv.type = kTypeUndefined;
                if (arrSort(argv, 2, &rv) == K_ESOK) {
                    char* s = rv.data.string;
                    for (i = 0; i < 4; i++) {
                        if (unpack_int32_cur(s, &cur) != expect[i]) ok = 0;
                    }
                    check(ok, "arrSort [10,9,1,2] -> [1,10,2,9] (ToString order)");
                    ESFreeMem(s);
                }
                else {
                    check(0, "arrSort [10,9,1,2] returns OK");
                }
            }
            {
                char packed[64] = {0};
                TaggedData argv[2], rv;
                long vals[4] = { -5, 0, 7, 4 };
                long expect[4] = { -5, 0, 4, 7 };
                long i, ok = 1;
                long cur = 0;
                pack_array(packed, vals, 4);
                argv[0].type = kTypeString;
                argv[0].data.string = packed;
                argv[1].type = kTypeInteger;
                argv[1].data.intval = 4;
                rv.type = kTypeUndefined;
                if (arrSort(argv, 2, &rv) == K_ESOK) {
                    char* s = rv.data.string;
                    for (i = 0; i < 4; i++) {
                        if (unpack_int32_cur(s, &cur) != expect[i]) ok = 0;
                    }
                    check(ok, "arrSort [-5,0,7,4] -> [-5,0,4,7]");
                    ESFreeMem(s);
                }
                else {
                    check(0, "arrSort [-5,0,7,4] returns OK");
                }
            }
            {
                char packed[64] = {0};
                TaggedData argv[2], rv;
                long vals[3] = { -9, -10, -11 };
                long expect[3] = { -10, -11, -9 }; /* Node-verified ToString order */
                long i, ok = 1;
                long cur = 0;
                pack_array(packed, vals, 3);
                argv[0].type = kTypeString;
                argv[0].data.string = packed;
                argv[1].type = kTypeInteger;
                argv[1].data.intval = 3;
                rv.type = kTypeUndefined;
                if (arrSort(argv, 2, &rv) == K_ESOK) {
                    char* s = rv.data.string;
                    for (i = 0; i < 3; i++) {
                        if (unpack_int32_cur(s, &cur) != expect[i]) ok = 0;
                    }
                    check(ok, "arrSort [-9,-10,-11] -> [-10,-11,-9] (Node-verified)");
                    ESFreeMem(s);
                }
                else {
                    check(0, "arrSort [-9,-10,-11] returns OK");
                }
            }
            {
                char packed[64] = {0};
                TaggedData argv[2], rv;
                long vals[4] = { 1000, 7, 100, 8 };
                long expect[4] = { 1000, 7, 100, 8 }; /* "1000"<"7"<"100"<"8"? no: "100"<"1000"<"7"<"8" */
                long i, ok = 1;
                long cur = 0;
                expect[0] = 100;
                expect[1] = 1000;
                expect[2] = 7;
                expect[3] = 8;
                pack_array(packed, vals, 4);
                argv[0].type = kTypeString;
                argv[0].data.string = packed;
                argv[1].type = kTypeInteger;
                argv[1].data.intval = 4;
                rv.type = kTypeUndefined;
                if (arrSort(argv, 2, &rv) == K_ESOK) {
                    char* s = rv.data.string;
                    for (i = 0; i < 4; i++) {
                        if (unpack_int32_cur(s, &cur) != expect[i]) ok = 0;
                    }
                    check(ok, "arrSort [1000,7,100,8] -> [100,1000,7,8] (power-of-10 mix)");
                    ESFreeMem(s);
                }
                else {
                    check(0, "arrSort power-of-10 mix returns OK");
                }
            }
            {
                char packed[64] = {0};
                TaggedData argv[2], rv;
                long vals[3] = { 2147483647L, -2147483648L, 0 };
                long expect[3] = { -2147483648L, 0, 2147483647L };
                long i, ok = 1;
                long cur = 0;
                pack_array(packed, vals, 3);
                argv[0].type = kTypeString;
                argv[0].data.string = packed;
                argv[1].type = kTypeInteger;
                argv[1].data.intval = 3;
                rv.type = kTypeUndefined;
                if (arrSort(argv, 2, &rv) == K_ESOK) {
                    char* s = rv.data.string;
                    for (i = 0; i < 3; i++) {
                        if (unpack_int32_cur(s, &cur) != expect[i]) ok = 0;
                    }
                    check(ok, "arrSort [INT32_MAX, INT32_MIN, 0] -> [INT32_MIN, 0, INT32_MAX]");
                    ESFreeMem(s);
                }
                else {
                    check(0, "arrSort int32 bounds returns OK");
                }
            }
            /* duplicates: stable order allowed either way; check group identity */
            {
                char packed[64] = {0};
                TaggedData argv[2], rv;
                long vals[4] = { 2, 2, 1, 1 };
                long expect[4] = { 1, 1, 2, 2 };
                long i, ok = 1;
                long cur = 0;
                pack_array(packed, vals, 4);
                argv[0].type = kTypeString;
                argv[0].data.string = packed;
                argv[1].type = kTypeInteger;
                argv[1].data.intval = 4;
                rv.type = kTypeUndefined;
                if (arrSort(argv, 2, &rv) == K_ESOK) {
                    char* s = rv.data.string;
                    for (i = 0; i < 4; i++) {
                        if (unpack_int32_cur(s, &cur) != expect[i]) ok = 0;
                    }
                    check(ok, "arrSort [2,2,1,1] -> [1,1,2,2]");
                    ESFreeMem(s);
                }
                else {
                    check(0, "arrSort [2,2,1,1] returns OK");
                }
            }

            /* ---- arrReverse(packed, len) ---- */
            {
                char packed[64] = {0};
                TaggedData argv[2], rv;
                long vals[3] = { 1, 2, 3 };
                long cur = 0;
                pack_array(packed, vals, 3);
                argv[0].type = kTypeString;
                argv[0].data.string = packed;
                argv[1].type = kTypeInteger;
                argv[1].data.intval = 3;
                rv.type = kTypeUndefined;
                if (arrReverse(argv, 2, &rv) == K_ESOK) {
                    char* s = rv.data.string;
                    check(s && unpack_int32_cur(s, &cur) == 3 &&
                          unpack_int32_cur(s, &cur) == 2 &&
                          unpack_int32_cur(s, &cur) == 1,
                          "arrReverse [1,2,3] -> [3,2,1]");
                    ESFreeMem(s);
                }
                else {
                    check(0, "arrReverse [1,2,3] returns OK");
                }
            }

            /* ---- arrJoin(packed, len, sep) ---- */
            {
                char packed[64] = {0};
                TaggedData argv[3], rv;
                long vals[3] = { 1, 2, 3 };
                char* s;
                pack_array(packed, vals, 3);
                argv[0].type = kTypeString;
                argv[0].data.string = packed;
                argv[1].type = kTypeInteger;
                argv[1].data.intval = 3;
                argv[2].type = kTypeString;
                argv[2].data.string = ",";
                rv.type = kTypeUndefined;
                if (arrJoin(argv, 3, &rv) == K_ESOK) {
                    s = rv.data.string;
                    check(s && str_eq(s, "1,2,3") == 0, "arrJoin [1,2,3] \",\" -> \"1,2,3\"");
                    ESFreeMem(s);
                }
                else {
                    check(0, "arrJoin [1,2,3] returns OK");
                }
            }
            {
                char packed[64] = {0};
                TaggedData argv[3], rv;
                long vals[3] = { -1, 0, 1 };
                char* s;
                pack_array(packed, vals, 3);
                argv[0].type = kTypeString;
                argv[0].data.string = packed;
                argv[1].type = kTypeInteger;
                argv[1].data.intval = 3;
                argv[2].type = kTypeString;
                argv[2].data.string = "";
                rv.type = kTypeUndefined;
                if (arrJoin(argv, 3, &rv) == K_ESOK) {
                    s = rv.data.string;
                    check(s && str_eq(s, "-101") == 0, "arrJoin [-1,0,1] \"\" -> \"-101\"");
                    ESFreeMem(s);
                }
                else {
                    check(0, "arrJoin [-1,0,1] empty sep returns OK");
                }
            }
            {
                char packed[64] = {0};
                TaggedData argv[3], rv;
                long vals[2] = { -2147483648L, 2147483647L };
                char* s;
                pack_array(packed, vals, 2);
                argv[0].type = kTypeString;
                argv[0].data.string = packed;
                argv[1].type = kTypeInteger;
                argv[1].data.intval = 2;
                argv[2].type = kTypeString;
                argv[2].data.string = " | ";
                rv.type = kTypeUndefined;
                if (arrJoin(argv, 3, &rv) == K_ESOK) {
                    s = rv.data.string;
                    check(s && str_eq(s, "-2147483648 | 2147483647") == 0,
                          "arrJoin int32 bounds multi-char sep");
                    ESFreeMem(s);
                }
                else {
                    check(0, "arrJoin int32 bounds returns OK");
                }
            }
            {
                TaggedData argv[3], rv;
                argv[0].type = kTypeString;
                argv[0].data.string = "";
                argv[1].type = kTypeInteger;
                argv[1].data.intval = 0;
                argv[2].type = kTypeString;
                argv[2].data.string = ",";
                rv.type = kTypeUndefined;
                if (arrJoin(argv, 3, &rv) == K_ESOK) {
                    char* s = rv.data.string;
                    check(s && str_eq(s, "") == 0, "arrJoin [] -> \"\"");
                    ESFreeMem(s);
                }
                else {
                    check(0, "arrJoin [] returns OK");
                }
            }

            /* ---- arrIndexOf / arrLastIndexOf / arrIncludes (packed, len, search) ---- */
            {
                char packed[64] = {0};
                TaggedData argv[3], rv;
                long vals[4] = { 1, 2, 3, 2 };
                pack_array(packed, vals, 4);
                argv[0].type = kTypeString;
                argv[0].data.string = packed;
                argv[1].type = kTypeInteger;
                argv[1].data.intval = 4;
                argv[2].type = kTypeInteger;
                argv[2].data.intval = 2;
                rv.type = kTypeUndefined;
                check(arrIndexOf(argv, 3, &rv) == K_ESOK && rv.data.intval == 1,
                      "arrIndexOf [1,2,3,2] 2 -> 1");
                rv.type = kTypeUndefined;
                check(arrLastIndexOf(argv, 3, &rv) == K_ESOK && rv.data.intval == 3,
                      "arrLastIndexOf [1,2,3,2] 2 -> 3");
                rv.type = kTypeUndefined;
                check(arrIncludes(argv, 3, &rv) == K_ESOK && rv.data.intval == 1,
                      "arrIncludes [1,2,3,2] 2 -> 1");
                argv[2].data.intval = 9;
                rv.type = kTypeUndefined;
                check(arrIndexOf(argv, 3, &rv) == K_ESOK && rv.data.intval == -1,
                      "arrIndexOf missing -> -1");
                rv.type = kTypeUndefined;
                check(arrLastIndexOf(argv, 3, &rv) == K_ESOK && rv.data.intval == -1,
                      "arrLastIndexOf missing -> -1");
                rv.type = kTypeUndefined;
                check(arrIncludes(argv, 3, &rv) == K_ESOK && rv.data.intval == 0,
                      "arrIncludes missing -> 0");
                argv[2].data.intval = 0;
                argv[1].data.intval = 0; /* empty payload => len must be 0 */
                argv[0].data.string = "";
                rv.type = kTypeUndefined;
                check(arrIndexOf(argv, 3, &rv) == K_ESOK && rv.data.intval == -1,
                      "arrIndexOf empty -> -1");
            }

            /* ---- error paths (doc §1.4) ---- */
            {
                char packed[64] = {0};
                TaggedData argv[2], rv;
                long vals[3] = { 1, 2, 3 };
                pack_array(packed, vals, 3);
                argv[0].type = kTypeString;
                argv[0].data.string = packed;
                argv[1].type = kTypeInteger;
                argv[1].data.intval = 2; /* len 2 but 3 elements packed */
                rv.type = kTypeUndefined;
                check(arrSort(argv, 2, &rv) == K_ERR_PAYLOAD,
                      "arrSort len mismatch -> 10001");
            }
            {
                char packed[64] = {0};
                TaggedData argv[2], rv;
                long vals[3] = { 1, 2, 3 };
                pack_array(packed, vals, 3);
                argv[0].type = kTypeString;
                argv[0].data.string = packed;
                argv[1].type = kTypeInteger;
                argv[1].data.intval = 3;
                rv.type = kTypeUndefined;
                check(arrReverse(argv, 2, &rv) == K_ESOK, "arrReverse valid");
                /* malformed channel: invalid UTF-8 lead byte (unit > 256) */
                argv[0].data.string = "\xE0\x80\x80\x01";
                argv[1].data.intval = 1;
                rv.type = kTypeUndefined;
                check(arrReverse(argv, 2, &rv) == K_ERR_PAYLOAD,
                      "arrReverse invalid UTF-8 unit -> 10001");
            }
            {
                TaggedData argv[2], rv;
                argv[0].type = kTypeString;
                argv[0].data.string = "";
                argv[1].type = kTypeInteger;
                argv[1].data.intval = 1000000001L; /* over the sanity cap */
                rv.type = kTypeUndefined;
                check(arrSort(argv, 2, &rv) == K_ERR_PAYLOAD,
                      "arrSort len > 1e9 -> 10001");
            }
            {
                char packed[64] = {0};
                TaggedData argv[3], rv;
                long vals[1] = { 5 };
                pack_array(packed, vals, 1);
                argv[0].type = kTypeString;
                argv[0].data.string = packed;
                argv[1].type = kTypeInteger;
                argv[1].data.intval = 1;
                argv[2].type = kTypeDouble;
                argv[2].data.fltval = 1.5; /* wrong arg type */
                rv.type = kTypeUndefined;
                check(arrJoin(argv, 3, &rv) == K_ERR_BAD_ARGS,
                      "arrJoin non-string sep -> 20");
            }
            {
                TaggedData argv[1], rv;
                argv[0].type = kTypeDouble;
                argv[0].data.fltval = 1.5;
                rv.type = kTypeUndefined;
                check(arrSort(argv, 1, &rv) == K_ERR_BAD_ARGS,
                      "arrSort wrong argc -> 20");
            }

            ESTerminate();
        }

        FreeLibrary(h);
    }

    out_str("PASS ");
    out_long(g_pass);
    out_str(", FAIL ");
    out_long(g_fail);
    out_c('\n');
    flush_out();
    ExitProcess(g_fail == 0 ? 0 : 1);
}
