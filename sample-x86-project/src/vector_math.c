/**
 * vector_math.c - SIMD-accelerated vector operations
 * Uses SSE on x86, NEON on ARM64, scalar fallback otherwise
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#if defined(__x86_64__) || defined(_M_X64)
  #include <immintrin.h>
#elif defined(__aarch64__)
  #include <arm_neon.h>
#endif

// Add two float arrays
void vector_add(const float *a, const float *b, float *result, int n) {
    int i = 0;

#if defined(__x86_64__) || defined(_M_X64)
    for (; i <= n - 4; i += 4) {
        __m128 va = _mm_loadu_ps(&a[i]);
        __m128 vb = _mm_loadu_ps(&b[i]);
        __m128 vr = _mm_add_ps(va, vb);
        _mm_storeu_ps(&result[i], vr);
    }
#elif defined(__aarch64__)
    for (; i <= n - 4; i += 4) {
        float32x4_t va = vld1q_f32(&a[i]);
        float32x4_t vb = vld1q_f32(&b[i]);
        float32x4_t vr = vaddq_f32(va, vb);
        vst1q_f32(&result[i], vr);
    }
#endif

    // Scalar remainder
    for (; i < n; i++) {
        result[i] = a[i] + b[i];
    }
}

// Multiply two float arrays
void vector_mul(const float *a, const float *b, float *result, int n) {
    int i = 0;

#if defined(__x86_64__) || defined(_M_X64)
    for (; i <= n - 4; i += 4) {
        __m128 va = _mm_loadu_ps(&a[i]);
        __m128 vb = _mm_loadu_ps(&b[i]);
        __m128 vr = _mm_mul_ps(va, vb);
        _mm_storeu_ps(&result[i], vr);
    }
#elif defined(__aarch64__)
    for (; i <= n - 4; i += 4) {
        float32x4_t va = vld1q_f32(&a[i]);
        float32x4_t vb = vld1q_f32(&b[i]);
        float32x4_t vr = vmulq_f32(va, vb);
        vst1q_f32(&result[i], vr);
    }
#endif

    for (; i < n; i++) {
        result[i] = a[i] * b[i];
    }
}

// Dot product
float vector_dot(const float *a, const float *b, int n) {
    float result = 0.0f;
    int i = 0;

#if defined(__x86_64__) || defined(_M_X64)
    __m128 sum = _mm_setzero_ps();
    for (; i <= n - 4; i += 4) {
        __m128 va = _mm_loadu_ps(&a[i]);
        __m128 vb = _mm_loadu_ps(&b[i]);
        __m128 prod = _mm_mul_ps(va, vb);
        sum = _mm_add_ps(sum, prod);
    }
    float tmp[4];
    _mm_storeu_ps(tmp, sum);
    result = tmp[0] + tmp[1] + tmp[2] + tmp[3];
#elif defined(__aarch64__)
    float32x4_t sum = vdupq_n_f32(0.0f);
    for (; i <= n - 4; i += 4) {
        float32x4_t va = vld1q_f32(&a[i]);
        float32x4_t vb = vld1q_f32(&b[i]);
        sum = vmlaq_f32(sum, va, vb);
    }
    result = vaddvq_f32(sum);
#endif

    for (; i < n; i++) {
        result += a[i] * b[i];
    }
    return result;
}

// Find min/max in array
void vector_minmax(const float *data, int n, float *min_val, float *max_val) {
    *min_val = data[0];
    *max_val = data[0];
    int i = 1;

#if defined(__x86_64__) || defined(_M_X64)
    __m128 vmin = _mm_set1_ps(data[0]);
    __m128 vmax = _mm_set1_ps(data[0]);
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
#elif defined(__aarch64__)
    float32x4_t vmin = vdupq_n_f32(data[0]);
    float32x4_t vmax = vdupq_n_f32(data[0]);
    for (i = 0; i <= n - 4; i += 4) {
        float32x4_t v = vld1q_f32(&data[i]);
        vmin = vminq_f32(vmin, v);
        vmax = vmaxq_f32(vmax, v);
    }
    *min_val = vminvq_f32(vmin);
    *max_val = vmaxvq_f32(vmax);
#endif

    for (; i < n; i++) {
        if (data[i] < *min_val) *min_val = data[i];
        if (data[i] > *max_val) *max_val = data[i];
    }
}
