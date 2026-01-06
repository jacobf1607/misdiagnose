/**
 * Scoring Module - Main Export
 *
 * A comprehensive scoring system for the medical diagnosis game.
 *
 * Components:
 * - Time Score: Rewards fast diagnosis
 * - Budget Score: Rewards cost-efficient testing
 * - Efficiency Score: Penalizes unnecessary/redundant tests
 * - Accuracy Score: Rewards correct diagnosis
 * - Clinical Reasoning Score: Rewards systematic approach
 *
 * Usage:
 * ```typescript
 * import { calculateScore, createTranscriptFromGameState } from './scoring';
 *
 * // Create transcript from game state
 * const transcript = createTranscriptFromGameState(
 *   gameId, startTime, endTime, domain,
 *   correctDiagnosisId, correctDiagnosisName,
 *   submittedDiagnosisId, submittedDiagnosisName,
 *   chatHistory, testResults, examResults
 * );
 *
 * // Calculate score
 * const scoreBreakdown = calculateScore(transcript);
 *
 * console.log(scoreBreakdown.totalScore);  // 0-100
 * console.log(scoreBreakdown.grade);       // S, A, B, C, D, F
 * console.log(scoreBreakdown.rank);        // "Expert Clinician", etc.
 * ```
 */

// Types
export type {
  GameplayAction,
  GameplayTranscript,
  TestCostConfig,
  ExamCostConfig,
  ScoringWeights,
  TimeScore,
  BudgetScore,
  EfficiencyScore,
  AccuracyScore,
  ClinicalReasoningScore,
  ScoreBreakdown,
  DiseaseTestMapping
} from './types';

// Configuration
export {
  DEFAULT_WEIGHTS,
  TEST_COSTS,
  EXAM_COSTS,
  GRADE_THRESHOLDS,
  RANK_NAMES,
  getTestCost,
  getExamCost,
  isTestRelevantToDomain,
  isExamRelevantToDomain
} from './config';

// Engine
export {
  calculateScore,
  calculateTimeScore,
  calculateBudgetScore,
  calculateEfficiencyScore,
  calculateAccuracyScore,
  calculateClinicalReasoningScore,
  createTranscriptFromGameState
} from './engine';
