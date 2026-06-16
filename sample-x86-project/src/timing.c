/**
 * timing.c - High-resolution timing using x86 RDTSC
 * Uses inline assembly to read the timestamp counter
 */

#include <stdint.h>
#include <stdio.h>

// Read timestamp counter (x86 specific)
static inline uint64_t rdtsc(void) {
    uint32_t lo, hi;
    __asm__ volatile (
        "rdtsc"
        : "=a"(lo), "=d"(hi)
    );
    return ((uint64_t)hi << 32) | lo;
}

// Serializing read (waits for all prior instructions to complete)
static inline uint64_t rdtscp(void) {
    uint32_t lo, hi, aux;
    __asm__ volatile (
        "rdtscp"
        : "=a"(lo), "=d"(hi), "=c"(aux)
    );
    return ((uint64_t)hi << 32) | lo;
}

// CPU pause for spin-wait loops
static inline void cpu_relax(void) {
    __asm__ volatile("pause" ::: "memory");
}

// Memory fence
static inline void memory_barrier(void) {
    __asm__ volatile("mfence" ::: "memory");
}

// Measure execution time of a function
typedef void (*bench_fn)(void);

double measure_cycles(bench_fn fn, int iterations) {
    uint64_t start, end;
    uint64_t total = 0;

    // Warmup
    for (int i = 0; i < 10; i++) {
        fn();
    }

    // Measure
    for (int i = 0; i < iterations; i++) {
        memory_barrier();
        start = rdtscp();
        fn();
        end = rdtscp();
        memory_barrier();
        total += (end - start);
    }

    return (double)total / iterations;
}

void print_timing(const char *label, bench_fn fn) {
    double cycles = measure_cycles(fn, 1000);
    printf("%s: %.1f cycles\n", label, cycles);
}
