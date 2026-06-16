import { useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Code, FileText, Info, Lightbulb, Sparkles, Send, EyeOff, Loader2, Undo2 } from 'lucide-react';
import { ConversionIssue, ScanResult, Severity } from '../types';
import { manualResolve, ignoreIssue, getScanResult, rollbackIssue } from '../api';
import { clsx } from 'clsx';

interface IssueDetailProps {
  issue: ConversionIssue;
  scanId: string;
  onUpdateResult: (result: ScanResult) => void;
  onBack: () => void;
}

export function IssueDetail({ issue, scanId, onUpdateResult, onBack }: IssueDetailProps) {
  const [manualCode, setManualCode] = useState(issue.suggestedFix || '');
  const [resolving, setResolving] = useState(false);
  const [ignoring, setIgnoring] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [overrideNoChange, setOverrideNoChange] = useState(false);

  // Determine if this is a "no change needed" issue (intrinsic usage with sse2neon)
  const isNoChangeNeeded = issue.category === 'intrinsics' && issue.severity === 'info';

  const handleManualResolve = async () => {
    if (!manualCode.trim()) return;
    setResolving(true);
    try {
      await manualResolve(scanId, issue.id, manualCode);
      const updated = await getScanResult(scanId);
      onUpdateResult(updated);
      onBack();
    } catch {
      // Handle error
    } finally {
      setResolving(false);
    }
  };

  const handleIgnore = async () => {
    setIgnoring(true);
    try {
      await ignoreIssue(scanId, issue.id);
      const updated = await getScanResult(scanId);
      onUpdateResult(updated);
      onBack();
    } catch {
      // Handle error
    } finally {
      setIgnoring(false);
    }
  };

  const handleApplySuggestion = (code: string) => {
    setManualCode(code);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors mt-1" aria-label="Go back to issues list">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <SeverityBadge severity={issue.severity} />
              <span className="text-xs text-gray-400 font-mono px-2 py-0.5 bg-gray-800 rounded">
                {issue.category}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white">{issue.title}</h2>
            <p className="text-gray-400 mt-1">{issue.description}</p>
          </div>
        </div>

        <button
          onClick={handleIgnore}
          disabled={ignoring || issue.status !== 'unresolved'}
          className="btn-secondary flex items-center gap-2 text-sm shrink-0"
        >
          {ignoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4" />}
          Ignore
        </button>
      </div>

      {/* File Location */}
      <div className="glass-panel p-4">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <FileText className="w-4 h-4 text-graviton-400" />
          <span className="font-mono">{issue.file}</span>
          {issue.line && <span className="text-gray-500">Line {issue.line}</span>}
        </div>
      </div>

      {/* Original Code */}
      {issue.originalCode && (
        <div className="glass-panel p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Code className="w-4 h-4 text-red-400" />
            Original Code (x86/x64)
          </h3>
          <div className="code-block">
            <code className="text-red-300">{issue.originalCode}</code>
          </div>
        </div>
      )}

      {/* Suggestions Section */}
      <div className="glass-panel p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          Resolution Suggestions
          <span className="text-xs text-gray-500 font-normal ml-2">
            Click to apply to the editor below
          </span>
        </h3>

        <div className="space-y-3">
          {issue.suggestions.map(suggestion => (
            <div
              key={suggestion.id}
              className={clsx(
                'p-4 rounded-lg border cursor-pointer transition-all duration-200',
                selectedSuggestion === suggestion.id
                  ? 'bg-graviton-600/10 border-graviton-500/50'
                  : 'bg-gray-800/30 border-gray-700/50 hover:border-gray-600'
              )}
              onClick={() => {
                setSelectedSuggestion(suggestion.id);
                if (suggestion.code) handleApplySuggestion(suggestion.code);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSelectedSuggestion(suggestion.id);
                  if (suggestion.code) handleApplySuggestion(suggestion.code);
                }
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="text-sm font-medium text-white">{suggestion.title}</h4>
                <ConfidenceBadge confidence={suggestion.confidence} />
              </div>
              <p className="text-xs text-gray-400 mb-3">{suggestion.description}</p>
              {suggestion.code && (
                <div className="code-block text-xs">
                  <code className="text-emerald-300 whitespace-pre-wrap">{suggestion.code}</code>
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                <Sparkles className="w-3 h-3 text-gray-500" />
                <span className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">
                  Source: {suggestion.source}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* No Change Needed Mark */}
      {issue.status === 'unresolved' && isNoChangeNeeded && !overrideNoChange && (
        <div className="glass-panel p-5 border-emerald-500/20">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-emerald-300 mb-1">No Change Needed</h3>
              <p className="text-xs text-gray-400 mb-3">
                This line uses SSE/AVX intrinsics that are fully compatible with <code className="text-emerald-300 bg-gray-800 px-1 rounded">sse2neon.h</code>. 
                Once the header is replaced (auto-resolved), these function calls work on ARM64 without modification.
              </p>
              <button
                onClick={() => setOverrideNoChange(true)}
                className="text-xs text-gray-500 hover:text-amber-400 transition-colors underline underline-offset-2"
              >
                I still want to change this manually →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Override disclaimer for no-change issues */}
      {issue.status === 'unresolved' && isNoChangeNeeded && overrideNoChange && (
        <div className="glass-panel p-5">
          <div className="px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-4">
            <p className="text-xs text-amber-300 font-medium mb-1">⚠️ Manual Override</p>
            <p className="text-xs text-amber-200/70">
              This line is compatible with sse2neon and doesn't need changes. Modifying it manually may break the sse2neon compatibility layer. Proceed only if you're replacing with native NEON intrinsics for performance reasons.
            </p>
          </div>
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Code className="w-4 h-4 text-amber-400" />
            Manual Override
          </h3>
          <textarea
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            rows={6}
            className="w-full px-4 py-3 bg-gray-900/80 border border-amber-600/30 rounded-lg text-amber-300 font-mono text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all duration-200 resize-y"
            placeholder="Enter your manual NEON replacement..."
            spellCheck={false}
          />
          <div className="flex items-center justify-between mt-4">
            <button onClick={() => setOverrideNoChange(false)} className="text-xs text-gray-400 hover:text-gray-300">
              ← Cancel override
            </button>
            <button
              onClick={handleManualResolve}
              disabled={resolving || !manualCode.trim()}
              className="btn-primary flex items-center gap-2 bg-amber-600 hover:bg-amber-500"
            >
              {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Apply Override
            </button>
          </div>
        </div>
      )}

      {/* Manual Resolution Editor (normal issues) */}
      {issue.status === 'unresolved' && !isNoChangeNeeded && (
        <div className="glass-panel p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <Code className="w-4 h-4 text-emerald-400" />
            Apply Resolution
            <span className="text-xs text-gray-500 font-normal ml-2">
              Edit the code below and apply to resolve this issue
            </span>
          </h3>

          <textarea
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            rows={6}
            className="w-full px-4 py-3 bg-gray-900/80 border border-gray-600/50 rounded-lg text-emerald-300 font-mono text-sm placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-graviton-500/50 focus:border-graviton-500/50 transition-all duration-200 resize-y"
            placeholder="Enter or modify the resolution code here..."
            spellCheck={false}
          />

          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-gray-500">
              This will replace the original code in the file.
            </p>
            <button
              onClick={handleManualResolve}
              disabled={resolving || !manualCode.trim()}
              className="btn-primary flex items-center gap-2"
            >
              {resolving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Apply Resolution
            </button>
          </div>
        </div>
      )}

      {/* Already Resolved State */}
      {issue.status !== 'unresolved' && (
        <div className="glass-panel p-5 border-emerald-500/30">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <div>
                <h3 className="text-sm font-semibold text-emerald-300">
                  {issue.status === 'auto-resolved' ? 'Auto-Resolved' : issue.status === 'manually-resolved' ? 'Manually Resolved' : 'Ignored'}
                </h3>
                {issue.resolution && (
                  <div className="code-block mt-2 text-xs">
                    <code className="text-emerald-300">{issue.resolution}</code>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={async () => {
                try {
                  await rollbackIssue(scanId, issue.id);
                  const updated = await getScanResult(scanId);
                  onUpdateResult(updated);
                  onBack();
                } catch {}
              }}
              className="btn-danger flex items-center gap-2 text-sm"
            >
              <Undo2 className="w-4 h-4" />
              Rollback
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  switch (severity) {
    case 'critical':
      return (
        <span className="badge-critical flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Critical
        </span>
      );
    case 'warning':
      return (
        <span className="badge-warning flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Warning
        </span>
      );
    case 'info':
      return (
        <span className="badge-info flex items-center gap-1">
          <Info className="w-3 h-3" /> Info
        </span>
      );
  }
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color = confidence >= 80 ? 'emerald' : confidence >= 60 ? 'amber' : 'gray';
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold',
      color === 'emerald' && 'bg-emerald-500/20 text-emerald-400',
      color === 'amber' && 'bg-amber-500/20 text-amber-400',
      color === 'gray' && 'bg-gray-600/20 text-gray-400',
    )}>
      {confidence}% confidence
    </span>
  );
}
