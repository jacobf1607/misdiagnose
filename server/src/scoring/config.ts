/**
 * Scoring System Configuration
 * All configurable parameters for the scoring engine
 */

import {
  ScoringWeights,
  TestCostConfig,
  ExamCostConfig,
  DiseaseTestMapping
} from './types';

// ============================================
// SCORING WEIGHTS
// ============================================

export const DEFAULT_WEIGHTS: ScoringWeights = {
  // Component weights (sum = 100)
  timeWeight: 15,
  budgetWeight: 20,
  efficiencyWeight: 20,
  accuracyWeight: 30,
  clinicalReasoningWeight: 15,

  // Time scoring
  maxTimeMinutes: 30,        // Game ends at 30 min
  optimalTimeMinutes: 10,    // Best time bonus under 10 min
  timeDecayRate: 2,          // Lose 2 points per minute over optimal

  // Test count scoring (fewer tests = higher score)
  optimalTestCount: 3,       // 3 or fewer tests = full score
  maxTestCount: 10,          // 10+ tests = zero score
  penaltyPerExtraTest: 14,   // ~14 points lost per test over optimal

  // Efficiency penalties
  maxUnnecessaryTestPenalty: 30,
  redundantTestPenalty: 10,  // Per redundant test
  lowYieldTestPenalty: 5,    // Per low-yield test

  // Accuracy bonuses
  correctDiagnosisBonus: 100,
  firstAttemptBonus: 20,

  // Clinical reasoning
  relevantTestBonus: 5,      // Per relevant test
  systematicApproachBonus: 15
};

// ============================================
// TEST COSTS (in currency units)
// ============================================

export const TEST_COSTS: TestCostConfig[] = [
  // Basic Labs
  { name: 'CBC', cost: 100, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['hematology', 'infectious diseases', 'all'] },
  { name: 'Complete Blood Count', cost: 100, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['hematology', 'infectious diseases', 'all'] },
  { name: 'BMP', cost: 120, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['nephrology', 'endocrinology', 'all'] },
  { name: 'Basic Metabolic Panel', cost: 120, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['nephrology', 'endocrinology', 'all'] },
  { name: 'CMP', cost: 150, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['gastroenterology', 'nephrology', 'all'] },
  { name: 'Comprehensive Metabolic Panel', cost: 150, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['gastroenterology', 'nephrology', 'all'] },
  { name: 'LFT', cost: 130, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['gastroenterology', 'all'] },
  { name: 'Liver Function Tests', cost: 130, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['gastroenterology', 'all'] },
  { name: 'Urinalysis', cost: 50, category: 'basic', turnaroundMinutes: 15, relevantDomains: ['nephrology', 'infectious diseases', 'all'] },
  { name: 'Urine Routine', cost: 50, category: 'basic', turnaroundMinutes: 15, relevantDomains: ['nephrology', 'infectious diseases', 'all'] },

  // Cardiac Tests
  { name: 'ECG', cost: 150, category: 'basic', turnaroundMinutes: 10, relevantDomains: ['cardiology'] },
  { name: 'Electrocardiogram', cost: 150, category: 'basic', turnaroundMinutes: 10, relevantDomains: ['cardiology'] },
  { name: 'Troponin', cost: 200, category: 'advanced', turnaroundMinutes: 60, relevantDomains: ['cardiology'] },
  { name: 'Cardiac Enzymes', cost: 250, category: 'advanced', turnaroundMinutes: 60, relevantDomains: ['cardiology'] },
  { name: 'BNP', cost: 180, category: 'advanced', turnaroundMinutes: 45, relevantDomains: ['cardiology'] },
  { name: 'NT-proBNP', cost: 200, category: 'advanced', turnaroundMinutes: 45, relevantDomains: ['cardiology'] },
  { name: 'Echocardiogram', cost: 800, category: 'imaging', turnaroundMinutes: 60, relevantDomains: ['cardiology'] },
  { name: 'Echo', cost: 800, category: 'imaging', turnaroundMinutes: 60, relevantDomains: ['cardiology'] },
  { name: 'Stress Test', cost: 1000, category: 'advanced', turnaroundMinutes: 120, relevantDomains: ['cardiology'] },
  { name: 'Coronary Angiography', cost: 3000, category: 'invasive', turnaroundMinutes: 180, relevantDomains: ['cardiology'] },

  // Respiratory Tests
  { name: 'Chest X-ray', cost: 300, category: 'imaging', turnaroundMinutes: 30, relevantDomains: ['respiratory', 'cardiology', 'infectious diseases'] },
  { name: 'CXR', cost: 300, category: 'imaging', turnaroundMinutes: 30, relevantDomains: ['respiratory', 'cardiology', 'infectious diseases'] },
  { name: 'ABG', cost: 200, category: 'advanced', turnaroundMinutes: 20, relevantDomains: ['respiratory'] },
  { name: 'Arterial Blood Gas', cost: 200, category: 'advanced', turnaroundMinutes: 20, relevantDomains: ['respiratory'] },
  { name: 'Pulmonary Function Test', cost: 500, category: 'advanced', turnaroundMinutes: 60, relevantDomains: ['respiratory'] },
  { name: 'PFT', cost: 500, category: 'advanced', turnaroundMinutes: 60, relevantDomains: ['respiratory'] },
  { name: 'Spirometry', cost: 400, category: 'advanced', turnaroundMinutes: 45, relevantDomains: ['respiratory'] },
  { name: 'CT Chest', cost: 1200, category: 'imaging', turnaroundMinutes: 60, relevantDomains: ['respiratory', 'cardiology'] },
  { name: 'HRCT Chest', cost: 1500, category: 'imaging', turnaroundMinutes: 60, relevantDomains: ['respiratory'] },
  { name: 'Bronchoscopy', cost: 2500, category: 'invasive', turnaroundMinutes: 120, relevantDomains: ['respiratory'] },

  // GI Tests
  { name: 'Amylase', cost: 100, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['gastroenterology'] },
  { name: 'Lipase', cost: 120, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['gastroenterology'] },
  { name: 'Stool Sample', cost: 80, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['gastroenterology', 'infectious diseases'] },
  { name: 'Stool Routine', cost: 80, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['gastroenterology', 'infectious diseases'] },
  { name: 'Stool Culture', cost: 200, category: 'advanced', turnaroundMinutes: 72, relevantDomains: ['gastroenterology', 'infectious diseases'] },
  { name: 'H. pylori Test', cost: 150, category: 'advanced', turnaroundMinutes: 30, relevantDomains: ['gastroenterology'] },
  { name: 'Ultrasound Abdomen', cost: 600, category: 'imaging', turnaroundMinutes: 30, relevantDomains: ['gastroenterology', 'nephrology'] },
  { name: 'USG Abdomen', cost: 600, category: 'imaging', turnaroundMinutes: 30, relevantDomains: ['gastroenterology', 'nephrology'] },
  { name: 'CT Abdomen', cost: 1500, category: 'imaging', turnaroundMinutes: 60, relevantDomains: ['gastroenterology'] },
  { name: 'Endoscopy', cost: 2000, category: 'invasive', turnaroundMinutes: 60, relevantDomains: ['gastroenterology'] },
  { name: 'Colonoscopy', cost: 2500, category: 'invasive', turnaroundMinutes: 90, relevantDomains: ['gastroenterology'] },

  // Neurology Tests
  { name: 'CT Head', cost: 1200, category: 'imaging', turnaroundMinutes: 30, relevantDomains: ['neurology'] },
  { name: 'CT Brain', cost: 1200, category: 'imaging', turnaroundMinutes: 30, relevantDomains: ['neurology'] },
  { name: 'MRI Brain', cost: 3000, category: 'imaging', turnaroundMinutes: 60, relevantDomains: ['neurology'] },
  { name: 'EEG', cost: 800, category: 'advanced', turnaroundMinutes: 60, relevantDomains: ['neurology'] },
  { name: 'Electroencephalogram', cost: 800, category: 'advanced', turnaroundMinutes: 60, relevantDomains: ['neurology'] },
  { name: 'Lumbar Puncture', cost: 1000, category: 'invasive', turnaroundMinutes: 60, relevantDomains: ['neurology', 'infectious diseases'] },
  { name: 'CSF Analysis', cost: 500, category: 'advanced', turnaroundMinutes: 60, relevantDomains: ['neurology', 'infectious diseases'] },
  { name: 'Nerve Conduction Study', cost: 1200, category: 'advanced', turnaroundMinutes: 90, relevantDomains: ['neurology'] },
  { name: 'EMG', cost: 1000, category: 'advanced', turnaroundMinutes: 60, relevantDomains: ['neurology'] },

  // Endocrine Tests
  { name: 'Blood Glucose', cost: 50, category: 'basic', turnaroundMinutes: 15, relevantDomains: ['endocrinology', 'all'] },
  { name: 'Fasting Blood Sugar', cost: 50, category: 'basic', turnaroundMinutes: 15, relevantDomains: ['endocrinology'] },
  { name: 'HbA1c', cost: 200, category: 'advanced', turnaroundMinutes: 60, relevantDomains: ['endocrinology'] },
  { name: 'Thyroid Profile', cost: 300, category: 'advanced', turnaroundMinutes: 60, relevantDomains: ['endocrinology'] },
  { name: 'TSH', cost: 150, category: 'basic', turnaroundMinutes: 60, relevantDomains: ['endocrinology'] },
  { name: 'T3 T4', cost: 200, category: 'advanced', turnaroundMinutes: 60, relevantDomains: ['endocrinology'] },
  { name: 'Cortisol', cost: 250, category: 'advanced', turnaroundMinutes: 60, relevantDomains: ['endocrinology'] },
  { name: 'ACTH', cost: 350, category: 'specialist', turnaroundMinutes: 120, relevantDomains: ['endocrinology'] },

  // Nephrology Tests
  { name: 'Serum Creatinine', cost: 80, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['nephrology', 'all'] },
  { name: 'BUN', cost: 80, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['nephrology'] },
  { name: 'Urea', cost: 80, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['nephrology'] },
  { name: 'eGFR', cost: 100, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['nephrology'] },
  { name: '24-hour Urine Protein', cost: 200, category: 'advanced', turnaroundMinutes: 1440, relevantDomains: ['nephrology'] },
  { name: 'Renal Biopsy', cost: 3000, category: 'invasive', turnaroundMinutes: 180, relevantDomains: ['nephrology'] },
  { name: 'Ultrasound KUB', cost: 500, category: 'imaging', turnaroundMinutes: 30, relevantDomains: ['nephrology'] },

  // Hematology Tests
  { name: 'Peripheral Smear', cost: 100, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['hematology'] },
  { name: 'PBS', cost: 100, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['hematology'] },
  { name: 'Reticulocyte Count', cost: 80, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['hematology'] },
  { name: 'Iron Studies', cost: 250, category: 'advanced', turnaroundMinutes: 60, relevantDomains: ['hematology'] },
  { name: 'Serum Ferritin', cost: 150, category: 'advanced', turnaroundMinutes: 60, relevantDomains: ['hematology'] },
  { name: 'Vitamin B12', cost: 200, category: 'advanced', turnaroundMinutes: 60, relevantDomains: ['hematology', 'neurology'] },
  { name: 'Folate', cost: 180, category: 'advanced', turnaroundMinutes: 60, relevantDomains: ['hematology'] },
  { name: 'Coagulation Profile', cost: 200, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['hematology'] },
  { name: 'PT INR', cost: 100, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['hematology', 'gastroenterology'] },
  { name: 'APTT', cost: 100, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['hematology'] },
  { name: 'Bone Marrow Biopsy', cost: 2500, category: 'invasive', turnaroundMinutes: 180, relevantDomains: ['hematology'] },

  // Infectious Disease Tests
  { name: 'Blood Culture', cost: 300, category: 'advanced', turnaroundMinutes: 72, relevantDomains: ['infectious diseases'] },
  { name: 'Urine Culture', cost: 200, category: 'advanced', turnaroundMinutes: 48, relevantDomains: ['infectious diseases', 'nephrology'] },
  { name: 'Sputum Culture', cost: 200, category: 'advanced', turnaroundMinutes: 72, relevantDomains: ['respiratory', 'infectious diseases'] },
  { name: 'Dengue NS1', cost: 300, category: 'advanced', turnaroundMinutes: 30, relevantDomains: ['infectious diseases'] },
  { name: 'Dengue Serology', cost: 350, category: 'advanced', turnaroundMinutes: 60, relevantDomains: ['infectious diseases'] },
  { name: 'Malaria Smear', cost: 100, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['infectious diseases', 'hematology'] },
  { name: 'Widal Test', cost: 150, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['infectious diseases'] },
  { name: 'Typhoid Culture', cost: 300, category: 'advanced', turnaroundMinutes: 72, relevantDomains: ['infectious diseases'] },
  { name: 'HIV Test', cost: 200, category: 'advanced', turnaroundMinutes: 30, relevantDomains: ['infectious diseases'] },
  { name: 'Hepatitis Panel', cost: 400, category: 'advanced', turnaroundMinutes: 60, relevantDomains: ['infectious diseases', 'gastroenterology'] },
  { name: 'CRP', cost: 100, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['infectious diseases', 'rheumatology', 'all'] },
  { name: 'ESR', cost: 50, category: 'basic', turnaroundMinutes: 60, relevantDomains: ['infectious diseases', 'rheumatology', 'all'] },
  { name: 'Procalcitonin', cost: 400, category: 'advanced', turnaroundMinutes: 60, relevantDomains: ['infectious diseases'] },

  // Rheumatology Tests
  { name: 'RF', cost: 150, category: 'advanced', turnaroundMinutes: 60, relevantDomains: ['rheumatology'] },
  { name: 'Rheumatoid Factor', cost: 150, category: 'advanced', turnaroundMinutes: 60, relevantDomains: ['rheumatology'] },
  { name: 'ANA', cost: 300, category: 'advanced', turnaroundMinutes: 60, relevantDomains: ['rheumatology'] },
  { name: 'Anti-CCP', cost: 400, category: 'specialist', turnaroundMinutes: 120, relevantDomains: ['rheumatology'] },
  { name: 'Uric Acid', cost: 80, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['rheumatology', 'nephrology'] },
  { name: 'Joint Aspiration', cost: 800, category: 'invasive', turnaroundMinutes: 30, relevantDomains: ['rheumatology'] },
  { name: 'X-ray Joint', cost: 300, category: 'imaging', turnaroundMinutes: 30, relevantDomains: ['rheumatology'] },

  // Dermatology Tests
  { name: 'Skin Biopsy', cost: 1000, category: 'invasive', turnaroundMinutes: 180, relevantDomains: ['dermatology'] },
  { name: 'KOH Mount', cost: 50, category: 'basic', turnaroundMinutes: 15, relevantDomains: ['dermatology', 'infectious diseases'] },
  { name: 'Skin Scraping', cost: 100, category: 'basic', turnaroundMinutes: 30, relevantDomains: ['dermatology'] },
  { name: 'Patch Test', cost: 500, category: 'advanced', turnaroundMinutes: 48, relevantDomains: ['dermatology'] },
  { name: 'Wood Lamp', cost: 100, category: 'basic', turnaroundMinutes: 10, relevantDomains: ['dermatology'] },
];

// ============================================
// EXAM COSTS (time-based)
// ============================================

export const EXAM_COSTS: ExamCostConfig[] = [
  // General
  { name: 'Vital Signs', cost: 5, relevantDomains: ['all'] },
  { name: 'General Examination', cost: 10, relevantDomains: ['all'] },

  // Cardiovascular
  { name: 'Cardiovascular Examination', cost: 15, relevantDomains: ['cardiology'] },
  { name: 'Heart Auscultation', cost: 10, relevantDomains: ['cardiology'] },
  { name: 'JVP Examination', cost: 10, relevantDomains: ['cardiology'] },
  { name: 'Peripheral Pulse', cost: 10, relevantDomains: ['cardiology'] },
  { name: 'Blood Pressure', cost: 5, relevantDomains: ['cardiology', 'nephrology', 'all'] },

  // Respiratory
  { name: 'Respiratory Examination', cost: 15, relevantDomains: ['respiratory'] },
  { name: 'Chest Auscultation', cost: 10, relevantDomains: ['respiratory', 'cardiology'] },
  { name: 'Chest Percussion', cost: 10, relevantDomains: ['respiratory'] },

  // GI
  { name: 'Abdominal Examination', cost: 15, relevantDomains: ['gastroenterology'] },
  { name: 'Abdominal Palpation', cost: 10, relevantDomains: ['gastroenterology'] },
  { name: 'Digital Rectal Exam', cost: 10, relevantDomains: ['gastroenterology'] },

  // Neuro
  { name: 'Neurological Examination', cost: 20, relevantDomains: ['neurology'] },
  { name: 'Cranial Nerve Examination', cost: 15, relevantDomains: ['neurology'] },
  { name: 'Motor Examination', cost: 15, relevantDomains: ['neurology'] },
  { name: 'Sensory Examination', cost: 15, relevantDomains: ['neurology'] },
  { name: 'Reflex Examination', cost: 10, relevantDomains: ['neurology'] },
  { name: 'Fundoscopy', cost: 10, relevantDomains: ['neurology', 'endocrinology'] },

  // MSK
  { name: 'Joint Examination', cost: 15, relevantDomains: ['rheumatology'] },
  { name: 'Musculoskeletal Examination', cost: 15, relevantDomains: ['rheumatology'] },

  // Skin
  { name: 'Skin Examination', cost: 10, relevantDomains: ['dermatology'] },
  { name: 'Dermatological Examination', cost: 15, relevantDomains: ['dermatology'] },

  // Other
  { name: 'Thyroid Examination', cost: 10, relevantDomains: ['endocrinology'] },
  { name: 'Lymph Node Examination', cost: 10, relevantDomains: ['hematology', 'infectious diseases'] },
  { name: 'ENT Examination', cost: 15, relevantDomains: ['respiratory', 'infectious diseases'] },
];

// ============================================
// GRADE THRESHOLDS
// ============================================

export const GRADE_THRESHOLDS = {
  S: 95,  // Exceptional
  A: 85,  // Excellent
  B: 70,  // Good
  C: 55,  // Average
  D: 40,  // Below Average
  F: 0    // Failing
};

export const RANK_NAMES: Record<string, string> = {
  S: 'Master Diagnostician',
  A: 'Expert Clinician',
  B: 'Competent Physician',
  C: 'Junior Resident',
  D: 'Medical Student',
  F: 'Needs Improvement'
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getTestCost(testName: string): TestCostConfig | undefined {
  const normalized = testName.toLowerCase().trim();
  return TEST_COSTS.find(t =>
    t.name.toLowerCase() === normalized ||
    t.name.toLowerCase().includes(normalized) ||
    normalized.includes(t.name.toLowerCase())
  );
}

export function getExamCost(examName: string): ExamCostConfig | undefined {
  const normalized = examName.toLowerCase().trim();
  return EXAM_COSTS.find(e =>
    e.name.toLowerCase() === normalized ||
    e.name.toLowerCase().includes(normalized) ||
    normalized.includes(e.name.toLowerCase())
  );
}

export function isTestRelevantToDomain(testName: string, domain: string): boolean {
  const testConfig = getTestCost(testName);
  if (!testConfig) return false;

  return testConfig.relevantDomains.includes(domain.toLowerCase()) ||
         testConfig.relevantDomains.includes('all');
}

export function isExamRelevantToDomain(examName: string, domain: string): boolean {
  const examConfig = getExamCost(examName);
  if (!examConfig) return false;

  return examConfig.relevantDomains.includes(domain.toLowerCase()) ||
         examConfig.relevantDomains.includes('all');
}
