/**
 * vector_math.c - SIMD-accelerated vector operations
 * Uses SSE intrinsics for 4-wide float operations
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <immintrin.h>

// Add two float arrays using SSE
void vector_add(const float *a, const float *b, float *result, int n) {
    int i;
    for (i = 0; i <= n - 4; i += 4) {
        __m128 va = _mm_loadu_ps(&a[i]);
        __m128 vb = _mm_loadu_ps(&b[i]);
        __m128 vr = _mm_add_ps(va, vb);
        _mm_storeu_ps(&result[i], vr);
    }
    for (; i < n; i++) {
        result[i] = a[i] + b[i];
    }
}

// Multiply two float arrays using SSE
void vector_mul(const float *a, const float *b, float *result, int n) {
    int i;
    for (i = 0; i <= n - 4; i += 4) {
        __m128 va = _mm_loadu_ps(&a[i]);
        __m128 vb = _mm_loadu_ps(&b[i]);
        __m128 vr = _mm_mul_ps(va, vb);
        _mm_storeu_ps(&result[i], vr);
    }
    for (; i < n; i++) {
        result[i] = a[i] * b[i];
    }
}

// Dot product using SSE
float vector_dot(const float *a, const float *b, int n) {
    __m128 sum = _mm_setzero_ps();
    int i;
    for (i = 0; i <= n - 4; i += 4) {
        __m128 va = _mm_loadu_ps(&a[i]);
        __m128 vb = _mm_loadu_ps(&b[i]);
        __m128 prod = _mm_mul_ps(va, vb);
        sum = _mm_add_ps(sum, prod);
    }
    float tmp[4];
    _mm_storeu_ps(tmp, sum);
    float result = tmp[0] + tmp[1] + tmp[2] + tmp[3];
    for (; i < n; i++) {
        result += a[i] * b[i];
    }
    return result;
}

// Find min/max in array using SSE
void vector_minmax(const float *data, int n, float *min_val, float *max_val) {
    __m128 vmin = _mm_set1_ps(data[0]);
    __m128 vmax = _mm_set1_ps(data[0]);

    int i;
    for (i = 0; i <= n - 4; i += 4) {
        __m128 v = _mm_loadu_ps(&data[i]);
        vmin = _mm_min_ps(vmin, v);
        vmax = _mm_max_ps(vmax, v);
    }

    float mins[4], maxs[4];
    _mm_storeu_ps(mins, vmin);
    _mm_storeu_ps(maxs, vmax);

    *min_val = mins[0];
    *max_val = maxs[0];
    for (int j = 1; j < 4; j++) {
        if (mins[j] < *min_val) *min_val = mins[j];
        if (maxs[j] > *max_val) *max_val = maxs[j];
    }
    for (; i < n; i++) {
        if (data[i] < *min_val) *min_val = data[i];
        if (data[i] > *max_val) *max_val = data[i];
    }
}
