/***************************************************************************
 * lane-test.c — FREESTANDING scale-parity driver for ESARRArray.dll.
 *
 * Reads commands from stdin, drives the loaded DLL, writes results to
 * stdout. Used by lane-parity.mjs to differential-test the native lanes
 * (sort/reverse/join) against Node's Array natives on large random and
 * adversarial int32 payloads (4k-48k elements — the design doc §7 band)
 * WITHOUT an Illustrator instance.
 *
 * Command format (one per line; payloads b64-encoded because packed
 * channels can contain bytes 0x0A/0x0D):
 *   SORT <len> <b64chan>
 *   REV  <len> <b64chan>
 *   JOIN <len> <b64sep> <b64chan>
 *   IDX  <len> <search> <b64chan>   (arrIndexOf  -> int)
 *   LIDX <len> <search> <b64chan>   (arrLastIndexOf -> int)
 *   INC  <len> <search> <b64chan>   (arrIncludes -> 1/0)
 * Output: "OK <b64result>" for string results, "OKI <int>" for scan
 * results, or "ERR <code>".
 *
 * Build (clang+lld, kernel32 only — same flags as dll-test.c).
 ***************************************************************************/

#include <stddef.h>

typedef unsigned long DWORD;
typedef int BOOL;
typedef void* HANDLE;
typedef void* HMODULE;
typedef void* LPVOID;

#define WINAPI __stdcall
#define STD_INPUT_HANDLE ((DWORD)-10)
#define STD_OUTPUT_HANDLE ((DWORD)-11)

__declspec(dllimport) HANDLE WINAPI GetStdHandle(DWORD nStdHandle);
__declspec(dllimport) BOOL WINAPI ReadFile(
    HANDLE hFile, LPVOID lpBuffer, DWORD nNumberOfBytesToRead,
    DWORD* lpNumberOfBytesRead, LPVOID lpOverlapped);
__declspec(dllimport) BOOL WINAPI WriteFile(
    HANDLE hFile, const void* lpBuffer, DWORD nNumberOfBytesToWrite,
    DWORD* lpNumberOfBytesWritten, LPVOID lpOverlapped);
__declspec(dllimport) void WINAPI ExitProcess(unsigned int uExitCode);
__declspec(dllimport) HMODULE WINAPI LoadLibraryA(const char* lpFileName);
__declspec(dllimport) void* WINAPI GetProcAddress(HMODULE hModule, const char* lpProcName);
__declspec(dllimport) DWORD WINAPI GetLastError(void);
__declspec(dllimport) char* __cdecl GetCommandLineA(void);

unsigned int _fltused = 0;

#include <esabi/esabi.h>

typedef esabi_error (ESABI_CALL *ESFunc)(esabi_value*, esabi_long, esabi_value*);
typedef void (ESABI_CALL *ESFreeFn)(void*);

#define IN_BUF (96u << 20)  /* 256k scan batch: 19 cmds x ~2.7MB b64 < 96MB */
#define OUT_BUF (32u << 20)
#define CHAN_BUF (8u << 20) /* 256k worst-case channel (1M units x 2B) = 2MB + headroom */

static char g_in[IN_BUF];
static char g_out[OUT_BUF];
static size_t g_outlen = 0;
static unsigned char g_chan[CHAN_BUF];
static unsigned char g_sep[CHAN_BUF];

static void out_c(char c)
{
    if (g_outlen < OUT_BUF - 1) {
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

/* ---- b64 ---- */
static int b64_val(char c)
{
    if (c >= 'A' && c <= 'Z') return c - 'A';
    if (c >= 'a' && c <= 'z') return c - 'a' + 26;
    if (c >= '0' && c <= '9') return c - '0' + 52;
    if (c == '+') return 62;
    if (c == '/') return 63;
    return -1;
}

static long b64_decode(const char* in, unsigned char* out, long outcap)
{
    long o = 0;
    long i = 0;
    while (in[i] != '\0') {
        int a = b64_val(in[i]), b = b64_val(in[i + 1]);
        int c = in[i + 2] == '=' ? 0 : b64_val(in[i + 2]);
        int d = in[i + 3] == '=' ? 0 : b64_val(in[i + 3]);
        if (a < 0 || b < 0 || c < 0 || d < 0) {
            return -1;
        }
        if (o + 3 > outcap) {
            return -1;
        }
        out[o++] = (unsigned char)((a << 2) | (b >> 4));
        if (in[i + 2] != '=') {
            out[o++] = (unsigned char)(((b & 15) << 4) | (c >> 2));
        }
        if (in[i + 3] != '=') {
            out[o++] = (unsigned char)(((c & 3) << 6) | d);
        }
        i += 4;
    }
    return o;
}

static const char b64_alphabet[] =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

static long b64_encode(const unsigned char* in, long n, char* out)
{
    long o = 0;
    long i = 0;
    while (i + 3 <= n) {
        unsigned long v = ((unsigned long)in[i] << 16) | ((unsigned long)in[i + 1] << 8) | in[i + 2];
        out[o++] = b64_alphabet[(v >> 18) & 63];
        out[o++] = b64_alphabet[(v >> 12) & 63];
        out[o++] = b64_alphabet[(v >> 6) & 63];
        out[o++] = b64_alphabet[v & 63];
        i += 3;
    }
    if (n - i == 1) {
        unsigned long v = (unsigned long)in[i] << 16;
        out[o++] = b64_alphabet[(v >> 18) & 63];
        out[o++] = b64_alphabet[(v >> 12) & 63];
        out[o++] = '=';
        out[o++] = '=';
    }
    else if (n - i == 2) {
        unsigned long v = ((unsigned long)in[i] << 16) | ((unsigned long)in[i + 1] << 8);
        out[o++] = b64_alphabet[(v >> 18) & 63];
        out[o++] = b64_alphabet[(v >> 12) & 63];
        out[o++] = b64_alphabet[(v >> 6) & 63];
        out[o++] = '=';
    }
    out[o] = '\0';
    return o;
}

static long str_len(const char* s)
{
    const char* p = s;
    while (*p) {
        p++;
    }
    return (long)(p - s);
}

static long parse_long(const char* s)
{
    long v = 0;
    int neg = 0;
    if (*s == '-') {
        neg = 1;
        s++;
    }
    while (*s >= '0' && *s <= '9') {
        v = v * 10 + (*s - '0');
        s++;
    }
    return neg ? -v : v;
}

/* copy the next whitespace-delimited token into tok; returns token length */
static long next_token(const char** pp, char* tok, long tokcap)
{
    const char* p = *pp;
    long n = 0;
    while (*p == ' ' || *p == '\t') {
        p++;
    }
    while (*p != '\0' && *p != '\n' && *p != '\r' && *p != ' ' && *p != '\t' && n < tokcap - 1) {
        tok[n++] = *p++;
    }
    tok[n] = '\0';
    *pp = p;
    return n;
}

void mainCRTStartup(void)
{
    HMODULE h;
    ESFunc arrSort, arrReverse, arrJoin, arrIndexOf, arrLastIndexOf, arrIncludes;
    ESFreeFn ESFreeMem;
    HANDLE hin = GetStdHandle(STD_INPUT_HANDLE);
    size_t inlen = 0;
    DWORD got = 0;
    static char enc[3 * CHAN_BUF];
    const char* dllname = "ESARRArray.dll";
    {
        char* cmd = GetCommandLineA();
        char* p = cmd;
        int q = 0;
        while (*p) {
            if (*p == '"') q = !q;
            else if (*p == ' ' && !q) break;
            p++;
        }
        while (*p == ' ') p++;
        if (*p) {
            if (*p == '"') { p++; dllname = p; while (*p && *p != '"') p++; *p = '\0'; }
            else dllname = p;
        }
    }

    h = LoadLibraryA(dllname);
    if (!h) {
        out_str("FATAL: cannot load ESARRArray.dll\n");
        flush_out();
        ExitProcess(2);
    }
    arrSort = (ESFunc)GetProcAddress(h, "arrSort");
    arrReverse = (ESFunc)GetProcAddress(h, "arrReverse");
    arrJoin = (ESFunc)GetProcAddress(h, "arrJoin");
    arrIndexOf = (ESFunc)GetProcAddress(h, "arrIndexOf");
    arrLastIndexOf = (ESFunc)GetProcAddress(h, "arrLastIndexOf");
    arrIncludes = (ESFunc)GetProcAddress(h, "arrIncludes");
    ESFreeMem = (ESFreeFn)GetProcAddress(h, "ESFreeMem");
    if (!arrSort || !arrReverse || !arrJoin || !arrIndexOf ||
        !arrLastIndexOf || !arrIncludes || !ESFreeMem) {
        out_str("FATAL: exports missing\n");
        flush_out();
        ExitProcess(2);
    }

    for (;;) {
        if (!ReadFile(hin, g_in + inlen, (DWORD)(IN_BUF - inlen - 1), &got, NULL) || got == 0) {
            break;
        }
        inlen += (size_t)got;
        if (inlen >= IN_BUF - 1) {
            break;
        }
    }
    g_in[inlen] = '\0';

    /* process command lines */
    {
        static char sepstr[2 * CHAN_BUF]; /* b64 sep token */
        static char chstr[2 * CHAN_BUF];  /* b64 channel token */
        const char* p = g_in;
        while (*p != '\0') {
            char cmd[8];
            char lenstr[16];
            char searchstr[16];
            long len;
            long nbytes;
            long sepbytes = 0;
            long search = 0;
            int isScan = 0;
            esabi_value argv[3], rv;
            long rc = 0;
            long reslen;
            long elen;
            long k;

            if (next_token(&p, cmd, sizeof(cmd)) == 0) {
                break;
            }
            if (next_token(&p, lenstr, sizeof(lenstr)) == 0) {
                out_str("ERR fmt len-after-cmd=");
                out_str(cmd);
                out_c('\n');
                break;
            }
            len = parse_long(lenstr);
            isScan = (cmd[0] == 'I' && (cmd[1] == 'D' || cmd[1] == 'N')) ||
                     (cmd[0] == 'L' && cmd[1] == 'I');
            if (isScan) {
                /* IDX/LIDX/INC: <cmd> <len> <search> <b64chan> */
                if (next_token(&p, searchstr, sizeof(searchstr)) == 0) {
                    out_str("ERR fmt search\n");
                    break;
                }
                search = parse_long(searchstr);
            }
            if (cmd[0] == 'J' && cmd[1] == 'O') {
                long toklen = next_token(&p, sepstr, sizeof(sepstr));
                if (toklen == 0) {
                    sepbytes = 0; /* empty separator (b64 of "") */
                    g_sep[0] = '\0';
                }
                else {
                    sepbytes = b64_decode(sepstr, g_sep, CHAN_BUF);
                    if (sepbytes < 0) {
                        out_str("ERR sep-b64\n");
                        break;
                    }
                    g_sep[sepbytes] = '\0'; /* NUL-terminate (stale tail) */
                }
            }
            {
                if (next_token(&p, chstr, sizeof(chstr)) == 0) {
                    out_str("ERR fmt\n");
                    break;
                }
                nbytes = b64_decode(chstr, g_chan, CHAN_BUF);
                if (nbytes < 0) {
                    out_str("ERR chan-b64\n");
                    break;
                }
                g_chan[nbytes] = '\0'; /* NUL-terminate (stale tail) */
            }
            /* skip the rest of the line */
            while (*p != '\0' && *p != '\n') {
                p++;
            }
            if (*p == '\n') {
                p++;
            }

            argv[0].type = ESABI_TYPE_STRING;
            argv[0].payload.string_value = (char*)g_chan;
            argv[1].type = ESABI_TYPE_INTEGER;
            argv[1].payload.signed_value = len;
            rv.type = ESABI_TYPE_UNDEFINED;
            if (cmd[0] == 'S') {
                rc = arrSort(argv, 2, &rv);
            }
            else if (cmd[0] == 'R') {
                rc = arrReverse(argv, 2, &rv);
            }
            else if (cmd[0] == 'J') {
                argv[2].type = ESABI_TYPE_STRING;
                argv[2].payload.string_value = (char*)g_sep;
                rc = arrJoin(argv, 3, &rv);
            }
            else if (cmd[0] == 'I' && cmd[1] == 'D') { /* IDX */
                argv[2].type = ESABI_TYPE_INTEGER;
                argv[2].payload.signed_value = search;
                rc = arrIndexOf(argv, 3, &rv);
            }
            else if (cmd[0] == 'L' && cmd[1] == 'I') { /* LIDX */
                argv[2].type = ESABI_TYPE_INTEGER;
                argv[2].payload.signed_value = search;
                rc = arrLastIndexOf(argv, 3, &rv);
            }
            else if (cmd[0] == 'I' && cmd[1] == 'N') { /* INC */
                argv[2].type = ESABI_TYPE_INTEGER;
                argv[2].payload.signed_value = search;
                rc = arrIncludes(argv, 3, &rv);
            }
            else {
                out_str("ERR cmd\n");
                continue;
            }
            if (rc != 0) {
                out_str("ERR ");
                out_long(rc);
                out_c('\n');
                continue;
            }
            if (isScan) {
                /* scan results are plain ints (index or 1/0): "OKI <n>" */
                out_str("OKI ");
                out_long(rv.payload.signed_value);
                out_c('\n');
                continue;
            }
            reslen = str_len(rv.payload.string_value);
            elen = b64_encode((const unsigned char*)rv.payload.string_value, reslen, enc);
            out_str("OK ");
            for (k = 0; k < elen; k++) {
                out_c(enc[k]);
            }
            out_c('\n');
            ESFreeMem(rv.payload.string_value);
        }
    }
    flush_out();
    ExitProcess(0);
}
