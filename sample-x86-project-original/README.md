# Sample x86 Project

A small C application demonstrating x86-specific code patterns:

- **SSE intrinsics** — vector math operations (add, multiply, dot product, min/max)
- **Inline assembly** — CPUID, RDTSC, POPCNT, BSWAP, BSF, BSR, CRC32, PAUSE, MFENCE
- **x86 compiler flags** — `-march=x86-64 -msse4.2 -mavx2 -mpopcnt`
- **Dockerfile** — pinned to `linux/amd64` platform
- **Python deps** — includes tensorflow (limited ARM64 support)

## Build

```bash
make
./x86_sample
```

## Test with Graviton Converter

```bash
graviton-converter assess ./sample-x86-project
graviton-converter resolve ./sample-x86-project
graviton-converter convert ./sample-x86-project --output ./converted --skip-blockers
```
