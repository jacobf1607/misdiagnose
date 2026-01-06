/**
 * Case Pool Manager - Manages pre-generated case storage and allocation
 *
 * Storage structure:
 *   server/src/data/cases/
 *     pool-index.json        # Metadata index
 *     case_<id>.json         # Individual case files
 *     sample.json            # Original sample (kept for testing)
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  Case,
  CaseMetadata,
  CasePoolIndex,
  CaseAllocationRequest,
  CaseAllocationResult,
  PoolStatus
} from '../types';
import {
  generateCase as generateCaseFromAI,
  generateIdealPathway,
  generateSingleDiagnosisExplanation,
  GenerateCaseOptions
} from './openai';
import { addToPending, getPendingCount } from './pendingCaseManager';

// Constants
const CASES_DIR = path.join(__dirname, '../data/cases');
const INDEX_FILE = path.join(CASES_DIR, 'pool-index.json');

const DEFAULT_MIN_POOL_SIZE = 2;
const DEFAULT_TARGET_POOL_SIZE = 10;

const DOMAINS = [
  'cardiology',
  'respiratory',
  'gastroenterology',
  'neurology',
  'nephrology',
  'hematology',
  'endocrinology',
  'rheumatology',
  'infectious diseases',
  'dermatology'
];

// In-memory cache of index
let indexCache: CasePoolIndex | null = null;

/**
 * Create a default empty pool index
 */
function createDefaultIndex(): CasePoolIndex {
  return {
    version: '1.0.0',
    lastUpdated: Date.now(),
    totalCases: 0,
    availableCases: 0,
    cases: [],
    generationSettings: {
      minPoolSize: DEFAULT_MIN_POOL_SIZE,
      targetPoolSize: DEFAULT_TARGET_POOL_SIZE,
      domainsEnabled: DOMAINS
    }
  };
}

/**
 * Initialize the case pool (create index if doesn't exist)
 */
export async function initializePool(): Promise<CasePoolIndex> {
  // Ensure cases directory exists
  if (!fs.existsSync(CASES_DIR)) {
    fs.mkdirSync(CASES_DIR, { recursive: true });
  }

  // Create index file if doesn't exist
  if (!fs.existsSync(INDEX_FILE)) {
    const defaultIndex = createDefaultIndex();
    saveIndex(defaultIndex);
    console.log('[CasePool] Created new pool index');
    return defaultIndex;
  }

  // Load existing index
  const index = loadIndex();
  console.log(`[CasePool] Loaded pool with ${index.totalCases} cases (${index.availableCases} available)`);
  return index;
}

/**
 * Load the pool index from disk
 */
export function loadIndex(): CasePoolIndex {
  if (indexCache) {
    return indexCache;
  }

  try {
    const data = fs.readFileSync(INDEX_FILE, 'utf-8');
    indexCache = JSON.parse(data);
    return indexCache!;
  } catch (error) {
    console.error('[CasePool] Error loading index, creating default:', error);
    const defaultIndex = createDefaultIndex();
    saveIndex(defaultIndex);
    return defaultIndex;
  }
}

/**
 * Save the pool index to disk
 */
export function saveIndex(index: CasePoolIndex): void {
  index.lastUpdated = Date.now();

  // Recalculate counts
  index.totalCases = index.cases.length;
  index.availableCases = index.cases.filter(c => c.status === 'available').length;

  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
  indexCache = index;
}

/**
 * Load a case file by ID
 */
export function loadCaseFile(caseId: string): Case | null {
  const casePath = path.join(CASES_DIR, `${caseId}.json`);

  try {
    const data = fs.readFileSync(casePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`[CasePool] Error loading case ${caseId}:`, error);
    return null;
  }
}

/**
 * Save a case file to disk
 */
export function saveCaseFile(caseData: Case): void {
  const casePath = path.join(CASES_DIR, `${caseData.id}.json`);
  fs.writeFileSync(casePath, JSON.stringify(caseData, null, 2));
}

/**
 * Allocate a case for a new game
 * - Excludes cases the user has already seen (via usedBy array)
 * - Filters by domain if specified
 * - Falls back to fresh generation if pool empty
 * - Adds userId to usedBy at allocation time (not on release)
 */
export async function allocateCase(
  request: CaseAllocationRequest
): Promise<CaseAllocationResult> {
  // IMPORTANT: Clear cache and reload from disk to get fresh usedBy data
  indexCache = null;
  const index = loadIndex();

  // Start with all cases (no status filter - we don't use in_use anymore)
  let availableCases = [...index.cases];

  console.log(`[CasePool] Total cases in pool: ${availableCases.length}`);

  // CRITICAL: Filter out incomplete cases (missing idealPathway or precomputedExplanations)
  // This prevents players from getting cases without coaching or instant explanations
  const beforeCompleteness = availableCases.length;
  availableCases = availableCases.filter(meta => {
    const caseData = loadCaseFile(meta.caseId);
    if (!caseData) return false;

    const hasPathway = !!caseData.idealPathway;
    const hasExplanations = (caseData.precomputedExplanations?.length || 0) >= (caseData.diagnoses?.length || 10);

    if (!hasPathway || !hasExplanations) {
      console.log(`[CasePool] Filtering out incomplete case ${meta.caseId} (pathway: ${hasPathway}, explanations: ${caseData.precomputedExplanations?.length || 0})`);
      return false;
    }
    return true;
  });
  if (beforeCompleteness !== availableCases.length) {
    console.log(`[CasePool] Filtered out ${beforeCompleteness - availableCases.length} incomplete cases`);
  }
  console.log(`[CasePool] Request userId: ${request.userId || 'NONE'}`);

  // Exclude cases user has seen
  if (request.userId) {
    const beforeFilter = availableCases.length;
    availableCases = availableCases.filter(c => {
      const seen = c.usedBy.includes(request.userId!);
      if (seen) {
        console.log(`[CasePool] Filtering out ${c.caseId} - user already seen`);
      }
      return !seen;
    });
    console.log(`[CasePool] After user filter: ${availableCases.length} cases (filtered out ${beforeFilter - availableCases.length})`);
  }

  // Filter by domain
  if (request.domain) {
    availableCases = availableCases.filter(c => c.domain === request.domain);
  }

  // Exclude specific case IDs
  if (request.excludeCaseIds && request.excludeCaseIds.length > 0) {
    availableCases = availableCases.filter(c => !request.excludeCaseIds!.includes(c.caseId));
  }

  // If we have cases, pick one randomly
  if (availableCases.length > 0) {
    const selectedMeta = availableCases[Math.floor(Math.random() * availableCases.length)];
    const caseData = loadCaseFile(selectedMeta.caseId);

    if (caseData) {
      // Track usage immediately at allocation time
      const caseIndex = index.cases.findIndex(c => c.caseId === selectedMeta.caseId);
      if (caseIndex !== -1) {
        // Add user to usedBy so they won't see this case again
        if (request.userId && !index.cases[caseIndex].usedBy.includes(request.userId)) {
          index.cases[caseIndex].usedBy.push(request.userId);
        }
        index.cases[caseIndex].usedCount++;
        index.cases[caseIndex].lastUsedAt = Date.now();
        saveIndex(index);
      }

      console.log(`[CasePool] Allocated case ${selectedMeta.caseId} (${selectedMeta.domain}: ${selectedMeta.correctDiagnosis})${request.userId ? ` to user ${request.userId}` : ''}`);

      return {
        case: caseData,
        metadata: selectedMeta,
        fromPool: true
      };
    }
  }

  // No cases available - generate fresh (includes all explanations one-by-one)
  console.log('[CasePool] No available cases, generating fresh...');
  const freshCase = await generateCaseFromAI(request.domain);

  // Add to pool for future use (will be available to other users)
  const metadata = addCaseToPool(freshCase);

  // Track usage for this user
  if (request.userId) {
    const updatedIndex = loadIndex();
    const caseIndex = updatedIndex.cases.findIndex(c => c.caseId === metadata.caseId);
    if (caseIndex !== -1) {
      updatedIndex.cases[caseIndex].usedBy.push(request.userId);
      updatedIndex.cases[caseIndex].usedCount++;
      saveIndex(updatedIndex);
    }
  }

  return {
    case: freshCase,
    metadata,
    fromPool: false
  };
}

/**
 * Release a case back to the pool (when game ends)
 * @deprecated No longer needed - usedBy is tracked at allocation time now
 * Kept for backwards compatibility but does nothing
 */
export function releaseCase(_caseId: string, _userId?: string): void {
  // No-op: usedBy tracking now happens at allocation time in allocateCase()
  // Cases are always available to users who haven't seen them
}

/**
 * Mark a case as used by a user (for tracking without full allocation)
 * Used when playing challenges or games with specific caseId to prevent repeats
 */
export function markCaseAsUsed(caseId: string, userId: string): boolean {
  if (!userId) return false;

  const index = loadIndex();
  const caseIndex = index.cases.findIndex(c => c.caseId === caseId);

  if (caseIndex === -1) {
    console.log(`[CasePool] Case ${caseId} not found in pool index`);
    return false;
  }

  // Check if already marked
  if (index.cases[caseIndex].usedBy.includes(userId)) {
    console.log(`[CasePool] Case ${caseId} already marked as used by ${userId}`);
    return true; // Already tracked, still success
  }

  // Add user to usedBy
  index.cases[caseIndex].usedBy.push(userId);
  index.cases[caseIndex].usedCount++;
  index.cases[caseIndex].lastUsedAt = Date.now();
  saveIndex(index);

  console.log(`[CasePool] Marked case ${caseId} as used by ${userId}`);
  return true;
}

/**
 * Check if a user has already seen a specific case
 */
export function hasUserSeenCase(caseId: string, userId: string): boolean {
  if (!userId) return false;

  const index = loadIndex();
  const caseMeta = index.cases.find(c => c.caseId === caseId);

  if (!caseMeta) return false;

  return caseMeta.usedBy.includes(userId);
}

/**
 * Add a newly generated case to the pool
 * Can add incomplete cases (without pathway/explanations) for immediate availability
 */
export function addCaseToPool(caseData: Case, allowIncomplete: boolean = false): CaseMetadata {
  // Validate required fields
  if (!caseData.diagnoses || caseData.diagnoses.length === 0) {
    throw new Error(`Cannot add case ${caseData.id} to pool: missing diagnoses`);
  }

  // Unless explicitly allowed, require complete cases
  if (!allowIncomplete) {
    if (!caseData.idealPathway) {
      throw new Error(`Cannot add case ${caseData.id} to pool: missing idealPathway (coaching data)`);
    }
    if (!caseData.precomputedExplanations || caseData.precomputedExplanations.length === 0) {
      throw new Error(`Cannot add case ${caseData.id} to pool: missing precomputedExplanations`);
    }
  }

  const index = loadIndex();

  // Get correct diagnosis name
  const correctDiagnosis = caseData.diagnoses.find(d => d.id === caseData.correctDiagnosisId);

  const metadata: CaseMetadata = {
    caseId: caseData.id,
    filename: `${caseData.id}.json`,
    domain: caseData.domain || 'general',
    correctDiagnosis: correctDiagnosis?.name || 'Unknown',
    status: 'available',
    createdAt: Date.now(),
    usedBy: [],
    usedCount: 0,
    hasIdealPathway: !!caseData.idealPathway
  };

  // Save case file
  saveCaseFile(caseData);

  // Add to index
  index.cases.push(metadata);
  saveIndex(index);

  console.log(`[CasePool] Added case ${caseData.id} (${metadata.domain}: ${metadata.correctDiagnosis})`);

  return metadata;
}

/**
 * Get current pool status
 */
export function getPoolStatus(): PoolStatus {
  const index = loadIndex();

  // Count by domain - all cases are always available (no in_use status anymore)
  const byDomain: Record<string, { total: number; available: number }> = {};

  for (const domain of DOMAINS) {
    const domainCases = index.cases.filter(c => c.domain === domain);
    byDomain[domain] = {
      total: domainCases.length,
      available: domainCases.length  // All cases are available
    };
  }

  const totalCases = index.cases.length;
  const belowThreshold = totalCases < index.generationSettings.minPoolSize;
  const needsGeneration = belowThreshold
    ? index.generationSettings.targetPoolSize - totalCases
    : 0;

  return {
    totalCases,
    availableCases: totalCases,  // All cases are available
    inUseCases: 0,  // No longer tracking in_use
    byDomain,
    belowThreshold,
    needsGeneration
  };
}

/**
 * Get random cases for test mode
 * Returns metadata for N random cases from the pool
 */
export function getTestModeCases(count: number = 3): CaseMetadata[] {
  const index = loadIndex();

  if (index.cases.length === 0) {
    return [];
  }

  // Shuffle and take first N
  const shuffled = [...index.cases].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Check if pool needs replenishment
 */
export function needsReplenishment(): boolean {
  const status = getPoolStatus();
  return status.belowThreshold;
}

/**
 * Generate cases to replenish pool
 * Uses a fault-tolerant 2-stage approach:
 * 1. Generate Phase 1 cases (basic JSON) and add to PENDING queue
 * 2. Background monitor completes Phase 2-3 and moves to pool
 *
 * This ensures:
 * - No case is ever lost after Phase 1 (persisted to pending/)
 * - Server restarts don't lose work
 * - Failed phases get retried automatically
 * - Only complete cases ever reach the pool
 */
export async function replenishPool(count?: number): Promise<number> {
  const status = getPoolStatus();
  const pendingCount = getPendingCount();

  // Consider pending cases when deciding how many to generate
  const effectivePool = status.totalCases + pendingCount;
  const toGenerate = count ?? Math.max(0, status.needsGeneration - pendingCount);

  if (toGenerate <= 0) {
    if (pendingCount > 0) {
      console.log(`[CasePool] Pool has ${status.totalCases} cases + ${pendingCount} pending, no new generation needed`);
    }
    return 0;
  }

  console.log(`[CasePool] Generating ${toGenerate} new cases (current: ${status.totalCases} pool + ${pendingCount} pending)...`);
  const startTime = Date.now();

  // Pick random domains for each case
  const domains = Array.from({ length: toGenerate }, () =>
    DOMAINS[Math.floor(Math.random() * DOMAINS.length)]
  );

  // PHASE 1 ONLY: Generate case JSONs and add to pending queue
  // The pending monitor will complete Phase 2-3 automatically
  console.log(`[CasePool] Generating ${toGenerate} case JSONs...`);

  let addedToPending = 0;

  for (let i = 0; i < domains.length; i++) {
    const domain = domains[i];
    console.log(`[CasePool] Generating case ${i + 1}/${toGenerate} (${domain})...`);

    try {
      const caseData = await generateCaseFromAI({ domain, skipPathway: true, skipPrecompute: true });

      if (caseData) {
        // Add to pending queue - monitor will complete it
        addToPending(caseData, domain);
        addedToPending++;
        console.log(`[CasePool] ✓ Case ${caseData.id} added to pending queue`);
      }
    } catch (error) {
      console.error(`[CasePool] Error generating case ${i + 1}:`, error);
    }

    // Small delay between generations
    if (i < domains.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[CasePool] Added ${addedToPending}/${toGenerate} cases to pending queue in ${elapsed}s`);
  console.log(`[CasePool] Pending monitor will complete Phase 2-3 automatically`);

  return addedToPending;
}

/**
 * Filter cases by criteria
 */
export function filterAvailableCases(
  domain?: string,
  excludeUserIds?: string[],
  excludeCaseIds?: string[]
): CaseMetadata[] {
  const index = loadIndex();

  let cases = [...index.cases];  // All cases are available

  if (domain) {
    cases = cases.filter(c => c.domain === domain);
  }

  if (excludeUserIds && excludeUserIds.length > 0) {
    cases = cases.filter(c =>
      !excludeUserIds.some(userId => c.usedBy.includes(userId))
    );
  }

  if (excludeCaseIds && excludeCaseIds.length > 0) {
    cases = cases.filter(c => !excludeCaseIds.includes(c.caseId));
  }

  return cases;
}

/**
 * Delete a case from the pool
 */
export function deleteCaseFromPool(caseId: string): boolean {
  const index = loadIndex();
  const caseIndex = index.cases.findIndex(c => c.caseId === caseId);

  if (caseIndex === -1) {
    return false;
  }

  // Remove from index
  index.cases.splice(caseIndex, 1);
  saveIndex(index);

  // Delete file
  const casePath = path.join(CASES_DIR, `${caseId}.json`);
  try {
    if (fs.existsSync(casePath)) {
      fs.unlinkSync(casePath);
    }
  } catch (error) {
    console.error(`[CasePool] Error deleting case file ${caseId}:`, error);
  }

  console.log(`[CasePool] Deleted case ${caseId}`);
  return true;
}

/**
 * Clear the in-memory cache (useful for testing)
 */
export function clearCache(): void {
  indexCache = null;
}

/**
 * Count how many unseen cases are available for a specific user
 * Used by background generator to check per-user availability
 */
export function countUnseenCasesForUser(userId: string): number {
  // Clear cache to get fresh data
  indexCache = null;
  const index = loadIndex();

  return index.cases.filter(c => !c.usedBy.includes(userId)).length;
}

/**
 * Check if any user from a list has fewer than minCases unseen
 * Returns the user with the fewest unseen cases (if any are below threshold)
 */
export function findUserNeedingCases(
  userIds: string[],
  minCases: number
): { userId: string; unseenCount: number } | null {
  // Clear cache to get fresh data
  indexCache = null;
  const index = loadIndex();

  let lowestUser: { userId: string; unseenCount: number } | null = null;

  for (const userId of userIds) {
    const unseenCount = index.cases.filter(c => !c.usedBy.includes(userId)).length;

    if (unseenCount < minCases) {
      if (!lowestUser || unseenCount < lowestUser.unseenCount) {
        lowestUser = { userId, unseenCount };
      }
    }
  }

  return lowestUser;
}
