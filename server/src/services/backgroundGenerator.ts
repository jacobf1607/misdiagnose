/**
 * Background Case Generator
 *
 * SIMPLIFIED LOGIC (per-user only):
 *   1. Find minimum unseen cases across all active users
 *   2. If min < 10 (MIN_CASES_PER_USER), need to get cases ready
 *   3. Calculate needed = 20 (TARGET) - min
 *   4. First, complete cases from pending queue (prioritize by completion stage)
 *   5. Only generate new Phase 1 cases if pending is empty AND still need cases
 *
 * This ensures:
 *   - No flooding of pending queue
 *   - Efficient processing (closest-to-done first)
 *   - Clear trigger logic based on user needs
 */

import {
  getPoolStatus,
  replenishPool,
  loadIndex,
  findUserNeedingCases
} from './casePoolManager';
import { getActiveUsers } from './userService';
import {
  stopPendingMonitor,
  isMonitorRunning,
  getPendingStatus,
  getPendingBreakdown,
  migrateIncompleteCasesToPending,
  completeCasesFromPending
} from './pendingCaseManager';

let isProcessing = false;
let intervalId: NodeJS.Timeout | null = null;

// Check every 60 seconds
const CHECK_INTERVAL_MS = 60000;

// Maximum cases to generate/complete in one cycle
const MAX_BATCH_SIZE = 10;

// Minimum unseen cases per user - TRIGGER threshold
const MIN_CASES_PER_USER = 10;

// Target unseen cases per user - how many to aim for
const TARGET_CASES_PER_USER = 20;

// Only check users active in the last N days
const ACTIVE_USER_DAYS = 7;

/**
 * Find the minimum unseen case count across all active users
 * Returns { userId, unseenCount } for the user with fewest unseen cases
 */
function getMinUnseenUser(activeUserIds: string[]): { userId: string; unseenCount: number } | null {
  if (activeUserIds.length === 0) return null;

  // Use a very high threshold to get the lowest user regardless
  // findUserNeedingCases returns the user with lowest unseenCount below threshold
  return findUserNeedingCases(activeUserIds, Number.MAX_SAFE_INTEGER);
}

/**
 * Start background monitoring
 */
export function startBackgroundGenerator(): void {
  if (intervalId) {
    console.log('[BackgroundGenerator] Already running');
    return;
  }

  console.log('[BackgroundGenerator] Starting case generator...');
  console.log(`[BackgroundGenerator] Check interval: ${CHECK_INTERVAL_MS / 1000}s`);
  console.log(`[BackgroundGenerator] Trigger: min(unseen per user) < ${MIN_CASES_PER_USER}`);
  console.log(`[BackgroundGenerator] Target: ${TARGET_CASES_PER_USER} unseen per user`);
  console.log(`[BackgroundGenerator] Max batch size: ${MAX_BATCH_SIZE}`);
  console.log(`[BackgroundGenerator] Active user window: ${ACTIVE_USER_DAYS} days`);

  // One-time migration: move incomplete cases from pool to pending
  const migrated = migrateIncompleteCasesToPending();
  if (migrated > 0) {
    console.log(`[BackgroundGenerator] Migrated ${migrated} incomplete cases to pending queue`);
  }

  // Log initial pending status
  const pendingBreakdown = getPendingBreakdown();
  if (pendingBreakdown.total > 0) {
    console.log(`[BackgroundGenerator] Pending queue: ${pendingBreakdown.total} cases (${pendingBreakdown.phase3Incomplete} in Phase 3, ${pendingBreakdown.phase2Incomplete} in Phase 2)`);
  }

  // NOTE: We do NOT start the automatic pending monitor anymore
  // The checkAndReplenish function now handles pending processing directly

  intervalId = setInterval(async () => {
    await checkAndReplenish();
  }, CHECK_INTERVAL_MS);

  // Do an initial check after a short delay
  setTimeout(() => {
    checkAndReplenish();
  }, 5000);
}

/**
 * Stop background monitoring
 */
export function stopBackgroundGenerator(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[BackgroundGenerator] Stopped');
  }
  // Stop pending monitor if it was running
  stopPendingMonitor();
}

/**
 * Main check and replenish logic
 *
 * Flow:
 * 1. Get min(unseen) across all active users
 * 2. If min >= MIN_CASES_PER_USER (10), do nothing
 * 3. Calculate needed = TARGET (20) - min
 * 4. If pending has cases, complete from pending (up to needed)
 * 5. If still need cases AND pending is empty, generate new Phase 1 cases
 */
async function checkAndReplenish(): Promise<void> {
  // Skip if already processing
  if (isProcessing) {
    console.log('[BackgroundGenerator] Already processing, skipping check');
    return;
  }

  // Get active users
  const activeUsers = getActiveUsers(ACTIVE_USER_DAYS);
  const activeUserIds = activeUsers.map(u => u.uid);

  // If no active users, nothing to do
  if (activeUserIds.length === 0) {
    return;
  }

  // Find user with minimum unseen cases
  const minUnseenUser = getMinUnseenUser(activeUserIds);

  if (!minUnseenUser) {
    return;
  }

  const { userId, unseenCount } = minUnseenUser;
  const user = activeUsers.find(u => u.uid === userId);
  const username = user?.username || userId;

  // Check if trigger threshold is met
  if (unseenCount >= MIN_CASES_PER_USER) {
    // All users have enough cases, nothing to do
    return;
  }

  // Calculate how many cases we need
  const needed = Math.min(TARGET_CASES_PER_USER - unseenCount, MAX_BATCH_SIZE);

  console.log(`[BackgroundGenerator] User "${username}" has ${unseenCount} unseen cases (min: ${MIN_CASES_PER_USER})`);
  console.log(`[BackgroundGenerator] Need to get ${needed} more cases ready`);

  isProcessing = true;

  try {
    // Check pending queue
    const pendingBreakdown = getPendingBreakdown();

    if (pendingBreakdown.total > 0) {
      // STEP 1: Complete from pending queue first
      console.log(`[BackgroundGenerator] Pending queue has ${pendingBreakdown.total} cases (${pendingBreakdown.phase3Incomplete} Phase 3, ${pendingBreakdown.phase2Incomplete} Phase 2)`);
      console.log(`[BackgroundGenerator] Completing up to ${needed} cases from pending...`);

      const completed = await completeCasesFromPending(needed);

      console.log(`[BackgroundGenerator] Completed ${completed} cases from pending`);

      // Check if we still need more
      const stillNeeded = needed - completed;
      const newPendingBreakdown = getPendingBreakdown();

      if (stillNeeded > 0 && newPendingBreakdown.total === 0) {
        // Pending is now empty but we still need more - generate new Phase 1
        console.log(`[BackgroundGenerator] Still need ${stillNeeded} cases, generating new batch...`);
        const generated = await replenishPool(stillNeeded);
        console.log(`[BackgroundGenerator] Generated ${generated} new cases (Phase 1)`);
      } else if (stillNeeded > 0) {
        console.log(`[BackgroundGenerator] Still need ${stillNeeded} cases, ${newPendingBreakdown.total} pending - will continue next cycle`);
      } else {
        console.log(`[BackgroundGenerator] Target reached for this cycle`);
      }
    } else {
      // STEP 2: No pending cases - generate new Phase 1 batch
      console.log(`[BackgroundGenerator] Pending queue empty, generating ${needed} new cases...`);
      const generated = await replenishPool(needed);
      console.log(`[BackgroundGenerator] Generated ${generated} new cases (Phase 1)`);
    }

    // Log final status
    const finalMinUser = getMinUnseenUser(activeUserIds);
    if (finalMinUser) {
      const finalUser = activeUsers.find(u => u.uid === finalMinUser.userId);
      console.log(`[BackgroundGenerator] After processing: "${finalUser?.username || finalMinUser.userId}" now has ${finalMinUser.unseenCount} unseen cases`);
    }

  } catch (error) {
    console.error('[BackgroundGenerator] Error during processing:', error);
  } finally {
    isProcessing = false;
  }
}

/**
 * Get generator status
 */
export function getGeneratorStatus(): {
  running: boolean;
  isProcessing: boolean;
  pendingMonitor: boolean;
  pendingCases: number;
  pendingBreakdown: {
    total: number;
    phase2Incomplete: number;
    phase3Incomplete: number;
  };
} {
  const pendingStatus = getPendingStatus();
  const breakdown = getPendingBreakdown();
  return {
    running: intervalId !== null,
    isProcessing,
    pendingMonitor: isMonitorRunning(),
    pendingCases: pendingStatus.total,
    pendingBreakdown: breakdown
  };
}

/**
 * Manually trigger a replenishment check
 */
export async function triggerReplenishment(): Promise<void> {
  await checkAndReplenish();
}
