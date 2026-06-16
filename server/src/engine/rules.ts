import { IssueCategory, Severity, ResolutionSuggestion } from '../types';

export interface DetectionRule {
  id: string;
  category: IssueCategory;
  severity: Severity;
  title: string;
  description: string;
  filePatterns: RegExp[];
  contentPatterns: RegExp[];
  autoResolvable: boolean;
  getSuggestions: (match: string, file: string) => ResolutionSuggestion[];
  getAutoFix?: (match: string, file: string) => string;
}

export const detectionRules: DetectionRule[] = [
  // x86/x64 Intrinsics
  {
    id: 'intrinsics-sse',
    category: 'intrinsics',
    severity: 'critical',
    title: 'x86 SSE/AVX Intrinsics Detected',
    description: 'SSE/AVX intrinsics are x86-specific and must be replaced with NEON equivalents for Graviton.',
    filePatterns: [/\.(c|cpp|cc|cxx|h|hpp)$/i],
    contentPatterns: [
      /_mm_(set|load|store|add|sub|mul|div|and|or|xor|cmp|shuffle|blend|extract|insert|min|max|sqrt|rsqrt|rcp|hadd|hsub|movemask|cvt|cast|stream|prefetch|pause|clflush|fence|mfence|sfence|lfence)\w*\s*\(/,
      /_mm256_\w+\s*\(/,
      /_mm512_\w+\s*\(/,
      /#include\s*<(x|e|p|t|s|n|w|a|i)mmintrin\.h>/,
      /#include\s*<immintrin\.h>/,
    ],
    autoResolvable: false,
    getSuggestions: (match: string) => [
      {
        id: 'sse-to-neon-lib',
        title: 'Use sse2neon translation library',
        description: 'sse2neon is a header-only library that provides NEON implementations of SSE intrinsics. Add #include "sse2neon.h" and link the library.',
        code: '#include "sse2neon.h" // Drop-in replacement for SSE intrinsics on ARM',
        confidence: 85,
        source: 'AWS Graviton Getting Started Guide',
      },
      {
        id: 'sse-to-neon-manual',
        title: 'Manually convert to ARM NEON intrinsics',
        description: 'Replace each SSE intrinsic with its ARM NEON equivalent. This provides best performance but requires deep knowledge of both ISAs.',
        code: '#include <arm_neon.h>\n// Example: _mm_add_ps(a, b) → vaddq_f32(a, b)',
        confidence: 70,
        source: 'ARM NEON Programmer Guide',
      },
      {
        id: 'sse-conditional-compile',
        title: 'Use conditional compilation',
        description: 'Use preprocessor macros to provide both x86 and ARM implementations.',
        code: '#if defined(__x86_64__) || defined(_M_X64)\n  #include <immintrin.h>\n  // x86 implementation\n#elif defined(__aarch64__)\n  #include <arm_neon.h>\n  // ARM NEON implementation\n#endif',
        confidence: 90,
        source: 'Best Practice',
      },
    ],
  },
  // Compiler Flags
  {
    id: 'compiler-flags-x86',
    category: 'compiler-flags',
    severity: 'warning',
    title: 'x86-specific Compiler Flags',
    description: 'Compiler flags targeting x86 architecture need to be updated for ARM64/Graviton.',
    filePatterns: [/(Makefile|CMakeLists\.txt|\.cmake|configure\.ac|\.pro|meson\.build)$/i],
    contentPatterns: [
      /-m(sse|sse2|sse3|ssse3|sse4|sse4\.1|sse4\.2|avx|avx2|avx512|fma|bmi|bmi2|popcnt|lzcnt|f16c|aes|sha|pclmul)\b/,
      /-march=(native|x86-64|i686|haswell|broadwell|skylake|znver[1-4])\b/,
      /-mtune=(generic|intel|haswell|broadwell|skylake|znver[1-4])\b/,
    ],
    autoResolvable: true,
    getSuggestions: (match: string) => [
      {
        id: 'graviton-flags',
        title: 'Replace with Graviton-optimized flags',
        description: 'Use ARM64-specific compiler flags optimized for Graviton processors.',
        code: '-march=armv8.2-a+crypto+fp16+rcpc+dotprod -mtune=neoverse-n1',
        confidence: 92,
        source: 'AWS Graviton Performance Tuning Guide',
      },
      {
        id: 'portable-flags',
        title: 'Use portable flags with architecture detection',
        description: 'Use CMake or Makefile conditionals to set flags per architecture.',
        code: 'ifeq ($(shell uname -m),aarch64)\n  CFLAGS += -march=armv8.2-a+crypto+fp16+rcpc+dotprod\nelse\n  CFLAGS += -march=native\nendif',
        confidence: 88,
        source: 'AWS Graviton Getting Started Guide',
      },
    ],
    getAutoFix: (match: string) => {
      return match
        .replace(/-march=(native|x86-64|i686|haswell|broadwell|skylake|znver[1-4])\b/g, '-march=armv8.2-a+crypto+fp16+rcpc+dotprod')
        .replace(/-mtune=(generic|intel|haswell|broadwell|skylake|znver[1-4])\b/g, '-mtune=neoverse-n1')
        .replace(/-m(sse|sse2|sse3|ssse3|sse4\.2|sse4\.1|sse4|avx2|avx512|avx|fma|bmi2|bmi|popcnt|lzcnt|f16c|aes|sha|pclmul)\b/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    },
  },
  // Docker Images
  {
    id: 'docker-x86-image',
    category: 'docker-image',
    severity: 'critical',
    title: 'x86-specific Docker Base Image',
    description: 'Docker image uses an x86-specific base that won\'t run on Graviton. Use multi-arch images.',
    filePatterns: [/(Dockerfile|\.dockerfile|docker-compose\.(yml|yaml))$/i],
    contentPatterns: [
      /FROM\s+(amd64|x86_64)\//,
      /--platform=linux\/amd64/,
      /FROM\s+\S*windows\S*/,
    ],
    autoResolvable: true,
    getSuggestions: () => [
      {
        id: 'multi-arch-image',
        title: 'Use multi-architecture base image',
        description: 'Replace x86-specific images with multi-arch variants that support both amd64 and arm64.',
        code: 'FROM --platform=$BUILDPLATFORM node:20-slim\n# Or use: FROM public.ecr.aws/docker/library/node:20-slim',
        confidence: 95,
        source: 'AWS Graviton Container Guide',
      },
      {
        id: 'graviton-ecr-image',
        title: 'Use AWS ECR public multi-arch images',
        description: 'AWS ECR Public Gallery provides multi-arch images optimized for Graviton.',
        code: 'FROM public.ecr.aws/docker/library/python:3.11-slim',
        confidence: 90,
        source: 'AWS ECR Public Gallery',
      },
    ],
    getAutoFix: (match: string) => {
      return match
        .replace(/FROM\s+amd64\//g, 'FROM ')
        .replace(/--platform=linux\/amd64\s*/g, '')
        .replace(/FROM\s+--platform=\$BUILDPLATFORM\s*/g, 'FROM ');
    },
  },
  // Assembly Code
  {
    id: 'inline-assembly-x86',
    category: 'assembly',
    severity: 'critical',
    title: 'x86 Inline Assembly Detected',
    description: 'Inline assembly using x86 instructions must be rewritten for ARM64.',
    filePatterns: [/\.(c|cpp|cc|cxx|h|hpp|s|S|asm)$/i],
    contentPatterns: [
      /__asm__\s*(volatile\s*)?\(/,
      /\basm\s*(volatile\s*)?\(/,
      /__asm\s*\{/,
    ],
    autoResolvable: false,
    getSuggestions: () => [
      {
        id: 'asm-to-c',
        title: 'Replace with portable C/C++ code',
        description: 'Modern compilers generate efficient code. Replace inline assembly with equivalent C/C++ that the compiler can optimize for any architecture.',
        confidence: 75,
        source: 'Best Practice',
      },
      {
        id: 'asm-conditional',
        title: 'Add ARM64 assembly alongside x86',
        description: 'Use preprocessor guards to provide both x86 and ARM64 assembly implementations.',
        code: '#if defined(__x86_64__)\n  __asm__ volatile("pause");\n#elif defined(__aarch64__)\n  __asm__ volatile("yield");\n#endif',
        confidence: 80,
        source: 'AWS Graviton Porting Guide',
      },
    ],
  },
  // Library Compatibility
  {
    id: 'native-npm-packages',
    category: 'library-compatibility',
    severity: 'warning',
    title: 'Native NPM Package May Lack ARM64 Support',
    description: 'This npm package includes native bindings that may not have pre-built ARM64 binaries.',
    filePatterns: [/package\.json$/i],
    contentPatterns: [
      /"(bcrypt|sharp|canvas|sqlite3|grpc|node-sass|libxmljs|mapnik|farmhash|leveldown|snappy|sodium-native|argon2|cpu-features|microtime|nsfw|node-expat|node-hid|usb|serialport|robotjs|ffi-napi|ref-napi|node-pty|deasync)"/,
    ],
    autoResolvable: false,
    getSuggestions: (match: string) => {
      const pkg = match.match(/"(\w[\w-]*)"/)?.[1] || 'package';
      return [
        {
          id: `${pkg}-check-version`,
          title: `Check latest version of ${pkg} for ARM64 support`,
          description: `Many packages have added ARM64 pre-built binaries in recent versions. Update to the latest version and check release notes.`,
          code: `npm info ${pkg} dist-tags.latest\nnpm update ${pkg}`,
          confidence: 70,
          source: 'npm Registry',
        },
        {
          id: `${pkg}-build-from-source`,
          title: 'Build from source on ARM64',
          description: 'If no pre-built binary exists, ensure build tools are available to compile from source.',
          code: `# Ensure build essentials are installed\napt-get install -y build-essential python3\nnpm rebuild ${pkg}`,
          confidence: 60,
          source: 'Node.js Native Modules Guide',
        },
      ];
    },
  },
  // Build System - Go
  {
    id: 'go-build-x86',
    category: 'build-system',
    severity: 'warning',
    title: 'Go build targeting x86 architecture',
    description: 'Go build scripts or configurations explicitly target x86/amd64. Update for multi-arch support.',
    filePatterns: [/(Makefile|\.sh|\.bash|go\.mod|\.goreleaser\.(yml|yaml))$/i],
    contentPatterns: [
      /GOARCH=amd64\b/,
      /GOOS=windows\b/,
      /CGO_ENABLED=\d.*GOARCH=amd64/,
    ],
    autoResolvable: true,
    getSuggestions: () => [
      {
        id: 'go-multi-arch',
        title: 'Build for multiple architectures',
        description: 'Update build scripts to support both amd64 and arm64 targets.',
        code: '# Build for both architectures\nGOOS=linux GOARCH=arm64 go build -o app-arm64\nGOOS=linux GOARCH=amd64 go build -o app-amd64',
        confidence: 95,
        source: 'Go Documentation',
      },
    ],
    getAutoFix: (match: string) => {
      return match.replace(/GOARCH=amd64/g, 'GOARCH=arm64');
    },
  },
  // Python native extensions
  {
    id: 'python-native-ext',
    category: 'library-compatibility',
    severity: 'warning',
    title: 'Python Package with Potential ARM64 Compatibility Issue',
    description: 'Some Python packages with C extensions may have issues on ARM64.',
    filePatterns: [/(requirements\.txt|setup\.py|setup\.cfg|pyproject\.toml|Pipfile)$/i],
    contentPatterns: [
      /\b(tensorflow|torch|pytorch|numpy|scipy|pandas|scikit-learn|opencv-python|pillow|psycopg2|mysqlclient|lxml|pycrypto|cryptography)\b/i,
    ],
    autoResolvable: false,
    getSuggestions: (match: string) => {
      const pkg = match.match(/\b(tensorflow|torch|pytorch|numpy|scipy|pandas|scikit-learn|opencv-python|pillow|psycopg2|mysqlclient|lxml|pycrypto|cryptography)\b/i)?.[1] || 'package';
      return [
        {
          id: `${pkg}-graviton-wheel`,
          title: `Check for ARM64 wheel availability`,
          description: `Most popular Python packages now provide ARM64 (aarch64) wheels. Verify availability on PyPI.`,
          code: `pip install --platform manylinux2014_aarch64 --only-binary=:all: --dry-run ${pkg}`,
          confidence: 80,
          source: 'PyPI',
        },
        {
          id: `${pkg}-build-deps`,
          title: 'Install build dependencies for source compilation',
          description: 'If no wheel is available, ensure system dependencies for building from source are present.',
          code: `# For Debian/Ubuntu on Graviton\napt-get install -y python3-dev build-essential libffi-dev`,
          confidence: 65,
          source: 'AWS Graviton Python Guide',
        },
      ];
    },
  },
  // Architecture-specific code patterns
  {
    id: 'arch-specific-ifdef',
    category: 'architecture-specific-code',
    severity: 'info',
    title: 'Architecture-specific Preprocessor Directive',
    description: 'Code contains architecture-specific preprocessor guards. Ensure ARM64 path exists.',
    filePatterns: [/\.(c|cpp|cc|cxx|h|hpp)$/i],
    contentPatterns: [
      /#if\s*(defined\s*\(\s*(__x86_64__|_M_X64|__i386__|_M_IX86|__amd64__)\s*\)|__x86_64__|_M_X64)/,
      /#ifdef\s+(__x86_64__|_M_X64|__i386__|_M_IX86|__amd64__)/,
    ],
    autoResolvable: false,
    getSuggestions: () => [
      {
        id: 'add-arm64-path',
        title: 'Add ARM64 code path',
        description: 'Add an #elif or #else branch for __aarch64__ to provide ARM64 implementation.',
        code: '#if defined(__x86_64__) || defined(_M_X64)\n  // x86_64 implementation\n#elif defined(__aarch64__)\n  // ARM64/Graviton implementation\n#else\n  #error "Unsupported architecture"\n#endif',
        confidence: 85,
        source: 'Best Practice',
      },
    ],
  },
  // Runtime configuration
  {
    id: 'java-jvm-x86-flags',
    category: 'runtime-config',
    severity: 'warning',
    title: 'JVM flags may need Graviton optimization',
    description: 'JVM configuration may benefit from Graviton-specific tuning.',
    filePatterns: [/(\.sh|\.bash|\.cmd|\.bat|jvm\.options|application\.(properties|yml|yaml)|JAVA_OPTS)$/i],
    contentPatterns: [
      /-XX:\+Use(SSE|AVX|AES|SHA|CRC32)\w*/,
      /-XX:UseSSE=\d/,
      /-Xss\d+[km]/,
    ],
    autoResolvable: true,
    getSuggestions: () => [
      {
        id: 'graviton-jvm-opts',
        title: 'Use Graviton-optimized JVM flags',
        description: 'Graviton processors benefit from specific JVM tuning parameters.',
        code: '-XX:+UseNUMA -XX:+UseTransparentHugePages -XX:+UseParallelGC\n# For Graviton 3: -XX:+UseLSE (Large System Extensions)',
        confidence: 88,
        source: 'AWS Graviton Java Best Practices',
      },
    ],
    getAutoFix: (match: string) => {
      return match
        .replace(/-XX:\+Use(SSE|AVX)\w*/g, '')
        .replace(/-XX:UseSSE=\d/g, '');
    },
  },
  // Package manager lock files with x86 binaries
  {
    id: 'lockfile-x86-binaries',
    category: 'package-manager',
    severity: 'info',
    title: 'Lock file may reference x86-only binaries',
    description: 'Package lock files may contain references to platform-specific binaries that need regeneration on ARM64.',
    filePatterns: [/(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Gemfile\.lock|Cargo\.lock|poetry\.lock)$/i],
    contentPatterns: [
      /linux-x64|win32-x64|darwin-x64|x86_64-unknown-linux/,
      /"os":\s*\["(?!linux|darwin)/,
    ],
    autoResolvable: true,
    getSuggestions: () => [
      {
        id: 'regenerate-lockfile',
        title: 'Regenerate lock file on ARM64',
        description: 'Delete and regenerate the lock file on an ARM64 machine to get correct binary references.',
        code: '# On Graviton instance:\nrm package-lock.json  # or yarn.lock / pnpm-lock.yaml\nnpm install  # or yarn / pnpm install',
        confidence: 95,
        source: 'Best Practice',
      },
    ],
    getAutoFix: () => '# Lock file should be regenerated on ARM64 target platform',
  },
];
