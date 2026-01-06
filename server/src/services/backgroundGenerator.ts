/**
 * Background Case Generator
 *
 * Monitors pool size and triggers generation when below threshold.
 * Now uses per-user availability checking:
 *   - Gets active users (logged in within last 7 days)
 *   - Checks if ANY user has fewer than MIN_CASES_PER_USER unseen cases
 *   - Triggers generation if so
 *
 * Uses a simple interval-based approach (not a separate worker thread).
 */

import {
  getPoolStatus,
  needsReplenishment,
  replenishPool,
  loadIndex,
  findUserNeedingCases
} from './casePoolManager';
import { getActiveUsers, getAllUserIds } from './userService';
import { startPendingMonitor, stopPendingMonitor, isMonitorRunning, getPendingStatus, migrateIncompleteCasesToPending } from './pendingCaseManager';

let isGenerating = false;
let intervalId: NodeJS.Timeout | null = null;

// Check every 60 seconds
const CHECK_INTERVAL_MS = 60000;

// Generate up to 10 cases at a time (phased generation handles parallelization)
const MAX_CONCURRENT_GENERATION = 10;

// Minimum unseen cases each active user should have available
const MIN_CASES_PER_USER = 10;

// Target: keep generating until each user has this many unseen cases
const TARGET_CASES_PER_USER = 20;

// Only check users active in the last N days
const ACTIVE_USER_DAYS = 7;

/**
 * Start background monitoring
 */
export function startBackgroundGenerator(): void {
  if (intervalId) {
    console.log('[BackgroundGenerator] Already running');
    return;
  }

  console.log('[BackgroundGenerator] Starting pool monitor...');
  console.log(`[BackgroundGenerator] Check interval: ${CHECK_INTERVAL_MS / 1000}s`);

  const index = loadIndex();
  console.log(`[BackgroundGenerator] Min pool size: ${index.generationSettings.minPoolSize}`);
  console.log(`[BackgroundGenerator] Target pool size: ${index.generationSettings.targetPoolSize}`);
  console.log(`[BackgroundGenerator] Min cases per user: ${MIN_CASES_PER_USER}`);
  console.log(`[BackgroundGenerator] Target cases per user: ${TARGET_CASES_PER_USER}`);
  console.log(`[BackgroundGenerator] Active user window: ${ACTIVE_USER_DAYS} days`);

  // One-time migration: move incomplete cases from pool to pending
  const migrated = migrateIncompleteCasesToPending();
  if (migrated > 0) {
    console.log(`[BackgroundGenerator] Migrated ${migrated} incomplete cases to pending queue`);
  }

  // Start the pending case monitor (completes Phase 2-3 for pending cases)
  startPendingMonitor(60000); // Check every 60 seconds

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
  // Also stop the pending monitor
  stopPendingMonitor();
}

/**
 * Check pool and generate if needed
 * Now uses per-user availability checking
 */
async function checkAndReplenish(): Promise<void> {
  // Skip if already generating
  if (isGenerating) {
    console.log('[BackgroundGenerator] Already generating, skipping check');
    return;
  }

  // Get active users (logged in within last N days)
  const activeUsers = getActiveUsers(ACTIVE_USER_DAYS);
  const activeUserIds = activeUsers.map(u => u.uid);
  const status = getPoolStatus();

  // First check: is the total pool below minimum? (regardless of users)
  const totalPoolLow = needsReplenishment();

  // Second check: does any active user have fewer than TARGET unseen cases?
  // (We trigger at MIN but keep generating until TARGET)
  const userNeedingCases = activeUserIds.length > 0
    ? findUserNeedingCases(activeUserIds, TARGET_CASES_PER_USER)
    : null;

  // Decide if we need to generate
  const needsGeneration = totalPoolLow || userNeedingCases !== null;

  if (!needsGeneration) {
    return;
  }

  isGenerating = true;

  // Log why we're generating
  if (userNeedingCases) {
    const user = activeUsers.find(u => u.uid === userNeedingCases.userId);
    console.log(`[BackgroundGenerator] User "${user?.username || userNeedingCases.userId}" only has ${userNeedingCases.unseenCount} unseen cases (min: ${MIN_CASES_PER_USER})`);
  } else if (totalPoolLow) {
    console.log(`[BackgroundGenerator] Pool low (${status.totalCases} total, need ${status.needsGeneration} more)`);
  }

  try {
    // Generate cases - aim for TARGET, not just MIN
    const toGenerate = Math.min(
      userNeedingCases
        ? TARGET_CASES_PER_USER - userNeedingCases.unseenCount  // Generate enough to reach target
        : status.needsGeneration,
      MAX_CONCURRENT_GENERATION
    );
    console.log(`[BackgroundGenerator] Generating ${toGenerate} cases (target: ${TARGET_CASES_PER_USER} per user)...`);

    const generated = await replenishPool(toGenerate);
    console.log(`[BackgroundGenerator] Generated ${generated} cases`);

    // Check if any user still needs more (below TARGET)
    const stillNeedingUser = activeUserIds.length > 0
      ? findUserNeedingCases(activeUserIds, TARGET_CASES_PER_USER)
      : null;

    if (stillNeedingUser) {
      const user = activeUsers.find(u => u.uid === stillNeedingUser.userId);
      console.log(`[BackgroundGenerator] User "${user?.username || stillNeedingUser.userId}" has ${stillNeedingUser.unseenCount}/${TARGET_CASES_PER_USER} unseen cases, will continue next cycle`);
    } else {
      console.log(`[BackgroundGenerator] All users have ${TARGET_CASES_PER_USER}+ unseen cases`);
    }
  } catch (error) {
    console.error('[BackgroundGenerator] Error during generation:', error);
  } finally {
    isGenerating = false;
  }
}

/**
 * Get generator status
 */
export function getGeneratorStatus(): {
  running: boolean;
  isGenerating: boolean;
  pendingMonitor: boolean;
  pendingCases: number;
} {
  const pendingStatus = getPendingStatus();
  return {
    running: intervalId !== null,
    isGenerating,
    pendingMonitor: isMonitorRunning(),
    pendingCases: pendingStatus.total
  };
}

/**
 * Manually trigger a replenishment check
 */
export async function triggerReplenishment(): Promise<void> {
  await checkAndReplenish();
}
