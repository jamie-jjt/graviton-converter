#include <stdio.h>
#include <string.h>
#include <stdint.h>

#ifdef __x86_64__
#include <wmmintrin.h>  // AES-NI intrinsics
#include <emmintrin.h>  // SSE2
#endif

// AES encryption using hardware AES-NI instructions
void aes_encrypt_block(uint8_t* plaintext, uint8_t* ciphertext, uint8_t* key) {
#if defined(__x86_64__) || defined(_M_X64)
    __m128i block = _mm_loadu_si128((__m128i*)plaintext);
    __m128i round_key = _mm_loadu_si128((__m128i*)key);

    // XOR with initial key
    block = _mm_xor_si128(block, round_key);

    // AES rounds (simplified - real impl needs key schedule)
    block = _mm_aesenc_si128(block, round_key);
    block = _mm_aesenc_si128(block, round_key);
    block = _mm_aesenclast_si128(block, round_key);

    _mm_storeu_si128((__m128i*)ciphertext, block);
#else
    // Software AES fallback
    memcpy(ciphertext, plaintext, 16);
    for (int i = 0; i < 16; i++) {
        ciphertext[i] ^= key[i];
    }
#endif
}

// CLMUL-based polynomial multiplication (used in GCM)
void poly_multiply(uint64_t* a, uint64_t* b, uint64_t* result) {
#ifdef __x86_64__
    __m128i va = _mm_loadu_si128((__m128i*)a);
    __m128i vb = _mm_loadu_si128((__m128i*)b);
    __m128i vr = _mm_clmulepi64_si128(va, vb, 0x00);
    _mm_storeu_si128((__m128i*)result, vr);
#else
    // Software carry-less multiply fallback
    result[0] = 0;
    result[1] = 0;
    for (int i = 0; i < 64; i++) {
        if ((a[0] >> i) & 1) {
            result[0] ^= b[0] << i;
            result[1] ^= b[0] >> (64 - i);
        }
    }
#endif
}

// RDRAND - hardware random number generation
int get_hardware_random(uint64_t* value) {
#ifdef __x86_64__
    unsigned char ok;
    __asm__ volatile(
        "rdrand %0; setc %1"
        : "=r" (*value), "=qm" (ok)
    );
    return ok;
#else
    // Fallback to /dev/urandom would go here
    *value = 0;
    return 0;
#endif
}

// CPUID check for feature detection
void check_cpu_features(void) {
#ifdef __x86_64__
    unsigned int eax, ebx, ecx, edx;
    __asm__ volatile(
        "cpuid"
        : "=a"(eax), "=b"(ebx), "=c"(ecx), "=d"(edx)
        : "a"(1)
    );
    printf("SSE2: %s\n", (edx & (1 << 26)) ? "yes" : "no");
    printf("SSE4.2: %s\n", (ecx & (1 << 20)) ? "yes" : "no");
    printf("AES-NI: %s\n", (ecx & (1 << 25)) ? "yes" : "no");
    printf("AVX: %s\n", (ecx & (1 << 28)) ? "yes" : "no");
#else
    printf("Non-x86 platform - use /proc/cpuinfo\n");
#endif
}
