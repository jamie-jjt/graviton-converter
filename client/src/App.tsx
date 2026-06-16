import { useState } from 'react';
import { ScanResult } from './types';
import { Header } from './components/Header';
import { SourceInput } from './components/SourceInput';
import { Dashboard } from './components/Dashboard';
import { IssueList } from './components/IssueList';
import { IssueDetail } from './components/IssueDetail';
import { ConversionIssue } from './types';

type View = 'home' | 'dashboard' | 'issues' | 'detail';

export default function App() {
  const [view, setView] = useState<View>('home');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<ConversionIssue | null>(null);

  const handleScanComplete = (result: ScanResult) => {
    setScanResult(result);
    setView('dashboard');
  };

  const handleViewIssues = () => {
    setView('issues');
  };

  const handleSelectIssue = (issue: ConversionIssue) => {
    setSelectedIssue(issue);
    setView('detail');
  };

  const handleBack = () => {
    if (view === 'detail') setView('issues');
    else if (view === 'issues') setView('dashboard');
    else if (view === 'dashboard') setView('home');
  };

  const handleNewScan = () => {
    setScanResult(null);
    setSelectedIssue(null);
    setView('home');
  };

  const handleUpdateResult = (result: ScanResult) => {
    setScanResult(result);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        view={view}
        onBack={handleBack}
        onNewScan={handleNewScan}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {view === 'home' && (
          <SourceInput onScanComplete={handleScanComplete} />
        )}

        {view === 'dashboard' && scanResult && (
          <Dashboard
            result={scanResult}
            onViewIssues={handleViewIssues}
            onUpdateResult={handleUpdateResult}
          />
        )}

        {view === 'issues' && scanResult && (
          <IssueList
            result={scanResult}
            onSelectIssue={handleSelectIssue}
            onUpdateResult={handleUpdateResult}
          />
        )}

        {view === 'detail' && scanResult && selectedIssue && (
          <IssueDetail
            issue={selectedIssue}
            scanId={scanResult.id}
            onUpdateResult={handleUpdateResult}
            onBack={() => setView('issues')}
          />
        )}
      </main>
    </div>
  );
}
