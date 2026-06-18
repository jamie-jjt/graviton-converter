# Graviton Converter 2.0 — Project Structure Reference

```
graviton-converter/
├── package.json                  # Root workspace - concurrently runs client + server
├── README.md                     # Project overview and quick start
├── STRUCTURE.md                  # This file
├── .gitignore                    # Ignores node_modules, dist, .vscode, .env
│
├── client/                       # ── FRONTEND (React + TypeScript + Vite) ──
│   ├── package.json              # React, Tailwind, Lucide Icons, Vite
│   ├── tsconfig.json             # TypeScript config (ESNext, React JSX)
│   ├── tsconfig.node.json        # TypeScript config for Vite config file
│   ├── vite.config.ts            # Vite dev server (port 5173), proxies /api → :3001
│   ├── tailwind.config.js        # Tailwind theme (graviton colors, AWS brand, fonts)
│   ├── postcss.config.js         # PostCSS with Tailwind + Autoprefixer
│   ├── index.html                # HTML entry point, loads Google Fonts
│   │
│   ├── public/
│   │   └── graviton.svg          # App favicon/logo (AWS-styled hexagon)
│   │
│   └── src/
│       ├── main.tsx              # React root render
│       ├── App.tsx               # Main app - view routing (home/dashboard/issues/detail)
│       ├── index.css             # Global styles, Tailwind layers, component classes
│       ├── types.ts              # All TypeScript interfaces (shared with server concepts)
│       ├── api.ts                # API client - all fetch calls to backend endpoints
│       │
│       └── components/
│           ├── Header.tsx        # Top nav bar - logo, back button, "New Scan" button
│           ├── SourceInput.tsx   # Home view - source type selector, path input, scan trigger
│           ├── Dashboard.tsx     # Post-scan view - readiness score, stats, categories,
│           │                     #   cost estimate, export report, generate PR,
│           │                     #   dismiss SSE usage button
│           ├── IssueList.tsx     # Filterable/searchable issue list with severity badges,
│           │                     #   "No Change" marks, Resolve All (Best Match) + confirm
│           └── IssueDetail.tsx   # Single issue view - code, suggestions, manual editor,
│                                 #   apply resolution, rollback, ignore,
│                                 #   "No Change Needed" panel with optional override
│
├── server/                       # ── BACKEND (Express + TypeScript) ──
│   ├── package.json              # Express, simple-git, glob, semver, ts-node-dev
│   ├── tsconfig.json             # TypeScript config (CommonJS, ES2020)
│   │
│   └── src/
│       ├── index.ts              # Express app - all API routes (20+ endpoints)
│       ├── types.ts              # All TypeScript interfaces and type definitions
│       │
│       ├── utils/
│       │   └── id.ts             # Unique ID generator (timestamp + random)
│       │
│       └── engine/               # ── CORE SCANNING & RESOLUTION ENGINE ──
│           ├── scanner.ts        # Main scanner - orchestrates all sub-scanners
│           ├── rules.ts          # Detection rules (13 categories, regex patterns,
│           │                     #   suggestions, auto-fix functions)
│           ├── resolver.ts       # Auto-resolver + manual resolver (applies fixes to files)
│           │                     #   Downloads full sse2neon.h from GitHub when intrinsics detected
│           │                     #   Triggers whole-file rewrites for assembly files
│           ├── file-rewriter.ts  # Whole-file ARM64 rewrites for deeply x86 files
│           │                     #   Patterns: cpu_detect (cpuid→mrs), timing (rdtsc→cntvct),
│           │                     #   bitops (popcnt/bswap/bsf/bsr → __builtin_*)
│           ├── project-detector.ts   # Detects language, build system, missing files
│           │                     #   Generates Dockerfile/Makefile/go.mod/etc.
│           │                     #   Reads Makefile TARGET for correct CMD in Dockerfile
│           ├── git-source.ts     # GitHub repo cloner (shallow clone, cleanup)
│           ├── binary-detector.ts    # Detects x86 .so/.dll/.a files, reads ELF headers
│           ├── cicd-scanner.ts       # Scans CI/CD pipelines (Actions, GitLab, Jenkins)
│           ├── infra-scanner.ts      # Scans Terraform/CloudFormation for instance types
│           ├── dependency-analyzer.ts # Deep dependency tree ARM64 compatibility check
│           ├── compatibility-db.ts   # Static DB of 35+ packages with ARM64 status
│           ├── cost-estimator.ts     # AWS instance pricing + savings calculator
│           └── report-generator.ts   # Generates JSON + Markdown migration reports
│
├── sample-x86-project/           # ── SAMPLE x86 PROJECT FOR TESTING ──
│   ├── src/main.c                # Entry point with vector/bit ops calls
│   ├── src/vector_math.c         # SSE intrinsics (loadu, add, mul, min, max)
│   ├── src/cpu_detect.c          # CPUID inline assembly
│   ├── src/timing.c              # RDTSC/RDTSCP inline assembly
│   ├── src/bitops.c              # POPCNT/BSWAP/BSF/BSR inline assembly
│   ├── Makefile                  # gcc with -march=haswell -msse4.2 -mavx2
│   ├── Dockerfile                # FROM --platform=linux/amd64
│   └── requirements.txt          # Python deps for testing
│
├── sample-x86-project-original/  # ── CLEAN BACKUP (never modified) ──
│   └── (same structure as above)
│
└── test-project/                 # ── ADDITIONAL TEST FIXTURES ──
    ├── main.c, crypto.c, simd_ops.c
    ├── Makefile, Dockerfile, docker-compose.yml
    ├── build.sh, jvm.options
    ├── package.json, requirements.txt
    └── server.js
```

---

## How to Run

```bash
# Terminal 1 - Backend API
cd server
npx ts-node-dev --respawn src/index.ts
# → http://localhost:3001

# Terminal 2 - Frontend UI
cd client
npx vite
# → http://localhost:5173
```

---

## Data Flow

```
┌─────────────┐         ┌──────────────┐         ┌─────────────────┐
│   Browser   │  HTTP   │  Vite Proxy  │  HTTP   │  Express API    │
│  (React UI) │ ──────► │  :5173/api/* │ ──────► │  :3001/api/*    │
│             │ ◄────── │              │ ◄────── │                 │
└─────────────┘         └──────────────┘         └────────┬────────┘
                                                          │
                                                          ▼
                                                 ┌────────────────┐
                                                 │  Scan Engine   │
                                                 ├────────────────┤
                                                 │ • Rule Scanner │
                                                 │ • Binary Det.  │
                                                 │ • CI/CD Scan   │
                                                 │ • Infra Scan   │
                                                 │ • Dep Analyzer │
                                                 └────────┬───────┘
                                                          │
                                                          ▼
                                                 ┌────────────────┐
                                                 │  File System   │
                                                 │  or Git Clone  │
                                                 └────────────────┘
```

---

## Resolution Flow

```
Auto-Resolve triggers (in order):
1. Line-by-line fixes (compiler flags → ARM64, Docker → remove amd64, includes → sse2neon)
2. Full sse2neon.h downloaded from GitHub (covers ALL SSE/SSE2/SSE3/SSE4 functions)
   - Fallback: generates minimal stub if download fails
3. -I. added to CFLAGS so gcc finds sse2neon.h from subdirectories
4. Whole-file rewrites for deeply x86 files:
   - cpu_detect: cpuid → mrs midr_el1
   - timing: rdtsc → cntvct_el0, pause → yield, mfence → dmb ish
   - bitops: popcnt → __builtin_popcount, bswap → __builtin_bswap32, bsf → __builtin_ctz

Project Detection:
- Identifies language (C, C++, Go, Python, Rust, Java, JS/TS)
- Detects build system (Make, CMake, npm, Cargo, Go Modules, Gradle, Maven)
- Lists missing files needed for ARM64 validation
- Generates missing files (Dockerfile, Makefile, etc.) with correct settings
- Reads Makefile TARGET/BINEXT to set correct CMD in generated Dockerfiles
```

---

## API Endpoints

### Scanning
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/scan` | Start a new scan |
| GET | `/api/scan/:id` | Get scan result |
| GET | `/api/scans` | List all scans |

### Resolution
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/scan/:id/auto-resolve` | Auto-resolve all (line fixes + file rewrites) |
| POST | `/api/scan/:id/resolve/:issueId` | Manual resolve with custom code |
| POST | `/api/scan/:id/ignore/:issueId` | Mark as ignored |
| POST | `/api/scan/:id/batch-resolve` | Resolve multiple at once |
| POST | `/api/scan/:id/rollback/:issueId` | Undo a resolution |

### Analysis & Reporting
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/scan/:id/diff-preview` | Preview changes |
| GET | `/api/scan/:id/report` | JSON report |
| GET | `/api/scan/:id/report/markdown` | Markdown report |
| GET | `/api/scan/:id/cost-estimate` | Cost savings |
| POST | `/api/scan/:id/generate-pr` | PR description |

### Progress & Comparison
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/scans/progress` | Overall progress |
| GET | `/api/scans/compare/:id1/:id2` | Compare two scans |

### Compatibility
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/compatibility/:package` | ARM64 support lookup |

### Project Detection
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/scan/:id/project-info` | Detect language, build system, missing files |
| POST | `/api/scan/:id/generate-dockerfile` | Generate Dockerfile for detected language |
| POST | `/api/scan/:id/generate-file` | Generate any missing file (Makefile, go.mod, etc.) |

---

## Detection Categories

| Category | Severity | Auto-Fix | Method |
|----------|----------|----------|--------|
| `intrinsics` (header) | Critical | ✅ | → sse2neon.h swap + generate header |
| `intrinsics` (usage) | Info | N/A | Works unchanged via sse2neon |
| `assembly` | Critical | ✅ | Whole-file rewrite to ARM64 |
| `binary-file` | Critical | ❌ | Manual recompile needed |
| `docker-image` | Critical | ✅ | Remove --platform=linux/amd64 |
| `compiler-flags` | Warning | ✅ | ARM64 flags + -I. |
| `library-compatibility` | Warning | ❌ | Compat DB suggestions |
| `build-system` | Warning | ✅ | GOARCH=arm64 |
| `runtime-config` | Warning | ✅ | Remove x86 JVM flags |
| `cicd-pipeline` | Warning | Partial | Runner swap suggestions |
| `infrastructure` | Warning | ✅ | m5→m7g, c5→c7g, t3→t4g |
| `architecture-specific-code` | Info | ❌ | Manual review |
| `package-manager` | Info | ✅ | Regenerate lockfile |

---

## Docker ARM64 Validation

```bash
# One-time setup
docker buildx create --name arm64builder --platform linux/arm64 --use

# Build on ARM64
docker buildx build --builder arm64builder --platform linux/arm64 --no-cache --load -t graviton-test .

# Run
docker run --platform linux/arm64 graviton-test
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite |
| Backend | Express 4, TypeScript, simple-git, glob |
| Dev | ts-node-dev, concurrently |
| Testing | Docker Buildx, QEMU ARM64 emulation |
