# Graviton Converter 2.0

A professional web-based tool for converting x86/x64 projects to AWS Graviton (ARM64). Scan code from GitHub repos, local paths, or remote URLs and get automated resolution with detailed migration guidance.

## Features

- **Multi-Source Scanning** — Import from GitHub, local filesystem, or remote URLs
- **Auto-Resolver** — Automatically fixes common x86 patterns (compiler flags, Docker images, build configs)
- **Manual Resolution UI** — Edit and apply fixes directly in the browser with a code editor
- **Smart Suggestions** — AI-powered resolution suggestions with confidence scoring and source attribution
- **Category Detection** — 10+ rule categories: intrinsics, assembly, Docker, libraries, compiler flags, and more
- **Professional Dashboard** — Readiness score, category breakdown, severity filtering

## Quick Start

```bash
# Install all dependencies
npm run install:all

# Run both client and server in development mode
npm run dev
```

Or manually:

```bash
# Terminal 1 - Backend API (port 3001)
cd server
npm run dev

# Terminal 2 - Frontend (port 5173)
cd client
npm run dev
```

Then open http://localhost:5173

## Architecture

```
graviton-converter/
├── client/          # React + TypeScript + Tailwind CSS frontend
│   └── src/
│       ├── components/   # UI components (Header, SourceInput, Dashboard, IssueList, IssueDetail)
│       ├── api.ts        # API client
│       └── types.ts      # Shared TypeScript types
├── server/          # Express.js backend
│   └── src/
│       ├── engine/       # Core scanning & resolution engine
│       │   ├── rules.ts      # Detection rules (SSE, AVX, Docker, Go, Python, etc.)
│       │   ├── scanner.ts    # File scanner
│       │   ├── resolver.ts   # Auto & manual resolver
│       │   └── git-source.ts # GitHub clone handler
│       ├── types.ts      # Shared types
│       └── index.ts      # Express API routes
└── package.json     # Root workspace scripts
```

## Detection Categories

| Category | Severity | Auto-Resolvable |
|----------|----------|-----------------|
| x86 Intrinsics (SSE/AVX) | Critical | No |
| Inline Assembly | Critical | No |
| Docker x86 Images | Critical | Yes |
| Compiler Flags (-march, -mtune) | Warning | Yes |
| Native NPM Packages | Warning | No |
| Python Native Extensions | Warning | No |
| Go Build Targets | Warning | Yes |
| JVM x86 Flags | Warning | Yes |
| Architecture #ifdef Guards | Info | No |
| Lock File x86 Binaries | Info | Yes |

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite
- **Backend**: Node.js, Express, TypeScript, simple-git, glob
