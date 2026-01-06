/**
 * Scoring System Types
 * Pure type definitions for the scoring engine
 */

// ============================================
// GAMEPLAY TRANSCRIPT TYPES
// ============================================

export interface GameplayAction {
  type: 'question' | 'exam' | 'test' | 'diagnosis';
  name: string;           // e.g., "chest pain history", "CBC", "chest X-ray"
  timestamp: number;      // Unix timestamp
  result?: string;        // The result/response received
  isAbnormal?: boolean;   // For tests/exams
  qualityScore?: number;  // For questions (1-10)
}

export interface GameplayTranscript {
  gameId: string;
  startTime: number;
  endTime?: number;
  correctDiagnosisId: string;
  correctDiagnosisName: string;
  submittedDiagnosisId?: string;
  submittedDiagnosisName?: string;
  domain: string;         // e.g., "cardiology", "respiratory"
  actions: GameplayAction[];
}

// ============================================
// SCORING CONFIGURATION TYPES
// ============================================

export interface TestCostConfig {
  name: string;
  cost: number;           // In currency units
  category: 'basic' | 'advanced' | 'imaging' | 'invasive' | 'specialist';
  turnaroundMinutes: number;
  relevantDomains: string[];  // Which medical domains this test is useful for
}

export interface ExamCostConfig {
  name: string;
  cost: number;           // Time cost in "units"
  relevantDomains: string[];
}

export interface ScoringWeights {
  // Component weights (should sum to 100)
  timeWeight: number;
  budgetWeight: number;
  efficiencyWeight: number;
  accuracyWeight: number;
  clinicalReasoningWeight: number;

  // Time scoring
  maxTimeMinutes: number;
  optimalTimeMinutes: number;
  timeDecayRate: number;  // Points lost per minute over optimal

  // Test count scoring
  optimalTestCount: number;      // Ideal number of tests (full score if at or below)
  maxTestCount: number;          // Max tests before score hits 0
  penaltyPerExtraTest: number;   // Points lost per test over optimal

  // Efficiency scoring
  maxUnnecessaryTestPenalty: number;
  redundantTestPenalty: number;
  lowYieldTestPenalty: number;

  // Accuracy bonuses
  correctDiagnosisBonus: number;
  firstAttemptBonus: number;

  // Clinical reasoning
  relevantTestBonus: number;
  systematicApproachBonus: number;
}

// ============================================
// SCORE BREAKDOWN TYPES
// ============================================

export interface TimeScore {
  raw: number;            // 0-100
  weighted: number;       // After applying weight
  timeElapsedMinutes: number;
  bonusApplied: boolean;
  details: string;
}

export interface BudgetScore {
  raw: number;            // 0-100
  weighted: number;
  testsOrdered: number;   // Number of tests ordered
  optimalTests: number;   // Optimal number of tests
  penaltyPerTest: number; // Points lost per extra test
  bonusApplied: boolean;
  details: string;
}

export interface EfficiencyScore {
  raw: number;            // 0-100
  weighted: number;
  unnecessaryTests: string[];
  redundantTests: string[];
  lowYieldTests: string[];
  totalPenalty: number;
  details: string;
}

export interface AccuracyScore {
  raw: number;            // 0-100
  weighted: number;
  correct: boolean;
  firstAttempt: boolean;
  details: string;
}

export interface ClinicalReasoningScore {
  raw: number;            // 0-100
  weighted: number;
  relevantActionsCount: number;
  totalActionsCount: number;
  systematicApproach: boolean;
  questionQualityAvg: number;
  details: string;
}

export interface ScoreBreakdown {
  // Individual components
  time: TimeScore;
  budget: BudgetScore;
  efficiency: EfficiencyScore;
  accuracy: AccuracyScore;
  clinicalReasoning: ClinicalReasoningScore;

  // Totals
  totalScore: number;     // 0-100
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  rank: string;           // e.g., "Expert Diagnostician", "Competent Clinician"

  // Summary
  summary: string;
  strengths: string[];
  areasForImprovement: string[];

  // Meta
  calculatedAt: number;
}

// ============================================
// TEST RELEVANCE MAPPING
// ============================================

export interface DiseaseTestMapping {
  diseaseName: string;
  domain: string;
  highYieldTests: string[];     // Tests that strongly support/rule out
  moderateYieldTests: string[]; // Useful but not definitive
  lowYieldTests: string[];      // Rarely helpful for this condition
  contraindicated: string[];    // Tests that shouldn't be ordered
}
