/**
 * Script to complete incomplete cases
 * Generates missing idealPathway and precomputedExplanations
 *
 * Run with: npx ts-node src/scripts/completeCases.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateIdealPathway, generateDiagnosisExplanation } from '../services/openai';
import { searchDomainTextbook } from '../services/ragService';

const CASES_DIR = path.join(__dirname, '../data/cases');

interface CaseData {
  id: string;
  domain: string;
  persona: any;
  diagnoses: Array<{ id: string; name: string; description: string }>;
  correctDiagnosisId: string;
  initialComplaint: string;
  medicalHistory: string;
  symptoms: string;
  relevantFindings: string;
  idealPathway?: any;
  precomputedExplanations?: any[];
}

async function loadCase(filename: string): Promise<CaseData | null> {
  try {
    const filepath = path.join(CASES_DIR, filename);
    const data = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Failed to load ${filename}:`, error);
    return null;
  }
}

function saveCase(caseData: CaseData): void {
  const filepath = path.join(CASES_DIR, `${caseData.id}.json`);
  fs.writeFileSync(filepath, JSON.stringify(caseData, null, 2));
  console.log(`  Saved ${caseData.id}`);
}

async function completeCase(caseData: CaseData): Promise<boolean> {
  console.log(`\nProcessing ${caseData.id} (${caseData.domain})...`);

  let updated = false;

  // Phase 2: Generate idealPathway if missing
  if (!caseData.idealPathway) {
    console.log('  Generating idealPathway...');
    try {
      // Get textbook context for the domain
      const textbookContext = await searchDomainTextbook(caseData.domain, 'diseases', 20);
      const contextText = textbookContext?.results?.map((r: any) => r.text).join('\n\n') || '';

      const pathway = await generateIdealPathway(caseData, contextText);
      if (pathway) {
        caseData.idealPathway = pathway;
        updated = true;
        console.log('  ✓ idealPathway generated');
      } else {
        console.log('  ✗ Failed to generate idealPathway');
      }
    } catch (error) {
      console.error('  ✗ Error generating idealPathway:', error);
    }
  } else {
    console.log('  ✓ idealPathway already exists');
  }

  // Phase 3: Generate precomputedExplanations if missing or incomplete
  const existingExplanations = caseData.precomputedExplanations || [];
  const diagnosisCount = caseData.diagnoses.length;

  if (existingExplanations.length < diagnosisCount) {
    console.log(`  Generating explanations (${existingExplanations.length}/${diagnosisCount})...`);

    if (!caseData.precomputedExplanations) {
      caseData.precomputedExplanations = [];
    }

    // Generate for each missing diagnosis
    for (const diagnosis of caseData.diagnoses) {
      const existing = caseData.precomputedExplanations.find(
        (e: any) => e.diagnosisId === diagnosis.id
      );

      if (!existing) {
        try {
          console.log(`    Generating for ${diagnosis.name}...`);
          const isCorrect = diagnosis.id === caseData.correctDiagnosisId;

          const explanation = await generateDiagnosisExplanation(
            caseData,
            [] // Empty player actions for precomputed
          );

          if (explanation) {
            caseData.precomputedExplanations.push({
              diagnosisId: diagnosis.id,
              diagnosisName: diagnosis.name,
              isCorrect,
              ...explanation
            });
            updated = true;
            console.log(`    ✓ ${diagnosis.name}`);
          }

          // Rate limiting - wait between API calls
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`    ✗ Failed for ${diagnosis.name}:`, error);
        }
      }
    }

    console.log(`  ✓ Explanations: ${caseData.precomputedExplanations.length}/${diagnosisCount}`);
  } else {
    console.log(`  ✓ All ${diagnosisCount} explanations exist`);
  }

  if (updated) {
    saveCase(caseData);
  }

  return updated;
}

async function main() {
  console.log('=== Case Completion Script ===\n');

  // Find all case files
  const files = fs.readdirSync(CASES_DIR)
    .filter(f => f.startsWith('case_') && f.endsWith('.json'));

  console.log(`Found ${files.length} case files\n`);

  // Check each case
  const incomplete: string[] = [];
  const complete: string[] = [];

  for (const file of files) {
    const caseData = await loadCase(file);
    if (!caseData) continue;

    const hasPathway = !!caseData.idealPathway;
    const hasAllExplanations = (caseData.precomputedExplanations?.length || 0) >= (caseData.diagnoses?.length || 10);

    if (hasPathway && hasAllExplanations) {
      complete.push(file);
    } else {
      incomplete.push(file);
    }
  }

  console.log(`Complete: ${complete.length}`);
  console.log(`Incomplete: ${incomplete.length}`);

  if (incomplete.length === 0) {
    console.log('\nAll cases are complete!');
    return;
  }

  console.log(`\nIncomplete cases:`);
  incomplete.forEach(f => console.log(`  - ${f}`));

  console.log('\n--- Starting completion process ---\n');

  let completed = 0;
  let failed = 0;

  for (const file of incomplete) {
    const caseData = await loadCase(file);
    if (!caseData) {
      failed++;
      continue;
    }

    try {
      const wasUpdated = await completeCase(caseData);
      if (wasUpdated) {
        completed++;
      }
    } catch (error) {
      console.error(`Failed to complete ${file}:`, error);
      failed++;
    }

    // Rate limiting between cases
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n=== Summary ===');
  console.log(`Completed: ${completed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Already complete: ${complete.length}`);
}

main().catch(console.error);
