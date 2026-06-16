export type Severity = 'critical' | 'warning' | 'info';
export type IssueStatus = 'unresolved' | 'auto-resolved' | 'manually-resolved' | 'ignored';
export type SourceType = 'github' | 'local' | 'url';

export interface ScanSource {
  type: SourceType;
  path: string; // GitHub URL, local path, or download URL
  branch?: string;
}

export interface ConversionIssue {
  id: string;
  file: string;
  line?: number;
  category: IssueCategory;
  severity: Severity;
  status: IssueStatus;
  title: string;
  description: string;
  originalCode?: string;
  suggestedFix?: string;
  resolution?: string;
  autoResolvable: boolean;
  suggestions: ResolutionSuggestion[];
}

export type IssueCategory =
  | 'architecture-specific-code'
  | 'compiler-flags'
  | 'intrinsics'
  | 'library-compatibility'
  | 'docker-image'
  | 'build-system'
  | 'assembly'
  | 'binary-dependency'
  | 'package-manager'
  | 'runtime-config';

export interface ResolutionSuggestion {
  id: string;
  title: string;
  description: string;
  code?: string;
  confidence: number; // 0-100
  source: string; // e.g., "AWS Graviton Guide", "Community", "Auto-detected"
}

export interface ScanResult {
  id: string;
  source: ScanSource;
  timestamp: string;
  status: 'scanning' | 'completed' | 'failed';
  summary: ScanSummary;
  issues: ConversionIssue[];
}

export interface ScanSummary {
  totalFiles: number;
  scannedFiles: number;
  totalIssues: number;
  critical: number;
  warnings: number;
  info: number;
  autoResolvable: number;
  resolved: number;
}

export interface ProjectInfo {
  name: string;
  language: string[];
  buildSystem: string;
  packageManager?: string;
  dockerized: boolean;
}
