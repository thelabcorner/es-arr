/***************************************************************************
 * fmt-test.c — FREESTANDING test harness for the ES Number->string engine.
 *
 * Reads one IEEE-754 double per line from stdin as a 16-hex-digit bit
 * pattern, prints the ES3-formatted string per line to stdout. Used by
 * fmt-diff.mjs to differential-validate esarr_num_to_string against
 * Node's String(n) (both must produce identical shortest-round-trip
 * formatting for the sort/join oracle).
 *
 * No CRT: kernel32 only (GetStdHandle/ReadFile/WriteFile/ExitProcess),
 * entry point mainCRTStartup, /entry:mainCRTStartup /nodefaultlib
 * /subsystem:console. This is a test tool, not part of the DLL.
 *
 * Build (clang+lld, same family flags as the DLL):
 *   clang --target=x86_64-pc-windows-msvc -O2 -ffreestanding -fno-builtin \
 *     -fno-stack-protector -mno-stack-arg-probe -c fmt-test.c -o fmt-test.obj
 *   lld -flavor link /subsystem:console /entry:mainCRTStartup /nodefaultlib \
 *     /machine:x64 /out:fmt-test.exe fmt-test.obj kernel32.lib
 * Usage: fmt-test.exe < corpus.txt
 ***************************************************************************/

#include <stddef.h>

/* MSVC/clang emits a reference to _fltused when any floating-point code is
   present; freestanding builds must provide it (the CRT normally does). */
unsigned int _fltused = 0;

typedef unsigned long DWORD;
typedef int BOOL;
typedef void* HANDLE;
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

/* the engine under test (linked from esarr_format.c) */
extern size_t esarr_num_to_string(double x, char* buf);

#define IN_BUF_SIZE (48u << 20)   /* corpus text (hex lines) */
#define OUT_BUF_SIZE (48u << 20)  /* formatted output */

static char g_in[IN_BUF_SIZE];
static char g_out[OUT_BUF_SIZE];

static int hex_val(char c)
{
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

void mainCRTStartup(void)
{
    HANDLE hin = GetStdHandle(STD_INPUT_HANDLE);
    HANDLE hout = GetStdHandle(STD_OUTPUT_HANDLE);
    size_t inlen = 0;
    size_t outlen = 0;
    DWORD got = 0;

    /* read all of stdin */
    for (;;) {
        if (!ReadFile(hin, g_in + inlen, (DWORD)(IN_BUF_SIZE - inlen - 1), &got, NULL) || got == 0) {
            break;
        }
        inlen += (size_t)got;
        if (inlen >= IN_BUF_SIZE - 1) {
            break;
        }
    }

    /* process line by line: 16 hex digits per double */
    {
        size_t i = 0;
        while (i < inlen) {
            unsigned long long bits = 0;
            int digits = 0;
            int parsed = 1;
            /* skip leading whitespace (incl. any stray \r \n) */
            while (i < inlen && (g_in[i] == ' ' || g_in[i] == '\t' ||
                                 g_in[i] == '\r' || g_in[i] == '\n' || g_in[i] == '#')) {
                /* '#' starts a comment: skip to end of line */
                if (g_in[i] == '#') {
                    while (i < inlen && g_in[i] != '\n') {
                        i++;
                    }
                }
                else {
                    i++;
                }
            }
            if (i >= inlen) {
                break;
            }
            while (i < inlen && digits < 16) {
                int hv = hex_val(g_in[i]);
                if (hv < 0) {
                    break;
                }
                bits = (bits << 4) | (unsigned long long)hv;
                digits++;
                i++;
            }
            if (digits < 16) {
                /* malformed line: emit marker, skip to end of line */
                const char* err = "PARSE_ERR\n";
                size_t e;
                for (e = 0; err[e] != '\0'; e++) {
                    g_out[outlen++] = err[e];
                }
                while (i < inlen && g_in[i] != '\n') {
                    i++;
                }
                continue;
            }
            /* parse the rest of the line (should be empty) */
            {
                double x;
                char buf[64];
                size_t n;
                unsigned char* p = (unsigned char*)&bits;
                /* little-endian host: copy bits into the double */
                {
                    unsigned char* xb = (unsigned char*)&x;
                    xb[0] = p[0]; xb[1] = p[1]; xb[2] = p[2]; xb[3] = p[3];
                    xb[4] = p[4]; xb[5] = p[5]; xb[6] = p[6]; xb[7] = p[7];
                }
                n = esarr_num_to_string(x, buf);
                {
                    size_t j;
                    for (j = 0; j < n; j++) {
                        g_out[outlen++] = buf[j];
                    }
                }
                g_out[outlen++] = '\n';
            }
            /* skip to end of line */
            while (i < inlen && g_in[i] != '\n') {
                i++;
            }
            if (i < inlen) {
                i++; /* consume '\n' */
            }
        }
    }

    /* write all output */
    {
        DWORD written = 0;
        size_t off = 0;
        while (off < outlen) {
            DWORD chunk = (DWORD)(outlen - off > 0x7FFFFFFF ? 0x7FFFFFFF : outlen - off);
            if (!WriteFile(hout, g_out + off, chunk, &written, NULL) || written == 0) {
                break;
            }
            off += (size_t)written;
        }
    }

    ExitProcess(0);
}
