#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#if defined(__x86_64__) || defined(_M_X64)
#include <immintrin.h>
#include <smmintrin.h>
#endif

// Dot product using SSE4.1
float dot_product_sse(const float* a, const float* b, int n) {
    float result = 0.0f;
#if defined(__x86_64__)
    __m128 sum = _mm_setzero_ps();
    for (int i = 0; i < n; i += 4) {
        __m128 va = _mm_loadu_ps(&a[i]);
        __m128 vb = _mm_loadu_ps(&b[i]);
        __m128 dp = _mm_dp_ps(va, vb, 0xFF);
        sum = _mm_add_ps(sum, dp);
    }
    _mm_store_ss(&result, sum);
#else
    for (int i = 0; i < n; i++) {
        result += a[i] * b[i];
    }
#endif
    return result;
}

// String search using SSE4.2 PCMPESTRI
int fast_strstr(const char* haystack, int haystack_len, const char* needle, int needle_len) {
#if defined(__x86_64__)
    if (needle_len > 16) return -1;  // SSE register limit

    __m128i pattern = _mm_loadu_si128((__m128i*)needle);

    for (int i = 0; i < haystack_len - needle_len + 1; i += 16) {
        __m128i block = _mm_loadu_si128((__m128i*)(haystack + i));
        int idx = _mm_cmpestri(pattern, needle_len, block, 16,
                               _SIDD_UBYTE_OPS | _SIDD_CMP_EQUAL_ORDERED);
        if (idx < 16) {
            return i + idx;
        }
    }
    return -1;
#else
    const char* p = strstr(haystack, needle);
    return p ? (int)(p - haystack) : -1;
#endif
}

// Population count using POPCNT instruction
int popcount_hw(uint64_t x) {
#if defined(__x86_64__)
    return __builtin_popcountll(x);
#else
    int count = 0;
    while (x) {
        count += x & 1;
        x >>= 1;
    }
    return count;
#endif
}

// Byte swap using BSWAP instruction
uint64_t bswap64(uint64_t x) {
#if defined(__x86_64__)
    __asm__ volatile("bswap %0" : "=r"(x) : "0"(x));
    return x;
#else
    return __builtin_bswap64(x);
#endif
}

// Memory copy optimized with MOVNTDQ (non-temporal stores)
void fast_memcpy(void* dst, const void* src, size_t n) {
#if defined(__x86_64__)
    const __m128i* s = (const __m128i*)src;
    __m128i* d = (__m128i*)dst;
    size_t chunks = n / 16;

    for (size_t i = 0; i < chunks; i++) {
        __m128i data = _mm_load_si128(&s[i]);
        _mm_stream_si128(&d[i], data);
    }
    _mm_sfence();  // Ensure stores are visible
#else
    memcpy(dst, src, n);
#endif
}
