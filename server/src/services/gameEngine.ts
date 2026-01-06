import { v4 as uuidv4 } from 'uuid';
import {
  Case,
  GameState,
  ChatMessage,
  TestResult,
  ExamResult,
  GameMode,
  BLITZ_TIME_LIMIT_MS,
  ScoreBreakdown
} from '../types';

import { generateAIScore, AIScoreInput } from './openai';

// releaseCase import removed - usedBy tracking now happens at allocation time

// In-memory game storage
const activeGames: Map<string, InternalGameState> = new Map();

interface InternalGameState {
  gameId: string;
  case: Case;
  chatHistory: ChatMessage[];
  testResults: TestResult[];
  examResults: ExamResult[];
  questionScores: number[];
  status: "in_progress" | "won" | "lost" | "timeout";
  selectedDiagnosisId?: string;
  startTime: number;
  // Case pool tracking
  poolCaseId?: string;  // ID of case from pool (for release)
  userId?: string;      // User ID (for tracking)
  // Game mode
  mode: GameMode;       // 'standard' or 'blitz'
  timeLimit?: number;   // Time limit in ms (only for blitz)
}

/**
 * Options for creating a new game
 */
interface CreateGameOptions {
  poolCaseId?: string;  // ID of case from pool (for release)
  userId?: string;      // User ID (for tracking)
  mode?: GameMode;      // 'standard' (default) or 'blitz'
}

/**
 * Create a new game from a case
 */
export function createGame(caseData: Case, options?: CreateGameOptions): GameState {
  const gameId = uuidv4();
  const mode = options?.mode || 'standard';
  const timeLimit = mode === 'blitz' ? BLITZ_TIME_LIMIT_MS : undefined;

  const internalState: InternalGameState = {
    gameId,
    case: caseData,
    chatHistory: [],
    testResults: [],
    examResults: [],
    questionScores: [],
    status: "in_progress",
    startTime: Date.now(),
    poolCaseId: options?.poolCaseId,
    userId: options?.userId,
    mode,
    timeLimit
  };

  activeGames.set(gameId, internalState);
  return toPublicState(internalState);
}

/**
 * Get game state
 */
export function getGame(gameId: string): GameState | null {
  const internal = activeGames.get(gameId);
  if (!internal) return null;
  return toPublicState(internal);
}

/**
 * Get the full case data (for OpenAI context)
 */
export function getCaseData(gameId: string): Case | null {
  const internal = activeGames.get(gameId);
  return internal?.case || null;
}

/**
 * Add a question and answer to the chat history
 */
export function addChatExchange(
  gameId: string,
  question: string,
  answer: string,
  questionQuality: number
): GameState | null {
  const internal = activeGames.get(gameId);
  if (!internal || internal.status !== "in_progress") return null;

  // Add player question
  internal.chatHistory.push({
    id: uuidv4(),
    role: "player",
    content: question,
    timestamp: Date.now(),
    questionQuality
  });

  // Add patient answer
  internal.chatHistory.push({
    id: uuidv4(),
    role: "patient",
    content: answer,
    timestamp: Date.now()
  });

  // Track question score
  internal.questionScores.push(questionQuality);

  return toPublicState(internal);
}

/**
 * Add an examination result
 */
export function addExamResult(
  gameId: string,
  examName: string,
  finding: string,
  isAbnormal: boolean
): GameState | null {
  const internal = activeGames.get(gameId);
  if (!internal || internal.status !== "in_progress") return null;

  const examResult: ExamResult = {
    id: uuidv4(),
    examName,
    finding,
    timestamp: Date.now(),
    isAbnormal
  };

  internal.examResults.push(examResult);
  return toPublicState(internal);
}

/**
 * Add a test result
 */
export function addTestResult(
  gameId: string,
  testName: string,
  result: string,
  isAbnormal: boolean
): GameState | null {
  const internal = activeGames.get(gameId);
  if (!internal || internal.status !== "in_progress") return null;

  const testResult: TestResult = {
    id: uuidv4(),
    testName,
    result,
    timestamp: Date.now(),
    isAbnormal
  };

  internal.testResults.push(testResult);
  return toPublicState(internal);
}

/**
 * Submit final diagnosis - uses AI-based scoring system
 * Now async to support AI scoring API call
 */
export async function submitDiagnosis(
  gameId: string,
  diagnosisId: string
): Promise<{ correct: boolean; breakdown: ScoreBreakdown; state: GameState } | null> {
  const internal = activeGames.get(gameId);
  if (!internal || internal.status !== "in_progress") return null;

  const correct = diagnosisId === internal.case.correctDiagnosisId;
  internal.selectedDiagnosisId = diagnosisId;
  internal.status = correct ? "won" : "lost";

  // Get diagnosis names
  const correctDiagnosis = internal.case.diagnoses.find(
    d => d.id === internal.case.correctDiagnosisId
  );
  const submittedDiagnosis = internal.case.diagnoses.find(
    d => d.id === diagnosisId
  );

  // Calculate time elapsed
  const endTime = Date.now();
  const timeElapsedMinutes = (endTime - internal.startTime) / 60000;

  // Prepare input for AI scoring
  const scoreInput: AIScoreInput = {
    caseId: internal.case.id,
    domain: (internal.case as any).domain || 'general',
    correctDiagnosisName: correctDiagnosis?.name || 'Unknown',
    submittedDiagnosisName: submittedDiagnosis?.name || 'Unknown',
    isCorrect: correct,
    timeElapsedMinutes,
    isTimeout: false,
    questionsAsked: internal.chatHistory
      .filter(msg => msg.role === 'player')
      .map(msg => ({
        content: msg.content,
        quality: msg.questionQuality || 5
      })),
    examsPerformed: internal.examResults.map(e => ({
      name: e.examName,
      finding: e.finding,
      isAbnormal: e.isAbnormal
    })),
    testsOrdered: internal.testResults.map(t => ({
      name: t.testName,
      result: t.result,
      isAbnormal: t.isAbnormal
    })),
    idealPathway: (internal.case as any).idealPathway ? {
      keyHistoryQuestions: (internal.case as any).idealPathway.keyHistoryQuestions || [],
      keyExaminations: (internal.case as any).idealPathway.keyExaminations || [],
      keyInvestigations: (internal.case as any).idealPathway.keyInvestigations || []
    } : undefined
  };

  // Generate AI-based score
  const breakdown = await generateAIScore(scoreInput);

  return {
    correct,
    breakdown,
    state: toPublicState(internal)
  };
}

/**
 * Timeout a blitz game - called when timer expires
 * Returns score breakdown for the timed-out game
 * Now async to support AI scoring API call
 */
export async function timeoutGame(
  gameId: string
): Promise<{ breakdown: ScoreBreakdown; state: GameState } | null> {
  const internal = activeGames.get(gameId);
  if (!internal || internal.status !== "in_progress") return null;

  // Verify this is a blitz game
  if (internal.mode !== 'blitz') {
    console.warn(`timeoutGame called on non-blitz game: ${gameId}`);
    return null;
  }

  // Mark as timed out
  internal.status = "timeout";

  // Get correct diagnosis name
  const correctDiagnosis = internal.case.diagnoses.find(
    d => d.id === internal.case.correctDiagnosisId
  );

  // Calculate time elapsed (should be ~2 minutes for blitz timeout)
  const timeElapsedMinutes = 2; // Blitz is always 2 minutes

  // Prepare input for AI scoring - timeout means no diagnosis submitted
  const scoreInput: AIScoreInput = {
    caseId: internal.case.id,
    domain: (internal.case as any).domain || 'general',
    correctDiagnosisName: correctDiagnosis?.name || 'Unknown',
    submittedDiagnosisName: 'No diagnosis (timeout)',
    isCorrect: false, // Timeout is always incorrect
    timeElapsedMinutes,
    isTimeout: true,
    questionsAsked: internal.chatHistory
      .filter(msg => msg.role === 'player')
      .map(msg => ({
        content: msg.content,
        quality: msg.questionQuality || 5
      })),
    examsPerformed: internal.examResults.map(e => ({
      name: e.examName,
      finding: e.finding,
      isAbnormal: e.isAbnormal
    })),
    testsOrdered: internal.testResults.map(t => ({
      name: t.testName,
      result: t.result,
      isAbnormal: t.isAbnormal
    })),
    idealPathway: (internal.case as any).idealPathway ? {
      keyHistoryQuestions: (internal.case as any).idealPathway.keyHistoryQuestions || [],
      keyExaminations: (internal.case as any).idealPathway.keyExaminations || [],
      keyInvestigations: (internal.case as any).idealPathway.keyInvestigations || []
    } : undefined
  };

  // Generate AI-based score
  const breakdown = await generateAIScore(scoreInput);

  return {
    breakdown,
    state: toPublicState(internal)
  };
}

/**
 * Convert to public state (hide case secrets)
 */
function toPublicState(internal: InternalGameState): GameState {
  const caseData = internal.case;

  return {
    gameId: internal.gameId,
    caseId: caseData.id,
    domain: caseData.domain,
    persona: caseData.persona,
    initialComplaint: caseData.initialComplaint,
    diagnoses: caseData.diagnoses,
    chatHistory: internal.chatHistory,
    testResults: internal.testResults,
    examResults: internal.examResults,
    status: internal.status,
    score: 0, // Calculated at end
    questionScores: internal.questionScores,
    selectedDiagnosisId: internal.selectedDiagnosisId,
    correctDiagnosisId: internal.status !== "in_progress" ? caseData.correctDiagnosisId : undefined,
    startTime: internal.startTime,
    mode: internal.mode,
    timeLimit: internal.timeLimit
  };
}

/**
 * Delete a game from memory
 * Note: Case usage is now tracked at allocation time, not on delete
 */
export function deleteGame(gameId: string): boolean {
  return activeGames.delete(gameId);
}

/**
 * Get pool case ID for a game (for external use)
 */
export function getGamePoolInfo(gameId: string): { poolCaseId?: string; userId?: string } | null {
  const internal = activeGames.get(gameId);
  if (!internal) return null;
  return {
    poolCaseId: internal.poolCaseId,
    userId: internal.userId
  };
}
