import { ArrowLeft, Cpu, PlusCircle } from 'lucide-react';

interface HeaderProps {
  view: string;
  onBack: () => void;
  onNewScan: () => void;
}

export function Header({ view, onBack, onNewScan }: HeaderProps) {
  return (
    <header className="border-b border-gray-700/50 bg-aws-squid/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {view !== 'home' && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
          )}

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-aws-orange to-amber-600 flex items-center justify-center shadow-lg">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">
                Graviton Converter
              </h1>
              <p className="text-xs text-gray-400 font-medium">
                x86/x64 → ARM64 Migration Tool
              </p>
            </div>
          </div>
        </div>

        {view !== 'home' && (
          <button
            onClick={onNewScan}
            className="btn-primary flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            New Scan
          </button>
        )}
      </div>
    </header>
  );
}
