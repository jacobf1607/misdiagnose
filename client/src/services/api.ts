import type {
  GameState,
  NewGameRequest,
  AskQuestionResponse,
  SubmitDiagnosisResponse,
  OrderTestResponse,
  PerformExamResponse,
  BatchTestResponse,
  BatchExamResponse,
  CaseHistoryResponse,
  GameMode,
  ScoreBreakdown,
  FeedbackEntry,
  FeedbackStatus,
  FeedbackContext,
  FeedbackCaseSnapshot,
  SubmitFeedbackRequest,
  SubmitFeedbackResponse,
  GetFeedbackResponse,
  UpdateFeedbackStatusRequest
} from '../../../shared/types';

// In production, VITE_API_URL should be set to the backend URL
// In development, Vite proxy handles /api requests
const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface NewGameResponse {
  gameId: string;
  state: GameState;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(response.status, error.error || 'Request failed');
  }

  return response.json();
}

export async function startNewGame(caseId?: string, mode?: GameMode, userId?: string): Promise<NewGameResponse> {
  const body: NewGameRequest & { userId?: string } = {};
  if (caseId) body.caseId = caseId;
  if (mode) body.mode = mode;
  if (userId) body.userId = userId;

  return request<NewGameResponse>('/game/new', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getGameState(gameId: string): Promise<{ state: GameState }> {
  return request<{ state: GameState }>(`/game/${gameId}`);
}

export async function askQuestion(
  gameId: string,
  question: string
): Promise<AskQuestionResponse> {
  return request<AskQuestionResponse>(`/game/${gameId}/ask`, {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}

export async function submitDiagnosis(
  gameId: string,
  diagnosisId: string,
  userId?: string
): Promise<SubmitDiagnosisResponse> {
  return request<SubmitDiagnosisResponse>(`/game/${gameId}/diagnose`, {
    method: 'POST',
    body: JSON.stringify({ diagnosisId, userId }),
  });
}

export async function deleteGame(gameId: string): Promise<void> {
  await request(`/game/${gameId}`, {
    method: 'DELETE',
  });
}

export async function orderTest(
  gameId: string,
  testName: string
): Promise<OrderTestResponse> {
  return request<OrderTestResponse>(`/game/${gameId}/test`, {
    method: 'POST',
    body: JSON.stringify({ testName }),
  });
}

export async function performExam(
  gameId: string,
  examName: string
): Promise<PerformExamResponse> {
  return request<PerformExamResponse>(`/game/${gameId}/exam`, {
    method: 'POST',
    body: JSON.stringify({ examName }),
  });
}

export async function orderBatchTests(
  gameId: string,
  freeText: string
): Promise<BatchTestResponse> {
  return request<BatchTestResponse>(`/game/${gameId}/batch-tests`, {
    method: 'POST',
    body: JSON.stringify({ freeText }),
  });
}

export async function performBatchExams(
  gameId: string,
  freeText: string
): Promise<BatchExamResponse> {
  return request<BatchExamResponse>(`/game/${gameId}/batch-exams`, {
    method: 'POST',
    body: JSON.stringify({ freeText }),
  });
}

// Test mode types
export interface TestCase {
  caseId: string;
  domain: string;
  diagnosis: string;
}

export interface TestCasesResponse {
  testCases: TestCase[];
  count: number;
}

export async function getTestModeCases(count: number = 3): Promise<TestCasesResponse> {
  return request<TestCasesResponse>(`/game/pool/test-cases?count=${count}`);
}

// Case history
export async function getCaseHistory(userId: string): Promise<CaseHistoryResponse> {
  return request<CaseHistoryResponse>(`/user/${userId}/history`);
}

// Blitz mode timeout
export interface TimeoutResponse {
  correct: boolean;
  correctDiagnosisId: string;
  correctDiagnosisName: string;
  submittedDiagnosisName: string;
  finalScore: number;
  scoreBreakdown: ScoreBreakdown;
  state: GameState;
  timedOut: boolean;
}

export async function timeoutGame(gameId: string, userId?: string): Promise<TimeoutResponse> {
  return request<TimeoutResponse>(`/game/${gameId}/timeout`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

// ============================================
// FEEDBACK API
// ============================================

export async function submitFeedback(
  feedbackText: string,
  context: FeedbackContext,
  caseSnapshot?: FeedbackCaseSnapshot,
  userId?: string,
  userEmail?: string,
  isTestUser?: boolean
): Promise<SubmitFeedbackResponse> {
  const body: SubmitFeedbackRequest = {
    feedbackText,
    context,
    caseSnapshot,
    userId,
    userEmail,
    isTestUser
  };

  return request<SubmitFeedbackResponse>('/feedback', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getAllFeedback(statusFilter?: FeedbackStatus): Promise<GetFeedbackResponse> {
  const query = statusFilter ? `?status=${statusFilter}` : '';
  return request<GetFeedbackResponse>(`/feedback${query}`);
}

export async function getFeedbackStats(): Promise<{
  stats: {
    total: number;
    unread: number;
    important: number;
    solved: number;
    irrelevant: number;
  };
}> {
  return request(`/feedback/stats`);
}

export async function updateFeedbackStatus(
  feedbackId: string,
  status: FeedbackStatus,
  adminNotes?: string
): Promise<{ success: boolean; feedback: FeedbackEntry }> {
  const body: UpdateFeedbackStatusRequest = { status, adminNotes };

  return request(`/feedback/${feedbackId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteFeedback(feedbackId: string): Promise<{ success: boolean }> {
  return request(`/feedback/${feedbackId}`, {
    method: 'DELETE',
  });
}
