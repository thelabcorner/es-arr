/***************************************************************************
 * esarr_format.c — ES Number -> string engine (ECMA-262 9.8.1).
 *
 * Self-contained (no CRT, no libc — own bignum); shared by the ESARRArray
 * DLL (freestanding) and the CRT test harness (native/fmt-test.c) that
 * differential-validates it against Node's String(n).
 *
 * Semantics (must EXACTLY match the ExtendScript engine for the sort/join
 * differential oracle):
 *   - NaN -> "NaN"; +Inf -> "Infinity"; -Inf -> "-Infinity";
 *     +0/-0 -> "0" (ES3: both print "0", unlike ES2015+ "-0").
 *   - Finite: shortest round-trip decimal digits, formatted per the ES3
 *     thresholds with value = 0.digits x 10^n (k digit count):
 *       k <= n <= 21     -> digits + (n-k) '0'
 *       0 <  n <= 21     -> first n digits '.' rest
 *       -6 < n <= 0      -> '0.' + (-n zeros) + digits
 *       otherwise        -> d[0][.rest]e[+|-]abs(n-1)
 *
 * Digit search: exact Dragon4-style interval scan. x = f x 2^E; the
 * round-trip interval is the open range between the midpoints to the
 * neighbouring doubles (endpoints allowed only when ties-to-even favours x,
 * i.e. f even). Each step emits one digit d = floor(V) with V the scaled
 * remaining value; the stop test checks whether the current k-digit prefix
 * (truncated, or rounded up by one) already round-trips:
 *   truncate-ok  <=>  0  in [L, H]    (V-world: value shifted left k times)
 *   round-up-ok  <=>  10 in [L, H]
 * All arithmetic is exact bignum over the scale S = 2^Q x 5^max(n,0).
 *
 * Integer fast path: |x| <= 2^53 integers print their exact decimal digits
 * (standard result, no bignum).
 ***************************************************************************/

#ifndef ESARR_FORMAT_C_INCLUDED
#define ESARR_FORMAT_C_INCLUDED

#include <stddef.h>

/* ---- bignum: unsigned magnitude, base 1e9, fixed capacity ---- */

#define ESARR_BIG_LIMBS 128 /* 1152 decimal digits: covers 2^1128 x 5^324 */

typedef struct {
    unsigned int d[ESARR_BIG_LIMBS];
    int n; /* significant limbs; 0 => value 0 */
} EsarrBig;

static void big_zero(EsarrBig* b)
{
    b->n = 0;
}

static void big_set_u64(EsarrBig* b, unsigned long long v)
{
    int i = 0;
    if (v == 0) {
        b->n = 0;
        return;
    }
    while (v != 0) {
        b->d[i++] = (unsigned int)(v % 1000000000ull);
        v /= 1000000000ull;
    }
    b->n = i;
}

static int big_is_zero(const EsarrBig* b)
{
    return b->n == 0;
}

static int big_cmp(const EsarrBig* a, const EsarrBig* b)
{
    int i;
    if (a->n != b->n) {
        return a->n < b->n ? -1 : 1;
    }
    for (i = a->n - 1; i >= 0; i--) {
        if (a->d[i] != b->d[i]) {
            return a->d[i] < b->d[i] ? -1 : 1;
        }
    }
    return 0;
}

static void big_copy(EsarrBig* a, const EsarrBig* b)
{
    int i;
    a->n = b->n;
    for (i = 0; i < b->n; i++) {
        a->d[i] = b->d[i];
    }
}

static void big_mul_small(EsarrBig* a, unsigned int m)
{
    unsigned long long carry = 0;
    int i;
    if (m == 0 || a->n == 0) {
        a->n = 0;
        return;
    }
    for (i = 0; i < a->n; i++) {
        unsigned long long v = (unsigned long long)a->d[i] * m + carry;
        a->d[i] = (unsigned int)(v % 1000000000ull);
        carry = v / 1000000000ull;
    }
    while (carry != 0) {
        if (a->n >= ESARR_BIG_LIMBS) {
            a->n = ESARR_BIG_LIMBS; /* clamp; cannot happen at our magnitudes */
            return;
        }
        a->d[a->n++] = (unsigned int)(carry % 1000000000ull);
        carry /= 1000000000ull;
    }
}

static void big_mul_pow2(EsarrBig* a, int e)
{
    /* multiply by 2^e, e >= 0, chunked by 2^30 (fits in a small limb) */
    static const unsigned int p2[30] = {
        1u, 2u, 4u, 8u, 16u, 32u, 64u, 128u, 256u, 512u, 1024u, 2048u,
        4096u, 8192u, 16384u, 32768u, 65536u, 131072u, 262144u, 524288u,
        1048576u, 2097152u, 4194304u, 8388608u, 16777216u, 33554432u,
        67108864u, 134217728u, 268435456u, 536870912u
    };
    if (e <= 0) {
        return;
    }
    while (e >= 30) {
        big_mul_small(a, 1073741824u); /* 2^30 */
        e -= 30;
    }
    if (e > 0) {
        big_mul_small(a, p2[e]);
    }
}

static void big_mul_pow5(EsarrBig* a, int e)
{
    /* multiply by 5^e, e >= 0 (naive; e <= 324 -> fine) */
    while (e-- > 0) {
        big_mul_small(a, 5u);
    }
}

/* a = b + c (may alias b or c) */
static void big_add(EsarrBig* a, const EsarrBig* b, const EsarrBig* c)
{
    unsigned long long carry = 0;
    int i, n = b->n > c->n ? b->n : c->n;
    EsarrBig t;
    t.n = 0;
    for (i = 0; i < n; i++) {
        unsigned long long v = carry;
        if (i < b->n) {
            v += b->d[i];
        }
        if (i < c->n) {
            v += c->d[i];
        }
        t.d[i] = (unsigned int)(v % 1000000000ull);
        carry = v / 1000000000ull;
    }
    if (carry != 0) {
        t.d[n++] = (unsigned int)carry;
    }
    t.n = n;
    big_copy(a, &t);
}

/* a = b - c, requires b >= c (may alias b or c) */
static void big_sub(EsarrBig* a, const EsarrBig* b, const EsarrBig* c)
{
    long long borrow = 0;
    int i;
    EsarrBig t;
    t.n = 0;
    for (i = 0; i < b->n; i++) {
        long long v = (long long)b->d[i] - borrow;
        if (i < c->n) {
            v -= (long long)c->d[i];
        }
        if (v < 0) {
            v += 1000000000ll;
            borrow = 1;
        }
        else {
            borrow = 0;
        }
        t.d[i] = (unsigned int)v;
    }
    t.n = b->n;
    while (t.n > 0 && t.d[t.n - 1] == 0) {
        t.n--;
    }
    big_copy(a, &t);
}

/* ---- signed bignum wrapper (only needed for the lower interval bound) ---- */

typedef struct {
    int neg;   /* 1 when the value is negative; magnitude in m */
    EsarrBig m;
} EsarrS;

static void s_zero(EsarrS* s)
{
    s->neg = 0;
    s->m.n = 0;
}

/* s -= b  (b unsigned, >= 0) */
static void s_sub_pos(EsarrS* s, const EsarrBig* b)
{
    if (s->neg) {
        big_add(&s->m, &s->m, b);
        return;
    }
    if (big_cmp(&s->m, b) >= 0) {
        big_sub(&s->m, &s->m, b);
    }
    else {
        s->neg = 1;
        big_sub(&s->m, b, &s->m);
    }
}

static void s_mul10(EsarrS* s)
{
    if (s->m.n != 0) {
        big_mul_small(&s->m, 10u);
    }
}

/* compare s vs unsigned b: -1 / 0 / +1 */
static int s_cmp_big(const EsarrS* s, const EsarrBig* b)
{
    if (s->neg) {
        return -1;
    }
    return big_cmp(&s->m, b);
}

static int s_eq_big(const EsarrS* s, const EsarrBig* b)
{
    return !s->neg && big_cmp(&s->m, b) == 0;
}

/* ---- double decomposition: x = f x 2^E (x > 0, finite) ---- */

static void esarr_split(double x, unsigned long long* f, int* E)
{
    union {
        double d;
        unsigned long long u;
    } cv;
    unsigned long long mant;
    int exp;
    cv.d = x;
    mant = cv.u & 0xFFFFFFFFFFFFFull;
    exp = (int)((cv.u >> 52) & 0x7FFull);
    if (exp == 0) {
        *f = mant;
        *E = -1074;
    }
    else {
        *f = mant | (1ull << 52);
        *E = exp - 1075;
    }
}

/* compare x = f x 2^E vs 10^m (exact) */
static int esarr_cmp_x_pow10(unsigned long long f, int E, int m)
{
    EsarrBig lhs, rhs;
    big_zero(&lhs);
    big_zero(&rhs);
    if (m >= 0) {
        /* f x 2^E vs 2^m x 5^m */
        big_set_u64(&lhs, f);
        if (E >= m) {
            big_mul_pow2(&lhs, E - m);
            big_set_u64(&rhs, 1);
            big_mul_pow5(&rhs, m);
        }
        else {
            big_set_u64(&rhs, 1);
            big_mul_pow2(&rhs, m - E);
            big_mul_pow5(&rhs, m);
        }
    }
    else {
        /* f x 2^E vs 1 / (2^-m x 5^-m)  <=>  f x 2^(E-m) x 5^-m vs 1.
           E-m may be negative -> move the power of two to the rhs:
           f x 5^-m vs 2^(m-E). */
        big_set_u64(&lhs, f);
        big_mul_pow5(&lhs, -m);
        if (E - m >= 0) {
            big_mul_pow2(&lhs, E - m);
            big_set_u64(&rhs, 1);
        }
        else {
            big_set_u64(&rhs, 1);
            big_mul_pow2(&rhs, m - E);
        }
    }
    return big_cmp(&lhs, &rhs);
}

/*
 * Shortest round-trip decimal digits of x (x > 0, finite).
 * out: digits[k] (no leading/trailing zeros), k digit count, n decimal
 * exponent such that value = 0.digits x 10^n.
 */
static void esarr_shortest_digits(double x, char* digits, int* kp, int* np)
{
    union {
        double d;
        unsigned long long u;
    } cv;
    unsigned long long f;
    int E;
    unsigned long long N0, N1; /* interval numerators (odd) */
    int e0, e1;                /* interval exponents: m0 = N0 x 2^e0, m1 = N1 x 2^e1 */
    int n;                     /* floor(log10 x) */
    int Q;
    EsarrBig S, S10, S5, IV, IH, Sd;
    EsarrS IL;
    unsigned long long P = 0; /* k-digit prefix as u64 (<= 10^18) */
    int k = 0;
    int f_even;

    /* ---- integer fast path: |x| <= 2^53 prints its exact digits ---- */
    if (x <= 9007199254740992.0 && x == (double)(long long)x) {
        unsigned long long w = (unsigned long long)x;
        char t2[20];
        int j = 0;
        int m2;
        while (w != 0) {
            t2[j++] = (char)('0' + (w % 10));
            w /= 10;
        }
        if (j == 0) { /* cannot happen (x > 0) but keep safe */
            digits[0] = '0';
            *kp = 1;
            *np = 1;
            return;
        }
        for (m2 = 0; m2 < j; m2++) {
            digits[m2] = t2[j - 1 - m2];
        }
        *kp = j;
        *np = j; /* value = 0.digits x 10^j */
        return;
    }

    cv.d = x;

    esarr_split(x, &f, &E);

    /* ---- round-trip interval m0 = N0 x 2^e0, m1 = N1 x 2^e1 ---- */
    {
        unsigned long long mant = cv.u & 0xFFFFFFFFFFFFFull;
        int exp = (int)((cv.u >> 52) & 0x7FFull);
        if (exp == 0) {
            /* subnormal: neighbours at distance 2^-1074 */
            N0 = 2 * f - 1;
            N1 = 2 * f + 1;
            e0 = E - 1;
            e1 = E - 1;
        }
        else if (mant == 0) {
            /* power of two: spacing below is half the ulp */
            N0 = (1ull << 54) - 1;
            e0 = E - 2;
            N1 = (1ull << 53) + 1;
            e1 = E - 1;
        }
        else {
            N0 = 2 * f - 1;
            N1 = 2 * f + 1;
            e0 = E - 1;
            e1 = E - 1;
        }
    }
    f_even = (int)((f & 1ull) == 0); /* ties-to-even: x's mantissa parity */

    /* ---- n = floor(log10 x), refined with exact compares ---- */
    n = (int)((double)E * 0.30102999566398119521) + 16;
    while (n > -324 && esarr_cmp_x_pow10(f, E, n) < 0) {
        n--;
    }
    while (esarr_cmp_x_pow10(f, E, n + 1) >= 0) {
        n++;
    }

    /* ---- scale: S = 2^Q x 5^max(n,0); I_V/I_L/I_H = bounds x S ---- */
    Q = 0;
    if (n - E > Q) Q = n - E;
    if (n - e0 > Q) Q = n - e0;
    if (n - e1 > Q) Q = n - e1;
    /* Q >= 0 by construction (take max with 0) */
    if (Q < 0) Q = 0;

    big_set_u64(&S, 1);
    big_mul_pow2(&S, Q);
    if (n > 0) {
        big_mul_pow5(&S, n);
    }
    big_copy(&S10, &S);
    big_mul_small(&S10, 10u);
    big_copy(&S5, &S);
    big_mul_small(&S5, 5u);

    big_set_u64(&IV, f);
    big_mul_pow2(&IV, E - n + Q);
    if (n < 0) {
        big_mul_pow5(&IV, -n);
    }
    big_set_u64(&IH, N1);
    big_mul_pow2(&IH, e1 - n + Q);
    if (n < 0) {
        big_mul_pow5(&IH, -n);
    }
    s_zero(&IL);
    big_set_u64(&IL.m, N0);
    big_mul_pow2(&IL.m, e0 - n + Q);
    if (n < 0) {
        big_mul_pow5(&IL.m, -n);
    }
    /* IL is positive at this point (m0/10^n > 0) */

    /* ---- digit loop ---- */
    for (;;) {
        int trunc_ok = 0;
        int up_ok = 0;
        int l_le0, l_eq0, h_eq0;
        int l_le10, l_eq10, h_eq10, h_ge10;

        /* stop test: 0 in [L,H] (truncate) */
        l_le0 = IL.neg || IL.m.n == 0;
        l_eq0 = !IL.neg && IL.m.n == 0;
        h_eq0 = IH.n == 0;
        if (l_le0) {
            if (l_eq0) {
                trunc_ok = f_even;
            }
            else if (h_eq0) {
                trunc_ok = f_even;
            }
            else {
                trunc_ok = 1;
            }
        }

        /* stop test: 10 in [L,H] (round up) */
        l_le10 = s_cmp_big(&IL, &S10) <= 0;
        l_eq10 = s_eq_big(&IL, &S10);
        h_ge10 = big_cmp(&IH, &S10) >= 0;
        h_eq10 = big_cmp(&IH, &S10) == 0;
        up_ok = l_le10 && h_ge10 && (!l_eq10 || f_even) && (!h_eq10 || f_even);

        if (trunc_ok || up_ok) {
            int round_up;
            if (trunc_ok && up_ok) {
                /* both work: pick the closer one; exact tie -> even last digit */
                int c = big_cmp(&IV, &S5);
                if (c < 0) {
                    round_up = 0;
                }
                else if (c > 0) {
                    round_up = 1;
                }
                else {
                    round_up = ((P % 10ull) & 1ull) ? 1 : 0; /* tie -> even digit */
                }
            }
            else {
                round_up = up_ok;
            }
            if (round_up) {
                P += 1;
            }
            /* emit: strip trailing zeros of P (each stripped zero raises the
               decimal exponent by 1: value = P x 10^(n-k+1)) */
            {
                int stripped = 0;
                while (P != 0 && P % 10ull == 0) {
                    P /= 10ull;
                    stripped++;
                }
                {
                    char tmp[20];
                    int j = 0;
                    unsigned long long w = P;
                    int m2;
                    if (w == 0) { /* defensive: cannot happen for x > 0 */
                        digits[0] = '1';
                        *kp = 1;
                        *np = n + 1;
                        return;
                    }
                    while (w != 0) {
                        tmp[j++] = (char)('0' + (w % 10));
                        w /= 10;
                    }
                    for (m2 = 0; m2 < j; m2++) {
                        digits[m2] = tmp[j - 1 - m2];
                    }
                    *kp = j;
                    *np = (n - k + 1) + stripped + j;
                    return;
                }
            }
        }

        /* extract next digit d = floor(V) = floor(IV/S), d in 0..9 */
        {
            int d = 1;
            big_copy(&Sd, &S);
            while (d < 10 && big_cmp(&Sd, &IV) <= 0) {
                big_add(&Sd, &Sd, &S);
                d++;
            }
            d--; /* digit */
            /* Sd currently = (d+1)*S; reduce to d*S then update */
            big_sub(&Sd, &Sd, &S); /* Sd = d*S */
            big_sub(&IV, &IV, &Sd);
            big_mul_small(&IV, 10u);
            s_sub_pos(&IL, &Sd);
            s_mul10(&IL);
            big_sub(&IH, &IH, &Sd);
            big_mul_small(&IH, 10u);
            P = P * 10ull + (unsigned long long)d;
            k++;
            if (k > 18) { /* defensive cap: shortest digits never exceed 17 */
                /* emit P as-is (with strip exponent fix) */
                {
                    int stripped = 0;
                    while (P != 0 && P % 10ull == 0) {
                        P /= 10ull;
                        stripped++;
                    }
                    {
                        char tmp[20];
                        int j = 0;
                        unsigned long long w = P;
                        int m2;
                        if (w == 0) {
                            digits[0] = '1';
                            *kp = 1;
                            *np = n + 1;
                            return;
                        }
                        while (w != 0) {
                            tmp[j++] = (char)('0' + (w % 10));
                            w /= 10;
                        }
                        for (m2 = 0; m2 < j; m2++) {
                            digits[m2] = tmp[j - 1 - m2];
                        }
                        *kp = j;
                        *np = (n - k + 1) + stripped + j;
                        return;
                    }
                }
            }
        }
    }
}

/*
 * Format a finite-or-not double per ES3 9.8.1 into buf (>= 32 bytes).
 * Returns the string length (excluding NUL). Non-static: linked into both
 * the ESARRArray DLL (freestanding) and the fmt-test CRT harness.
 */
size_t esarr_num_to_string(double x, char* buf)
{
    size_t len = 0;
    char digits[20];
    int k, n;
    if (x != x) { /* NaN */
        buf[0] = 'N'; buf[1] = 'a'; buf[2] = 'N'; buf[3] = '\0';
        return 3;
    }
    if (x == 1.0 / 0.0) {
        buf[0] = 'I'; buf[1] = 'n'; buf[2] = 'f'; buf[3] = 'i'; buf[4] = 'n';
        buf[5] = 'i'; buf[6] = 't'; buf[7] = 'y'; buf[8] = '\0';
        return 8;
    }
    if (x == -1.0 / 0.0) {
        buf[0] = '-'; buf[1] = 'I'; buf[2] = 'n'; buf[3] = 'f'; buf[4] = 'i';
        buf[5] = 'n'; buf[6] = 'i'; buf[7] = 't'; buf[8] = 'y'; buf[9] = '\0';
        return 9;
    }
    if (x == 0.0) {
        buf[0] = '0';
        buf[1] = '\0';
        return 1;
    }
    if (x < 0) {
        buf[len++] = '-';
        x = -x;
    }
    esarr_shortest_digits(x, digits, &k, &n);
    if (k <= n && n <= 21) {
        int i;
        for (i = 0; i < k; i++) {
            buf[len++] = digits[i];
        }
        for (i = 0; i < n - k; i++) {
            buf[len++] = '0';
        }
    }
    else if (0 < n && n <= 21) {
        int i;
        for (i = 0; i < n; i++) {
            buf[len++] = digits[i];
        }
        buf[len++] = '.';
        for (; i < k; i++) {
            buf[len++] = digits[i];
        }
    }
    else if (-6 < n && n <= 0) {
        int i, z;
        buf[len++] = '0';
        buf[len++] = '.';
        for (z = 0; z < -n; z++) {
            buf[len++] = '0';
        }
        for (i = 0; i < k; i++) {
            buf[len++] = digits[i];
        }
    }
    else {
        /* exponential: d[0][.rest]e[+|-]abs(n-1) */
        int e = n - 1;
        int i;
        buf[len++] = digits[0];
        if (k > 1) {
            buf[len++] = '.';
            for (i = 1; i < k; i++) {
                buf[len++] = digits[i];
            }
        }
        buf[len++] = 'e';
        if (e < 0) {
            buf[len++] = '-';
            e = -e;
        }
        else {
            buf[len++] = '+';
        }
        {
            char tmp[8];
            int t = 0;
            do {
                tmp[t++] = (char)('0' + (e % 10));
                e /= 10;
            } while (e != 0);
            while (t-- > 0) {
                buf[len++] = tmp[t];
            }
        }
    }
    buf[len] = '\0';
    return len;
}

/*
 * ES ToString of an int32 (the packed-lane unit): '-' + decimal digits,
 * always the plain form (|int32| < 10^21 so the ES3 thresholds never go
 * exponential). Returns the string length.
 */
size_t esarr_int32_to_string(long v, char* buf)
{
    size_t len = 0;
    unsigned int u;
    char tmp[12];
    int j = 0;
    if (v < 0) {
        buf[len++] = '-';
        u = (unsigned int)(-(v + 1)) + 1u; /* INT32_MIN safe */
    }
    else {
        u = (unsigned int)v;
    }
    do {
        tmp[j++] = (char)('0' + (u % 10));
        u /= 10;
    } while (u != 0);
    while (j-- > 0) {
        buf[len++] = tmp[j];
    }
    buf[len] = '\0';
    return len;
}

#endif /* ESARR_FORMAT_C_INCLUDED */
