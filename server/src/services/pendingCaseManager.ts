/**
 * Pending Case Manager
 *
 * Handles cases that are partially generated (Phase 1 complete, waiting for Phase 2-3).
 * Ensures no case is ever lost - they persist on disk until fully complete.
 *
 * Flow:
 * 1. Phase 1 (case JSON) → Save to /pending/ with status
 * 2. Background monitor picks up pending cases
 * 3. Phase 2 (pathway) → Update pending case
 * 4. Phase 3 (explanations) → Update pending case
 * 5. All complete → Move to /pool/
 */

import * as fs from 'fs';
import * as path from 'path';
import { Case } from '../types';
import { generateIdealPathway, generateSingleDiagnosisExplanation } from './openai';
import { addCaseToPool, saveCaseFile, loadIndex, saveIndex, loadCaseFile } from './casePoolManager';

const DATA_DIR = path.join(__dirname, '../data');
const PENDING_DIR = path.join(DATA_DIR, 'pending');

// Pending case status
interface PendingCaseStatus {
  caseId: string;
  domain: string;
  createdAt: number;
  lastAttempt: number;
  attemptCount: number;
  phase1Complete: boolean;
  phase2Complete: boolean;
  phase3Progress: number; // Number of explanations generated (0-10)
  phase3Total: number;    // Total explanations needed
  error?: string;
}

interface PendingIndex {
  cases: PendingCaseStatus[];
  lastUpdated: number;
}

// Ensure pending directory exists
function ensurePendingDir(): void {
  if (!fs.existsSync(PENDING_DIR)) {
    fs.mkdirSync(PENDING_DIR, { recursive: true });
    console.log('[PendingCases] Created pending directory');
  }
}

// Load pending index
function loadPendingIndex(): PendingIndex {
  ensurePendingDir();
  const indexPath = path.join(PENDING_DIR, 'pending-index.json');

  if (!fs.existsSync(indexPath)) {
    return { cases: [], lastUpdated: Date.now() };
  }

  try {
    const data = fs.readFileSync(indexPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[PendingCases] Error loading index:', error);
    return { cases: [], lastUpdated: Date.now() };
  }
}

// Save pending index
function savePendingIndex(index: PendingIndex): void {
  ensurePendingDir();
  const indexPath = path.join(PENDING_DIR, 'pending-index.json');
  index.lastUpdated = Date.now();
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
}

// Load a pending case file
function loadPendingCase(caseId: string): Case | null {
  const casePath = path.join(PENDING_DIR, `${caseId}.json`);

  if (!fs.existsSync(casePath)) {
    return null;
  }

  try {
    const data = fs.readFileSync(casePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`[PendingCases] Error loading case ${caseId}:`, error);
    return null;
  }
}

// Save a pending case file
function savePendingCase(caseData: Case): void {
  ensurePendingDir();
  const casePath = path.join(PENDING_DIR, `${caseData.id}.json`);
  fs.writeFileSync(casePath, JSON.stringify(caseData, null, 2));
}

// Delete a pending case (after moving to pool or permanent failure)
function deletePendingCase(caseId: string): void {
  const casePath = path.join(PENDING_DIR, `${caseId}.json`);
  if (fs.existsSync(casePath)) {
    fs.unlinkSync(casePath);
  }

  // Remove from index
  const index = loadPendingIndex();
  index.cases = index.cases.filter(c => c.caseId !== caseId);
  savePendingIndex(index);
}

/**
 * Add a Phase 1 case to pending queue
 */
export function addToPending(caseData: Case, domain: string): void {
  ensurePendingDir();

  // Initialize precomputedExplanations if not present
  if (!caseData.precomputedExplanations) {
    caseData.precomputedExplanations = [];
  }

  // Save case file
  savePendingCase(caseData);

  // Add to index
  const index = loadPendingIndex();

  const status: PendingCaseStatus = {
    caseId: caseData.id,
    domain,
    createdAt: Date.now(),
    lastAttempt: 0,
    attemptCount: 0,
    phase1Complete: true,
    phase2Complete: !!caseData.idealPathway,
    phase3Progress: caseData.precomputedExplanations?.length || 0,
    phase3Total: caseData.diagnoses?.length || 10
  };

  // Check if already exists
  const existingIndex = index.cases.findIndex(c => c.caseId === caseData.id);
  if (existingIndex >= 0) {
    index.cases[existingIndex] = status;
  } else {
    index.cases.push(status);
  }

  savePendingIndex(index);
  console.log(`[PendingCases] Added case ${caseData.id} to pending queue`);
}

/**
 * Get count of pending cases
 */
export function getPendingCount(): number {
  const index = loadPendingIndex();
  return index.cases.length;
}

/**
 * Get pending cases status
 */
export function getPendingStatus(): { total: number; statuses: PendingCaseStatus[] } {
  const index = loadPendingIndex();
  return {
    total: index.cases.length,
    statuses: index.cases
  };
}

/**
 * Process a single pending case - try to complete Phase 2 and 3
 * Returns true if case was completed and moved to pool
 */
export async function processPendingCase(caseId: string): Promise<boolean> {
  const index = loadPendingIndex();
  const statusIndex = index.cases.findIndex(c => c.caseId === caseId);

  if (statusIndex === -1) {
    console.warn(`[PendingCases] Case ${caseId} not found in pending index`);
    return false;
  }

  const status = index.cases[statusIndex];
  const caseData = loadPendingCase(caseId);

  if (!caseData) {
    console.error(`[PendingCases] Case file ${caseId} not found, removing from index`);
    deletePendingCase(caseId);
    return false;
  }

  // Update attempt tracking
  status.lastAttempt = Date.now();
  status.attemptCount++;

  console.log(`[PendingCases] Processing case ${caseId} (attempt ${status.attemptCount})`);

  try {
    // PHASE 2: Generate pathway if needed
    if (!status.phase2Complete) {
      const correctDiagnosis = caseData.diagnoses.find(d => d.id === caseData.correctDiagnosisId);

      if (correctDiagnosis) {
        console.log(`[PendingCases] Generating pathway for ${correctDiagnosis.name}...`);

        const pathway = await generateIdealPathway(correctDiagnosis.name, status.domain, caseData);

        if (pathway) {
          caseData.idealPathway = pathway;
          status.phase2Complete = true;
          savePendingCase(caseData);
          console.log(`[PendingCases] ✓ Pathway complete for ${caseId}`);
        } else {
          status.error = 'Failed to generate pathway';
          savePendingIndex(index);
          return false;
        }
      }
    }

    // PHASE 3: Generate remaining explanations
    if (!caseData.precomputedExplanations) {
      caseData.precomputedExplanations = [];
    }

    const existingIds = new Set(caseData.precomputedExplanations.map((e: any) => e.diagnosisId));

    for (const diagnosis of caseData.diagnoses) {
      if (existingIds.has(diagnosis.id)) continue;

      console.log(`[PendingCases] Generating explanation for ${diagnosis.name}...`);

      try {
        const explanation = await generateSingleDiagnosisExplanation(caseData, diagnosis.id);

        if (explanation) {
          caseData.precomputedExplanations.push(explanation);
          status.phase3Progress = caseData.precomputedExplanations.length;
          savePendingCase(caseData);
          savePendingIndex(index);
          console.log(`[PendingCases] ✓ Explanation ${status.phase3Progress}/${status.phase3Total} for ${caseId}`);
        }
      } catch (error) {
        console.error(`[PendingCases] Error generating explanation for ${diagnosis.name}:`, error);
        // Continue with other explanations
      }

      // Small delay between API calls
      await new Promise(r => setTimeout(r, 500));
    }

    // Check if fully complete
    const isComplete =
      status.phase2Complete &&
      (caseData.precomputedExplanations?.length || 0) >= caseData.diagnoses.length;

    if (isComplete) {
      console.log(`[PendingCases] Case ${caseId} fully complete, moving to pool...`);

      try {
        // Add to main pool
        addCaseToPool(caseData, false);

        // Remove from pending
        deletePendingCase(caseId);

        console.log(`[PendingCases] ✓ Case ${caseId} moved to pool`);
        return true;
      } catch (error) {
        console.error(`[PendingCases] Error adding ${caseId} to pool:`, error);
        status.error = `Pool error: ${error}`;
      }
    }

    // Save updated status
    index.cases[statusIndex] = status;
    savePendingIndex(index);

    return false;
  } catch (error) {
    console.error(`[PendingCases] Error processing ${caseId}:`, error);
    status.error = String(error);
    index.cases[statusIndex] = status;
    savePendingIndex(index);
    return false;
  }
}

/**
 * Complete cases from pending queue to fill pool
 *
 * SMART PROCESSING: Only processes what's needed, prioritizes cases closest to completion.
 *
 * Priority order:
 * 1. Phase 2 complete + most explanations (closest to done)
 * 2. Phase 2 complete + fewer explanations
 * 3. Phase 2 incomplete (needs pathway + explanations)
 *
 * @param needed - Number of cases to complete
 * @returns Number of cases actually completed
 */
export async function completeCasesFromPending(needed: number): Promise<number> {
  if (needed <= 0) {
    console.log('[PendingCases] No cases needed');
    return 0;
  }

  const index = loadPendingIndex();
  if (index.cases.length === 0) {
    console.log('[PendingCases] No pending cases to process');
    return 0;
  }

  console.log(`[PendingCases] Completing up to ${needed} cases from ${index.cases.length} pending...`);

  // Sort by completion stage: cases closest to done first
  // Priority:
  // 1. Phase 2 complete + has most explanations (closest to done)
  // 2. Phase 2 complete + fewer explanations
  // 3. Phase 2 incomplete (needs pathway + explanations)
  const sortedCases = [...index.cases].sort((a, b) => {
    // Phase 2 complete cases come first
    if (a.phase2Complete && !b.phase2Complete) return -1;
    if (!a.phase2Complete && b.phase2Complete) return 1;

    // Among Phase 2 complete, sort by explanation progress (descending - more progress first)
    if (a.phase2Complete && b.phase2Complete) {
      const aProgress = a.phase3Progress / a.phase3Total;
      const bProgress = b.phase3Progress / b.phase3Total;
      return bProgress - aProgress;
    }

    // For Phase 2 incomplete, sort by attempt count (fewer attempts first)
    return a.attemptCount - b.attemptCount;
  });

  let completed = 0;

  for (const status of sortedCases) {
    // Stop if we've completed enough
    if (completed >= needed) {
      console.log(`[PendingCases] ✓ Reached target of ${needed} completed cases`);
      break;
    }

    // Delete if too many attempts (permanent failure)
    if (status.attemptCount >= 10) {
      console.warn(`[PendingCases] Case ${status.caseId} failed 10 times, deleting`);
      deletePendingCase(status.caseId);
      continue;
    }

    // Skip if attempted very recently (within 30 seconds) - avoid hammering
    const timeSinceAttempt = Date.now() - status.lastAttempt;
    if (status.attemptCount > 0 && timeSinceAttempt < 30000) {
      continue;
    }

    // Log what we're processing
    const phase = status.phase2Complete
      ? `Phase 3 (${status.phase3Progress}/${status.phase3Total} explanations)`
      : 'Phase 2 (needs pathway)';
    console.log(`[PendingCases] Processing ${status.caseId} - ${phase}`);

    // Process this case
    const wasCompleted = await processPendingCase(status.caseId);
    if (wasCompleted) {
      completed++;
      console.log(`[PendingCases] ✓ Completed ${completed}/${needed} cases`);
    }

    // Small delay between cases to avoid overwhelming APIs
    await new Promise(r => setTimeout(r, 500));
  }

  const remaining = getPendingCount();
  console.log(`[PendingCases] Finished batch: ${completed} completed, ${remaining} still pending`);

  return completed;
}

/**
 * Get breakdown of pending cases by phase
 */
export function getPendingBreakdown(): {
  total: number;
  phase2Incomplete: number;  // Need pathway
  phase3Incomplete: number;  // Have pathway, need explanations
} {
  const index = loadPendingIndex();

  let phase2Incomplete = 0;
  let phase3Incomplete = 0;

  for (const status of index.cases) {
    if (!status.phase2Complete) {
      phase2Incomplete++;
    } else if (status.phase3Progress < status.phase3Total) {
      phase3Incomplete++;
    }
  }

  return {
    total: index.cases.length,
    phase2Incomplete,
    phase3Incomplete
  };
}

/**
 * Process all pending cases (legacy - used by monitor for gradual background processing)
 * @deprecated Use completeCasesFromPending for targeted processing
 */
export async function processAllPending(): Promise<{ completed: number; remaining: number }> {
  const index = loadPendingIndex();

  if (index.cases.length === 0) {
    return { completed: 0, remaining: 0 };
  }

  console.log(`[PendingCases] Processing ${index.cases.length} pending cases...`);

  let completed = 0;

  // Sort by attempt count (process least-attempted first)
  const sortedCases = [...index.cases].sort((a, b) => a.attemptCount - b.attemptCount);

  for (const status of sortedCases) {
    // Skip if attempted recently (within 5 minutes) and has many attempts
    const timeSinceAttempt = Date.now() - status.lastAttempt;
    const backoffTime = Math.min(status.attemptCount * 60000, 300000); // Up to 5 min backoff

    if (status.attemptCount > 0 && timeSinceAttempt < backoffTime) {
      console.log(`[PendingCases] Skipping ${status.caseId} (backoff: ${Math.round(backoffTime/1000)}s)`);
      continue;
    }

    // Delete if too many attempts (likely permanent failure)
    if (status.attemptCount >= 10) {
      console.warn(`[PendingCases] Case ${status.caseId} failed 10 times, deleting`);
      deletePendingCase(status.caseId);
      continue;
    }

    const wasCompleted = await processPendingCase(status.caseId);
    if (wasCompleted) {
      completed++;
    }

    // Delay between cases
    await new Promise(r => setTimeout(r, 1000));
  }

  const remaining = getPendingCount();
  console.log(`[PendingCases] Processed: ${completed} completed, ${remaining} remaining`);

  return { completed, remaining };
}

/**
 * Start the pending case monitor
 * Runs periodically to complete pending cases
 */
let monitorInterval: NodeJS.Timeout | null = null;
let isProcessing = false;

export function startPendingMonitor(intervalMs: number = 60000): void {
  if (monitorInterval) {
    console.log('[PendingCases] Monitor already running');
    return;
  }

  console.log(`[PendingCases] Starting monitor (interval: ${intervalMs/1000}s)`);

  // Initial check after 10 seconds
  setTimeout(async () => {
    if (!isProcessing) {
      isProcessing = true;
      await processAllPending();
      isProcessing = false;
    }
  }, 10000);

  // Regular interval
  monitorInterval = setInterval(async () => {
    if (isProcessing) {
      console.log('[PendingCases] Monitor: Still processing, skipping this cycle');
      return;
    }

    isProcessing = true;
    try {
      await processAllPending();
    } catch (error) {
      console.error('[PendingCases] Monitor error:', error);
    } finally {
      isProcessing = false;
    }
  }, intervalMs);
}

export function stopPendingMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log('[PendingCases] Monitor stopped');
  }
}

export function isMonitorRunning(): boolean {
  return monitorInterval !== null;
}

/**
 * Migrate incomplete cases from pool to pending
 * One-time migration for existing incomplete cases
 * Returns count of cases migrated
 */
export function migrateIncompleteCasesToPending(): number {
  console.log('[PendingCases] Scanning pool for incomplete cases...');

  const poolIndex = loadIndex();
  const incompleteCaseIds: string[] = [];

  // Find incomplete cases in pool
  for (const meta of poolIndex.cases) {
    const caseData = loadCaseFile(meta.caseId);
    if (!caseData) continue;

    const hasPathway = !!caseData.idealPathway;
    const hasAllExplanations = (caseData.precomputedExplanations?.length || 0) >= (caseData.diagnoses?.length || 10);

    if (!hasPathway || !hasAllExplanations) {
      console.log(`[PendingCases] Found incomplete: ${meta.caseId} (pathway: ${hasPathway}, explanations: ${caseData.precomputedExplanations?.length || 0}/${caseData.diagnoses?.length || 10})`);
      incompleteCaseIds.push(meta.caseId);

      // Add to pending
      addToPending(caseData, meta.domain);
    }
  }

  if (incompleteCaseIds.length === 0) {
    console.log('[PendingCases] No incomplete cases found in pool');
    return 0;
  }

  // Remove incomplete cases from pool index
  poolIndex.cases = poolIndex.cases.filter(c => !incompleteCaseIds.includes(c.caseId));
  poolIndex.totalCases = poolIndex.cases.length;
  poolIndex.availableCases = poolIndex.cases.filter(c => c.status === 'available').length;
  saveIndex(poolIndex);

  console.log(`[PendingCases] Migrated ${incompleteCaseIds.length} incomplete cases to pending`);
  console.log(`[PendingCases] Pool now has ${poolIndex.totalCases} cases`);

  return incompleteCaseIds.length;
}
