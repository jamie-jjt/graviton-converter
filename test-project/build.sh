#!/bin/bash
# Build script for x86_64 target

export CC=gcc
export CXX=g++
export GOARCH=amd64
export GOOS=linux
export CGO_ENABLED=1

echo "Building for x86_64..."

# Compile C sources with x86 optimizations
gcc -O3 -march=skylake -mtune=intel -mavx2 -mfma -msse4.2 -maes \
    -o myapp main.c crypto.c simd_ops.c -lpthread -lm

# Build Go service
cd go-service
GOARCH=amd64 go build -o ../service ./cmd/main.go
cd ..

echo "Build complete!"
