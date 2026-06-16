import { useState } from 'react';
import { Github, FolderOpen, Globe, Loader2, ArrowRight, GitBranch } from 'lucide-react';
import { ScanResult, SourceType } from '../types';
import { startScan, getScanResult } from '../api';
import { clsx } from 'clsx';

interface SourceInputProps {
  onScanComplete: (result: ScanResult) => void;
}

export function SourceInput({ onScanComplete }: SourceInputProps) {
  const [sourceType, setSourceType] = useState<SourceType>('github');
  const [path, setPath] = useState('');
  const [branch, setBranch] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  const sourceTypes = [
    { type: 'github' as SourceType, icon: Github, label: 'GitHub Repository', placeholder: 'https://github.com/user/repo' },
    { type: 'local' as SourceType, icon: FolderOpen, label: 'Local Path', placeholder: 'C:\\projects\\my-app or /home/user/project' },
    { type: 'url' as SourceType, icon: Globe, label: 'Remote URL', placeholder: 'https://example.com/project.tar.gz' },
  ];

  const handleScan = async () => {
    if (!path.trim()) {
      setError('Please enter a source path');
      return;
    }

    setError('');
    setScanning(true);

    try {
      const { scanId } = await startScan({
        type: sourceType,
        path: path.trim(),
        branch: branch.trim() || undefined,
      });

      // Poll for results
      let result: ScanResult;
      let attempts = 0;
      do {
        await new Promise(resolve => setTimeout(resolve, 1000));
        result = await getScanResult(scanId);
        attempts++;
      } while (result.status === 'scanning' && attempts < 120);

      if (result.status === 'completed') {
        onScanComplete(result);
      } else {
        setError('Scan failed or timed out. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while scanning');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-aws-orange/10 border border-aws-orange/30 text-aws-orange text-sm font-medium mb-6">
          <span className="w-2 h-2 rounded-full bg-aws-orange animate-pulse" />
          Powered by AWS Graviton Detection Engine
        </div>
        <h2 className="text-4xl font-bold text-white mb-4">
          Migrate your code to{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-aws-orange to-amber-400">
            ARM64
          </span>
        </h2>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Scan your x86/x64 project for Graviton compatibility issues. Get automated fixes and detailed resolution guides.
        </p>
      </div>

      {/* Source Type Selector */}
      <div className="glass-panel p-6 mb-6">
        <label className="text-sm font-medium text-gray-300 mb-3 block">
          Select Source
        </label>
        <div className="grid grid-cols-3 gap-3">
          {sourceTypes.map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              onClick={() => setSourceType(type)}
              className={clsx(
                'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all duration-200',
                sourceType === type
                  ? 'bg-graviton-600/20 border-graviton-500/50 text-graviton-300'
                  : 'bg-gray-800/30 border-gray-700/50 text-gray-400 hover:border-gray-600 hover:text-gray-300'
              )}
            >
              <Icon className="w-6 h-6" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Input Form */}
      <div className="glass-panel p-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="source-path" className="text-sm font-medium text-gray-300 mb-2 block">
              {sourceTypes.find(s => s.type === sourceType)?.label}
            </label>
            <input
              id="source-path"
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder={sourceTypes.find(s => s.type === sourceType)?.placeholder}
              className="input-field"
              disabled={scanning}
            />
          </div>

          {sourceType === 'github' && (
            <div>
              <label htmlFor="branch" className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                Branch (optional)
              </label>
              <input
                id="branch"
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="input-field"
                disabled={scanning}
              />
            </div>
          )}

          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleScan}
            disabled={scanning || !path.trim()}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base"
          >
            {scanning ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Scanning Project...
              </>
            ) : (
              <>
                Start Scan
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Feature highlights */}
      <div className="grid grid-cols-3 gap-4 mt-8">
        {[
          { title: 'Auto-Resolver', desc: 'Automatically fixes common x86 patterns' },
          { title: 'Smart Detection', desc: '10+ rule categories for comprehensive coverage' },
          { title: 'Resolution Guide', desc: 'Detailed suggestions with confidence scoring' },
        ].map(({ title, desc }) => (
          <div key={title} className="text-center p-4">
            <h4 className="text-sm font-semibold text-gray-200 mb-1">{title}</h4>
            <p className="text-xs text-gray-500">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
