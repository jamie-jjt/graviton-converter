import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export interface ProjectInfo {
  languages: LanguageInfo[];
  buildSystem: string | null;
  hasDockerfile: boolean;
  hasMakefile: boolean;
  hasPackageJson: boolean;
  hasRequirements: boolean;
  hasCMakeLists: boolean;
  hasGoMod: boolean;
  hasCargoToml: boolean;
  missingForBuild: string[];
  suggestedDockerfile: string | null;
}

export interface LanguageInfo {
  name: string;
  fileCount: number;
  extensions: string[];
}

const LANGUAGE_MAP: Record<string, { name: string; extensions: string[] }> = {
  c: { name: 'C', extensions: ['.c', '.h'] },
  cpp: { name: 'C++', extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hxx'] },
  go: { name: 'Go', extensions: ['.go'] },
  python: { name: 'Python', extensions: ['.py'] },
  javascript: { name: 'JavaScript', extensions: ['.js', '.mjs', '.cjs'] },
  typescript: { name: 'TypeScript', extensions: ['.ts', '.tsx'] },
  rust: { name: 'Rust', extensions: ['.rs'] },
  java: { name: 'Java', extensions: ['.java'] },
  csharp: { name: 'C#', extensions: ['.cs'] },
};

/**
 * Detects project language, build system, and what's missing for ARM64 validation.
 */
export class ProjectDetector {
  private scanPath: string;

  constructor(scanPath: string) {
    this.scanPath = scanPath;
  }

  async detect(): Promise<ProjectInfo> {
    const files = await glob('**/*', {
      cwd: this.scanPath,
      absolute: false,
      nodir: true,
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/target/**'],
    });

    const languages = this.detectLanguages(files);
    const buildSystem = this.detectBuildSystem(files);
    const hasDockerfile = files.some(f => /^Dockerfile/i.test(path.basename(f)));
    const hasMakefile = files.some(f => /^Makefile$/i.test(path.basename(f)));
    const hasPackageJson = files.some(f => path.basename(f) === 'package.json');
    const hasRequirements = files.some(f => /^requirements.*\.txt$/i.test(path.basename(f)));
    const hasCMakeLists = files.some(f => path.basename(f) === 'CMakeLists.txt');
    const hasGoMod = files.some(f => path.basename(f) === 'go.mod');
    const hasCargoToml = files.some(f => path.basename(f) === 'Cargo.toml');

    const missingForBuild = this.detectMissing(languages, {
      hasDockerfile, hasMakefile, hasPackageJson, hasRequirements, hasCMakeLists, hasGoMod, hasCargoToml
    });

    const primaryLang = languages.length > 0 ? languages[0].name : null;
    const suggestedDockerfile = !hasDockerfile && primaryLang
      ? this.generateDockerfile(primaryLang, { hasMakefile, hasPackageJson, hasRequirements, hasCMakeLists, hasGoMod, hasCargoToml })
      : null;

    return {
      languages,
      buildSystem,
      hasDockerfile,
      hasMakefile,
      hasPackageJson,
      hasRequirements,
      hasCMakeLists,
      hasGoMod,
      hasCargoToml,
      missingForBuild,
      suggestedDockerfile,
    };
  }

  private detectLanguages(files: string[]): LanguageInfo[] {
    const counts: Record<string, { name: string; count: number; extensions: Set<string> }> = {};

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      for (const [key, lang] of Object.entries(LANGUAGE_MAP)) {
        if (lang.extensions.includes(ext)) {
          if (!counts[key]) {
            counts[key] = { name: lang.name, count: 0, extensions: new Set() };
          }
          counts[key].count++;
          counts[key].extensions.add(ext);
        }
      }
    }

    return Object.values(counts)
      .map(c => ({ name: c.name, fileCount: c.count, extensions: [...c.extensions] }))
      .sort((a, b) => b.fileCount - a.fileCount);
  }

  private detectBuildSystem(files: string[]): string | null {
    const basenames = files.map(f => path.basename(f));
    if (basenames.includes('CMakeLists.txt')) return 'CMake';
    if (basenames.includes('Makefile') || basenames.includes('makefile')) return 'Make';
    if (basenames.includes('Cargo.toml')) return 'Cargo (Rust)';
    if (basenames.includes('go.mod')) return 'Go Modules';
    if (basenames.includes('package.json')) return 'npm/Node.js';
    if (basenames.some(f => /^build\.gradle/.test(f))) return 'Gradle';
    if (basenames.includes('pom.xml')) return 'Maven';
    if (basenames.includes('setup.py') || basenames.includes('pyproject.toml')) return 'Python setuptools/pip';
    if (basenames.includes('meson.build')) return 'Meson';
    return null;
  }

  private detectMissing(
    languages: LanguageInfo[],
    has: Record<string, boolean>
  ): string[] {
    const missing: string[] = [];

    if (!has.hasDockerfile) {
      missing.push('Dockerfile');
    }

    const primaryLang = languages.length > 0 ? languages[0].name : '';

    if (['C', 'C++'].includes(primaryLang) && !has.hasMakefile && !has.hasCMakeLists) {
      missing.push('Makefile');
    }
    if (primaryLang === 'Go' && !has.hasGoMod) {
      missing.push('go.mod');
    }
    if (primaryLang === 'Rust' && !has.hasCargoToml) {
      missing.push('Cargo.toml');
    }
    if (primaryLang === 'Python' && !has.hasRequirements) {
      missing.push('requirements.txt');
    }
    if (['JavaScript', 'TypeScript'].includes(primaryLang) && !has.hasPackageJson) {
      missing.push('package.json');
    }

    return missing;
  }

  private generateDockerfile(
    language: string,
    has: Record<string, boolean>
  ): string {
    switch (language) {
      case 'C':
      case 'C++':
        if (has.hasCMakeLists) {
          return [
            'FROM ubuntu:22.04',
            'RUN apt-get update && apt-get install -y gcc g++ make cmake && rm -rf /var/lib/apt/lists/*',
            'WORKDIR /app',
            'COPY . .',
            'RUN mkdir -p build && cd build && cmake .. && make',
            'CMD ["./build/main"]',
          ].join('\n');
        }
        // Read Makefile to find the target binary name
        const target = this.getMakefileTarget();
        return [
          'FROM ubuntu:22.04',
          'RUN apt-get update && apt-get install -y gcc make && rm -rf /var/lib/apt/lists/*',
          'WORKDIR /app',
          'COPY . .',
          'RUN make',
          `CMD ["./${target}"]`,
        ].join('\n');

      case 'Go':
        return [
          'FROM golang:1.21',
          'WORKDIR /app',
          'COPY go.mod go.sum ./',
          'RUN go mod download',
          'COPY . .',
          'RUN go build -o app .',
          'CMD ["./app"]',
        ].join('\n');

      case 'Python':
        return [
          'FROM python:3.11-slim',
          'WORKDIR /app',
          'COPY requirements*.txt ./',
          'RUN pip install --no-cache-dir -r requirements.txt',
          'COPY . .',
          'CMD ["python", "main.py"]',
        ].join('\n');

      case 'JavaScript':
      case 'TypeScript':
        return [
          'FROM node:20-slim',
          'WORKDIR /app',
          'COPY package*.json ./',
          'RUN npm install',
          'COPY . .',
          'CMD ["node", "index.js"]',
        ].join('\n');

      case 'Rust':
        return [
          'FROM rust:1.75',
          'WORKDIR /app',
          'COPY . .',
          'RUN cargo build --release',
          'CMD ["./target/release/app"]',
        ].join('\n');

      case 'Java':
        return [
          'FROM eclipse-temurin:21-jdk',
          'WORKDIR /app',
          'COPY . .',
          'RUN ./gradlew build || mvn package',
          'CMD ["java", "-jar", "app.jar"]',
        ].join('\n');

      default:
        return [
          'FROM ubuntu:22.04',
          'WORKDIR /app',
          'COPY . .',
          'CMD ["/bin/bash"]',
        ].join('\n');
    }
  }

  /**
   * Write the suggested Dockerfile to the project.
   */
  writeDockerfile(content: string): boolean {
    try {
      const dockerfilePath = path.join(this.scanPath, 'Dockerfile');
      if (fs.existsSync(dockerfilePath)) return false;
      fs.writeFileSync(dockerfilePath, content, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate content for any missing file based on language and build system.
   */
  generateMissingFile(fileName: string, languages: LanguageInfo[]): string | null {
    const primaryLang = languages.length > 0 ? languages[0].name : '';
    const sourceFiles = this.getSourceFilesList(languages);

    switch (fileName) {
      case 'Dockerfile':
        return this.generateDockerfile(primaryLang, {
          hasMakefile: true, hasPackageJson: primaryLang === 'JavaScript' || primaryLang === 'TypeScript',
          hasRequirements: primaryLang === 'Python', hasCMakeLists: false,
          hasGoMod: primaryLang === 'Go', hasCargoToml: primaryLang === 'Rust',
        });

      case 'Makefile':
        return this.generateMakefile(primaryLang, sourceFiles);

      case 'go.mod':
        return this.generateGoMod();

      case 'Cargo.toml':
        return this.generateCargoToml();

      case 'requirements.txt':
        return this.generateRequirements();

      case 'package.json':
        return this.generatePackageJson();

      default:
        return null;
    }
  }

  /**
   * Write any generated file to the project.
   */
  writeFile(fileName: string, content: string): boolean {
    try {
      const filePath = path.join(this.scanPath, fileName);
      if (fs.existsSync(filePath)) return false;
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  private getMakefileTarget(): string {
    try {
      const makefilePath = path.join(this.scanPath, 'Makefile');
      if (!fs.existsSync(makefilePath)) return 'a.out';
      const content = fs.readFileSync(makefilePath, 'utf-8');
      
      // Look for TARGET = something or first target name
      const targetMatch = content.match(/^TARGET\s*[:?]?=\s*(\S+)/m);
      if (targetMatch) return targetMatch[1];
      
      // Look for BINEXT pattern (like the complex project)
      const binextMatch = content.match(/^BINEXT\s*=\s*(\S+)/m);
      const firstTarget = content.match(/^all:\s*(\S+)/m);
      if (firstTarget && binextMatch) return `${firstTarget[1]}.${binextMatch[1]}`;
      if (firstTarget) return firstTarget[1];
      
      return 'a.out';
    } catch {
      return 'a.out';
    }
  }

  private getSourceFilesList(languages: LanguageInfo[]): string[] {
    try {
      const files = fs.readdirSync(this.scanPath, { recursive: true }) as string[];
      const primaryLang = languages[0];
      if (!primaryLang) return [];
      return files.filter(f => {
        const ext = path.extname(String(f)).toLowerCase();
        return primaryLang.extensions.includes(ext);
      }).map(f => String(f));
    } catch {
      return [];
    }
  }

  private generateMakefile(language: string, sourceFiles: string[]): string {
    if (language === 'C' || language === 'C++') {
      const cc = language === 'C++' ? 'g++' : 'gcc';
      const ext = language === 'C++' ? '.cpp' : '.c';
      const srcs = sourceFiles.length > 0
        ? sourceFiles.filter(f => f.endsWith(ext)).join(' \\\n          ')
        : `$(wildcard *.${ext.slice(1)}) $(wildcard **/*${ext})`;
      return [
        `CC = ${cc}`,
        `CFLAGS = -O2 -Wall`,
        `LDFLAGS = -lm`,
        ``,
        `SOURCES = ${srcs}`,
        `OBJECTS = $(SOURCES:${ext}=.o)`,
        `TARGET = app`,
        ``,
        `.PHONY: all clean`,
        ``,
        `all: $(TARGET)`,
        ``,
        `$(TARGET): $(OBJECTS)`,
        `\t$(CC) $(CFLAGS) $(OBJECTS) -o $(TARGET) $(LDFLAGS)`,
        ``,
        `%${ext.slice(1)}.o: %${ext}`,
        `\t$(CC) $(CFLAGS) -c $< -o $@`,
        ``,
        `clean:`,
        `\trm -f $(OBJECTS) $(TARGET)`,
      ].join('\n');
    }
    return '# Auto-generated Makefile\nall:\n\techo "Build not configured"\n';
  }

  private generateGoMod(): string {
    const dirName = path.basename(this.scanPath);
    return [
      `module ${dirName}`,
      ``,
      `go 1.21`,
    ].join('\n');
  }

  private generateCargoToml(): string {
    const dirName = path.basename(this.scanPath);
    return [
      `[package]`,
      `name = "${dirName}"`,
      `version = "0.1.0"`,
      `edition = "2021"`,
      ``,
      `[dependencies]`,
    ].join('\n');
  }

  private generateRequirements(): string {
    return '# Auto-generated by Graviton Converter\n# Add your Python dependencies here\n';
  }

  private generatePackageJson(): string {
    const dirName = path.basename(this.scanPath);
    return JSON.stringify({
      name: dirName,
      version: '1.0.0',
      description: '',
      main: 'index.js',
      scripts: { start: 'node index.js' },
      dependencies: {},
    }, null, 2);
  }
}
