/**
 * main.c - Sample x86 application
 * Demonstrates various x86-specific features
 */

#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>

// Forward declarations
extern void print_cpu_info(void);
extern void vector_add(const float *a, const float *b, float *result, int n);
extern float vector_dot(const float *a, const float *b, int n);
extern void vector_minmax(const float *data, int n, float *min_val, float *max_val);
extern int hamming_distance(uint32_t a, uint32_t b);
extern int count_trailing_zeros(uint32_t x);
extern int count_leading_zeros(uint32_t x);

#define N 1024

int main(void) {
    printf("=== x86 Sample Application ===\n\n");

    // CPU detection
    print_cpu_info();
    printf("\n");

    // Vector operations
    float *a = (float *)aligned_alloc(16, N * sizeof(float));
    float *b = (float *)aligned_alloc(16, N * sizeof(float));
    float *c = (float *)aligned_alloc(16, N * sizeof(float));

    for (int i = 0; i < N; i++) {
        a[i] = (float)i * 0.5f;
        b[i] = (float)(N - i) * 0.3f;
    }

    vector_add(a, b, c, N);
    printf("vector_add: c[0]=%.2f, c[100]=%.2f, c[1023]=%.2f\n", c[0], c[100], c[1023]);

    float dot = vector_dot(a, b, N);
    printf("vector_dot: %.2f\n", dot);

    float min_v, max_v;
    vector_minmax(a, N, &min_v, &max_v);
    printf("vector_minmax: min=%.2f, max=%.2f\n", min_v, max_v);

    printf("\n");

    // Bit operations
    printf("hamming_distance(0xFF, 0x0F) = %d\n", hamming_distance(0xFF, 0x0F));
    printf("count_trailing_zeros(0x80) = %d\n", count_trailing_zeros(0x80));
    printf("count_leading_zeros(0x01) = %d\n", count_leading_zeros(0x01));

    free(a);
    free(b);
    free(c);

    printf("\nDone.\n");
    return 0;
}
