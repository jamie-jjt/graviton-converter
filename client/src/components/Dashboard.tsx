import { AlertTriangle, CheckCircle2, Info, Zap, FileSearch, Shield, ArrowRight, Loader2, DollarSign, FileText, GitBranch, Download, EyeOff, FileCode } from 'lucide-react';
import { ScanResult } from '../types';
import { autoResolve, getCostEstimate, getMarkdownReport, generatePR, getScanResult, getProjectInfo, generateDockerfile, generateMissingFile } from '../api';
import { useState, useEffect } from 'react';

interface DashboardProps {
  result: ScanResult;
  onViewIssues: () => void;
  onUpdateResult: (result: ScanResult) => void;
}

export function Dashboard({ result, onViewIssues, onUpdateResult }: DashboardProps) {
  const [resolving, setResolving] = useState(false);
  const [costEstimate, setCostEstimate] = useState<any>(null);
  const [loadingCost, setLoadingCost] = useState(false);
  const [prInfo, setPrInfo] = useState<any>(null);
  const [loadingPr, setLoadingPr] = useState(false);
  const [projectInfo, setProjectInfo] = useState<any>(null);
  const [generatingDockerfile, setGeneratingDockerfile] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState<string | null>(null);
  const { summary } = result;

  // Load project info on mount
  useEffect(() => {
    if (result.source.type === 'local') {
      getProjectInfo(result.id).then(setProjectInfo).catch(() => {});
    }
  }, [result.id]);

  const handleAutoResolve = async () => {
    setResolving(true);
    try {
      const updated = await autoResolve(result.id);
      onUpdateResult(updated);
    } catch {
      // Handle error silently
    } finally {
      setResolving(false);
    }
  };

  const handleIgnoreIntrinsicUsage = async () => {
    try {
      // Ignore all intrinsic-usage (info severity) issues via batch
      const intrinsicUsageIds = result.issues
        .filter(i => i.category === 'intrinsics' && i.severity === 'info' && i.status === 'unresolved')
        .map(i => i.id);

      for (const id of intrinsicUsageIds) {
        await fetch(`/api/scan/${result.id}/ignore/${id}`, { method: 'POST' });
      }

      const updated = await getScanResult(result.id);
      onUpdateResult(updated);
    } catch {
      // Handle error
    }
  };

  const handleGenerateDockerfile = async () => {
    setGeneratingDockerfile(true);
    try {
      await generateDockerfile(result.id);
      const info = await getProjectInfo(result.id);
      setProjectInfo(info);
    } catch {
      // Handle error
    } finally {
      setGeneratingDockerfile(false);
    }
  };

  const handleGetCostEstimate = async () => {
    setLoadingCost(true);
    try {
      const estimate = await getCostEstimate(result.id);
      setCostEstimate(estimate);
    } catch {
      // No infra issues found
      setCostEstimate({ currentMonthly: 0, projectedMonthly: 0, savings: 0, savingsPercent: 0, instances: [] });
    } finally {
      setLoadingCost(false);
    }
  };

  const handleExportReport = async () => {
    try {
      const markdown = await getMarkdownReport(result.id);
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `graviton-report-${result.id.slice(0, 8)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Handle error
    }
  };

  const handleGeneratePR = async () => {
    setLoadingPr(true);
    try {
      const pr = await generatePR(result.id);
      setPrInfo(pr);
    } catch {
      // Handle error
    } finally {
      setLoadingPr(false);
    }
  };

  // Readiness: exclude intrinsic-usage (info) issues since they work via sse2neon
  const actionableIssues = result.issues.filter(
    i => !(i.category === 'intrinsics' && i.severity === 'info')
  );
  const actionableResolved = actionableIssues.filter(
    i => i.status === 'auto-resolved' || i.status === 'manually-resolved' || i.status === 'ignored'
  );
  const readinessScore = actionableIssues.length > 0
    ? Math.round((actionableResolved.length / actionableIssues.length) * 100)
    : 100;

  const clampedScore = Math.max(0, Math.min(100, readinessScore));

  // Count unresolved intrinsic-usage issues for the ignore button
  const intrinsicUsageCount = result.issues.filter(
    i => i.category === 'intrinsics' && i.severity === 'info' && i.status === 'unresolved'
  ).length;

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Scan Complete</h2>
          <p className="text-gray-400 mt-1">
            Scanned {summary.scannedFiles} of {summary.totalFiles} files • Found {summary.totalIssues} issues
          </p>
        </div>
        <div className="flex gap-3">
          {intrinsicUsageCount > 0 && (
            <button
              onClick={handleIgnoreIntrinsicUsage}
              className="btn-secondary flex items-center gap-2"
            >
              <EyeOff className="w-4 h-4" />
              Dismiss SSE Usage ({intrinsicUsageCount})
            </button>
          )}
          {summary.autoResolvable > 0 && (
            <button
              onClick={handleAutoResolve}
              disabled={resolving}
              className="btn-success flex items-center gap-2"
            >
              {resolving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Auto-Resolve ({summary.autoResolvable})
            </button>
          )}
          <button onClick={onViewIssues} className="btn-primary flex items-center gap-2">
            View All Issues
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Readiness Score */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-graviton-400" />
            Graviton Readiness
          </h3>
          <span className="text-3xl font-bold text-graviton-400">{clampedScore}%</span>
        </div>
        <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-graviton-600 to-graviton-400"
            style={{ width: `${clampedScore}%` }}
          />
        </div>
        <p className="text-sm text-gray-400 mt-2">
          {clampedScore >= 90
            ? 'Excellent! Your project is nearly Graviton-ready.'
            : clampedScore >= 60
            ? 'Good progress. A few issues need attention before migration.'
            : 'Significant changes needed for Graviton compatibility.'}
        </p>
      </div>

      {/* Project Info Panel */}
      {!projectInfo && result.source.type === 'local' && (
        <div className="glass-panel p-5 flex items-center justify-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-graviton-400" />
          <span className="text-sm text-gray-400">Detecting project info...</span>
        </div>
      )}
      {projectInfo && (
        <div className="glass-panel p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <FileCode className="w-4 h-4 text-graviton-400" />
            Project Detection
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
            <div>
              <p className="text-xs text-gray-500">Language</p>
              <p className="text-sm text-white font-medium">
                {projectInfo.languages?.length > 0 ? projectInfo.languages.map((l: any) => `${l.name} (${l.fileCount})`).join(', ') : 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Build System</p>
              <p className="text-sm text-white font-medium">{projectInfo.buildSystem || 'None detected'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Dockerfile</p>
              <p className={`text-sm font-medium ${projectInfo.hasDockerfile ? 'text-emerald-400' : 'text-red-400'}`}>
                {projectInfo.hasDockerfile ? '✓ Present' : '✗ Missing'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Build Ready</p>
              <p className={`text-sm font-medium ${projectInfo.missingForBuild?.length === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {projectInfo.missingForBuild?.length === 0 ? '✓ Yes' : `${projectInfo.missingForBuild.length} missing`}
              </p>
            </div>
          </div>
          {projectInfo.missingForBuild?.length > 0 && (
            <div className="space-y-2 mb-3">
              <p className="text-xs text-amber-400 font-medium mb-2">Missing for ARM64 validation:</p>
              <div className="flex flex-wrap gap-2">
                {projectInfo.missingForBuild.map((fileName: string, i: number) => (
                  <button
                    key={i}
                    onClick={async () => {
                      try {
                        if (fileName === 'Dockerfile') {
                          await generateDockerfile(result.id);
                        } else {
                          await generateMissingFile(result.id, fileName);
                        }
                        setGenerateSuccess(fileName);
                        setTimeout(() => setGenerateSuccess(null), 3000);
                        const info = await getProjectInfo(result.id);
                        setProjectInfo(info);
                      } catch {}
                    }}
                    className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    Generate {fileName}
                  </button>
                ))}
              </div>
              {generateSuccess && (
                <div className="mt-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {generateSuccess} created successfully
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
          label="Critical"
          value={summary.critical}
          color="red"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
          label="Warnings"
          value={summary.warnings}
          color="amber"
        />
        <StatCard
          icon={<Info className="w-5 h-5 text-blue-400" />}
          label="Info"
          value={summary.info}
          color="blue"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          label="Resolved"
          value={summary.resolved}
          color="emerald"
        />
      </div>

      {/* Category Breakdown */}
      <div className="glass-panel p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FileSearch className="w-5 h-5 text-graviton-400" />
          Issues by Category
        </h3>
        <div className="space-y-3">
          {getCategoryBreakdown(result).map(({ category, count, label }) => (
            <div key={category} className="flex items-center justify-between">
              <span className="text-sm text-gray-300">{label}</span>
              <div className="flex items-center gap-3">
                <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-graviton-500 rounded-full"
                    style={{ width: `${(count / Math.max(summary.totalIssues, 1)) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-400 w-8 text-right">{count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions Row */}
      <div className="grid grid-cols-3 gap-4">
        <button onClick={handleGetCostEstimate} disabled={loadingCost} className="glass-panel-hover p-4 flex flex-col items-center gap-2 text-center">
          {loadingCost ? <Loader2 className="w-5 h-5 animate-spin text-graviton-400" /> : <DollarSign className="w-5 h-5 text-emerald-400" />}
          <span className="text-sm font-medium text-gray-200">Cost Estimate</span>
          <span className="text-xs text-gray-500">Graviton savings</span>
        </button>
        <button onClick={handleExportReport} className="glass-panel-hover p-4 flex flex-col items-center gap-2 text-center">
          <Download className="w-5 h-5 text-blue-400" />
          <span className="text-sm font-medium text-gray-200">Export Report</span>
          <span className="text-xs text-gray-500">Markdown download</span>
        </button>
        <button onClick={handleGeneratePR} disabled={loadingPr} className="glass-panel-hover p-4 flex flex-col items-center gap-2 text-center">
          {loadingPr ? <Loader2 className="w-5 h-5 animate-spin text-graviton-400" /> : <GitBranch className="w-5 h-5 text-purple-400" />}
          <span className="text-sm font-medium text-gray-200">Generate PR</span>
          <span className="text-xs text-gray-500">Migration branch</span>
        </button>
      </div>

      {/* Cost Estimate Panel */}
      {costEstimate && (
        <div className="glass-panel p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            Cost Savings Estimate
          </h3>
          {costEstimate.instances.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-400">${costEstimate.currentMonthly.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">Current /mo</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-400">${costEstimate.projectedMonthly.toFixed(2)}</p>
                  <p className="text-xs text-gray-400">Graviton /mo</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-aws-orange">{costEstimate.savingsPercent.toFixed(1)}%</p>
                  <p className="text-xs text-gray-400">Savings</p>
                </div>
              </div>
              <div className="space-y-2">
                {costEstimate.instances.map((inst: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-gray-300">{inst.current} → {inst.suggested}</span>
                    <span className="text-emerald-400">${(inst.currentCost - inst.suggestedCost).toFixed(2)}/mo saved</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No infrastructure instance types detected. Add Terraform or CloudFormation files for cost analysis.</p>
          )}
        </div>
      )}

      {/* PR Preview Panel */}
      {prInfo && (
        <div className="glass-panel p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-purple-400" />
            Migration PR Preview
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Branch:</span>
              <code className="text-sm text-purple-300 bg-gray-800 px-2 py-0.5 rounded">{prInfo.branch}</code>
            </div>
            <div>
              <span className="text-xs text-gray-500">Title:</span>
              <p className="text-sm text-gray-200 mt-1">{prInfo.title}</p>
            </div>
            <div className="flex gap-4 text-sm">
              <span className="text-gray-400">{prInfo.stats.filesChanged} files changed</span>
              <span className="text-emerald-400">{prInfo.stats.issuesResolved} resolved</span>
              <span className="text-amber-400">{prInfo.stats.issuesRemaining} remaining</span>
            </div>
            <details className="mt-2">
              <summary className="text-xs text-graviton-400 cursor-pointer hover:text-graviton-300">View full PR description</summary>
              <pre className="mt-2 text-xs text-gray-400 bg-gray-900 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">{prInfo.body}</pre>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="glass-panel p-4">
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-sm text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

function getCategoryBreakdown(result: ScanResult) {
  const categories = new Map<string, number>();
  for (const issue of result.issues) {
    categories.set(issue.category, (categories.get(issue.category) || 0) + 1);
  }

  const labels: Record<string, string> = {
    'architecture-specific-code': 'Architecture-Specific Code',
    'compiler-flags': 'Compiler Flags',
    'intrinsics': 'x86 Intrinsics (SSE/AVX)',
    'library-compatibility': 'Library Compatibility',
    'docker-image': 'Docker Images',
    'build-system': 'Build System',
    'assembly': 'Inline Assembly',
    'binary-dependency': 'Binary Dependencies',
    'package-manager': 'Package Manager',
    'runtime-config': 'Runtime Configuration',
    'cicd-pipeline': 'CI/CD Pipeline',
    'infrastructure': 'Infrastructure (IaC)',
    'binary-file': 'Binary Files',
  };

  return Array.from(categories.entries())
    .map(([category, count]) => ({
      category,
      count,
      label: labels[category] || category,
    }))
    .sort((a, b) => b.count - a.count);
}
