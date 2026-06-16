import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { ConversionIssue } from '../types';
import { v4Generator } from '../utils/id';

/**
 * Binary file extensions that are typically x86-compiled.
 */
const BINARY_EXTENSIONS = ['.so', '.dll', '.a', '.dylib', '.lib', '.obj', '.o'];

/**
 * ELF magic bytes: 0x7f 'E' 'L' 'F'
 */
const ELF_MAGIC = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);

/**
 * ELF machine type offset (byte 18-19 in ELF header)
 * EM_386 = 3, EM_X86_64 = 62
 */
const ELF_MACHINE_OFFSET = 18;
const EM_386 = 3;
const EM_X86_64 = 62;

/**
 * Detects pre-compiled binary files that are x86-only.
 * Checks ELF headers when possible, falls back to extension-based detection.
 */
export class BinaryDetector {
  private scanPath: string;

  constructor(scanPath: string) {
    this.scanPath = scanPath;
  }

  async detect(): Promise<ConversionIssue[]> {
    const issues: ConversionIssue[] = [];
    const patterns = BINARY_EXTENSIONS.map(ext => `**/*${ext}`);

    const files = await glob(patterns, {
      cwd: this.scanPath,
      absolute: true,
      nodir: true,
      ignore: ['**/node_modules/**', '**/.git/**'],
    });

    for (const file of files) {
      try {
        const issue = await this.analyzeFile(file);
        if (issue) {
          issues.push(issue);
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return issues;
  }

  private async analyzeFile(filePath: string): Promise<ConversionIssue | null> {
    const relativePath = path.relative(this.scanPath, filePath);
    const ext = path.extname(filePath).toLowerCase();

    // Try to read ELF header for .so, .o, .a files on Linux
    if (['.so', '.o', '.a'].includes(ext)) {
      const elfResult = await this.checkElfHeader(filePath);
      if (elfResult === 'x86') {
        return this.createIssue(relativePath, 'x86 ELF binary detected via header analysis');
      } else if (elfResult === 'arm64') {
        // Already ARM64, no issue
        return null;
      }
      // If we can't determine from header, fall through to extension-based detection
    }

    // Extension-based detection for non-ELF or unreadable files
    return this.createIssue(relativePath, `Pre-compiled binary file (${ext}) may be x86-only`);
  }

  private async checkElfHeader(filePath: string): Promise<'x86' | 'arm64' | 'unknown'> {
    try {
      const fd = fs.openSync(filePath, 'r');
      const header = Buffer.alloc(20);
      fs.readSync(fd, header, 0, 20, 0);
      fs.closeSync(fd);

      // Check ELF magic
      if (!header.subarray(0, 4).equals(ELF_MAGIC)) {
        return 'unknown';
      }

      // Read machine type (little-endian by default for x86)
      const machine = header.readUInt16LE(ELF_MACHINE_OFFSET);

      if (machine === EM_386 || machine === EM_X86_64) {
        return 'x86';
      } else if (machine === 183) {
        // EM_AARCH64 = 183
        return 'arm64';
      }

      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private createIssue(file: string, detail: string): ConversionIssue {
    return {
      id: v4Generator(),
      file,
      category: 'binary-file',
      severity: 'critical',
      status: 'unresolved',
      title: 'Pre-compiled x86 Binary Detected',
      description: `${detail}. This binary will not run on ARM64/Graviton processors. It must be recompiled for ARM64 or replaced with a multi-architecture version.`,
      autoResolvable: false,
      suggestions: [
        {
          id: 'recompile-arm64',
          title: 'Recompile for ARM64',
          description: 'Rebuild this binary from source targeting aarch64/ARM64 architecture.',
          code: '# Example: cross-compile for ARM64\naarch64-linux-gnu-gcc -o output.o -c source.c\n# Or build on a Graviton instance directly',
          confidence: 85,
          source: 'AWS Graviton Getting Started Guide',
        },
        {
          id: 'multi-arch-binary',
          title: 'Provide multi-architecture binaries',
          description: 'Build both x86_64 and arm64 variants and select at runtime.',
          code: '# Build both architectures\nmake ARCH=x86_64\nmake ARCH=aarch64\n# Use architecture detection at runtime',
          confidence: 75,
          source: 'Best Practice',
        },
        {
          id: 'replace-with-package',
          title: 'Replace with package manager dependency',
          description: 'If this binary comes from a library, install it via the system package manager which provides ARM64 versions.',
          confidence: 70,
          source: 'Best Practice',
        },
      ],
    };
  }
}
