import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Filter, Info, Search, Zap, Loader2, Eye, EyeOff, Sparkles, X } from 'lucide-react';
import { ConversionIssue, IssueCategory, IssueStatus, ScanResult, Severity } from '../types';
import { autoResolve, batchResolve, getScanResult } from '../api';
import { clsx } from 'clsx';

interface IssueListProps {
  result: ScanResult;
  onSelectIssue: (issue: ConversionIssue) => void;
  onUpdateResult: (result: ScanResult) => void;
}

export function IssueList({ result, onSelectIssue, onUpdateResult }: IssueListProps) {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<IssueStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<IssueCategory | 'all'>('all');
  const [resolving, setResolving] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [showConfirmAll, setShowConfirmAll] = useState(false);
  const [resolvingAll, setResolvingAll] = useState(false);

  const filteredIssues = result.issues.filter(issue => {
    if (search && !issue.title.toLowerCase().includes(search.toLowerCase()) &&
        !issue.file.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && issue.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && issue.category !== categoryFilter) return false;
    if (!showResolved && (issue.status === 'auto-resolved' || issue.status === 'manually-resolved' || issue.status === 'ignored')) {
      return false;
    }
    return true;
  });

  const handleAutoResolve = async () => {
    setResolving(true);
    try {
      const updated = await autoResolve(result.id);
      onUpdateResult(updated);
    } catch {
      // Handle error
    } finally {
      setResolving(false);
    }
  };

  const handleResolveAllHighestConfidence = async () => {
    setResolvingAll(true);
    setShowConfirmAll(false);
    try {
      // For each unresolved issue with suggestions, pick the highest confidence one
      const unresolvedWithSuggestions = result.issues.filter(
        i => i.status === 'unresolved' && i.suggestions.length > 0
      );

      for (const issue of unresolvedWithSuggestions) {
        const bestSuggestion = issue.suggestions.reduce((best, s) =>
          s.confidence > best.confidence ? s : best
        , issue.suggestions[0]);

        if (bestSuggestion.code) {
          await batchResolve(result.id, [issue.id], bestSuggestion.code);
        }
      }

      // Refresh the result
      const updated = await getScanResult(result.id);
      onUpdateResult(updated);
    } catch {
      // Handle error
    } finally {
      setResolvingAll(false);
    }
  };

  const categories = [...new Set(result.issues.map(i => i.category))];

  const categoryLabels: Record<string, string> = {
    'architecture-specific-code': 'Arch-Specific',
    'compiler-flags': 'Compiler Flags',
    'intrinsics': 'Intrinsics',
    'library-compatibility': 'Libraries',
    'docker-image': 'Docker',
    'build-system': 'Build System',
    'assembly': 'Assembly',
    'binary-dependency': 'Binaries',
    'package-manager': 'Pkg Manager',
    'runtime-config': 'Runtime',
    'cicd-pipeline': 'CI/CD',
    'infrastructure': 'Infrastructure',
    'binary-file': 'Binary Files',
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Issues</h2>
          <p className="text-gray-400 text-sm mt-1">
            {filteredIssues.length} of {result.issues.length} issues shown
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={clsx('btn-secondary flex items-center gap-2 text-sm', showResolved && 'border-graviton-500/50 text-graviton-300')}
          >
            {showResolved ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {showResolved ? 'Hide' : 'Show'} Resolved
          </button>
          <button
            onClick={() => setShowConfirmAll(true)}
            disabled={resolvingAll}
            className="btn-primary flex items-center gap-2 text-sm bg-purple-600 hover:bg-purple-500 shadow-purple-900/20"
          >
            {resolvingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Resolve All (Best Match)
          </button>
          <button
            onClick={handleAutoResolve}
            disabled={resolving}
            className="btn-success flex items-center gap-2 text-sm"
          >
            {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Auto-Resolve All
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by file or issue title..."
              className="input-field pl-9 py-2"
            />
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="input-field py-2 w-auto"
              aria-label="Filter by severity"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="input-field py-2 w-auto"
            aria-label="Filter by status"
          >
            <option value="all">All Statuses</option>
            <option value="unresolved">Unresolved</option>
            <option value="auto-resolved">Auto-Resolved</option>
            <option value="manually-resolved">Manual</option>
            <option value="ignored">Ignored</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
            className="input-field py-2 w-auto"
            aria-label="Filter by category"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{categoryLabels[cat] || cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel p-6 max-w-md w-full mx-4 border border-purple-500/30 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Resolve All Issues</h3>
              </div>
              <button onClick={() => setShowConfirmAll(false)} className="p-1 hover:bg-gray-700 rounded" aria-label="Close">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <p className="text-sm text-gray-300">
                This will apply the <span className="text-purple-300 font-medium">highest confidence suggestion</span> to every unresolved issue that has one.
              </p>
              <div className="px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <p className="text-sm text-amber-300 font-medium mb-1">⚠️ Are you sure?</p>
                <p className="text-xs text-amber-200/70">
                  This action will modify files on disk for local scans. Some suggestions may not be perfect for your use case. Review changes carefully afterward. You can rollback individual issues if needed.
                </p>
              </div>
              <div className="text-xs text-gray-400">
                <p>{result.issues.filter(i => i.status === 'unresolved' && i.suggestions.length > 0).length} issues will be resolved using their best-match suggestion.</p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowConfirmAll(false)} className="btn-secondary text-sm">
                Cancel
              </button>
              <button
                onClick={handleResolveAllHighestConfidence}
                className="btn-primary text-sm bg-purple-600 hover:bg-purple-500 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Yes, Resolve All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issue List */}
      <div className="space-y-2">
        {filteredIssues.length === 0 ? (
          <div className="glass-panel p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Issues Found</h3>
            <p className="text-gray-400">
              {result.issues.length > 0
                ? 'All matching issues are resolved or filtered out.'
                : 'Your project appears Graviton-ready!'}
            </p>
          </div>
        ) : (
          filteredIssues.map(issue => (
            <IssueRow key={issue.id} issue={issue} onClick={() => onSelectIssue(issue)} />
          ))
        )}
      </div>
    </div>
  );
}

function IssueRow({ issue, onClick }: { issue: ConversionIssue; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full glass-panel-hover p-4 flex items-center gap-4 text-left"
    >
      <SeverityIcon severity={issue.severity} status={issue.status} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="text-sm font-semibold text-white truncate">{issue.title}</h4>
          {issue.autoResolvable && issue.status === 'unresolved' && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Zap className="w-3 h-3" /> Auto
            </span>
          )}
          {issue.category === 'intrinsics' && issue.severity === 'info' && issue.status === 'unresolved' && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <CheckCircle2 className="w-3 h-3" /> No Change
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="font-mono truncate max-w-[300px]">{issue.file}{issue.line ? `:${issue.line}` : ''}</span>
          <StatusBadge status={issue.status} />
        </div>
      </div>

      <ChevronRight className="w-5 h-5 text-gray-500 shrink-0" />
    </button>
  );
}

function SeverityIcon({ severity, status }: { severity: Severity; status: IssueStatus }) {
  if (status === 'auto-resolved' || status === 'manually-resolved') {
    return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
  }
  if (status === 'ignored') {
    return <EyeOff className="w-5 h-5 text-gray-500 shrink-0" />;
  }

  switch (severity) {
    case 'critical':
      return <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />;
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
    case 'info':
      return <Info className="w-5 h-5 text-blue-400 shrink-0" />;
  }
}

function StatusBadge({ status }: { status: IssueStatus }) {
  switch (status) {
    case 'unresolved':
      return <span className="badge-warning">Unresolved</span>;
    case 'auto-resolved':
      return <span className="badge-resolved">Auto-Resolved</span>;
    case 'manually-resolved':
      return <span className="badge-resolved">Manually Resolved</span>;
    case 'ignored':
      return <span className="badge-info">Ignored</span>;
  }
}
