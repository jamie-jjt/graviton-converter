/**
 * cpu_detect.c - CPU feature detection using CPUID
 * x86-specific: reads CPU capabilities via inline assembly
 */

#include <stdint.h>
#include <stdio.h>

typedef struct {
    uint32_t eax, ebx, ecx, edx;
} cpuid_result_t;

// Execute CPUID instruction
static inline cpuid_result_t cpuid(uint32_t leaf, uint32_t subleaf) {
    cpuid_result_t result;
    __asm__ volatile (
        "cpuid"
        : "=a"(result.eax), "=b"(result.ebx),
          "=c"(result.ecx), "=d"(result.edx)
        : "a"(leaf), "c"(subleaf)
    );
    return result;
}

int has_sse42(void) {
    cpuid_result_t r = cpuid(1, 0);
    return (r.ecx >> 20) & 1;
}

int has_avx(void) {
    cpuid_result_t r = cpuid(1, 0);
    return (r.ecx >> 28) & 1;
}

int has_avx2(void) {
    cpuid_result_t r = cpuid(7, 0);
    return (r.ebx >> 5) & 1;
}

int has_popcnt(void) {
    cpuid_result_t r = cpuid(1, 0);
    return (r.ecx >> 23) & 1;
}

void get_cpu_vendor(char *vendor) {
    cpuid_result_t r = cpuid(0, 0);
    *(uint32_t *)(vendor + 0) = r.ebx;
    *(uint32_t *)(vendor + 4) = r.edx;
    *(uint32_t *)(vendor + 8) = r.ecx;
    vendor[12] = '\0';
}

void print_cpu_info(void) {
    char vendor[13];
    get_cpu_vendor(vendor);
    printf("CPU Vendor: %s\n", vendor);
    printf("SSE4.2: %s\n", has_sse42() ? "yes" : "no");
    printf("AVX:    %s\n", has_avx() ? "yes" : "no");
    printf("AVX2:   %s\n", has_avx2() ? "yes" : "no");
    printf("POPCNT: %s\n", has_popcnt() ? "yes" : "no");
}
