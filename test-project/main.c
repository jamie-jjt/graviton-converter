#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef __x86_64__
#include <immintrin.h>
#endif

// Architecture-specific pause instruction
static inline void cpu_relax(void) {
#if defined(__x86_64__) || defined(_M_X64)
    __asm__ volatile("pause");
#endif
}

// SSE-based vector addition
void vector_add_sse(float* a, float* b, float* result, int n) {
#ifdef __x86_64__
    for (int i = 0; i < n; i += 4) {
        __m128 va = _mm_load_ps(&a[i]);
        __m128 vb = _mm_load_ps(&b[i]);
        __m128 vr = _mm_add_ps(va, vb);
        _mm_store_ps(&result[i], vr);
    }
#else
    for (int i = 0; i < n; i++) {
        result[i] = a[i] + b[i];
    }
#endif
}

// AVX2-based matrix multiply kernel
void matmul_avx2(float* A, float* B, float* C, int M, int N, int K) {
#ifdef __x86_64__
    for (int i = 0; i < M; i++) {
        for (int j = 0; j < N; j += 8) {
            __m256 sum = _mm256_setzero_ps();
            for (int k = 0; k < K; k++) {
                __m256 a = _mm256_broadcast_ss(&A[i * K + k]);
                __m256 b = _mm256_loadu_ps(&B[k * N + j]);
                sum = _mm256_fmadd_ps(a, b, sum);
            }
            _mm256_storeu_ps(&C[i * N + j], sum);
        }
    }
#endif
}

// CRC32 using x86 instruction
unsigned int compute_crc32(const unsigned char* data, size_t len) {
    unsigned int crc = 0xFFFFFFFF;
#ifdef __x86_64__
    for (size_t i = 0; i < len; i++) {
        crc = __builtin_ia32_crc32qi(crc, data[i]);
    }
#else
    // Fallback polynomial CRC
    for (size_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (int j = 0; j < 8; j++) {
            crc = (crc >> 1) ^ (0xEDB88320 & (-(crc & 1)));
        }
    }
#endif
    return ~crc;
}

int main(int argc, char* argv[]) {
    printf("Architecture test program\n");

    // Test vector add
    float a[16] __attribute__((aligned(16)));
    float b[16] __attribute__((aligned(16)));
    float c[16] __attribute__((aligned(16)));

    for (int i = 0; i < 16; i++) {
        a[i] = (float)i;
        b[i] = (float)(i * 2);
    }

    vector_add_sse(a, b, c, 16);

    printf("Result[0] = %f\n", c[0]);
    printf("Result[15] = %f\n", c[15]);

    // Test CRC
    const char* test_data = "Hello Graviton!";
    unsigned int crc = compute_crc32((const unsigned char*)test_data, strlen(test_data));
    printf("CRC32: 0x%08X\n", crc);

    cpu_relax();

    return 0;
}
