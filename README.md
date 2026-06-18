# Graviton Converter 2.0

A web-based tool that converts x86/x64 projects to AWS Graviton (ARM64). Scans code from GitHub repos, local paths, or remote URLs — auto-resolves compatibility issues, rewrites x86 assembly to ARM64, generates sse2neon headers, and validates builds via Docker.

## Quick Start

```bash
# Install all dependencies
npm run install:all

# Terminal 1 - Backend API (port 3001)
cd server
npx ts-node-dev --respawn src/index.ts

# Terminal 2 - Frontend UI (port 5173)
cd client
npx vite
```

Open http://localhost:5173

## What It Does

1. **Scan** — Point it at a GitHub repo, local path, or URL. It detects x86-specific code across 13 categories.
2. **Detect Project** — Identifies language, build system, and missing files (Dockerfile, Makefile, etc.). Generates them with one click.
3. **Auto-Resolve** — One click fixes compiler flags, Docker images, Go targets, JVM flags, instance types, and rewrites x86 assembly files to ARM64.
4. **sse2neon** — Downloads the full [sse2neon.h](https://github.com/DLTcollab/sse2neon) (~500KB, covers all SSE/SSE2/SSE3/SSE4 functions) so SSE intrinsic calls work on ARM64 unchanged.
5. **Whole-File Rewrite** — Files with CPUID, RDTSC, POPCNT/BSWAP assembly get entirely rewritten using `__builtin_*` and ARM system registers.
6. **Generate Missing Files** — Detects missing Dockerfile/Makefile/go.mod/etc. and generates them based on the detected language and build system.
7. **Verify** — Build on ARM64 via Docker Buildx to confirm it compiles and runs.

## Features

| Feature | Description |
|---------|-------------|
| Multi-source scanning | GitHub, local filesystem, remote URLs |
| Auto-resolver | Fixes compiler flags, Docker, Go builds, JVM, infra |
| Whole-file rewriter | Rewrites deeply x86 files (cpuid, rdtsc, bitops) to ARM64 |
| sse2neon download | Downloads full sse2neon.h from GitHub (all SSE functions) |
| Generate missing files | Auto-create Dockerfile, Makefile, go.mod, etc. based on detected language |
| Project detection | Identifies language, build system, and what's missing |
| Manual resolution UI | Code editor with suggestions and confidence scores |
| Resolve All (Best Match) | Applies highest-confidence fix to every issue |
| Dismiss SSE Usage | Bulk-ignore intrinsic usage issues (work via sse2neon) |
| No Change Needed mark | Flags lines that don't need changes with optional override |
| Diff preview | See what auto-resolve will change before applying |
| Batch resolve | Fix multiple issues at once |
| Rollback | Undo any resolution |
| Export report | Download markdown migration report |
| Generate PR | Create migration branch description |
| Cost estimator | Calculate Graviton savings from infra files |
| Scan comparison | Compare two scans to track progress |
| Migration progress | Overall readiness percentage |
| Compatibility DB | 35+ packages with ARM64 support status |
| CI/CD scanning | GitHub Actions, GitLab CI, Jenkins, CircleCI |
| Infrastructure scanning | Terraform, CloudFormation instance types |
| Binary detection | ELF header analysis for .so/.dll/.a files |

## Testing with Docker

After resolving, validate the conversion builds and runs on ARM64:

```bash
# One-time setup: create an ARM64 builder
docker buildx create --name arm64builder --platform linux/arm64 --use

# Build the project targeting ARM64
docker buildx build --builder arm64builder --platform linux/arm64 --no-cache --load -t graviton-test .

# Run the ARM64 binary (uses QEMU emulation on x86 host)
docker run --platform linux/arm64 graviton-test
```

If you get TLS/certificate errors with the custom builder, use the default builder:
```bash
docker build --platform linux/arm64 --no-cache -t graviton-test .
docker run --platform linux/arm64 graviton-test
```

### Troubleshooting Docker

| Error | Fix |
|-------|-----|
| `certificate signed by unknown authority` | Disconnect VPN, or use default builder instead of arm64builder |
| `./a.out: no such file` | The CMD in Dockerfile doesn't match the Makefile's output binary. Check with `docker run graviton-test ls` |
| `bad value for -march` | The build is still using x86 gcc. Add `--no-cache` to force fresh ARM64 image pull |
| `sse2neon.h: No such file` | Re-run auto-resolve to regenerate sse2neon.h, or add `-I.` to CFLAGS |

## Architecture

```
graviton-converter/
├── client/                   # React + TypeScript + Tailwind (port 5173)
│   └── src/
│       ├── components/       # Header, SourceInput, Dashboard, IssueList, IssueDetail
│       ├── api.ts            # All fetch calls to backend
│       └── types.ts          # Shared TypeScript types
├── server/                   # Express + TypeScript (port 3001)
│   └── src/
│       ├── index.ts          # 20+ API routes
│       └── engine/           # Core scanning & resolution
│           ├── scanner.ts        # Orchestrates all sub-scanners
│           ├── rules.ts          # Detection rules + auto-fix functions
│           ├── resolver.ts       # Line-by-line fixes + sse2neon generation
│           ├── file-rewriter.ts  # Whole-file ARM64 rewrites
│           ├── binary-detector.ts
│           ├── cicd-scanner.ts
│           ├── infra-scanner.ts
│           ├── dependency-analyzer.ts
│           ├── compatibility-db.ts
│           ├── cost-estimator.ts
│           └── report-generator.ts
├── sample-x86-project/       # Test project (pure x86 C code)
├── sample-x86-project-original/  # Backup of original x86 state
└── test-project/             # Additional test fixtures
```

## Detection Categories

| Category | Severity | Auto-Fix | Method |
|----------|----------|----------|--------|
| Intrinsics (header) | Critical | ✅ → sse2neon.h | Header swap + generate |
| Intrinsics (usage) | Info | N/A (works via sse2neon) | No change needed |
| Assembly | Critical | ✅ Whole-file rewrite | ARM64 equivalents |
| Binary files | Critical | ❌ | Manual recompile |
| Docker images | Critical | ✅ | Remove platform constraint |
| Compiler flags | Warning | ✅ + adds -I. | ARM64 flags |
| Libraries | Warning | ❌ | Compatibility DB lookup |
| Build system | Warning | ✅ | GOARCH swap |
| Runtime config | Warning | ✅ | Remove x86 JVM flags |
| CI/CD pipeline | Warning | Partial | Runner swap |
| Infrastructure | Warning | ✅ | Instance type mapping |
| Arch-specific code | Info | ❌ | Manual review |
| Package manager | Info | ✅ | Regenerate lockfile |

## Tech Stack

- Frontend: React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite
- Backend: Node.js, Express, TypeScript, simple-git, glob
- Testing: Docker Buildx with QEMU ARM64 emulation
