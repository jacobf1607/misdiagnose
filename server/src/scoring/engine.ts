/**
 * Scoring Engine - Pure Functions
 * All scoring calculations are stateless and deterministic
 * Now supports pathway-based scoring when ideal pathway is available
 */

import {
  GameplayTranscript,
  GameplayAction,
  ScoreBreakdown,
  TimeScore,
  BudgetScore,
  EfficiencyScore,
  AccuracyScore,
  ClinicalReasoningScore,
  ScoringWeights
} from './types';

import {
  IdealPathway,
  PathwayComparison,
  ChatMessage,
  TestResult,
  ExamResult
} from '../types';

import {
  DEFAULT_WEIGHTS,
  GRADE_THRESHOLDS,
  RANK_NAMES,
  getTestCost,
  getExamCost,
  isTestRelevantToDomain,
  isExamRelevantToDomain
} from './config';

import {
  compareToIdealPathway,
  calculatePathwayDeviationScore
} from '../coaching/coachingEngine';

// ============================================
// MAIN SCORING FUNCTION
// ============================================

/**
 * Calculate complete score breakdown from a gameplay transcript
 * This is a pure function - same input always produces same output
 *
 * When idealPathway is provided, scoring is based on DEVIATION from the ideal:
 * - Efficiency score uses pathway adherence instead of domain-based checks
 * - Clinical reasoning uses pathway matching instead of generic relevance
 * - More accurate and textbook-grounded scoring
 */
export function calculateScore(
  transcript: GameplayTranscript,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
  idealPathway?: IdealPathway,
  chatHistory?: ChatMessage[],
  testResults?: TestResult[],
  examResults?: ExamResult[]
): ScoreBreakdown {
  const timeScore = calculateTimeScore(transcript, weights);
  const budgetScore = calculateBudgetScore(transcript, weights);

  // If we have an ideal pathway, use pathway-based scoring
  let efficiencyScore: EfficiencyScore;
  let clinicalReasoningScore: ClinicalReasoningScore;
  let pathwayComparison: PathwayComparison | undefined;

  if (idealPathway && chatHistory && testResults && examResults) {
    // Use pathway-based scoring (textbook-grounded)
    pathwayComparison = compareToIdealPathway(
      idealPathway,
      chatHistory,
      testResults,
      examResults
    );

    const pathwayScores = calculatePathwayDeviationScore(pathwayComparison);

    // Efficiency based on pathway adherence
    efficiencyScore = calculatePathwayEfficiencyScore(
      pathwayComparison,
      pathwayScores,
      weights
    );

    // Clinical reasoning based on pathway matching
    clinicalReasoningScore = calculatePathwayClinicalReasoningScore(
      pathwayComparison,
      pathwayScores,
      transcript,
      weights
    );
  } else {
    // Fallback to original domain-based scoring
    efficiencyScore = calculateEfficiencyScore(transcript, weights);
    clinicalReasoningScore = calculateClinicalReasoningScore(transcript, weights);
  }

  const accuracyScore = calculateAccuracyScore(transcript, weights);

  const totalScore = Math.round(
    timeScore.weighted +
    budgetScore.weighted +
    efficiencyScore.weighted +
    accuracyScore.weighted +
    clinicalReasoningScore.weighted
  );

  const grade = calculateGrade(totalScore);
  const rank = RANK_NAMES[grade];

  const { strengths, areasForImprovement } = pathwayComparison
    ? generatePathwayFeedback(pathwayComparison, accuracyScore, timeScore, budgetScore)
    : generateFeedback(timeScore, budgetScore, efficiencyScore, accuracyScore, clinicalReasoningScore);

  const summary = generateSummary(totalScore, grade, transcript);

  return {
    time: timeScore,
    budget: budgetScore,
    efficiency: efficiencyScore,
    accuracy: accuracyScore,
    clinicalReasoning: clinicalReasoningScore,
    totalScore,
    grade,
    rank,
    summary,
    strengths,
    areasForImprovement,
    calculatedAt: Date.now()
  };
}

// ============================================
// PATHWAY-BASED SCORING FUNCTIONS
// ============================================

/**
 * Calculate efficiency score based on pathway adherence
 * Penalizes unnecessary actions, rewards following the ideal path
 */
function calculatePathwayEfficiencyScore(
  comparison: PathwayComparison,
  pathwayScores: ReturnType<typeof calculatePathwayDeviationScore>,
  weights: ScoringWeights
): EfficiencyScore {
  const raw = pathwayScores.efficiencyScore;

  // Extract issues from comparison
  const unnecessaryTests = comparison.unnecessaryActions
    .filter(a => a.type === 'investigation')
    .map(a => a.action);

  const redundantTests: string[] = []; // Pathway comparison doesn't track duplicates separately

  const lowYieldTests = comparison.unnecessaryActions
    .filter(a => a.type !== 'investigation')
    .map(a => a.action);

  const totalPenalty = comparison.unnecessaryActions.length * 5;

  const details = pathwayScores.details;
  const weighted = (raw / 100) * weights.efficiencyWeight;

  return {
    raw: Math.round(raw),
    weighted: Math.round(weighted * 10) / 10,
    unnecessaryTests,
    redundantTests,
    lowYieldTests,
    totalPenalty,
    details
  };
}

/**
 * Calculate clinical reasoning score based on pathway matching
 * Rewards covering key steps, systematic approach
 */
function calculatePathwayClinicalReasoningScore(
  comparison: PathwayComparison,
  pathwayScores: ReturnType<typeof calculatePathwayDeviationScore>,
  transcript: GameplayTranscript,
  weights: ScoringWeights
): ClinicalReasoningScore {
  // Raw score is pathway adherence
  const raw = pathwayScores.pathwayAdherence;

  // Count relevant actions (matched to pathway)
  const relevantActionsCount = comparison.correctActions.length;
  const totalActionsCount = comparison.correctActions.length + comparison.unnecessaryActions.length;

  // Calculate question quality average from transcript
  const questionActions = transcript.actions.filter(a => a.type === 'question' && a.qualityScore);
  const questionQualityAvg = questionActions.length > 0
    ? questionActions.reduce((sum, a) => sum + (a.qualityScore || 0), 0) / questionActions.length
    : 5;

  // Systematic approach: No ordering issues and covered critical steps
  const systematicApproach = comparison.orderingIssues.length === 0 &&
    comparison.correctActions.some(a => a.matchedStep.importance === 'critical');

  let details: string;
  if (raw >= 80) {
    details = 'Excellent clinical reasoning - followed textbook diagnostic pathway';
  } else if (raw >= 60) {
    details = 'Good clinical reasoning - covered most key diagnostic steps';
  } else if (raw >= 40) {
    details = 'Average clinical reasoning - missed some important steps from textbook';
  } else {
    details = 'Needs improvement - review the textbook diagnostic approach';
  }

  const weighted = (raw / 100) * weights.clinicalReasoningWeight;

  return {
    raw: Math.round(raw),
    weighted: Math.round(weighted * 10) / 10,
    relevantActionsCount,
    totalActionsCount,
    systematicApproach,
    questionQualityAvg: Math.round(questionQualityAvg * 10) / 10,
    details
  };
}

/**
 * Generate feedback based on pathway comparison
 * Provides detailed, educational feedback to help players learn
 */
function generatePathwayFeedback(
  comparison: PathwayComparison,
  accuracy: AccuracyScore,
  time: TimeScore,
  budget: BudgetScore
): { strengths: string[]; areasForImprovement: string[] } {
  const strengths: string[] = [];
  const areasForImprovement: string[] = [];

  // Accuracy feedback - most important
  if (accuracy.correct) {
    strengths.push(accuracy.firstAttempt
      ? '**Excellent!** Correct diagnosis on first attempt - shows strong clinical reasoning'
      : '**Correct diagnosis** reached');
  }

  // Pathway-based feedback - detailed for each matched critical step
  const criticalMatches = comparison.correctActions.filter(a => a.matchedStep.importance === 'critical');
  for (const match of criticalMatches) {
    strengths.push(`**Good:** "${match.action}" - ${match.feedback}`);
  }

  if (comparison.pathwayScore >= 70) {
    strengths.push('**Strong adherence** to evidence-based diagnostic approach');
  } else if (comparison.pathwayScore >= 50) {
    strengths.push('**Partial adherence** to recommended diagnostic pathway');
  }

  // Missed critical steps - detailed with reasoning
  const missedCritical = comparison.missedSteps.filter(m => m.step.importance === 'critical');
  for (const missed of missedCritical) {
    areasForImprovement.push(
      `**MISSED CRITICAL:** ${missed.step.action}. **Why important:** ${missed.step.reasoning}`
    );
  }

  // Missed important steps - top 2 with reasoning
  const missedImportant = comparison.missedSteps.filter(m => m.step.importance === 'important');
  for (const missed of missedImportant.slice(0, 2)) {
    areasForImprovement.push(
      `**Should have:** ${missed.step.action}. **This would reveal:** ${missed.step.expectedFinding}`
    );
  }

  // Unnecessary actions - specific feedback
  const unnecessaryTests = comparison.unnecessaryActions.filter(a => a.type === 'investigation');
  if (unnecessaryTests.length > 0) {
    areasForImprovement.push(
      `**Unnecessary tests:** ${unnecessaryTests.map(t => t.action).join(', ')}. These added cost without helping reach the diagnosis.`
    );
  }

  const unnecessaryExams = comparison.unnecessaryActions.filter(a => a.type === 'examination');
  if (unnecessaryExams.length > 0) {
    areasForImprovement.push(
      `**Consider skipping:** ${unnecessaryExams.map(e => e.action).join(', ')} - not relevant for this presentation`
    );
  }

  // Ordering issues - educational
  if (comparison.orderingIssues.length > 0) {
    areasForImprovement.push(
      '**Diagnostic efficiency tip:** Start with history and basic tests before expensive imaging. Follow: **History → Exam → Basic labs → Advanced tests**'
    );
  }

  // Time feedback
  if (time.raw >= 80) {
    strengths.push('**Efficient diagnostic time**');
  } else if (time.raw < 40) {
    areasForImprovement.push('**Time management:** Try to gather key information more efficiently');
  }

  // Test count feedback
  if (budget.raw >= 80) {
    strengths.push('**Efficient test ordering** - diagnosed with minimal tests');
  } else if (budget.raw < 40) {
    areasForImprovement.push('**Too many tests ordered.** Focus on targeted testing - history and exam should guide which few tests are truly needed.');
  }

  return { strengths, areasForImprovement };
}

// ============================================
// TIME SCORING
// ============================================

/**
 * Calculate time-based score
 * Rewards fast diagnosis, penalizes slow ones
 */
export function calculateTimeScore(
  transcript: GameplayTranscript,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): TimeScore {
  const startTime = transcript.startTime;
  const endTime = transcript.endTime || Date.now();
  const elapsedMs = endTime - startTime;
  const elapsedMinutes = elapsedMs / (1000 * 60);

  let raw: number;
  let bonusApplied = false;
  let details: string;

  if (elapsedMinutes <= weights.optimalTimeMinutes) {
    // Perfect time - full score with bonus
    raw = 100;
    bonusApplied = true;
    details = `Excellent! Completed in ${elapsedMinutes.toFixed(1)} min (under optimal ${weights.optimalTimeMinutes} min)`;
  } else if (elapsedMinutes >= weights.maxTimeMinutes) {
    // Time limit reached
    raw = 0;
    details = `Time limit reached (${weights.maxTimeMinutes} min)`;
  } else {
    // Decay based on time over optimal
    const overTime = elapsedMinutes - weights.optimalTimeMinutes;
    const maxOverTime = weights.maxTimeMinutes - weights.optimalTimeMinutes;
    const decayPercent = (overTime / maxOverTime) * 100;
    raw = Math.max(0, 100 - decayPercent);
    details = `Completed in ${elapsedMinutes.toFixed(1)} min`;
  }

  const weighted = (raw / 100) * weights.timeWeight;

  return {
    raw: Math.round(raw),
    weighted: Math.round(weighted * 10) / 10,
    timeElapsedMinutes: Math.round(elapsedMinutes * 10) / 10,
    bonusApplied,
    details
  };
}

// ============================================
// TEST COUNT SCORING
// ============================================

/**
 * Calculate test count score
 * Fewer tests = higher score (rewards efficient diagnosis)
 */
export function calculateBudgetScore(
  transcript: GameplayTranscript,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): BudgetScore {
  const testActions = transcript.actions.filter(a => a.type === 'test');
  const testsOrdered = testActions.length;

  let raw: number;
  let bonusApplied = false;
  let details: string;

  if (testsOrdered <= weights.optimalTestCount) {
    // At or below optimal - full score with bonus
    raw = 100;
    bonusApplied = true;
    if (testsOrdered === 0) {
      details = 'No tests ordered - diagnosed through history and exam alone!';
    } else {
      details = `Excellent! Only ${testsOrdered} test${testsOrdered === 1 ? '' : 's'} ordered (optimal: ≤${weights.optimalTestCount})`;
    }
  } else if (testsOrdered >= weights.maxTestCount) {
    // At or above max - zero score
    raw = 0;
    details = `Too many tests! ${testsOrdered} ordered (max: ${weights.maxTestCount})`;
  } else {
    // Between optimal and max - linear penalty
    const extraTests = testsOrdered - weights.optimalTestCount;
    const penalty = extraTests * weights.penaltyPerExtraTest;
    raw = Math.max(0, 100 - penalty);
    details = `${testsOrdered} tests ordered (${extraTests} over optimal of ${weights.optimalTestCount})`;
  }

  const weighted = (raw / 100) * weights.budgetWeight;

  return {
    raw: Math.round(raw),
    weighted: Math.round(weighted * 10) / 10,
    testsOrdered,
    optimalTests: weights.optimalTestCount,
    penaltyPerTest: weights.penaltyPerExtraTest,
    bonusApplied,
    details
  };
}

// ============================================
// EFFICIENCY SCORING
// ============================================

/**
 * Calculate efficiency score
 * Penalizes unnecessary, redundant, and low-yield tests
 */
export function calculateEfficiencyScore(
  transcript: GameplayTranscript,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): EfficiencyScore {
  const testActions = transcript.actions.filter(a => a.type === 'test');
  const domain = transcript.domain.toLowerCase();

  const unnecessaryTests: string[] = [];
  const redundantTests: string[] = [];
  const lowYieldTests: string[] = [];
  const seenTests = new Set<string>();

  for (const action of testActions) {
    const testName = action.name.toLowerCase();

    // Check for redundant tests (same test ordered twice)
    if (seenTests.has(testName)) {
      redundantTests.push(action.name);
    }
    seenTests.add(testName);

    // Check if test is relevant to the domain
    if (!isTestRelevantToDomain(action.name, domain)) {
      lowYieldTests.push(action.name);
    }

    // Check for unnecessary tests (expensive but result was normal)
    const testConfig = getTestCost(action.name);
    if (testConfig && testConfig.cost > 500 && action.isAbnormal === false) {
      unnecessaryTests.push(action.name);
    }
  }

  // Calculate penalties
  let totalPenalty = 0;
  totalPenalty += redundantTests.length * weights.redundantTestPenalty;
  totalPenalty += lowYieldTests.length * weights.lowYieldTestPenalty;
  totalPenalty += Math.min(unnecessaryTests.length * 10, weights.maxUnnecessaryTestPenalty);

  const raw = Math.max(0, 100 - totalPenalty);

  let details: string;
  if (totalPenalty === 0) {
    details = 'Perfect efficiency - no unnecessary or redundant tests';
  } else {
    const issues: string[] = [];
    if (redundantTests.length > 0) issues.push(`${redundantTests.length} redundant`);
    if (lowYieldTests.length > 0) issues.push(`${lowYieldTests.length} low-yield`);
    if (unnecessaryTests.length > 0) issues.push(`${unnecessaryTests.length} unnecessary`);
    details = `Issues: ${issues.join(', ')} tests`;
  }

  const weighted = (raw / 100) * weights.efficiencyWeight;

  return {
    raw: Math.round(raw),
    weighted: Math.round(weighted * 10) / 10,
    unnecessaryTests,
    redundantTests,
    lowYieldTests,
    totalPenalty,
    details
  };
}

// ============================================
// ACCURACY SCORING
// ============================================

/**
 * Calculate accuracy score
 * Based on correct diagnosis
 */
export function calculateAccuracyScore(
  transcript: GameplayTranscript,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): AccuracyScore {
  const correct = transcript.submittedDiagnosisId === transcript.correctDiagnosisId;

  // Check if this was first attempt (no previous wrong diagnoses)
  const diagnosisActions = transcript.actions.filter(a => a.type === 'diagnosis');
  const firstAttempt = diagnosisActions.length <= 1;

  let raw: number;
  let details: string;

  if (correct) {
    raw = 100;
    if (firstAttempt) {
      details = 'Correct diagnosis on first attempt!';
    } else {
      details = `Correct diagnosis (after ${diagnosisActions.length} attempts)`;
    }
  } else {
    raw = 0;
    details = `Incorrect. Submitted: ${transcript.submittedDiagnosisName || 'None'}, Correct: ${transcript.correctDiagnosisName}`;
  }

  const weighted = (raw / 100) * weights.accuracyWeight;

  return {
    raw: Math.round(raw),
    weighted: Math.round(weighted * 10) / 10,
    correct,
    firstAttempt,
    details
  };
}

// ============================================
// CLINICAL REASONING SCORING
// ============================================

/**
 * Calculate clinical reasoning score
 * Rewards systematic approach and relevant questions/tests
 */
export function calculateClinicalReasoningScore(
  transcript: GameplayTranscript,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): ClinicalReasoningScore {
  const domain = transcript.domain.toLowerCase();

  // Count relevant actions
  let relevantActionsCount = 0;
  const totalActionsCount = transcript.actions.length;

  for (const action of transcript.actions) {
    if (action.type === 'test') {
      if (isTestRelevantToDomain(action.name, domain)) {
        relevantActionsCount++;
      }
    } else if (action.type === 'exam') {
      if (isExamRelevantToDomain(action.name, domain)) {
        relevantActionsCount++;
      }
    } else if (action.type === 'question') {
      // Questions with high quality scores are relevant
      if (action.qualityScore && action.qualityScore >= 7) {
        relevantActionsCount++;
      }
    }
  }

  // Calculate question quality average
  const questionActions = transcript.actions.filter(a => a.type === 'question' && a.qualityScore);
  const questionQualityAvg = questionActions.length > 0
    ? questionActions.reduce((sum, a) => sum + (a.qualityScore || 0), 0) / questionActions.length
    : 5;

  // Check for systematic approach
  // (Did they ask questions before ordering expensive tests?)
  const systematicApproach = checkSystematicApproach(transcript);

  // Calculate raw score
  let raw = 0;

  // Relevant actions contribute up to 40 points
  if (totalActionsCount > 0) {
    const relevanceRatio = relevantActionsCount / totalActionsCount;
    raw += relevanceRatio * 40;
  }

  // Question quality contributes up to 30 points
  raw += (questionQualityAvg / 10) * 30;

  // Systematic approach bonus
  if (systematicApproach) {
    raw += weights.systematicApproachBonus;
  }

  // Cap at 100
  raw = Math.min(100, raw);

  let details: string;
  if (raw >= 80) {
    details = 'Excellent clinical reasoning with systematic approach';
  } else if (raw >= 60) {
    details = 'Good clinical reasoning';
  } else if (raw >= 40) {
    details = 'Average clinical reasoning - consider more focused approach';
  } else {
    details = 'Needs improvement in clinical reasoning';
  }

  const weighted = (raw / 100) * weights.clinicalReasoningWeight;

  return {
    raw: Math.round(raw),
    weighted: Math.round(weighted * 10) / 10,
    relevantActionsCount,
    totalActionsCount,
    systematicApproach,
    questionQualityAvg: Math.round(questionQualityAvg * 10) / 10,
    details
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if the player used a systematic approach
 * (History -> Exam -> Basic tests -> Advanced tests)
 */
function checkSystematicApproach(transcript: GameplayTranscript): boolean {
  const actions = transcript.actions;
  if (actions.length < 3) return false;

  // Find first expensive test (cost > 500)
  let firstExpensiveTestIndex = -1;
  for (let i = 0; i < actions.length; i++) {
    if (actions[i].type === 'test') {
      const testConfig = getTestCost(actions[i].name);
      if (testConfig && testConfig.cost > 500) {
        firstExpensiveTestIndex = i;
        break;
      }
    }
  }

  if (firstExpensiveTestIndex === -1) {
    // No expensive tests - considered systematic
    return true;
  }

  // Check if there were questions or basic tests before expensive test
  const actionsBeforeExpensive = actions.slice(0, firstExpensiveTestIndex);
  const hasQuestionsBefore = actionsBeforeExpensive.some(a => a.type === 'question');
  const hasExamBefore = actionsBeforeExpensive.some(a => a.type === 'exam');
  const hasBasicTestBefore = actionsBeforeExpensive.some(a => {
    if (a.type !== 'test') return false;
    const testConfig = getTestCost(a.name);
    return testConfig && testConfig.category === 'basic';
  });

  // Systematic if they did history OR exam before expensive tests
  return hasQuestionsBefore || hasExamBefore || hasBasicTestBefore;
}

/**
 * Calculate letter grade from total score
 */
function calculateGrade(totalScore: number): 'S' | 'A' | 'B' | 'C' | 'D' | 'F' {
  if (totalScore >= GRADE_THRESHOLDS.S) return 'S';
  if (totalScore >= GRADE_THRESHOLDS.A) return 'A';
  if (totalScore >= GRADE_THRESHOLDS.B) return 'B';
  if (totalScore >= GRADE_THRESHOLDS.C) return 'C';
  if (totalScore >= GRADE_THRESHOLDS.D) return 'D';
  return 'F';
}

/**
 * Generate feedback based on component scores
 */
function generateFeedback(
  time: TimeScore,
  budget: BudgetScore,
  efficiency: EfficiencyScore,
  accuracy: AccuracyScore,
  clinicalReasoning: ClinicalReasoningScore
): { strengths: string[]; areasForImprovement: string[] } {
  const strengths: string[] = [];
  const areasForImprovement: string[] = [];

  // Time feedback
  if (time.raw >= 80) {
    strengths.push('Quick diagnostic time');
  } else if (time.raw < 50) {
    areasForImprovement.push('Work on faster diagnosis');
  }

  // Test count feedback
  if (budget.raw >= 80) {
    strengths.push('Efficient - few tests ordered');
  } else if (budget.raw < 50) {
    areasForImprovement.push('Try to diagnose with fewer tests');
  }

  // Efficiency feedback
  if (efficiency.raw >= 80) {
    strengths.push('Efficient test selection');
  } else {
    if (efficiency.redundantTests.length > 0) {
      areasForImprovement.push('Avoid ordering duplicate tests');
    }
    if (efficiency.lowYieldTests.length > 0) {
      areasForImprovement.push('Focus on domain-relevant tests');
    }
    if (efficiency.unnecessaryTests.length > 0) {
      areasForImprovement.push('Consider if expensive tests are truly needed');
    }
  }

  // Accuracy feedback
  if (accuracy.correct) {
    if (accuracy.firstAttempt) {
      strengths.push('Correct diagnosis on first attempt');
    } else {
      strengths.push('Eventually reached correct diagnosis');
    }
  } else {
    areasForImprovement.push('Review the case to understand the correct diagnosis');
  }

  // Clinical reasoning feedback
  if (clinicalReasoning.raw >= 80) {
    strengths.push('Strong clinical reasoning');
  } else {
    if (!clinicalReasoning.systematicApproach) {
      areasForImprovement.push('Use a more systematic approach: History → Exam → Basic tests → Advanced tests');
    }
    if (clinicalReasoning.questionQualityAvg < 6) {
      areasForImprovement.push('Ask more focused, diagnostically valuable questions');
    }
  }

  return { strengths, areasForImprovement };
}

/**
 * Generate summary text
 */
function generateSummary(
  totalScore: number,
  grade: string,
  transcript: GameplayTranscript
): string {
  const testCount = transcript.actions.filter(a => a.type === 'test').length;
  const questionCount = transcript.actions.filter(a => a.type === 'question').length;
  const examCount = transcript.actions.filter(a => a.type === 'exam').length;

  const correctText = transcript.submittedDiagnosisId === transcript.correctDiagnosisId
    ? 'correctly diagnosed'
    : 'incorrectly diagnosed';

  return `Grade ${grade} (${totalScore}/100). You ${correctText} ${transcript.correctDiagnosisName} using ${questionCount} questions, ${examCount} exams, and ${testCount} tests.`;
}

// ============================================
// UTILITY EXPORTS
// ============================================

/**
 * Create a gameplay transcript from game state
 * Useful for converting existing game data to transcript format
 */
export function createTranscriptFromGameState(
  gameId: string,
  startTime: number,
  endTime: number,
  domain: string,
  correctDiagnosisId: string,
  correctDiagnosisName: string,
  submittedDiagnosisId: string | undefined,
  submittedDiagnosisName: string | undefined,
  chatHistory: Array<{ content: string; questionQuality?: number; timestamp: number }>,
  testResults: Array<{ testName: string; isAbnormal: boolean; timestamp: number }>,
  examResults: Array<{ examName: string; isAbnormal: boolean; timestamp: number }>
): GameplayTranscript {
  const actions: GameplayAction[] = [];

  // Add questions from chat history (player messages only)
  for (let i = 0; i < chatHistory.length; i += 2) {
    const msg = chatHistory[i];
    actions.push({
      type: 'question',
      name: msg.content.substring(0, 50),
      timestamp: msg.timestamp,
      qualityScore: msg.questionQuality
    });
  }

  // Add tests
  for (const test of testResults) {
    actions.push({
      type: 'test',
      name: test.testName,
      timestamp: test.timestamp,
      isAbnormal: test.isAbnormal
    });
  }

  // Add exams
  for (const exam of examResults) {
    actions.push({
      type: 'exam',
      name: exam.examName,
      timestamp: exam.timestamp,
      isAbnormal: exam.isAbnormal
    });
  }

  // Add diagnosis if submitted
  if (submittedDiagnosisId) {
    actions.push({
      type: 'diagnosis',
      name: submittedDiagnosisName || submittedDiagnosisId,
      timestamp: endTime
    });
  }

  // Sort by timestamp
  actions.sort((a, b) => a.timestamp - b.timestamp);

  return {
    gameId,
    startTime,
    endTime,
    correctDiagnosisId,
    correctDiagnosisName,
    submittedDiagnosisId,
    submittedDiagnosisName,
    domain,
    actions
  };
}
