import express from 'express';
import cors from 'cors';
import { Scanner, createScanSummary } from './engine/scanner';
import { AutoResolver } from './engine/resolver';
import { GitSource } from './engine/git-source';
import { ConversionIssue, ScanResult, ScanSource, DiffPreview, DiffHunk, ScanComparison } from './types';
import { v4Generator } from './utils/id';
import { CostEstimator } from './engine/cost-estimator';
import { ReportGenerator } from './engine/report-generator';
import { DependencyAnalyzer } from './engine/dependency-analyzer';
import { lookupPackage, npmCompatDb, pythonCompatDb } from './engine/compatibility-db';

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

// GET /api/scan/:id/diff-preview - Show what auto-resolve would change
app.get('/api/scan/:id/diff-preview', (req, res) => {
  const result = scanResults.get(req.params.id);
  if (!result) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  const resolvableIssues = result.issues.filter(
    i => i.autoResolvable && i.status === 'unresolved' && i.suggestedFix && i.originalCode
  );

  const previews: DiffPreview[] = [];
  const fileGroups: Record<string, ConversionIssue[]> = {};

  for (const issue of resolvableIssues) {
    if (!fileGroups[issue.file]) {
      fileGroups[issue.file] = [];
    }
    fileGroups[issue.file].push(issue);
  }

  for (const [file, issues] of Object.entries(fileGroups)) {
    const hunks: DiffHunk[] = issues.map(issue => ({
      startLine: issue.line || 0,
      endLine: issue.line || 0,
      original: issue.originalCode || '',
      modified: issue.suggestedFix || '',
    }));

    previews.push({
      file,
      original: issues.map(i => i.originalCode || '').join('\n'),
      modified: issues.map(i => i.suggestedFix || '').join('\n'),
      hunks,
    });
  }

  res.json(previews);
});

// POST /api/scan/:id/batch-resolve - Resolve multiple issues at once
app.post('/api/scan/:id/batch-resolve', (req, res) => {
  const { issueIds, resolution } = req.body as { issueIds: string[]; resolution: string };
  const result = scanResults.get(req.params.id);

  if (!result) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  if (!issueIds || !Array.isArray(issueIds)) {
    return res.status(400).json({ error: 'issueIds array is required' });
  }

  const scanPath = result.source.type === 'local' ? result.source.path : '';
  const resolver = new AutoResolver(scanPath);
  const resolvedIds: string[] = [];

  for (const issueId of issueIds) {
    const issueIndex = result.issues.findIndex(i => i.id === issueId);
    if (issueIndex === -1) continue;

    const issue = result.issues[issueIndex];
    if (issue.status !== 'unresolved') continue;

    if (resolution) {
      result.issues[issueIndex] = resolver.manualResolve(issue, resolution);
    } else if (issue.autoResolvable) {
      result.issues[issueIndex] = resolver.resolve(issue);
    }

    resolvedIds.push(issueId);
  }

  result.summary = createScanSummary(result.issues, result.summary.totalFiles, result.summary.scannedFiles);
  scanResults.set(req.params.id, result);

  res.json({ resolved: resolvedIds.length, issueIds: resolvedIds, summary: result.summary });
});

// POST /api/scan/:id/generate-pr - Generate a migration branch description
app.post('/api/scan/:id/generate-pr', (req, res) => {
  const result = scanResults.get(req.params.id);
  if (!result) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  const resolvedIssues = result.issues.filter(
    i => i.status === 'auto-resolved' || i.status === 'manually-resolved'
  );
  const unresolvedIssues = result.issues.filter(i => i.status === 'unresolved');

  const prTitle = `chore: migrate to AWS Graviton (ARM64) compatibility`;
  const prBody = [
    '## Graviton Migration Changes',
    '',
    `This PR addresses ${resolvedIssues.length} compatibility issues for ARM64/Graviton migration.`,
    '',
    '### Changes Made',
    '',
    ...resolvedIssues.map(i => `- **${i.file}**${i.line ? ` (line ${i.line})` : ''}: ${i.title}`),
    '',
    unresolvedIssues.length > 0 ? `### Remaining Issues (${unresolvedIssues.length})` : '',
    unresolvedIssues.length > 0 ? '' : '',
    ...unresolvedIssues.map(i => `- [ ] **${i.file}**: ${i.title} (${i.severity})`),
    '',
    '### Testing',
    '',
    '- [ ] Build passes on ARM64/Graviton instance',
    '- [ ] Unit tests pass',
    '- [ ] Integration tests pass',
    '- [ ] Performance benchmarks acceptable',
    '',
    '---',
    '*Generated by Graviton Converter 2.0*',
  ].filter(line => line !== undefined).join('\n');

  const files = resolvedIssues.map(i => ({
    file: i.file,
    line: i.line,
    original: i.originalCode,
    modified: i.resolution || i.suggestedFix,
  }));

  res.json({
    branch: `graviton-migration/${result.id.slice(0, 8)}`,
    title: prTitle,
    body: prBody,
    files,
    stats: {
      filesChanged: new Set(resolvedIssues.map(i => i.file)).size,
      issuesResolved: resolvedIssues.length,
      issuesRemaining: unresolvedIssues.length,
    },
  });
});

// POST /api/scan/:id/rollback/:issueId - Undo a resolution
app.post('/api/scan/:id/rollback/:issueId', (req, res) => {
  const result = scanResults.get(req.params.id);
  if (!result) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  const issueIndex = result.issues.findIndex(i => i.id === req.params.issueId);
  if (issueIndex === -1) {
    return res.status(404).json({ error: 'Issue not found' });
  }

  const issue = result.issues[issueIndex];
  if (issue.status === 'unresolved') {
    return res.status(400).json({ error: 'Issue is not resolved, nothing to rollback' });
  }

  // Rollback: set status back to unresolved and clear resolution
  result.issues[issueIndex] = {
    ...issue,
    status: 'unresolved',
    resolution: undefined,
  };

  result.summary = createScanSummary(result.issues, result.summary.totalFiles, result.summary.scannedFiles);
  scanResults.set(req.params.id, result);

  res.json(result.issues[issueIndex]);
});

// GET /api/scan/:id/report - Generate migration report as JSON
app.get('/api/scan/:id/report', (req, res) => {
  const result = scanResults.get(req.params.id);
  if (!result) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  if (result.status !== 'completed') {
    return res.status(400).json({ error: 'Scan is not completed yet' });
  }

  const generator = new ReportGenerator();
  const report = generator.generateReport(result);
  res.json(report);
});

// GET /api/scan/:id/report/markdown - Generate markdown report
app.get('/api/scan/:id/report/markdown', (req, res) => {
  const result = scanResults.get(req.params.id);
  if (!result) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  if (result.status !== 'completed') {
    return res.status(400).json({ error: 'Scan is not completed yet' });
  }

  const generator = new ReportGenerator();
  const markdown = generator.generateMarkdown(result);
  res.setHeader('Content-Type', 'text/markdown');
  res.send(markdown);
});

// GET /api/scan/:id/cost-estimate - Get cost estimate based on infra findings
app.get('/api/scan/:id/cost-estimate', (req, res) => {
  const result = scanResults.get(req.params.id);
  if (!result) {
    return res.status(404).json({ error: 'Scan not found' });
  }

  if (result.status !== 'completed') {
    return res.status(400).json({ error: 'Scan is not completed yet' });
  }

  const estimator = new CostEstimator();
  const estimate = estimator.estimate(result.issues);
  res.json(estimate);
});

// GET /api/scans/compare/:id1/:id2 - Compare two scans
app.get('/api/scans/compare/:id1/:id2', (req, res) => {
  const result1 = scanResults.get(req.params.id1);
  const result2 = scanResults.get(req.params.id2);

  if (!result1 || !result2) {
    return res.status(404).json({ error: 'One or both scans not found' });
  }

  const beforeIssueIds = new Set(result1.issues.map(i => `${i.file}:${i.line}:${i.category}`));
  const afterIssueIds = new Set(result2.issues.map(i => `${i.file}:${i.line}:${i.category}`));

  const newIssues = result2.issues
    .filter(i => !beforeIssueIds.has(`${i.file}:${i.line}:${i.category}`))
    .map(i => i.id);

  const resolvedIssues = result1.issues
    .filter(i => !afterIssueIds.has(`${i.file}:${i.line}:${i.category}`))
    .map(i => i.id);

  const comparison: ScanComparison = {
    before: result1.summary,
    after: result2.summary,
    newIssues,
    resolvedIssues,
  };

  res.json(comparison);
});

// GET /api/scans/progress - Get overall migration progress across all scans
app.get('/api/scans/progress', (_req, res) => {
  const allScans = Array.from(scanResults.values()).filter(s => s.status === 'completed');

  if (allScans.length === 0) {
    return res.json({
      totalScans: 0,
      totalIssues: 0,
      resolvedIssues: 0,
      progressPercent: 0,
      bySeverity: { critical: { total: 0, resolved: 0 }, warning: { total: 0, resolved: 0 }, info: { total: 0, resolved: 0 } },
      byCategory: {},
    });
  }

  const allIssues = allScans.flatMap(s => s.issues);
  const resolved = allIssues.filter(i => i.status === 'auto-resolved' || i.status === 'manually-resolved' || i.status === 'ignored');
  const progressPercent = allIssues.length > 0 ? (resolved.length / allIssues.length) * 100 : 0;

  const bySeverity = {
    critical: {
      total: allIssues.filter(i => i.severity === 'critical').length,
      resolved: allIssues.filter(i => i.severity === 'critical' && (i.status === 'auto-resolved' || i.status === 'manually-resolved' || i.status === 'ignored')).length,
    },
    warning: {
      total: allIssues.filter(i => i.severity === 'warning').length,
      resolved: allIssues.filter(i => i.severity === 'warning' && (i.status === 'auto-resolved' || i.status === 'manually-resolved' || i.status === 'ignored')).length,
    },
    info: {
      total: allIssues.filter(i => i.severity === 'info').length,
      resolved: allIssues.filter(i => i.severity === 'info' && (i.status === 'auto-resolved' || i.status === 'manually-resolved' || i.status === 'ignored')).length,
    },
  };

  const byCategory: Record<string, { total: number; resolved: number }> = {};
  for (const issue of allIssues) {
    if (!byCategory[issue.category]) {
      byCategory[issue.category] = { total: 0, resolved: 0 };
    }
    byCategory[issue.category].total++;
    if (issue.status === 'auto-resolved' || issue.status === 'manually-resolved' || issue.status === 'ignored') {
      byCategory[issue.category].resolved++;
    }
  }

  res.json({
    totalScans: allScans.length,
    totalIssues: allIssues.length,
    resolvedIssues: resolved.length,
    progressPercent: Math.round(progressPercent * 10) / 10,
    bySeverity,
    byCategory,
  });
});

// GET /api/compatibility/:package - Check compatibility database for a package
app.get('/api/compatibility/:package', (req, res) => {
  const packageName = req.params.package;
  const ecosystem = (req.query.ecosystem as string) || 'npm';

  if (ecosystem !== 'npm' && ecosystem !== 'python') {
    return res.status(400).json({ error: 'Ecosystem must be "npm" or "python"' });
  }

  const entry = lookupPackage(packageName, ecosystem);
  if (!entry) {
    return res.json({
      name: packageName,
      ecosystem,
      found: false,
      message: `Package "${packageName}" not found in the ${ecosystem} compatibility database.`,
    });
  }

  res.json({
    ...entry,
    ecosystem,
    found: true,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Graviton Converter API running on http://localhost:${PORT}`);
});
