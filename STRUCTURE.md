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
│           │                     #   cost estimate, export report, generate PR
│           ├── IssueList.tsx     # Filterable/searchable issue list with severity badges
│           └── IssueDetail.tsx   # Single issue view - code, suggestions, manual editor,
│                                 #   apply resolution, rollback, ignore
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
│           ├── rules.ts          # Detection rules (10 categories, regex patterns,
│           │                     #   suggestions, auto-fix functions)
│           ├── resolver.ts       # Auto-resolver + manual resolver (applies fixes to files)
│           ├── git-source.ts     # GitHub repo cloner (shallow clone, cleanup)
│           ├── binary-detector.ts    # Detects x86 .so/.dll/.a files, reads ELF headers
│           ├── cicd-scanner.ts       # Scans CI/CD pipelines (Actions, GitLab, Jenkins)
│           ├── infra-scanner.ts      # Scans Terraform/CloudFormation for instance types
│           ├── dependency-analyzer.ts # Deep dependency tree ARM64 compatibility check
│           ├── compatibility-db.ts   # Static DB of 35+ packages with ARM64 status
│           ├── cost-estimator.ts     # AWS instance pricing + savings calculator
│           └── report-generator.ts   # Generates JSON + Markdown migration reports
│
└── test-project/                 # ── SAMPLE x86/x64 PROJECT FOR TESTING ──
    ├── main.c                    # SSE/AVX intrinsics, inline asm, CRC32
    ├── crypto.c                  # AES-NI, CLMUL, RDRAND, CPUID
    ├── simd_ops.c                # SSE4 dot product, PCMPESTRI, POPCNT, BSWAP, MOVNTDQ
    ├── Makefile                  # gcc with -march=haswell -mavx2 -msse4.2
    ├── Dockerfile                # FROM --platform=linux/amd64
    ├── docker-compose.yml        # amd64/ images, x86 JVM flags
    ├── build.sh                  # GOARCH=amd64, gcc -march=skylake
    ├── package.json              # Native npm deps (bcrypt, sharp, sqlite3, grpc, etc.)
    ├── requirements.txt          # tensorflow, torch, numpy, scipy, opencv-python
    ├── jvm.options               # -XX:+UseSSE42, -XX:+UseAVX2, -XX:UseSSE=4
    └── server.js                 # Simple Express app (clean, no issues)
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

## API Endpoints

### Scanning
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/scan` | Start a new scan (body: `{ source: { type, path, branch? } }`) |
| GET | `/api/scan/:id` | Get scan result (poll until status = "completed") |
| GET | `/api/scans` | List all scan summaries |

### Resolution
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/scan/:id/auto-resolve` | Auto-resolve all eligible issues |
| POST | `/api/scan/:id/resolve/:issueId` | Manually resolve with custom code |
| POST | `/api/scan/:id/ignore/:issueId` | Mark issue as ignored |
| POST | `/api/scan/:id/batch-resolve` | Resolve multiple issues at once |
| POST | `/api/scan/:id/rollback/:issueId` | Undo a resolution |

### Analysis & Reporting
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/scan/:id/diff-preview` | Preview auto-resolve changes |
| GET | `/api/scan/:id/report` | Full migration report (JSON) |
| GET | `/api/scan/:id/report/markdown` | Downloadable markdown report |
| GET | `/api/scan/:id/cost-estimate` | AWS cost savings estimate |
| POST | `/api/scan/:id/generate-pr` | Generate migration PR description |

### Progress & Comparison
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/scans/progress` | Overall migration progress across scans |
| GET | `/api/scans/compare/:id1/:id2` | Compare two scan results |

### Compatibility
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/compatibility/:package` | Look up ARM64 support (query: `?ecosystem=npm\|python`) |

---

## Detection Categories

| Category | Severity | Auto-Fix | Scanner |
|----------|----------|----------|---------|
| `intrinsics` | Critical | No | rules.ts |
| `assembly` | Critical | No | rules.ts |
| `binary-file` | Critical | No | binary-detector.ts |
| `docker-image` | Critical | Yes | rules.ts |
| `compiler-flags` | Warning | Yes | rules.ts |
| `library-compatibility` | Warning | No | rules.ts + dependency-analyzer.ts |
| `build-system` | Warning | Yes | rules.ts |
| `runtime-config` | Warning | Yes | rules.ts |
| `cicd-pipeline` | Warning | Partial | cicd-scanner.ts |
| `infrastructure` | Warning | Yes | infra-scanner.ts |
| `architecture-specific-code` | Info | No | rules.ts |
| `package-manager` | Info | Yes | rules.ts |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | React 18 |
| Language | TypeScript 5.3 |
| Styling | Tailwind CSS 3.3 |
| Icons | Lucide React |
| Build Tool | Vite 5 |
| Backend Framework | Express 4 |
| Git Operations | simple-git |
| File Scanning | glob |
| Dev Runner | ts-node-dev |
| Concurrent Dev | concurrently |

---

## Running the Project

```bash
# Install everything
npm run install:all

# Development (both client + server)
npm run dev

# Or separately:
cd server && npm run dev    # API on :3001
cd client && npm run dev    # UI on :5173
```

Open http://localhost:5173 in browser.
