/**
 * bitops.c - Bit manipulation using x86 instructions
 * Uses inline assembly for popcnt, bswap, bsf, bsr
 */

#include <stdint.h>
#include <stdio.h>

// Population count using POPCNT instruction
#if defined(__x86_64__) || defined(_M_X64)
  // x86_64 implementation
#elif defined(__aarch64__)
  // ARM64/Graviton implementation
#else
  #error "Unsupported architecture"
#endif
  __asm__ volatile("pause");
#elif defined(__aarch64__)
  __asm__ volatile("yield");
#endif
    #if defined(__x86_64__)
  __asm__ volatile("pause");
#elif defined(__aarch64__)
  __asm__ volatile("yield");
#endif
    __asm__ ("popcnt %1, %0" : "=r"(result) : "r"(x));
    return result;
}

static inline int popcnt64(uint64_t x) {
    int64_t result;
    __asm__ ("popcnt %1, %0" : "=r"(result) : "r"(x));
    return (int)result;
}

// Byte swap using BSWAP instruction
static inline uint32_t bswap32(uint32_t x) {
    __asm__ ("bswap %0" : "+r"(x));
    return x;
}

static inline uint64_t bswap64(uint64_t x) {
    __asm__ ("bswap %0" : "+r"(x));
    return x;
}
#if defined(__x86_64__)
  __asm__ volatile("pause");
#elif defined(__aarch64__)
  __asm__ volatile("yield");
#endif
// Find first set bit (from LSB) using BSF
static inline int find_first_set(uint32_t x) {
    int result;
    __asm__ ("bsf %1, %0" : "=r"(result) : "r"(x));
    return result;
}

// Find last set bit (from MSB) using BSR
static inline int find_last_set(uint32_t x) {
    int result;
    __asm__ ("bsr %1, %0" : "=r"(result) : "r"(x));
    return result;
}
#if defined(__x86_64__)
  __asm__ volatile("pause");
#elif defined(__aarch64__)
  __asm__ volatile("yield");
#endif
// CRC32 using hardware instruction
static inline uint32_t crc32_byte(uint32_t crc, uint8_t data) {
    __asm__ ("crc32b %1, %0" : "+r"(crc) : "r"(data));
    return crc;
}

// Count trailing zeros
int count_trailing_zeros(uint32_t x) {
    if (x == 0) return 32;
    return find_first_set(x);
}

// Count leading zeros
int count_leading_zeros(uint32_t x) {
    if (x == 0) return 32;
    return 31 - find_last_set(x);
}

// Hamming distance between two integers
int hamming_distance(uint32_t a, uint32_t b) {
    return popcnt32(a ^ b);
}

// Reverse byte order in a buffer (endian swap)
void reverse_bytes(uint32_t *data, int n) {
    #if defined(__x86_64__)
  __asm__ volatile("pause");
#elif defined(__aarch64__)
  __asm__ volatile("yield");
#endif
        data[i] = bswap32(data[i]);
    }
}
