import { Router, Request, Response } from 'express';
import * as gameEngine from '../services/gameEngine';
import * as openaiService from '../services/openai';
import * as fs from 'fs';
import * as path from 'path';
import {
  NewGameRequest,
  AskQuestionRequest,
  SubmitDiagnosisRequest,
  OrderTestRequest,
  PerformExamRequest,
  BatchTestRequest,
  BatchExamRequest,
  Case,
  GetCoachingRequest,
  CoachingFeedback,
  DiagnosisExplanation,
  IncorrectDiagnosisExplanation,
  TestResult,
  ExamResult,
  ValidationError,
  CaseHistoryEntry,
  GameMode,
  BLITZ_TIME_LIMIT_MS,
  BLITZ_GRACE_PERIOD_MS
} from '../types';
import {
  compareToIdealPathway,
  generateCoachingFeedback
} from '../coaching/coachingEngine';
import { allocateCase, getPoolStatus, getTestModeCases, markCaseAsUsed } from '../services/casePoolManager';
import { addCaseToHistory } from '../services/userService';

const router = Router();

// Load case from file
function loadCase(caseId: string): Case | null {
  try {
    const casePath = path.join(__dirname, '../data/cases', `${caseId}.json`);
    const caseData = fs.readFileSync(casePath, 'utf-8');
    return JSON.parse(caseData);
  } catch {
    return null;
  }
}

/**
 * POST /api/game/new - Start a new game
 * Now uses case pool for faster gameplay when available
 */
router.post('/new', async (req: Request, res: Response) => {
  try {
    const { caseId, mode } = req.body as NewGameRequest;
    // Extended request params for pool allocation
    const { userId, domain } = req.body as { userId?: string; domain?: string };

    // Validate mode if provided
    const gameMode: GameMode = mode === 'blitz' ? 'blitz' : 'standard';

    let caseData: Case | null = null;
    let poolCaseId: string | undefined;
    let fromPool = false;

    if (caseId) {
      // Load specific case by ID (e.g., 'sample')
      caseData = loadCase(caseId);
      if (!caseData) {
        return res.status(404).json({ error: `Case not found: ${caseId}` });
      }
      // Mark case as used by this user to prevent repeats
      if (userId) {
        markCaseAsUsed(caseId, userId);
      }
      poolCaseId = caseId;
    } else {
      // Try to allocate from case pool first
      try {
        const allocation = await allocateCase({
          userId,
          domain,
          excludeCaseIds: []
        });
        caseData = allocation.case;
        poolCaseId = allocation.metadata.caseId;
        fromPool = allocation.fromPool;

        console.log(`[Game] Allocated case ${poolCaseId} (from pool: ${fromPool})`);
      } catch (error) {
        console.error('Pool allocation failed, generating fresh case:', error);
        // Fallback to direct generation
        try {
          caseData = await openaiService.generateCase(domain);
        } catch (genError) {
          console.error('Case generation failed:', genError);
          return res.status(500).json({ error: 'Failed to generate case' });
        }
      }
    }

    // Create game with pool tracking and mode
    const state = gameEngine.createGame(caseData, {
      poolCaseId,
      userId,
      mode: gameMode
    });

    console.log(`[Game] Started ${gameMode} mode game ${state.gameId}`);

    res.json({
      gameId: state.gameId,
      state,
      fromPool // Let client know if case came from pool
    });
  } catch (error) {
    console.error('Error starting game:', error);
    res.status(500).json({ error: 'Failed to start game' });
  }
});

/**
 * GET /api/game/pool/status - Get case pool status (admin)
 */
router.get('/pool/status', (req: Request, res: Response) => {
  try {
    const status = getPoolStatus();
    res.json({ status });
  } catch (error) {
    console.error('Error getting pool status:', error);
    res.status(500).json({ error: 'Failed to get pool status' });
  }
});

/**
 * GET /api/game/pool/scan-invalid - Scan for invalid/garbage cases
 * Returns list of cases that have invalid content (error messages as diagnoses)
 */
router.get('/pool/scan-invalid', (req: Request, res: Response) => {
  try {
    const casesDir = path.join(__dirname, '../data/cases');
    const files = fs.readdirSync(casesDir).filter(f => f.startsWith('case_') && f.endsWith('.json'));

    const invalidPatterns = [
      'unknown',
      'textbook reference',
      'cannot be generated',
      'not provided',
      'cannot generate',
      'unable to generate',
      'no reference',
      'reference not'
    ];

    const invalidCases: Array<{ caseId: string; reason: string; sample: string }> = [];

    for (const file of files) {
      try {
        const filePath = path.join(casesDir, file);
        const caseData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        // Check diagnoses
        const badDiagnosis = caseData.diagnoses?.find((d: { name?: string; description?: string }) => {
          const text = `${d.name || ''} ${d.description || ''}`.toLowerCase();
          return invalidPatterns.some(p => text.includes(p));
        });

        // Check initialComplaint
        const badComplaint = invalidPatterns.some(p =>
          (caseData.initialComplaint || '').toLowerCase().includes(p)
        );

        if (badDiagnosis || badComplaint) {
          invalidCases.push({
            caseId: caseData.id || file.replace('.json', ''),
            reason: badDiagnosis ? `Bad diagnosis: ${badDiagnosis.name}` : 'Bad initial complaint',
            sample: badDiagnosis ? badDiagnosis.name : caseData.initialComplaint?.substring(0, 100)
          });
        }
      } catch (e) {
        // Skip files that can't be parsed
      }
    }

    res.json({
      totalCases: files.length,
      invalidCount: invalidCases.length,
      invalidCases
    });
  } catch (error) {
    console.error('Error scanning cases:', error);
    res.status(500).json({ error: 'Failed to scan cases' });
  }
});

/**
 * DELETE /api/game/pool/clean-invalid - Delete all invalid/garbage cases
 * Removes cases with error messages as diagnoses
 */
router.delete('/pool/clean-invalid', (req: Request, res: Response) => {
  try {
    const casesDir = path.join(__dirname, '../data/cases');
    const files = fs.readdirSync(casesDir).filter(f => f.startsWith('case_') && f.endsWith('.json'));

    const invalidPatterns = [
      'unknown',
      'textbook reference',
      'cannot be generated',
      'not provided',
      'cannot generate',
      'unable to generate',
      'no reference',
      'reference not'
    ];

    const deleted: string[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(casesDir, file);
        const caseData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        // Check diagnoses
        const badDiagnosis = caseData.diagnoses?.some((d: { name?: string; description?: string }) => {
          const text = `${d.name || ''} ${d.description || ''}`.toLowerCase();
          return invalidPatterns.some(p => text.includes(p));
        });

        // Check initialComplaint
        const badComplaint = invalidPatterns.some(p =>
          (caseData.initialComplaint || '').toLowerCase().includes(p)
        );

        if (badDiagnosis || badComplaint) {
          fs.unlinkSync(filePath);
          deleted.push(caseData.id || file.replace('.json', ''));
          console.log(`[Pool Cleanup] Deleted invalid case: ${file}`);
        }
      } catch (e) {
        // Skip files that can't be parsed
      }
    }

    // Reload the pool index after cleanup
    const { loadIndex } = require('../services/casePoolManager');
    loadIndex();

    res.json({
      deleted: deleted.length,
      deletedCases: deleted
    });
  } catch (error) {
    console.error('Error cleaning cases:', error);
    res.status(500).json({ error: 'Failed to clean cases' });
  }
});

/**
 * GET /api/game/pool/test-cases - Get 3 random cases for test mode
 * Future: Will be restricted to admin/test accounts only
 */
router.get('/pool/test-cases', (req: Request, res: Response) => {
  try {
    const count = parseInt(req.query.count as string) || 3;
    const testCases = getTestModeCases(count);

    if (testCases.length === 0) {
      return res.status(404).json({ error: 'No cases available in pool' });
    }

    res.json({
      testCases: testCases.map(c => ({
        caseId: c.caseId,
        domain: c.domain,
        diagnosis: c.correctDiagnosis
      })),
      count: testCases.length
    });
  } catch (error) {
    console.error('Error getting test cases:', error);
    res.status(500).json({ error: 'Failed to get test cases' });
  }
});

/**
 * GET /api/game/:id - Get game state
 */
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const state = gameEngine.getGame(id);

  if (!state) {
    return res.status(404).json({ error: 'Game not found' });
  }

  res.json({ state });
});

/**
 * POST /api/game/:id/ask - Ask a question to the patient
 */
router.post('/:id/ask', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { question } = req.body as AskQuestionRequest;

    if (!question || question.trim().length === 0) {
      return res.status(400).json({ error: 'Question is required' });
    }

    // Get current game state
    const state = gameEngine.getGame(id);
    if (!state) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (state.status !== 'in_progress') {
      return res.status(400).json({ error: 'Game is already finished' });
    }

    // Get full case data for OpenAI context
    const caseData = gameEngine.getCaseData(id);
    if (!caseData) {
      return res.status(404).json({ error: 'Case data not found' });
    }

    // Generate patient response using OpenAI
    const { answer, questionQuality } = await openaiService.generatePatientResponse(
      caseData,
      question.trim(),
      state.chatHistory
    );

    // Update game state with the exchange
    const newState = gameEngine.addChatExchange(id, question.trim(), answer, questionQuality);

    if (!newState) {
      return res.status(500).json({ error: 'Failed to update game state' });
    }

    res.json({
      answer,
      questionQuality,
      state: newState
    });
  } catch (error) {
    console.error('Error asking question:', error);
    res.status(500).json({ error: 'Failed to process question' });
  }
});

/**
 * POST /api/game/:id/exam - Perform a physical examination
 */
router.post('/:id/exam', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { examName } = req.body as PerformExamRequest;

    if (!examName || examName.trim().length === 0) {
      return res.status(400).json({ error: 'Exam name is required' });
    }

    // Get current game state
    const state = gameEngine.getGame(id);
    if (!state) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (state.status !== 'in_progress') {
      return res.status(400).json({ error: 'Game is already finished' });
    }

    // Get full case data for AI context
    const caseData = gameEngine.getCaseData(id);
    if (!caseData) {
      return res.status(404).json({ error: 'Case data not found' });
    }

    // Generate exam findings using AI
    const { finding, isAbnormal } = await openaiService.generateExamFinding(
      caseData,
      examName.trim()
    );

    // Update game state with the exam result
    const newState = gameEngine.addExamResult(id, examName.trim(), finding, isAbnormal);

    if (!newState) {
      return res.status(500).json({ error: 'Failed to add exam result' });
    }

    res.json({
      result: {
        id: newState.examResults[newState.examResults.length - 1].id,
        examName: examName.trim(),
        finding,
        timestamp: Date.now(),
        isAbnormal
      },
      state: newState
    });
  } catch (error) {
    console.error('Error performing exam:', error);
    res.status(500).json({ error: 'Failed to perform examination' });
  }
});

/**
 * POST /api/game/:id/test - Order a medical test
 */
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { testName } = req.body as OrderTestRequest;

    if (!testName || testName.trim().length === 0) {
      return res.status(400).json({ error: 'Test name is required' });
    }

    // Get current game state
    const state = gameEngine.getGame(id);
    if (!state) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (state.status !== 'in_progress') {
      return res.status(400).json({ error: 'Game is already finished' });
    }

    // Get full case data for AI context
    const caseData = gameEngine.getCaseData(id);
    if (!caseData) {
      return res.status(404).json({ error: 'Case data not found' });
    }

    // Generate test results using AI
    const { result, isAbnormal } = await openaiService.generateTestResult(
      caseData,
      testName.trim()
    );

    // Update game state with the test result
    const newState = gameEngine.addTestResult(id, testName.trim(), result, isAbnormal);

    if (!newState) {
      return res.status(500).json({ error: 'Failed to add test result' });
    }

    res.json({
      result: {
        id: newState.testResults[newState.testResults.length - 1].id,
        testName: testName.trim(),
        result,
        timestamp: Date.now(),
        isAbnormal
      },
      state: newState,
      testsOrdered: newState.testResults.length
    });
  } catch (error) {
    console.error('Error ordering test:', error);
    res.status(500).json({ error: 'Failed to order test' });
  }
});

/**
 * POST /api/game/:id/batch-tests - Order multiple tests via free-text input
 */
router.post('/:id/batch-tests', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { freeText } = req.body as BatchTestRequest;

    if (!freeText || freeText.trim().length === 0) {
      return res.status(400).json({ error: 'Free text input is required' });
    }

    // Get current game state
    const state = gameEngine.getGame(id);
    if (!state) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (state.status !== 'in_progress') {
      return res.status(400).json({ error: 'Game is already finished' });
    }

    // Get full case data for AI context
    const caseData = gameEngine.getCaseData(id);
    if (!caseData) {
      return res.status(404).json({ error: 'Case data not found' });
    }

    // Parse and validate the free-text input
    const { validTests, errors } = await openaiService.parseAndValidateTests(freeText);

    // Generate results for each valid test
    const results: TestResult[] = [];
    let currentState = state;

    for (const testName of validTests) {
      // Check if test was already ordered
      if (currentState.testResults.some(t => t.testName.toLowerCase() === testName.toLowerCase())) {
        errors.push({
          input: testName,
          message: `${testName} has already been ordered.`
        });
        continue;
      }

      // Generate result for this test
      const { result, isAbnormal } = await openaiService.generateTestResult(caseData, testName);

      // Update game state
      const newState = gameEngine.addTestResult(id, testName, result, isAbnormal);
      if (newState) {
        currentState = newState;
        const addedResult = newState.testResults[newState.testResults.length - 1];
        results.push(addedResult);
      }
    }

    res.json({
      results,
      errors,
      state: currentState,
      testsOrdered: currentState.testResults.length
    });
  } catch (error) {
    console.error('Error ordering batch tests:', error);
    res.status(500).json({ error: 'Failed to order tests' });
  }
});

/**
 * POST /api/game/:id/batch-exams - Perform multiple examinations via free-text input
 */
router.post('/:id/batch-exams', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { freeText } = req.body as BatchExamRequest;

    if (!freeText || freeText.trim().length === 0) {
      return res.status(400).json({ error: 'Free text input is required' });
    }

    // Get current game state
    const state = gameEngine.getGame(id);
    if (!state) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (state.status !== 'in_progress') {
      return res.status(400).json({ error: 'Game is already finished' });
    }

    // Get full case data for AI context
    const caseData = gameEngine.getCaseData(id);
    if (!caseData) {
      return res.status(404).json({ error: 'Case data not found' });
    }

    // Parse and validate the free-text input
    const { validExams, errors } = await openaiService.parseAndValidateExams(freeText);

    // Generate findings for each valid exam
    const results: ExamResult[] = [];
    let currentState = state;

    for (const examName of validExams) {
      // Check if exam was already performed
      if (currentState.examResults.some(e => e.examName.toLowerCase() === examName.toLowerCase())) {
        errors.push({
          input: examName,
          message: `${examName} has already been performed.`
        });
        continue;
      }

      // Generate finding for this exam
      const { finding, isAbnormal } = await openaiService.generateExamFinding(caseData, examName);

      // Update game state
      const newState = gameEngine.addExamResult(id, examName, finding, isAbnormal);
      if (newState) {
        currentState = newState;
        const addedResult = newState.examResults[newState.examResults.length - 1];
        results.push(addedResult);
      }
    }

    res.json({
      results,
      errors,
      state: currentState
    });
  } catch (error) {
    console.error('Error performing batch exams:', error);
    res.status(500).json({ error: 'Failed to perform examinations' });
  }
});

/**
 * POST /api/game/:id/diagnose - Submit final diagnosis
 */
router.post('/:id/diagnose', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { diagnosisId, userId } = req.body as SubmitDiagnosisRequest & { userId?: string };

    if (!diagnosisId) {
      return res.status(400).json({ error: 'Diagnosis ID is required' });
    }

    const state = gameEngine.getGame(id);
    if (!state) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Verify diagnosis exists
    const diagnosis = state.diagnoses.find(d => d.id === diagnosisId);
    if (!diagnosis) {
      return res.status(400).json({ error: 'Invalid diagnosis ID' });
    }

    // Get case data for explanations
    const caseData = gameEngine.getCaseData(id);
    if (!caseData) {
      return res.status(404).json({ error: 'Case data not found' });
    }

    const result = await gameEngine.submitDiagnosis(id, diagnosisId);
    if (!result) {
      return res.status(500).json({ error: 'Failed to submit diagnosis' });
    }

    const correctDiagnosis = state.diagnoses.find(d => d.id === result.state.correctDiagnosisId);
    const submittedDiagnosis = state.diagnoses.find(d => d.id === diagnosisId);

    // Prepare player actions for explanation generation
    const playerActions = {
      questions: state.chatHistory
        .filter(m => m.role === 'player')
        .map(m => m.content),
      exams: state.examResults.map(e => ({
        name: e.examName,
        finding: e.finding,
        isAbnormal: e.isAbnormal
      })),
      tests: state.testResults.map(t => ({
        name: t.testName,
        result: t.result,
        isAbnormal: t.isAbnormal
      }))
    };

    // Try to use precomputed explanations first (instant), fall back to AI generation
    const startTime = Date.now();
    let diagnosisExplanation: Awaited<ReturnType<typeof openaiService.generateDiagnosisExplanation>>;
    let incorrectExplanation: IncorrectDiagnosisExplanation | undefined;

    const precomputed = (caseData as any).precomputedExplanations as Array<{
      diagnosisId: string;
      diagnosisName: string;
      description: string;
      keySymptoms: string[];
      clinicalReasoning: string;
      whyIncorrectForCase?: string;
      keyDifferencesFromCorrect?: string[];
      missingFindings?: string[];
    }> | undefined;

    const correctPrecomputed = precomputed?.find(p => p.diagnosisId === result.state.correctDiagnosisId);
    const incorrectPrecomputed = !result.correct ? precomputed?.find(p => p.diagnosisId === diagnosisId) : undefined;

    if (correctPrecomputed) {
      // Use precomputed explanation for correct diagnosis
      console.log('Using precomputed explanation for correct diagnosis');
      diagnosisExplanation = {
        description: correctPrecomputed.description,
        keySymptoms: correctPrecomputed.keySymptoms,
        diagnosisSteps: [],
        keyFindings: [],
        clinicalReasoning: correctPrecomputed.clinicalReasoning
      };

      if (!result.correct) {
        if (incorrectPrecomputed) {
          // Use precomputed explanation for incorrect diagnosis
          console.log('Using precomputed explanation for incorrect diagnosis');
          incorrectExplanation = {
            description: incorrectPrecomputed.description,
            whyIncorrect: incorrectPrecomputed.whyIncorrectForCase || '',
            keyDifferences: incorrectPrecomputed.keyDifferencesFromCorrect || [],
            missingFindings: incorrectPrecomputed.missingFindings || [],
            contradictingFindings: [],
            differentiatingFeatures: ''
          };
        } else {
          // Generate incorrect explanation via AI (precomputed not available for this diagnosis)
          console.log('Generating incorrect explanation via AI (not precomputed)...');
          incorrectExplanation = await openaiService.generateIncorrectDiagnosisExplanation(
            caseData,
            diagnosisId,
            playerActions
          );
        }
      }
      console.log(`Explanations retrieved in ${Date.now() - startTime}ms`);
    } else {
      // Fall back to parallel AI generation
      console.log('Generating explanations in parallel (no precomputed data)...');

      const explanationPromises: [
        Promise<Awaited<ReturnType<typeof openaiService.generateDiagnosisExplanation>>>,
        Promise<IncorrectDiagnosisExplanation | undefined>
      ] = [
        openaiService.generateDiagnosisExplanation(caseData, playerActions),
        result.correct
          ? Promise.resolve(undefined)
          : openaiService.generateIncorrectDiagnosisExplanation(caseData, diagnosisId, playerActions)
      ];

      [diagnosisExplanation, incorrectExplanation] = await Promise.all(explanationPromises);
      console.log(`Explanations generated in ${Date.now() - startTime}ms (parallel AI)`);
    }

    // Save to user's case history if userId provided
    if (userId) {
      const timeElapsedMinutes = state.startTime
        ? Math.round((Date.now() - state.startTime) / 60000 * 10) / 10
        : 0;

      const historyEntry: CaseHistoryEntry = {
        caseId: state.caseId,
        gameId: id,
        completedAt: Date.now(),
        domain: caseData.domain || 'general',
        correctDiagnosis: correctDiagnosis?.name || 'Unknown',
        submittedDiagnosis: submittedDiagnosis?.name || 'Unknown',
        wasCorrect: result.correct,
        finalScore: result.breakdown.totalScore,
        grade: result.breakdown.grade,
        questionCount: state.chatHistory.filter(m => m.role === 'player').length,
        testsOrdered: state.testResults.length,
        examsPerformed: state.examResults.length,
        timeElapsedMinutes,
        mode: state.mode || 'standard',
        timedOut: false,

        // Detailed data for case review
        persona: {
          name: state.persona.name,
          age: state.persona.age,
          gender: state.persona.gender,
          occupation: state.persona.occupation
        },
        initialComplaint: state.initialComplaint,
        chatHistory: state.chatHistory.map(m => ({
          role: m.role,
          content: m.content
        })),
        testResults: state.testResults.map(t => ({
          name: t.testName,
          result: t.result,
          isAbnormal: t.isAbnormal
        })),
        examResults: state.examResults.map(e => ({
          name: e.examName,
          finding: e.finding,
          isAbnormal: e.isAbnormal
        })),

        // Score breakdown
        scoreBreakdown: {
          accuracy: result.breakdown.accuracy?.weighted || 0,
          efficiency: result.breakdown.efficiency?.weighted || 0,
          clinicalReasoning: result.breakdown.clinicalReasoning?.weighted || 0,
          testEconomy: result.breakdown.budget?.weighted || 0,
          time: result.breakdown.time?.weighted || 0,
          summary: result.breakdown.summary || '',
          strengths: result.breakdown.strengths || [],
          areasForImprovement: result.breakdown.areasForImprovement || []
        },

        // Coaching data
        diagnosisExplanation: diagnosisExplanation ? {
          description: diagnosisExplanation.description,
          keySymptoms: diagnosisExplanation.keySymptoms,
          clinicalReasoning: diagnosisExplanation.clinicalReasoning
        } : undefined,
        incorrectExplanation: incorrectExplanation ? {
          whyIncorrect: incorrectExplanation.whyIncorrect,
          keyDifferences: incorrectExplanation.keyDifferences,
          missingFindings: incorrectExplanation.missingFindings
        } : undefined
      };

      addCaseToHistory(userId, historyEntry);
      console.log(`Saved case history for user ${userId} (${state.mode} mode)`);
    }

    res.json({
      correct: result.correct,
      correctDiagnosisId: result.state.correctDiagnosisId,
      correctDiagnosisName: correctDiagnosis?.name || 'Unknown',
      submittedDiagnosisName: submittedDiagnosis?.name || 'Unknown',
      finalScore: result.breakdown.totalScore,
      scoreBreakdown: result.breakdown,
      state: result.state,
      diagnosisExplanation,
      incorrectExplanation
    });
  } catch (error) {
    console.error('Error submitting diagnosis:', error);
    res.status(500).json({ error: 'Failed to submit diagnosis' });
  }
});

/**
 * GET /api/game/:id/coaching - Get coaching feedback for a completed game
 * Returns ideal pathway and comparison with player's approach
 */
router.get('/:id/coaching', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get game state
    const state = gameEngine.getGame(id);
    if (!state) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Game must be finished to get coaching
    if (state.status === 'in_progress') {
      return res.status(400).json({ error: 'Game is still in progress. Submit diagnosis first.' });
    }

    // Get full case data including ideal pathway
    const caseData = gameEngine.getCaseData(id);
    if (!caseData) {
      return res.status(404).json({ error: 'Case data not found' });
    }

    // Check if ideal pathway is available
    const idealPathway = (caseData as any).idealPathway;
    if (!idealPathway) {
      return res.status(404).json({
        error: 'Coaching not available for this case',
        reason: 'Ideal pathway was not generated. This may happen if RAG was unavailable when the case was created.'
      });
    }

    // Compare player's approach to ideal pathway
    const comparison = compareToIdealPathway(
      idealPathway,
      state.chatHistory,
      state.testResults,
      state.examResults
    );

    // Generate coaching feedback
    const wasCorrect = state.status === 'won';
    const coaching = generateCoachingFeedback(idealPathway, comparison, wasCorrect);

    res.json({
      coaching,
      gameStatus: state.status,
      correctDiagnosisId: state.correctDiagnosisId
    });
  } catch (error) {
    console.error('Error getting coaching:', error);
    res.status(500).json({ error: 'Failed to generate coaching feedback' });
  }
});

/**
 * POST /api/game/:id/timeout - Handle blitz mode timeout
 * Called when the blitz timer expires
 */
router.post('/:id/timeout', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body as { userId?: string };

    const state = gameEngine.getGame(id);
    if (!state) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Verify this is a blitz game
    if (state.mode !== 'blitz') {
      return res.status(400).json({ error: 'Timeout is only valid for blitz mode games' });
    }

    // Verify game is still in progress
    if (state.status !== 'in_progress') {
      return res.status(400).json({ error: 'Game is already finished' });
    }

    // Server-side time validation with grace period
    if (state.startTime) {
      const elapsed = Date.now() - state.startTime;
      const maxAllowedTime = BLITZ_TIME_LIMIT_MS + BLITZ_GRACE_PERIOD_MS;

      if (elapsed < BLITZ_TIME_LIMIT_MS - 1000) {
        // Client tried to timeout too early (suspicious)
        console.warn(`[Game] Early timeout attempt for ${id}. Elapsed: ${elapsed}ms`);
        return res.status(400).json({ error: 'Time limit not yet reached' });
      }
    }

    // Get case data before timeout
    const caseData = gameEngine.getCaseData(id);

    // Process the timeout (async for AI scoring)
    const result = await gameEngine.timeoutGame(id);
    if (!result) {
      return res.status(500).json({ error: 'Failed to process timeout' });
    }

    const correctDiagnosis = state.diagnoses.find(d => d.id === result.state.correctDiagnosisId);

    // Save to user's case history if userId provided
    if (userId && caseData) {
      const timeElapsedMinutes = 2; // Blitz is always 2 minutes

      const historyEntry: CaseHistoryEntry = {
        caseId: state.caseId,
        gameId: id,
        completedAt: Date.now(),
        domain: caseData.domain || 'general',
        correctDiagnosis: correctDiagnosis?.name || 'Unknown',
        submittedDiagnosis: 'No diagnosis (timeout)',
        wasCorrect: false,
        finalScore: result.breakdown.totalScore,
        grade: result.breakdown.grade,
        questionCount: state.chatHistory.filter(m => m.role === 'player').length,
        testsOrdered: state.testResults.length,
        examsPerformed: state.examResults.length,
        timeElapsedMinutes,
        mode: 'blitz',
        timedOut: true,

        // Detailed data for case review
        persona: {
          name: state.persona.name,
          age: state.persona.age,
          gender: state.persona.gender,
          occupation: state.persona.occupation
        },
        initialComplaint: state.initialComplaint,
        chatHistory: state.chatHistory.map(m => ({
          role: m.role,
          content: m.content
        })),
        testResults: state.testResults.map(t => ({
          name: t.testName,
          result: t.result,
          isAbnormal: t.isAbnormal
        })),
        examResults: state.examResults.map(e => ({
          name: e.examName,
          finding: e.finding,
          isAbnormal: e.isAbnormal
        })),

        // Score breakdown (no coaching for timeout)
        scoreBreakdown: {
          accuracy: result.breakdown.accuracy?.weighted || 0,
          efficiency: result.breakdown.efficiency?.weighted || 0,
          clinicalReasoning: result.breakdown.clinicalReasoning?.weighted || 0,
          testEconomy: result.breakdown.budget?.weighted || 0,
          time: result.breakdown.time?.weighted || 0,
          summary: result.breakdown.summary || 'Time ran out before submitting a diagnosis.',
          strengths: result.breakdown.strengths || [],
          areasForImprovement: result.breakdown.areasForImprovement || ['Submit a diagnosis before time runs out']
        }
      };

      addCaseToHistory(userId, historyEntry);
      console.log(`[Game] Saved blitz timeout history for user ${userId}`);
    }

    console.log(`[Game] Blitz timeout for game ${id}`);

    res.json({
      correct: false,
      correctDiagnosisId: result.state.correctDiagnosisId,
      correctDiagnosisName: correctDiagnosis?.name || 'Unknown',
      submittedDiagnosisName: 'No diagnosis (timeout)',
      finalScore: result.breakdown.totalScore,
      scoreBreakdown: result.breakdown,
      state: result.state,
      timedOut: true
    });
  } catch (error) {
    console.error('Error processing timeout:', error);
    res.status(500).json({ error: 'Failed to process timeout' });
  }
});

/**
 * DELETE /api/game/:id - Delete a game
 */
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const deleted = gameEngine.deleteGame(id);

  if (!deleted) {
    return res.status(404).json({ error: 'Game not found' });
  }

  res.json({ success: true });
});

export default router;
