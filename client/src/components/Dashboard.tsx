import { AlertTriangle, CheckCircle2, Info, Zap, FileSearch, Shield, ArrowRight, Loader2 } from 'lucide-react';
import { ScanResult } from '../types';
import { autoResolve, getScanResult } from '../api';
import { useState } from 'react';

interface DashboardProps {
  result: ScanResult;
  onViewIssues: () => void;
  onUpdateResult: (result: ScanResult) => void;
}

export function Dashboard({ result, onViewIssues, onUpdateResult }: DashboardProps) {
  const [resolving, setResolving] = useState(false);
  const { summary } = result;

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

  const readinessScore = Math.round(
    ((summary.scannedFiles - summary.totalIssues + summary.resolved) / Math.max(summary.scannedFiles, 1)) * 100
  );

  const clampedScore = Math.max(0, Math.min(100, readinessScore));

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
  };

  return Array.from(categories.entries())
    .map(([category, count]) => ({
      category,
      count,
      label: labels[category] || category,
    }))
    .sort((a, b) => b.count - a.count);
}
