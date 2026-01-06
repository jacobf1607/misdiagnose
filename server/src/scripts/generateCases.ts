#!/usr/bin/env ts-node
/**
 * CLI Script: Generate pre-generated cases for the case pool
 *
 * Usage:
 *   npm run generate-cases 5              # Generate 5 random cases
 *   npm run generate-cases 3 cardiology   # Generate 3 cardiology cases
 *   npm run generate-cases --fill         # Fill pool to target size
 *   npm run generate-cases --status       # Show pool status
 */

import 'dotenv/config';
import {
  initializePool,
  getPoolStatus,
  addCaseToPool,
  loadIndex,
  loadCaseFile,
  saveCaseFile,
  replenishPool
} from '../services/casePoolManager';
import { generateCase, precomputeAllExplanations } from '../services/openai';
import type { Case } from '../../../shared/types';

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

async function main() {
  const args = process.argv.slice(2);

  // Show help
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  // Initialize pool
  await initializePool();

  // Show status
  if (args.includes('--status')) {
    await showStatus();
    return;
  }

  // Backfill missing explanations
  if (args.includes('--backfill')) {
    await backfillExplanations();
    return;
  }

  // Fill to target
  if (args.includes('--fill')) {
    await fillPool();
    return;
  }

  // Generate specific count
  const count = parseInt(args[0]) || 1;
  const domain = args[1] && DOMAINS.includes(args[1]) ? args[1] : undefined;

  if (args[1] && !DOMAINS.includes(args[1])) {
    console.log(`Warning: Unknown domain "${args[1]}". Generating random domain cases.`);
    console.log(`Valid domains: ${DOMAINS.join(', ')}\n`);
  }

  await generateCases(count, domain);
}

function showHelp() {
  console.log(`
Case Pool Generator
===================

Generate pre-generated medical cases for the case pool.

Usage:
  npm run generate-cases [count] [domain]   Generate cases
  npm run generate-cases --fill             Fill pool to target size
  npm run generate-cases --backfill         Fill missing explanations in existing cases
  npm run generate-cases --status           Show pool statistics
  npm run generate-cases --help             Show this help

Arguments:
  count     Number of cases to generate (default: 1)
  domain    Medical domain (optional, defaults to random)

Valid domains:
  ${DOMAINS.join(', ')}

Examples:
  npm run generate-cases 5                  Generate 5 random cases
  npm run generate-cases 3 cardiology       Generate 3 cardiology cases
  npm run generate-cases --fill             Fill pool to target (10 cases)
  npm run generate-cases --backfill         Check & fill missing explanations
  npm run generate-cases --status           Show current pool status
`);
}

async function showStatus() {
  const status = getPoolStatus();
  const index = loadIndex();

  console.log('\n=== Case Pool Status ===\n');
  console.log(`Total Cases: ${status.totalCases}`);
  console.log(`Available: ${status.availableCases}`);
  console.log(`In Use: ${status.inUseCases}`);
  console.log(`\nPool Settings:`);
  console.log(`  Min Pool Size: ${index.generationSettings.minPoolSize}`);
  console.log(`  Target Size: ${index.generationSettings.targetPoolSize}`);
  console.log(`  Below Threshold: ${status.belowThreshold ? 'YES - needs replenishment' : 'No'}`);

  if (status.needsGeneration > 0) {
    console.log(`  Needs Generation: ${status.needsGeneration} cases`);
  }

  console.log('\nBy Domain:');
  const sortedDomains = Object.entries(status.byDomain).sort(
    (a, b) => b[1].available - a[1].available
  );

  for (const [domain, counts] of sortedDomains) {
    const bar = '█'.repeat(counts.available) + '░'.repeat(Math.max(0, counts.total - counts.available));
    console.log(`  ${domain.padEnd(20)} ${counts.available}/${counts.total} ${bar}`);
  }

  console.log('\nRecent Cases:');
  const recentCases = index.cases
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  if (recentCases.length === 0) {
    console.log('  No cases in pool yet.');
  } else {
    for (const c of recentCases) {
      const age = Math.round((Date.now() - c.createdAt) / (1000 * 60 * 60));
      console.log(`  [${c.status.padEnd(9)}] ${c.domain.padEnd(18)} - ${c.correctDiagnosis} (${age}h ago)`);
    }
  }

  console.log('');
}

async function fillPool() {
  const index = loadIndex();
  const needed = index.generationSettings.targetPoolSize - index.availableCases;

  if (needed <= 0) {
    console.log('Pool is already at or above target size.');
    await showStatus();
    return;
  }

  console.log(`Pool needs ${needed} cases to reach target of ${index.generationSettings.targetPoolSize}.\n`);
  await generateCases(needed);
}

async function backfillExplanations() {
  console.log('\n=== BACKFILL MISSING EXPLANATIONS ===\n');

  const index = loadIndex();
  const caseIds = index.cases.map(c => c.caseId);

  if (caseIds.length === 0) {
    console.log('No cases found in pool.');
    return;
  }

  console.log(`Checking ${caseIds.length} cases for missing explanations...\n`);

  let totalMissing = 0;
  let totalFixed = 0;

  for (const caseId of caseIds) {
    const caseData = loadCaseFile(caseId);
    if (!caseData) {
      console.log(`[${caseId}] ✗ Could not load case file`);
      continue;
    }

    const totalDiagnoses = caseData.diagnoses?.length || 0;
    const existingExplanations = caseData.precomputedExplanations || [];
    const existingIds = new Set(existingExplanations.map(e => e.diagnosisId));

    const missingIds = caseData.diagnoses
      ?.filter(d => !existingIds.has(d.id))
      .map(d => d.id) || [];

    if (missingIds.length === 0) {
      console.log(`[${caseId}] ✓ Complete (${existingExplanations.length}/${totalDiagnoses} explanations)`);
      continue;
    }

    totalMissing += missingIds.length;
    console.log(`[${caseId}] Missing ${missingIds.length}/${totalDiagnoses} explanations - generating...`);

    try {
      // Generate ALL explanations fresh (more reliable than partial)
      const allExplanations = await precomputeAllExplanations(caseData);

      if (allExplanations.length >= totalDiagnoses) {
        caseData.precomputedExplanations = allExplanations;
        saveCaseFile(caseData);
        console.log(`  ✓ Generated ${allExplanations.length} explanations`);
        totalFixed += missingIds.length;
      } else {
        console.log(`  ⚠ Only got ${allExplanations.length}/${totalDiagnoses} - retrying one by one...`);

        // Fallback: generate missing ones individually
        const newExplanations = [...existingExplanations];
        for (const diagId of missingIds) {
          try {
            const explanation = await generateSingleExplanation(caseData, diagId);
            if (explanation) {
              newExplanations.push(explanation);
              console.log(`    ✓ Generated for ${diagId}`);
              totalFixed++;
            }
          } catch (err) {
            console.log(`    ✗ Failed for ${diagId}: ${err}`);
          }
        }
        caseData.precomputedExplanations = newExplanations;
        saveCaseFile(caseData);
      }
    } catch (error) {
      console.log(`  ✗ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  console.log('\n=== Backfill Complete ===');
  console.log(`Total missing: ${totalMissing}`);
  console.log(`Total fixed: ${totalFixed}`);
}

async function generateSingleExplanation(caseData: Case, diagnosisId: string) {
  const { generateSingleDiagnosisExplanation } = await import('../services/openai');
  return generateSingleDiagnosisExplanation(caseData, diagnosisId);
}

async function generateCases(count: number, domain?: string) {
  console.log(`\n=== TWO-PHASE GENERATION ===`);
  console.log(`Generating ${count} case(s)${domain ? ` for ${domain}` : ' (random domains)'}...\n`);

  const startTime = Date.now();
  const generatedCaseIds: string[] = [];
  let failed = 0;

  // ============================================
  // PHASE 1: Generate basic cases quickly (no precompute)
  // ============================================
  console.log('────────────────────────────────────────');
  console.log('PHASE 1: Generating basic cases (fast)');
  console.log('────────────────────────────────────────\n');

  for (let i = 0; i < count; i++) {
    const targetDomain = domain || DOMAINS[Math.floor(Math.random() * DOMAINS.length)];

    console.log(`[${i + 1}/${count}] Generating ${targetDomain} case...`);

    try {
      // Generate case WITHOUT precomputed explanations (fast)
      const caseData = await generateCase({ domain: targetDomain, skipPrecompute: true });
      const metadata = addCaseToPool(caseData);

      console.log(`  ✓ Created: ${metadata.caseId}`);
      console.log(`    Domain: ${metadata.domain}`);
      console.log(`    Diagnosis: ${metadata.correctDiagnosis}`);
      console.log(`    Has Ideal Pathway: ${metadata.hasIdealPathway ? 'Yes' : 'No'}\n`);

      generatedCaseIds.push(metadata.caseId);
    } catch (error) {
      console.error(`  ✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
      failed++;
    }
  }

  const phase1Time = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Phase 1 complete: ${generatedCaseIds.length} cases in ${phase1Time}s\n`);

  // ============================================
  // PHASE 2: Add precomputed explanations to each case
  // ============================================
  console.log('────────────────────────────────────────');
  console.log('PHASE 2: Adding precomputed explanations');
  console.log('────────────────────────────────────────\n');

  let precomputedCount = 0;
  const phase2Start = Date.now();

  for (let i = 0; i < generatedCaseIds.length; i++) {
    const caseId = generatedCaseIds[i];
    console.log(`[${i + 1}/${generatedCaseIds.length}] Precomputing for ${caseId}...`);

    try {
      const caseData = loadCaseFile(caseId);
      if (!caseData) {
        console.log(`  ✗ Could not load case file\n`);
        continue;
      }

      // Generate precomputed explanations
      const explanations = await precomputeAllExplanations(caseData);

      if (explanations.length > 0) {
        // Update case file with precomputed explanations
        caseData.precomputedExplanations = explanations;
        saveCaseFile(caseData);
        console.log(`  ✓ Added ${explanations.length} explanations\n`);
        precomputedCount++;
      } else {
        console.log(`  ⚠ No explanations generated\n`);
      }
    } catch (error) {
      console.error(`  ✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    }
  }

  const phase2Time = ((Date.now() - phase2Start) / 1000).toFixed(1);
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('=== Generation Complete ===\n');
  console.log(`Generated: ${generatedCaseIds.length} cases`);
  console.log(`Precomputed: ${precomputedCount}/${generatedCaseIds.length} with explanations`);
  if (failed > 0) {
    console.log(`Failed: ${failed} cases`);
  }
  console.log(`\nTime breakdown:`);
  console.log(`  Phase 1 (basic cases): ${phase1Time}s`);
  console.log(`  Phase 2 (explanations): ${phase2Time}s`);
  console.log(`  Total: ${totalTime}s`);

  const status = getPoolStatus();
  console.log(`\nPool now has ${status.availableCases} available cases.`);

  if (status.belowThreshold) {
    console.log(`Warning: Pool still below minimum threshold of ${loadIndex().generationSettings.minPoolSize}.`);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
