import { ScanResult, ScanSource, CostEstimate, DiffPreview, MigrationProgress, MigrationReport, PRDescription, ScanComparison } from './types';

const API_BASE = '/api';

export async function startScan(source: ScanSource): Promise<{ scanId: string }> {
  const res = await fetch(`${API_BASE}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  });
  if (!res.ok) throw new Error('Failed to start scan');
  return res.json();
}

export async function getScanResult(scanId: string): Promise<ScanResult> {
  const res = await fetch(`${API_BASE}/scan/${scanId}`);
  if (!res.ok) throw new Error('Failed to get scan result');
  return res.json();
}

export async function getScans(): Promise<ScanResult[]> {
  const res = await fetch(`${API_BASE}/scans`);
  if (!res.ok) throw new Error('Failed to get scans');
  return res.json();
}

export async function autoResolve(scanId: string): Promise<ScanResult> {
  const res = await fetch(`${API_BASE}/scan/${scanId}/auto-resolve`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to auto-resolve');
  return res.json();
}

export async function manualResolve(scanId: string, issueId: string, resolution: string): Promise<void> {
  const res = await fetch(`${API_BASE}/scan/${scanId}/resolve/${issueId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolution }),
  });
  if (!res.ok) throw new Error('Failed to resolve issue');
}

export async function ignoreIssue(scanId: string, issueId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/scan/${scanId}/ignore/${issueId}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to ignore issue');
}


export async function getDiffPreview(scanId: string): Promise<DiffPreview[]> {
  const res = await fetch(`${API_BASE}/scan/${scanId}/diff-preview`);
  if (!res.ok) throw new Error('Failed to get diff preview');
  return res.json();
}

export async function batchResolve(scanId: string, issueIds: string[], resolution?: string): Promise<{ resolved: number }> {
  const res = await fetch(`${API_BASE}/scan/${scanId}/batch-resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issueIds, resolution }),
  });
  if (!res.ok) throw new Error('Failed to batch resolve');
  return res.json();
}

export async function generatePR(scanId: string): Promise<PRDescription> {
  const res = await fetch(`${API_BASE}/scan/${scanId}/generate-pr`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to generate PR');
  return res.json();
}

export async function rollbackIssue(scanId: string, issueId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/scan/${scanId}/rollback/${issueId}`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to rollback');
}

export async function getReport(scanId: string): Promise<MigrationReport> {
  const res = await fetch(`${API_BASE}/scan/${scanId}/report`);
  if (!res.ok) throw new Error('Failed to get report');
  return res.json();
}

export async function getMarkdownReport(scanId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/scan/${scanId}/report/markdown`);
  if (!res.ok) throw new Error('Failed to get markdown report');
  return res.text();
}

export async function getCostEstimate(scanId: string): Promise<CostEstimate> {
  const res = await fetch(`${API_BASE}/scan/${scanId}/cost-estimate`);
  if (!res.ok) throw new Error('Failed to get cost estimate');
  return res.json();
}

export async function compareScans(id1: string, id2: string): Promise<ScanComparison> {
  const res = await fetch(`${API_BASE}/scans/compare/${id1}/${id2}`);
  if (!res.ok) throw new Error('Failed to compare scans');
  return res.json();
}

export async function getMigrationProgress(): Promise<MigrationProgress> {
  const res = await fetch(`${API_BASE}/scans/progress`);
  if (!res.ok) throw new Error('Failed to get progress');
  return res.json();
}

export async function checkCompatibility(packageName: string, ecosystem: string = 'npm'): Promise<any> {
  const res = await fetch(`${API_BASE}/compatibility/${packageName}?ecosystem=${ecosystem}`);
  if (!res.ok) throw new Error('Failed to check compatibility');
  return res.json();
}
