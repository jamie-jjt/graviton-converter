import { ScanResult, ScanSource } from './types';

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
