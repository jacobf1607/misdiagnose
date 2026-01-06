/**
 * Coaching Engine - Compares player actions to ideal pathway and generates feedback
 * All scoring and feedback is based on deviation from the textbook-derived ideal pathway
 */

import {
  IdealPathway,
  PathwayStep,
  PathwayComparison,
  CoachingFeedback,
  ChatMessage,
  TestResult,
  ExamResult
} from '../../../shared/types';

// Similarity threshold for matching actions to pathway steps
const SIMILARITY_THRESHOLD = 0.4;

/**
 * Extract keywords from a string for matching
 */
function extractKeywords(text: string): Set<string> {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'about', 'any', 'ask', 'tell',
    'me', 'you', 'your', 'patient', 'doctor', 'please', 'what', 'how',
    'when', 'where', 'why', 'which', 'who', 'perform', 'order', 'check'
  ]);

  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
  );
}

/**
 * Calculate similarity between two texts using Jaccard index
 */
function calculateSimilarity(text1: string, text2: string): number {
  const keywords1 = extractKeywords(text1);
  const keywords2 = extractKeywords(text2);

  if (keywords1.size === 0 || keywords2.size === 0) return 0;

  const intersection = new Set([...keywords1].filter(x => keywords2.has(x)));
  const union = new Set([...keywords1, ...keywords2]);

  return intersection.size / union.size;
}

/**
 * Check if a player question matches a pathway step
 */
function questionMatchesStep(question: string, step: PathwayStep): boolean {
  // Check similarity with action description
  if (calculateSimilarity(question, step.action) >= SIMILARITY_THRESHOLD) {
    return true;
  }

  // Check similarity with expected finding
  if (calculateSimilarity(question, step.expectedFinding) >= SIMILARITY_THRESHOLD) {
    return true;
  }

  // Check similarity with reasoning
  if (calculateSimilarity(question, step.reasoning) >= 0.3) {
    return true;
  }

  return false;
}

/**
 * Check if a test/exam matches a pathway step
 */
function actionMatchesStep(actionName: string, step: PathwayStep): boolean {
  const actionLower = actionName.toLowerCase();
  const stepActionLower = step.action.toLowerCase();

  // Direct substring match
  if (stepActionLower.includes(actionLower) || actionLower.includes(stepActionLower.split(' ').pop() || '')) {
    return true;
  }

  // Check keyword similarity
  if (calculateSimilarity(actionName, step.action) >= SIMILARITY_THRESHOLD) {
    return true;
  }

  return false;
}

/**
 * Compare player's approach to the ideal pathway
 */
export function compareToIdealPathway(
  idealPathway: IdealPathway,
  chatHistory: ChatMessage[],
  testResults: TestResult[],
  examResults: ExamResult[]
): PathwayComparison {
  const correctActions: PathwayComparison['correctActions'] = [];
  const missedSteps: PathwayComparison['missedSteps'] = [];
  const unnecessaryActions: PathwayComparison['unnecessaryActions'] = [];
  const orderingIssues: PathwayComparison['orderingIssues'] = [];

  // Track which steps were matched
  const matchedHistorySteps = new Set<number>();
  const matchedExamSteps = new Set<number>();
  const matchedInvestigationSteps = new Set<number>();

  // Track which player actions were matched (to avoid marking them as unnecessary)
  const matchedQuestionIndices = new Set<number>();
  const matchedExamNames = new Set<string>();
  const matchedTestNames = new Set<string>();

  // Player's questions (filter to player messages only)
  const playerQuestions = chatHistory
    .filter(msg => msg.role === 'player')
    .map((msg, idx) => ({ content: msg.content, order: idx + 1, originalIdx: idx }));

  // 1. Match player questions to history steps
  for (const question of playerQuestions) {
    let matched = false;
    for (let i = 0; i < idealPathway.keyHistoryQuestions.length; i++) {
      const step = idealPathway.keyHistoryQuestions[i];
      if (questionMatchesStep(question.content, step)) {
        matchedHistorySteps.add(i);
        matchedQuestionIndices.add(question.originalIdx);
        matched = true;
        correctActions.push({
          action: question.content,
          type: 'question',
          matchedStep: step,
          feedback: `Good question! This helps identify ${step.expectedFinding}`
        });

        // Check ordering
        if (question.order > (i + 1) * 2 && step.importance === 'critical') {
          orderingIssues.push({
            action: question.content,
            idealOrder: step.order,
            actualOrder: question.order,
            feedback: `This critical question should be asked earlier in the diagnostic process`
          });
        }
        break;
      }
    }

    // If not matched to any step, might be unnecessary (only if not already matched)
    if (!matched && !matchedQuestionIndices.has(question.originalIdx)) {
      // Check if it's at least related to the disease
      const isRelated = idealPathway.keyHistoryQuestions.some(
        step => calculateSimilarity(question.content, step.action) >= 0.2
      );
      if (!isRelated) {
        unnecessaryActions.push({
          action: question.content,
          type: 'question',
          feedback: 'This question was not directly relevant to the diagnostic pathway'
        });
      }
    }
  }

  // 2. Match examinations to exam steps
  for (let examIdx = 0; examIdx < examResults.length; examIdx++) {
    const exam = examResults[examIdx];
    let matched = false;
    for (let i = 0; i < idealPathway.keyExaminations.length; i++) {
      const step = idealPathway.keyExaminations[i];
      if (actionMatchesStep(exam.examName, step)) {
        matchedExamSteps.add(i);
        matchedExamNames.add(exam.examName.toLowerCase());
        matched = true;
        correctActions.push({
          action: exam.examName,
          type: 'examination',
          matchedStep: step,
          feedback: `Correct examination! ${step.reasoning}`
        });
        break;
      }
    }

    // Only mark as unnecessary if not matched
    if (!matched && !matchedExamNames.has(exam.examName.toLowerCase())) {
      unnecessaryActions.push({
        action: exam.examName,
        type: 'examination',
        feedback: 'This examination was not part of the recommended diagnostic workup'
      });
    }
  }

  // 3. Match investigations to investigation steps
  for (let testIdx = 0; testIdx < testResults.length; testIdx++) {
    const test = testResults[testIdx];
    let matched = false;
    for (let i = 0; i < idealPathway.keyInvestigations.length; i++) {
      const step = idealPathway.keyInvestigations[i];
      if (actionMatchesStep(test.testName, step)) {
        matchedInvestigationSteps.add(i);
        matchedTestNames.add(test.testName.toLowerCase());
        matched = true;
        correctActions.push({
          action: test.testName,
          type: 'investigation',
          matchedStep: step,
          feedback: `Appropriate test! ${step.reasoning}`
        });

        // Check if expensive tests were ordered before basic ones
        if (step.order > 2 && testIdx < 2 && step.importance !== 'critical') {
          orderingIssues.push({
            action: test.testName,
            idealOrder: step.order,
            actualOrder: testIdx + 1,
            feedback: 'Consider ordering basic tests before expensive investigations'
          });
        }
        break;
      }
    }

    // Only mark as unnecessary if not already matched to a pathway step
    if (!matched && !matchedTestNames.has(test.testName.toLowerCase())) {
      unnecessaryActions.push({
        action: test.testName,
        type: 'investigation',
        feedback: 'This test was not essential for the diagnosis and added unnecessary cost'
      });
    }
  }

  // 3.5 Check for differential diagnosis elimination
  // Track if player asked questions that help rule out other diagnoses
  const differentialEliminationActions: { action: string; ruledOut: string; how: string }[] = [];

  for (const question of playerQuestions) {
    for (const diff of idealPathway.differentialDiagnoses) {
      // Check if question relates to ruling out this differential
      const ruleOutKeywords = extractKeywords(diff.howToRuleOut);
      const questionKeywords = extractKeywords(question.content);
      const overlap = [...questionKeywords].filter(k => ruleOutKeywords.has(k));

      if (overlap.length >= 2 || calculateSimilarity(question.content, diff.howToRuleOut) >= 0.3) {
        differentialEliminationActions.push({
          action: question.content,
          ruledOut: diff.name,
          how: diff.howToRuleOut
        });
      }
    }
  }

  // Also check if tests/exams helped rule out differentials
  for (const test of testResults) {
    for (const diff of idealPathway.differentialDiagnoses) {
      if (calculateSimilarity(test.testName, diff.howToRuleOut) >= 0.3) {
        differentialEliminationActions.push({
          action: test.testName,
          ruledOut: diff.name,
          how: diff.howToRuleOut
        });
      }
    }
  }

  // 4. Find missed steps
  for (let i = 0; i < idealPathway.keyHistoryQuestions.length; i++) {
    if (!matchedHistorySteps.has(i)) {
      const step = idealPathway.keyHistoryQuestions[i];
      missedSteps.push({
        step,
        whyImportant: `Per textbook: ${step.reasoning}. Expected finding: ${step.expectedFinding}`
      });
    }
  }

  for (let i = 0; i < idealPathway.keyExaminations.length; i++) {
    if (!matchedExamSteps.has(i)) {
      const step = idealPathway.keyExaminations[i];
      missedSteps.push({
        step,
        whyImportant: `Per textbook: ${step.reasoning}. Expected finding: ${step.expectedFinding}`
      });
    }
  }

  for (let i = 0; i < idealPathway.keyInvestigations.length; i++) {
    if (!matchedInvestigationSteps.has(i)) {
      const step = idealPathway.keyInvestigations[i];
      // Only count as missed if it was critical or important
      if (step.importance !== 'helpful') {
        missedSteps.push({
          step,
          whyImportant: `Per textbook: ${step.reasoning}. Expected finding: ${step.expectedFinding}`
        });
      }
    }
  }

  // 5. Calculate pathway score
  const totalIdealSteps =
    idealPathway.keyHistoryQuestions.length +
    idealPathway.keyExaminations.length +
    idealPathway.keyInvestigations.filter(s => s.importance !== 'helpful').length;

  const matchedSteps =
    matchedHistorySteps.size +
    matchedExamSteps.size +
    matchedInvestigationSteps.size;

  // Score calculation:
  // - Base score from matched steps (50%)
  // - Penalty for unnecessary actions (15% max deduction)
  // - Penalty for ordering issues (10% max deduction)
  // - Bonus for matching critical steps (10% bonus)
  // - Bonus for differential elimination (15% bonus)

  const baseScore = totalIdealSteps > 0 ? (matchedSteps / totalIdealSteps) * 50 : 0;

  const unnecessaryPenalty = Math.min(15, unnecessaryActions.length * 4);

  const orderingPenalty = Math.min(10, orderingIssues.length * 3);

  // Bonus for critical steps
  const criticalSteps = [
    ...idealPathway.keyHistoryQuestions.filter(s => s.importance === 'critical'),
    ...idealPathway.keyExaminations.filter(s => s.importance === 'critical'),
    ...idealPathway.keyInvestigations.filter(s => s.importance === 'critical')
  ];
  const matchedCritical = correctActions.filter(
    a => a.matchedStep.importance === 'critical'
  ).length;
  const criticalBonus = criticalSteps.length > 0
    ? (matchedCritical / criticalSteps.length) * 10
    : 0;

  // Bonus for differential elimination - reward players who narrowed down the diagnosis
  const uniqueDifferentialsRuledOut = new Set(differentialEliminationActions.map(a => a.ruledOut));
  const totalDifferentials = idealPathway.differentialDiagnoses.length;
  const differentialBonus = totalDifferentials > 0
    ? (uniqueDifferentialsRuledOut.size / totalDifferentials) * 15
    : 0;

  const pathwayScore = Math.max(0, Math.min(100,
    baseScore + criticalBonus + differentialBonus + 25 - unnecessaryPenalty - orderingPenalty
  ));

  return {
    correctActions,
    missedSteps,
    unnecessaryActions,
    differentialEliminationActions,
    orderingIssues,
    pathwayScore: Math.round(pathwayScore)
  };
}

/**
 * Generate complete coaching feedback
 * Provides detailed, educational feedback to help players learn clinical reasoning
 */
export function generateCoachingFeedback(
  idealPathway: IdealPathway,
  comparison: PathwayComparison,
  wasCorrect: boolean
): CoachingFeedback {
  const whatYouDidWell: string[] = [];
  const whatYouMissed: string[] = [];
  const whatWasUnnecessary: string[] = [];
  const keyLearningPoints: string[] = [];
  const recommendedReading: string[] = [];

  // ========== WHAT YOU DID WELL ==========

  if (wasCorrect) {
    whatYouDidWell.push(
      `Correct diagnosis! You successfully identified ${idealPathway.diseaseName}.`
    );
  }

  // Praise differential diagnosis elimination strategy
  const uniqueDifferentialsRuledOut = new Set(comparison.differentialEliminationActions.map(a => a.ruledOut));
  if (uniqueDifferentialsRuledOut.size > 0) {
    const ruledOutList = [...uniqueDifferentialsRuledOut].slice(0, 3).join(', ');
    whatYouDidWell.push(
      `Excellent differential reasoning: You asked questions that helped rule out ${uniqueDifferentialsRuledOut.size} alternative diagnoses (${ruledOutList}). This is exactly how experienced clinicians narrow down to the correct diagnosis.`
    );

    // If they got few pathway steps but good elimination, emphasize this
    if (wasCorrect && comparison.correctActions.length < 5 && uniqueDifferentialsRuledOut.size >= 2) {
      whatYouDidWell.push(
        `Efficient approach: You reached the correct diagnosis through targeted elimination rather than exhaustive testing. This shows strong clinical reasoning.`
      );
    }
  }

  // Detail each correct critical action with WHY it was good
  const criticalMatches = comparison.correctActions.filter(
    a => a.matchedStep.importance === 'critical'
  );
  for (const match of criticalMatches) {
    whatYouDidWell.push(
      `Excellent: "${match.action}" - This is a critical diagnostic step because ${match.matchedStep.reasoning}. Expected finding: ${match.matchedStep.expectedFinding}`
    );
  }

  // Detail important matches
  const importantMatches = comparison.correctActions.filter(
    a => a.matchedStep.importance === 'important'
  );
  for (const match of importantMatches.slice(0, 2)) {
    whatYouDidWell.push(
      `Good: "${match.action}" - ${match.matchedStep.reasoning}`
    );
  }

  if (comparison.orderingIssues.length === 0 && comparison.correctActions.length > 3) {
    whatYouDidWell.push(
      'Systematic approach: You followed the recommended diagnostic sequence (history → exam → targeted tests)'
    );
  }

  // ========== WHAT YOU MISSED ==========

  // Critical missed steps - full detail with textbook reference
  const missedCritical = comparison.missedSteps.filter(
    m => m.step.importance === 'critical'
  );
  for (const missed of missedCritical) {
    whatYouMissed.push(
      `CRITICAL STEP MISSED: "${missed.step.action}"\n` +
      `Why it matters: ${missed.step.reasoning}\n` +
      `What you would have found: ${missed.step.expectedFinding}\n` +
      `Textbook reference: "${missed.step.textbookReference}"`
    );
  }

  // Important missed steps
  const missedImportant = comparison.missedSteps.filter(
    m => m.step.importance === 'important'
  );
  for (const missed of missedImportant.slice(0, 3)) {
    whatYouMissed.push(
      `SHOULD HAVE: "${missed.step.action}"\n` +
      `Reason: ${missed.step.reasoning}\n` +
      `Expected finding: ${missed.step.expectedFinding}`
    );
  }

  // Helpful missed steps (brief)
  const missedHelpful = comparison.missedSteps.filter(
    m => m.step.importance === 'helpful'
  );
  if (missedHelpful.length > 0) {
    whatYouMissed.push(
      `Also consider: ${missedHelpful.slice(0, 2).map(m => m.step.action).join(', ')} - these provide additional supporting evidence`
    );
  }

  // ========== UNNECESSARY ACTIONS ==========

  for (const unnecessary of comparison.unnecessaryActions) {
    const actionTypeLabel = unnecessary.type === 'investigation' ? 'Test' :
      unnecessary.type === 'examination' ? 'Exam' : 'Question';

    whatWasUnnecessary.push(
      `${actionTypeLabel}: "${unnecessary.action}"\n` +
      `Why unnecessary: ${unnecessary.feedback}\n` +
      `Tip: For ${idealPathway.diseaseName}, focus on ${idealPathway.domain}-specific investigations`
    );
  }

  // ========== KEY LEARNING POINTS ==========

  // Main diagnostic approach
  keyLearningPoints.push(
    `DIAGNOSTIC APPROACH for ${idealPathway.diseaseName}:\n${idealPathway.diagnosticApproach}`
  );

  // Critical questions to always ask
  const criticalHistory = idealPathway.keyHistoryQuestions.filter(q => q.importance === 'critical');
  if (criticalHistory.length > 0) {
    keyLearningPoints.push(
      `ALWAYS ASK about:\n${criticalHistory.map(q =>
        `• ${q.action} - reveals ${q.expectedFinding}`
      ).join('\n')}`
    );
  }

  // Key investigations
  const criticalTests = idealPathway.keyInvestigations.filter(t => t.importance === 'critical');
  if (criticalTests.length > 0) {
    keyLearningPoints.push(
      `KEY INVESTIGATIONS:\n${criticalTests.map(t =>
        `• ${t.action} - ${t.reasoning}`
      ).join('\n')}`
    );
  }

  // Differential diagnosis insights
  if (idealPathway.differentialDiagnoses.length > 0) {
    const diffList = idealPathway.differentialDiagnoses.map(d =>
      `• ${d.name}: Rule out by ${d.howToRuleOut}`
    ).join('\n');
    keyLearningPoints.push(
      `DIFFERENTIAL DIAGNOSIS:\nWhen considering ${idealPathway.diseaseName}, also think about:\n${diffList}`
    );
  }

  // Clinical reasoning tip
  if (comparison.orderingIssues.length > 0) {
    keyLearningPoints.push(
      `CLINICAL REASONING TIP:\nFollow the diagnostic hierarchy:\n` +
      `1. History (most important - 80% of diagnoses come from history)\n` +
      `2. Physical examination\n` +
      `3. Basic investigations (CBC, basic metabolic panel)\n` +
      `4. Targeted advanced tests\n\n` +
      `Expensive tests should confirm, not discover, the diagnosis.`
    );
  }

  // ========== RECOMMENDED READING ==========

  // Include all textbook sources
  for (const source of idealPathway.textbookSources) {
    recommendedReading.push(source);
  }

  // Add textbook references from critical steps
  for (const step of [...criticalHistory, ...criticalTests]) {
    if (step.textbookReference && !recommendedReading.includes(step.textbookReference)) {
      recommendedReading.push(`From textbook: "${step.textbookReference}"`);
    }
  }

  // ========== COACHING SUMMARY ==========

  let coachingSummary = '';
  const totalIdealSteps = idealPathway.keyHistoryQuestions.length +
    idealPathway.keyExaminations.length +
    idealPathway.keyInvestigations.length;

  // Check if player used effective elimination strategy
  const usedEliminationStrategy = uniqueDifferentialsRuledOut.size >= 2;
  const efficientDiagnosis = wasCorrect && comparison.correctActions.length < totalIdealSteps * 0.6 && usedEliminationStrategy;

  if (efficientDiagnosis) {
    // Special praise for reaching correct diagnosis through elimination with fewer steps
    coachingSummary = `Outstanding clinical reasoning! You correctly diagnosed ${idealPathway.diseaseName} using an efficient elimination approach. `;
    coachingSummary += `You ruled out ${uniqueDifferentialsRuledOut.size} differential diagnoses through targeted questioning, which is exactly how expert clinicians work. `;
    coachingSummary += `While the textbook pathway has ${totalIdealSteps} steps, reaching the diagnosis through smart elimination is equally valid.`;
  } else if (comparison.pathwayScore >= 80) {
    coachingSummary = `Excellent work! You demonstrated strong clinical reasoning, covering ${comparison.correctActions.length} of ${totalIdealSteps} key diagnostic steps for ${idealPathway.diseaseName}. `;
    if (wasCorrect) {
      coachingSummary += 'Your systematic approach led to the correct diagnosis.';
    }
    if (usedEliminationStrategy) {
      coachingSummary += ` Additionally, you effectively ruled out ${uniqueDifferentialsRuledOut.size} alternative diagnoses.`;
    }
  } else if (comparison.pathwayScore >= 60) {
    coachingSummary = `Good attempt! You covered ${comparison.correctActions.length} of ${totalIdealSteps} key steps. `;
    if (usedEliminationStrategy) {
      coachingSummary += `Good job ruling out ${uniqueDifferentialsRuledOut.size} differential diagnoses. `;
    }
    if (missedCritical.length > 0) {
      coachingSummary += `Focus on the critical questions you missed - these are essential for diagnosing ${idealPathway.diseaseName}. `;
    }
    coachingSummary += 'Review the "Ideal Pathway" tab to see the recommended diagnostic sequence.';
  } else if (comparison.pathwayScore >= 40) {
    coachingSummary = `There's room for improvement. You covered ${comparison.correctActions.length} of ${totalIdealSteps} recommended steps. `;
    coachingSummary += `For ${idealPathway.diseaseName}, the textbook emphasizes: ${idealPathway.diagnosticApproach.substring(0, 150)}... `;
    coachingSummary += 'Review the complete pathway in the "Ideal Pathway" tab.';
  } else {
    coachingSummary = `This case needs more work. You covered only ${comparison.correctActions.length} of ${totalIdealSteps} key diagnostic steps. `;
    coachingSummary += `${idealPathway.diseaseName} requires a structured approach. Key points:\n`;
    coachingSummary += `1. ${criticalHistory[0]?.action || 'Take thorough history'}\n`;
    coachingSummary += `2. ${criticalTests[0]?.action || 'Order appropriate tests'}\n`;
    coachingSummary += 'Study the "Key Learnings" tab for detailed guidance.';
  }

  if (comparison.unnecessaryActions.length > 2 && !efficientDiagnosis) {
    coachingSummary += `\n\nEfficiency note: You ordered ${comparison.unnecessaryActions.length} unnecessary tests/exams. Remember to focus on investigations that will change your management.`;
  }

  return {
    idealPathway,
    comparison,
    whatYouDidWell,
    whatYouMissed,
    whatWasUnnecessary,
    keyLearningPoints,
    recommendedReading,
    coachingSummary
  };
}

/**
 * Calculate pathway-based score (replaces old efficiency scoring)
 * This is the new "deviation from ideal" based scoring
 */
export function calculatePathwayDeviationScore(comparison: PathwayComparison): {
  pathwayAdherence: number;
  efficiencyScore: number;
  completenessScore: number;
  details: string;
} {
  // Pathway adherence: How well did they follow the ideal path?
  const pathwayAdherence = comparison.pathwayScore;

  // Efficiency: Penalty for unnecessary actions
  const totalActions = comparison.correctActions.length + comparison.unnecessaryActions.length;
  const efficiencyScore = totalActions > 0
    ? Math.round((comparison.correctActions.length / totalActions) * 100)
    : 100;

  // Completeness: How many ideal steps were covered?
  const totalMissed = comparison.missedSteps.length;
  const totalCovered = comparison.correctActions.length;
  const completenessScore = totalCovered + totalMissed > 0
    ? Math.round((totalCovered / (totalCovered + totalMissed)) * 100)
    : 0;

  // Build details string
  const details = [
    `Pathway adherence: ${pathwayAdherence}%`,
    `Covered ${totalCovered}/${totalCovered + totalMissed} key steps`,
    comparison.unnecessaryActions.length > 0
      ? `${comparison.unnecessaryActions.length} unnecessary actions`
      : 'No unnecessary actions'
  ].join('. ');

  return {
    pathwayAdherence,
    efficiencyScore,
    completenessScore,
    details
  };
}
