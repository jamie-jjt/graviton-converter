import express from 'express';
import cors from 'cors';
import { Scanner, createScanSummary } from './engine/scanner';
import { AutoResolver } from './engine/resolver';
import { GitSource } from './engine/git-source';
import { ConversionIssue, ScanResult, ScanSource } from './types';
import { v4Generator } from './utils/id';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// In-memory store for scan results
const scanResults: Map<string, ScanResult> = new Map();
const gitSource = new GitSource();

// POST /api/scan - Start a new scan
app.post('/api/scan', async (req, res) => {
  const { source }: { source: ScanSource } = req.body;

  if (!source || !source.type || !source.path) {
    return res.status(400).json({ error: 'Invalid source configuration' });
  }

  const scanId = v4Generator();
  let scanPath: string;

  const scanResult: ScanResult = {
    id: scanId,
    source,
    timestamp: new Date().toISOString(),
    status: 'scanning',
    summary: { totalFiles: 0, scannedFiles: 0, totalIssues: 0, critical: 0, warnings: 0, info: 0, autoResolvable: 0, resolved: 0 },
    issues: [],
  };

  scanResults.set(scanId, scanResult);
  res.json({ scanId, status: 'scanning' });

  // Process scan asynchronously
  try {
    if (source.type === 'github') {
      scanPath = await gitSource.clone(source.path, source.branch);
    } else {
      scanPath = source.path;
    }

    const scanner = new Scanner(scanPath);
    const { issues, totalFiles, scannedFiles } = await scanner.scan();

    const result: ScanResult = {
      ...scanResult,
      status: 'completed',
      issues,
      summary: createScanSummary(issues, totalFiles, scannedFiles),
    };

    scanResults.set(scanId, result);

    // Cleanup GitHub clones
    if (source.type === 'github') {
      gitSource.cleanup(scanPath);
    }
  } catch (error: any) {
    scanResults.set(scanId, {
      ...scanResult,
      status: 'failed',
    });
  }
});

// GET /api/scan/:id - Get scan results
app.get('/api/scan/:id', (req, res) => {
  const result = scanResults.get(req.params.id);
  if (!result) {
    return res.status(404).json({ error: 'Scan not found' });
  }
  res.json(result);
});

// GET /api/scans - List all scans
app.get('/api/scans', (_req, res) => {
  const scans = Array.from(scanResults.values()).map(s => ({
    id: s.id,
    source: s.source,
    timestamp: s.timestamp,
    status: s.status,
    summary: s.summary,
  }));
  res.json(scans);
});

// POST /api/scan/:id/auto-resolve - Auto-resolve all issues
app.post('/api/scan/:id/auto-resolve', (req, res) => {
  const result = scanResults.get(req.params.id);
  if (!result) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  const scanPath = result.source.type === 'local' ? result.source.path : '';
  const resolver = new AutoResolver(scanPath);
  const updatedIssues = resolver.resolveAll(result.issues);

  const updatedResult: ScanResult = {
    ...result,
    issues: updatedIssues,
    summary: createScanSummary(updatedIssues, result.summary.totalFiles, result.summary.scannedFiles),
  };

  scanResults.set(req.params.id, updatedResult);
  res.json(updatedResult);
});

// POST /api/scan/:id/resolve/:issueId - Manually resolve an issue
app.post('/api/scan/:id/resolve/:issueId', (req, res) => {
  const { resolution } = req.body;
  const result = scanResults.get(req.params.id);

  if (!result) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  const issueIndex = result.issues.findIndex(i => i.id === req.params.issueId);
  if (issueIndex === -1) {
    return res.status(404).json({ error: 'Issue not found' });
  }

  const scanPath = result.source.type === 'local' ? result.source.path : '';
  const resolver = new AutoResolver(scanPath);
  const updatedIssue = resolver.manualResolve(result.issues[issueIndex], resolution);

  result.issues[issueIndex] = updatedIssue;
  result.summary = createScanSummary(result.issues, result.summary.totalFiles, result.summary.scannedFiles);

  scanResults.set(req.params.id, result);
  res.json(updatedIssue);
});

// POST /api/scan/:id/ignore/:issueId - Ignore an issue
app.post('/api/scan/:id/ignore/:issueId', (req, res) => {
  const result = scanResults.get(req.params.id);
  if (!result) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  const issueIndex = result.issues.findIndex(i => i.id === req.params.issueId);
  if (issueIndex === -1) {
    return res.status(404).json({ error: 'Issue not found' });
  }

  result.issues[issueIndex] = { ...result.issues[issueIndex], status: 'ignored' };
  result.summary = createScanSummary(result.issues, result.summary.totalFiles, result.summary.scannedFiles);

  scanResults.set(req.params.id, result);
  res.json(result.issues[issueIndex]);
});

app.listen(PORT, () => {
  console.log(`🚀 Graviton Converter API running on http://localhost:${PORT}`);
});
