/**
 * Static database of known package ARM64 compatibility status.
 * Used by dependency-analyzer to quickly assess ARM compatibility.
 */

export type CompatStatus = 'full' | 'partial' | 'none' | 'unknown';

export interface CompatEntry {
  name: string;
  arm64Support: CompatStatus;
  minVersion?: string; // Minimum version with ARM64 support
  notes: string;
  lastUpdated: string;
}

// NPM packages with native bindings
export const npmCompatDb: Record<string, CompatEntry> = {
  'sharp': {
    name: 'sharp',
    arm64Support: 'full',
    minVersion: '0.29.0',
    notes: 'Full ARM64 support with pre-built binaries since v0.29.0. Uses libvips which has NEON optimizations.',
    lastUpdated: '2024-01-15',
  },
  'bcrypt': {
    name: 'bcrypt',
    arm64Support: 'full',
    minVersion: '5.1.0',
    notes: 'ARM64 pre-built binaries available. Compiles from source on older versions.',
    lastUpdated: '2024-01-15',
  },
  'canvas': {
    name: 'canvas',
    arm64Support: 'full',
    minVersion: '2.9.0',
    notes: 'Requires system Cairo library compiled for ARM64. Pre-built binaries available for Linux arm64.',
    lastUpdated: '2024-01-15',
  },
  'sqlite3': {
    name: 'sqlite3',
    arm64Support: 'full',
    minVersion: '5.1.0',
    notes: 'Pre-built binaries for ARM64 Linux. Falls back to source compilation.',
    lastUpdated: '2024-01-15',
  },
  'grpc': {
    name: 'grpc',
    arm64Support: 'full',
    minVersion: '1.24.0',
    notes: 'Deprecated in favor of @grpc/grpc-js (pure JS). Native grpc package has ARM64 support.',
    lastUpdated: '2024-01-15',
  },
  '@grpc/grpc-js': {
    name: '@grpc/grpc-js',
    arm64Support: 'full',
    notes: 'Pure JavaScript implementation, no native bindings needed.',
    lastUpdated: '2024-01-15',
  },
  'node-sass': {
    name: 'node-sass',
    arm64Support: 'partial',
    minVersion: '7.0.0',
    notes: 'Deprecated. Migrate to sass (Dart Sass) which is pure JS. ARM64 binaries may be missing for older versions.',
    lastUpdated: '2024-01-15',
  },
  'libxmljs': {
    name: 'libxmljs',
    arm64Support: 'full',
    minVersion: '0.19.10',
    notes: 'Compiles from source on ARM64. Ensure libxml2-dev is installed.',
    lastUpdated: '2024-01-15',
  },
  'leveldown': {
    name: 'leveldown',
    arm64Support: 'full',
    minVersion: '6.0.0',
    notes: 'Pre-built binaries available for ARM64 Linux via prebuild-install.',
    lastUpdated: '2024-01-15',
  },
  'snappy': {
    name: 'snappy',
    arm64Support: 'full',
    minVersion: '7.0.0',
    notes: 'ARM64 pre-built binaries available. Good performance on Graviton.',
    lastUpdated: '2024-01-15',
  },
  'sodium-native': {
    name: 'sodium-native',
    arm64Support: 'full',
    minVersion: '3.4.0',
    notes: 'Full ARM64 support. libsodium has ARM optimizations.',
    lastUpdated: '2024-01-15',
  },
  'argon2': {
    name: 'argon2',
    arm64Support: 'full',
    minVersion: '0.30.0',
    notes: 'Compiles from source with ARM64 optimizations.',
    lastUpdated: '2024-01-15',
  },
  'cpu-features': {
    name: 'cpu-features',
    arm64Support: 'full',
    minVersion: '0.0.4',
    notes: 'Detects ARM64 CPU features including NEON, CRC32, AES.',
    lastUpdated: '2024-01-15',
  },
  'farmhash': {
    name: 'farmhash',
    arm64Support: 'full',
    minVersion: '3.2.0',
    notes: 'ARM64 support available. Uses architecture-specific optimizations.',
    lastUpdated: '2024-01-15',
  },
  'node-pty': {
    name: 'node-pty',
    arm64Support: 'full',
    minVersion: '0.11.0',
    notes: 'ARM64 pre-built binaries included.',
    lastUpdated: '2024-01-15',
  },
  'serialport': {
    name: 'serialport',
    arm64Support: 'full',
    minVersion: '10.0.0',
    notes: 'Full ARM64 Linux support via pre-built binaries.',
    lastUpdated: '2024-01-15',
  },
  'robotjs': {
    name: 'robotjs',
    arm64Support: 'none',
    notes: 'No ARM64 support. Consider alternatives like nutjs for ARM64.',
    lastUpdated: '2024-01-15',
  },
  'mapnik': {
    name: 'mapnik',
    arm64Support: 'partial',
    notes: 'Can be compiled from source for ARM64 but no pre-built binaries.',
    lastUpdated: '2024-01-15',
  },
  'deasync': {
    name: 'deasync',
    arm64Support: 'full',
    minVersion: '0.1.28',
    notes: 'ARM64 binaries available for recent Node.js versions.',
    lastUpdated: '2024-01-15',
  },
  'ffi-napi': {
    name: 'ffi-napi',
    arm64Support: 'full',
    minVersion: '4.0.0',
    notes: 'ARM64 support via libffi. Ensure libffi-dev is installed.',
    lastUpdated: '2024-01-15',
  },
};

// Python packages
export const pythonCompatDb: Record<string, CompatEntry> = {
  'tensorflow': {
    name: 'tensorflow',
    arm64Support: 'full',
    minVersion: '2.10.0',
    notes: 'Official ARM64 wheels available. AWS provides optimized builds for Graviton.',
    lastUpdated: '2024-01-15',
  },
  'torch': {
    name: 'torch',
    arm64Support: 'full',
    minVersion: '1.13.0',
    notes: 'PyTorch provides ARM64 wheels. CPU builds work well on Graviton.',
    lastUpdated: '2024-01-15',
  },
  'pytorch': {
    name: 'pytorch',
    arm64Support: 'full',
    minVersion: '1.13.0',
    notes: 'Same as torch package. ARM64 wheels available.',
    lastUpdated: '2024-01-15',
  },
  'numpy': {
    name: 'numpy',
    arm64Support: 'full',
    minVersion: '1.21.0',
    notes: 'Full ARM64 support with NEON optimizations. Excellent performance on Graviton.',
    lastUpdated: '2024-01-15',
  },
  'scipy': {
    name: 'scipy',
    arm64Support: 'full',
    minVersion: '1.7.0',
    notes: 'ARM64 wheels available. Uses OpenBLAS with ARM optimizations.',
    lastUpdated: '2024-01-15',
  },
  'pandas': {
    name: 'pandas',
    arm64Support: 'full',
    minVersion: '1.3.0',
    notes: 'Full ARM64 support via numpy dependency.',
    lastUpdated: '2024-01-15',
  },
  'scikit-learn': {
    name: 'scikit-learn',
    arm64Support: 'full',
    minVersion: '1.0.0',
    notes: 'ARM64 wheels available. Benefits from OpenBLAS ARM optimizations.',
    lastUpdated: '2024-01-15',
  },
  'opencv-python': {
    name: 'opencv-python',
    arm64Support: 'full',
    minVersion: '4.5.4',
    notes: 'ARM64 wheels available on PyPI. NEON optimizations enabled.',
    lastUpdated: '2024-01-15',
  },
  'pillow': {
    name: 'pillow',
    arm64Support: 'full',
    minVersion: '8.3.0',
    notes: 'Full ARM64 support with pre-built wheels.',
    lastUpdated: '2024-01-15',
  },
  'psycopg2': {
    name: 'psycopg2',
    arm64Support: 'full',
    minVersion: '2.9.0',
    notes: 'Compiles from source. Use psycopg2-binary for pre-built ARM64 wheels.',
    lastUpdated: '2024-01-15',
  },
  'mysqlclient': {
    name: 'mysqlclient',
    arm64Support: 'full',
    minVersion: '2.1.0',
    notes: 'Compiles from source on ARM64. Ensure libmysqlclient-dev is installed.',
    lastUpdated: '2024-01-15',
  },
  'lxml': {
    name: 'lxml',
    arm64Support: 'full',
    minVersion: '4.7.0',
    notes: 'ARM64 wheels available. Requires libxml2 and libxslt system libraries.',
    lastUpdated: '2024-01-15',
  },
  'pycrypto': {
    name: 'pycrypto',
    arm64Support: 'none',
    notes: 'Deprecated and unmaintained. Migrate to pycryptodome which has ARM64 support.',
    lastUpdated: '2024-01-15',
  },
  'cryptography': {
    name: 'cryptography',
    arm64Support: 'full',
    minVersion: '3.4.0',
    notes: 'Full ARM64 support with pre-built wheels. Uses Rust backend.',
    lastUpdated: '2024-01-15',
  },
  'grpcio': {
    name: 'grpcio',
    arm64Support: 'full',
    minVersion: '1.49.0',
    notes: 'ARM64 wheels available for Linux.',
    lastUpdated: '2024-01-15',
  },
  'pyarrow': {
    name: 'pyarrow',
    arm64Support: 'full',
    minVersion: '10.0.0',
    notes: 'ARM64 wheels available. Good performance on Graviton.',
    lastUpdated: '2024-01-15',
  },
};

/**
 * Look up a package in the compatibility database.
 */
export function lookupPackage(name: string, ecosystem: 'npm' | 'python'): CompatEntry | undefined {
  if (ecosystem === 'npm') {
    return npmCompatDb[name];
  }
  return pythonCompatDb[name];
}

/**
 * Get all packages with a specific compatibility status.
 */
export function getPackagesByStatus(status: CompatStatus, ecosystem: 'npm' | 'python'): CompatEntry[] {
  const db = ecosystem === 'npm' ? npmCompatDb : pythonCompatDb;
  return Object.values(db).filter(entry => entry.arm64Support === status);
}
