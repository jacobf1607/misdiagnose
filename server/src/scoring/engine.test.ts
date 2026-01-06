/**
 * Scoring Engine Unit Tests
 */

import {
  calculateScore,
  calculateTimeScore,
  calculateBudgetScore,
  calculateEfficiencyScore,
  calculateAccuracyScore,
  calculateClinicalReasoningScore,
  createTranscriptFromGameState
} from './engine';

import { GameplayTranscript, ScoringWeights } from './types';
import { DEFAULT_WEIGHTS } from './config';

// ============================================
// TEST FIXTURES
// ============================================

const createMockTranscript = (overrides: Partial<GameplayTranscript> = {}): GameplayTranscript => ({
  gameId: 'test-game-1',
  startTime: Date.now() - 5 * 60 * 1000, // 5 minutes ago
  endTime: Date.now(),
  correctDiagnosisId: 'd1',
  correctDiagnosisName: 'Acute Myocardial Infarction',
  submittedDiagnosisId: 'd1',
  submittedDiagnosisName: 'Acute Myocardial Infarction',
  domain: 'cardiology',
  actions: [
    { type: 'question', name: 'chest pain history', timestamp: Date.now() - 4 * 60 * 1000, qualityScore: 8 },
    { type: 'question', name: 'radiation of pain', timestamp: Date.now() - 3.5 * 60 * 1000, qualityScore: 9 },
    { type: 'exam', name: 'Cardiovascular Examination', timestamp: Date.now() - 3 * 60 * 1000, isAbnormal: true },
    { type: 'test', name: 'ECG', timestamp: Date.now() - 2 * 60 * 1000, isAbnormal: true },
    { type: 'test', name: 'Troponin', timestamp: Date.now() - 1 * 60 * 1000, isAbnormal: true },
    { type: 'diagnosis', name: 'Acute Myocardial Infarction', timestamp: Date.now() }
  ],
  ...overrides
});

// ============================================
// TIME SCORE TESTS
// ============================================

describe('calculateTimeScore', () => {
  test('should give 100 points for optimal time', () => {
    const transcript = createMockTranscript({
      startTime: Date.now() - 5 * 60 * 1000, // 5 minutes
      endTime: Date.now()
    });

    const result = calculateTimeScore(transcript);

    expect(result.raw).toBe(100);
    expect(result.bonusApplied).toBe(true);
    expect(result.timeElapsedMinutes).toBeLessThanOrEqual(DEFAULT_WEIGHTS.optimalTimeMinutes);
  });

  test('should decay score for time over optimal', () => {
    const transcript = createMockTranscript({
      startTime: Date.now() - 20 * 60 * 1000, // 20 minutes
      endTime: Date.now()
    });

    const result = calculateTimeScore(transcript);

    expect(result.raw).toBeLessThan(100);
    expect(result.raw).toBeGreaterThan(0);
    expect(result.bonusApplied).toBe(false);
  });

  test('should give 0 points at max time', () => {
    const transcript = createMockTranscript({
      startTime: Date.now() - 31 * 60 * 1000, // 31 minutes (over 30 max)
      endTime: Date.now()
    });

    const result = calculateTimeScore(transcript);

    expect(result.raw).toBe(0);
  });
});

// ============================================
// BUDGET SCORE TESTS
// ============================================

describe('calculateBudgetScore', () => {
  test('should give 100 points for no tests', () => {
    const transcript = createMockTranscript({
      actions: [
        { type: 'question', name: 'history', timestamp: Date.now(), qualityScore: 8 },
        { type: 'diagnosis', name: 'diagnosis', timestamp: Date.now() }
      ]
    });

    const result = calculateBudgetScore(transcript);

    expect(result.raw).toBe(100);
    expect(result.totalSpent).toBe(0);
    expect(result.bonusApplied).toBe(true);
  });

  test('should calculate correct spending for tests', () => {
    const transcript = createMockTranscript({
      actions: [
        { type: 'test', name: 'ECG', timestamp: Date.now(), isAbnormal: true }, // 150
        { type: 'test', name: 'Troponin', timestamp: Date.now(), isAbnormal: true }, // 200
      ]
    });

    const result = calculateBudgetScore(transcript);

    expect(result.totalSpent).toBe(350); // ECG (150) + Troponin (200)
    expect(result.percentUsed).toBe(7); // 350/5000 = 7%
  });

  test('should penalize over-budget spending', () => {
    const expensiveTests = [];
    for (let i = 0; i < 10; i++) {
      expensiveTests.push({ type: 'test' as const, name: 'MRI Brain', timestamp: Date.now(), isAbnormal: false }); // 3000 each
    }

    const transcript = createMockTranscript({ actions: expensiveTests });

    const result = calculateBudgetScore(transcript);

    expect(result.totalSpent).toBeGreaterThan(DEFAULT_WEIGHTS.totalBudget);
    expect(result.raw).toBeLessThan(50);
  });
});

// ============================================
// EFFICIENCY SCORE TESTS
// ============================================

describe('calculateEfficiencyScore', () => {
  test('should give 100 points for efficient testing', () => {
    const transcript = createMockTranscript({
      domain: 'cardiology',
      actions: [
        { type: 'test', name: 'ECG', timestamp: Date.now(), isAbnormal: true },
        { type: 'test', name: 'Troponin', timestamp: Date.now(), isAbnormal: true }
      ]
    });

    const result = calculateEfficiencyScore(transcript);

    expect(result.raw).toBe(100);
    expect(result.redundantTests).toHaveLength(0);
    expect(result.lowYieldTests).toHaveLength(0);
  });

  test('should penalize redundant tests', () => {
    const transcript = createMockTranscript({
      domain: 'cardiology',
      actions: [
        { type: 'test', name: 'ECG', timestamp: Date.now(), isAbnormal: true },
        { type: 'test', name: 'ECG', timestamp: Date.now(), isAbnormal: true }, // Duplicate
      ]
    });

    const result = calculateEfficiencyScore(transcript);

    expect(result.redundantTests).toHaveLength(1);
    expect(result.raw).toBeLessThan(100);
  });

  test('should penalize low-yield tests', () => {
    const transcript = createMockTranscript({
      domain: 'cardiology',
      actions: [
        { type: 'test', name: 'Skin Biopsy', timestamp: Date.now(), isAbnormal: false }, // Not relevant to cardiology
      ]
    });

    const result = calculateEfficiencyScore(transcript);

    expect(result.lowYieldTests).toHaveLength(1);
    expect(result.raw).toBeLessThan(100);
  });

  test('should flag unnecessary expensive tests with normal results', () => {
    const transcript = createMockTranscript({
      domain: 'cardiology',
      actions: [
        { type: 'test', name: 'Coronary Angiography', timestamp: Date.now(), isAbnormal: false }, // 3000 cost, normal
      ]
    });

    const result = calculateEfficiencyScore(transcript);

    expect(result.unnecessaryTests).toHaveLength(1);
  });
});

// ============================================
// ACCURACY SCORE TESTS
// ============================================

describe('calculateAccuracyScore', () => {
  test('should give 100 points for correct diagnosis', () => {
    const transcript = createMockTranscript({
      correctDiagnosisId: 'd1',
      submittedDiagnosisId: 'd1'
    });

    const result = calculateAccuracyScore(transcript);

    expect(result.raw).toBe(100);
    expect(result.correct).toBe(true);
  });

  test('should give 0 points for incorrect diagnosis', () => {
    const transcript = createMockTranscript({
      correctDiagnosisId: 'd1',
      submittedDiagnosisId: 'd2'
    });

    const result = calculateAccuracyScore(transcript);

    expect(result.raw).toBe(0);
    expect(result.correct).toBe(false);
  });

  test('should detect first attempt', () => {
    const transcript = createMockTranscript({
      correctDiagnosisId: 'd1',
      submittedDiagnosisId: 'd1',
      actions: [
        { type: 'diagnosis', name: 'diagnosis', timestamp: Date.now() }
      ]
    });

    const result = calculateAccuracyScore(transcript);

    expect(result.firstAttempt).toBe(true);
  });
});

// ============================================
// CLINICAL REASONING SCORE TESTS
// ============================================

describe('calculateClinicalReasoningScore', () => {
  test('should reward high question quality', () => {
    const transcript = createMockTranscript({
      actions: [
        { type: 'question', name: 'q1', timestamp: Date.now(), qualityScore: 9 },
        { type: 'question', name: 'q2', timestamp: Date.now(), qualityScore: 10 },
        { type: 'question', name: 'q3', timestamp: Date.now(), qualityScore: 8 }
      ]
    });

    const result = calculateClinicalReasoningScore(transcript);

    expect(result.questionQualityAvg).toBeGreaterThan(8);
  });

  test('should detect systematic approach', () => {
    const transcript = createMockTranscript({
      domain: 'cardiology',
      actions: [
        { type: 'question', name: 'history', timestamp: 1, qualityScore: 8 },
        { type: 'exam', name: 'Cardiovascular Examination', timestamp: 2, isAbnormal: true },
        { type: 'test', name: 'ECG', timestamp: 3, isAbnormal: true }, // Basic test first
        { type: 'test', name: 'Coronary Angiography', timestamp: 4, isAbnormal: true } // Then expensive
      ]
    });

    const result = calculateClinicalReasoningScore(transcript);

    expect(result.systematicApproach).toBe(true);
  });

  test('should detect non-systematic approach', () => {
    const transcript = createMockTranscript({
      domain: 'cardiology',
      actions: [
        { type: 'test', name: 'Coronary Angiography', timestamp: 1, isAbnormal: true } // Expensive test first, no history
      ]
    });

    const result = calculateClinicalReasoningScore(transcript);

    expect(result.systematicApproach).toBe(false);
  });
});

// ============================================
// FULL SCORE CALCULATION TESTS
// ============================================

describe('calculateScore', () => {
  test('should calculate complete score breakdown', () => {
    const transcript = createMockTranscript();

    const result = calculateScore(transcript);

    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
    expect(result.grade).toMatch(/^[SABCDF]$/);
    expect(result.rank).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.strengths).toBeInstanceOf(Array);
    expect(result.areasForImprovement).toBeInstanceOf(Array);
  });

  test('should give high score for perfect play', () => {
    const transcript = createMockTranscript({
      startTime: Date.now() - 5 * 60 * 1000, // 5 minutes (fast)
      correctDiagnosisId: 'd1',
      submittedDiagnosisId: 'd1',
      domain: 'cardiology',
      actions: [
        { type: 'question', name: 'chest pain', timestamp: 1, qualityScore: 9 },
        { type: 'exam', name: 'Cardiovascular Examination', timestamp: 2, isAbnormal: true },
        { type: 'test', name: 'ECG', timestamp: 3, isAbnormal: true },
        { type: 'diagnosis', name: 'AMI', timestamp: 4 }
      ]
    });

    const result = calculateScore(transcript);

    expect(result.totalScore).toBeGreaterThan(70);
    expect(result.accuracy.correct).toBe(true);
  });

  test('should give low score for poor play', () => {
    const transcript = createMockTranscript({
      startTime: Date.now() - 25 * 60 * 1000, // 25 minutes (slow)
      correctDiagnosisId: 'd1',
      submittedDiagnosisId: 'd2', // Wrong diagnosis
      domain: 'cardiology',
      actions: [
        { type: 'test', name: 'MRI Brain', timestamp: 1, isAbnormal: false }, // Wrong domain, expensive
        { type: 'test', name: 'MRI Brain', timestamp: 2, isAbnormal: false }, // Duplicate
        { type: 'test', name: 'Skin Biopsy', timestamp: 3, isAbnormal: false }, // Wrong domain
        { type: 'diagnosis', name: 'wrong', timestamp: 4 }
      ]
    });

    const result = calculateScore(transcript);

    expect(result.totalScore).toBeLessThan(50);
    expect(result.accuracy.correct).toBe(false);
    expect(result.efficiency.redundantTests.length).toBeGreaterThan(0);
  });
});

// ============================================
// TRANSCRIPT CREATION TESTS
// ============================================

describe('createTranscriptFromGameState', () => {
  test('should create valid transcript from game state', () => {
    const transcript = createTranscriptFromGameState(
      'game-123',
      Date.now() - 10 * 60 * 1000,
      Date.now(),
      'cardiology',
      'd1',
      'AMI',
      'd1',
      'AMI',
      [
        { content: 'Do you have chest pain?', questionQuality: 8, timestamp: Date.now() - 5 * 60 * 1000 },
        { content: 'Yes, it hurts', timestamp: Date.now() - 4.5 * 60 * 1000 }
      ],
      [
        { testName: 'ECG', isAbnormal: true, timestamp: Date.now() - 3 * 60 * 1000 }
      ],
      [
        { examName: 'Cardiovascular Examination', isAbnormal: true, timestamp: Date.now() - 4 * 60 * 1000 }
      ]
    );

    expect(transcript.gameId).toBe('game-123');
    expect(transcript.domain).toBe('cardiology');
    expect(transcript.actions.length).toBe(4); // 1 question + 1 test + 1 exam + 1 diagnosis
    expect(transcript.actions.some(a => a.type === 'diagnosis')).toBe(true);
  });
});

// ============================================
// GRADE CALCULATION TESTS
// ============================================

describe('Grade Calculation', () => {
  test('should assign correct grades based on score', () => {
    const createTranscriptWithScore = (score: number) => {
      // Create a transcript that will roughly produce the desired score
      const actions = [];

      if (score >= 30) {
        // Need correct diagnosis for any decent score
        return createMockTranscript({
          correctDiagnosisId: 'd1',
          submittedDiagnosisId: 'd1',
          startTime: score >= 80 ? Date.now() - 5 * 60 * 1000 : Date.now() - 20 * 60 * 1000
        });
      }

      return createMockTranscript({
        correctDiagnosisId: 'd1',
        submittedDiagnosisId: 'd2' // Wrong diagnosis
      });
    };

    const highScore = calculateScore(createTranscriptWithScore(90));
    expect(['S', 'A', 'B']).toContain(highScore.grade);

    const lowScore = calculateScore(createTranscriptWithScore(20));
    expect(['D', 'F']).toContain(lowScore.grade);
  });
});

console.log('All scoring engine tests defined. Run with: npm test');
