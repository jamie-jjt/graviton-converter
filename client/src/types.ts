export type Severity = 'critical' | 'warning' | 'info';
export type IssueStatus = 'unresolved' | 'auto-resolved' | 'manually-resolved' | 'ignored';
export type SourceType = 'github' | 'local' | 'url';

export interface ScanSource {
  type: SourceType;
  path: string;
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
  | 'runtime-config'
  | 'cicd-pipeline'
  | 'infrastructure'
  | 'binary-file';

export interface ResolutionSuggestion {
  id: string;
  title: string;
  description: string;
  code?: string;
  confidence: number;
  source: string;
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


// Extended types for new features

export interface DiffPreview {
  file: string;
  original: string;
  modified: string;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  startLine: number;
  endLine: number;
  original: string;
  modified: string;
}

export interface CostEstimate {
  currentMonthly: number;
  projectedMonthly: number;
  savings: number;
  savingsPercent: number;
  instances: InstanceMapping[];
}

export interface InstanceMapping {
  current: string;
  suggested: string;
  currentCost: number;
  suggestedCost: number;
}

export interface MigrationReport {
  id: string;
  scanId: string;
  generatedAt: string;
  summary: ScanSummary;
  issues: ConversionIssue[];
  recommendations: string[];
  estimatedSavings?: CostEstimate;
}

export interface ScanComparison {
  before: ScanSummary;
  after: ScanSummary;
  newIssues: string[];
  resolvedIssues: string[];
}

export interface MigrationProgress {
  totalScans: number;
  totalIssues: number;
  resolvedIssues: number;
  progressPercent: number;
  bySeverity: Record<string, { total: number; resolved: number }>;
  byCategory: Record<string, { total: number; resolved: number }>;
}

export interface PRDescription {
  branch: string;
  title: string;
  body: string;
  files: Array<{ file: string; line?: number; original?: string; modified?: string }>;
  stats: { filesChanged: number; issuesResolved: number; issuesRemaining: number };
}
