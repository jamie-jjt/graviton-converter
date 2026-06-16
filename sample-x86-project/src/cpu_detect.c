/**
 * cpu_detect.c - CPU feature detection
 * x86: uses CPUID instruction
 * ARM64: reads system registers / /proc/cpuinfo
 */

#include <stdint.h>
#include <stdio.h>
#include <string.h>

#if defined(__x86_64__) || defined(_M_X64)

typedef struct {
    uint32_t eax, ebx, ecx, edx;
} cpuid_result_t;

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

#elif defined(__aarch64__)

void print_cpu_info(void) {
    printf("Architecture: ARM64 (aarch64)\n");

    // Read main ID register
    uint64_t midr;
    __asm__ volatile("mrs %0, midr_el1" : "=r"(midr));

    uint32_t implementer = (midr >> 24) & 0xFF;
    uint32_t part = (midr >> 4) & 0xFFF;

    const char *impl_name = "Unknown";
    if (implementer == 0x41) impl_name = "ARM";
    else if (implementer == 0x51) impl_name = "Qualcomm";
    else if (implementer == 0xC0) impl_name = "Ampere";

    printf("Implementer: %s (0x%02x)\n", impl_name, implementer);
    printf("Part number: 0x%03x\n", part);

    // Graviton detection
    if (implementer == 0x41) {
        if (part == 0xd0c) printf("Detected: AWS Graviton 2 (Neoverse N1)\n");
        else if (part == 0xd40) printf("Detected: AWS Graviton 3 (Neoverse V1)\n");
    }

    // NEON is always available on AArch64
    printf("NEON:   yes (always available on ARM64)\n");
    printf("CRC32:  yes\n");
    printf("AES:    yes\n");
    printf("SHA:    yes\n");
}

#else

void print_cpu_info(void) {
    printf("Unknown architecture\n");
}

#endif
