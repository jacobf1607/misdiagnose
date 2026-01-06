// ============================================
// DIAGNOSIS GRID - SHARED TYPES (Open World Version)
// ============================================

// Game mode types
export type GameMode = 'standard' | 'blitz';

// Blitz mode constants
export const BLITZ_TIME_LIMIT_MS = 120000; // 2 minutes
export const BLITZ_GRACE_PERIOD_MS = 3000; // 3 second grace for network latency

// Persona - the patient character
export interface Persona {
  name: string;
  age: number;
  gender: string;
  occupation: string;
  background: string;
  lifestyle: {
    activityLevel: "low" | "moderate" | "high";
    smoking: boolean | "unknown";
    alcohol: "none" | "social" | "heavy";
  };
  personalityTraits: string[];
}

// Diagnosis - a possible condition
export interface Diagnosis {
  id: string;
  name: string;
  description: string;
}

// Pre-computed diagnosis explanation (generated at case creation for speed)
export interface PrecomputedDiagnosisExplanation {
  diagnosisId: string;
  diagnosisName: string;
  description: string;
  keySymptoms: string[];
  clinicalReasoning: string;
  // For incorrect diagnoses: why it would be wrong for this case
  whyIncorrectForCase?: string;
  keyDifferencesFromCorrect?: string[];
  missingFindings?: string[];
}

// Case - complete case definition
export interface Case {
  id: string;
  persona: Persona;
  diagnoses: Diagnosis[]; // 10 possible diagnoses
  correctDiagnosisId: string;
  initialComplaint: string;
  medicalHistory: string; // Hidden from player, sent to ChatGPT
  symptoms: string; // Hidden from player, sent to ChatGPT
  relevantFindings: string; // Hidden from player, sent to ChatGPT
  redHerrings: string; // Misleading info that ChatGPT might hint at
  domain?: string; // Medical domain (cardiology, respiratory, etc.)
  idealPathway?: IdealPathway; // The ideal diagnostic approach from textbook
  precomputedExplanations?: PrecomputedDiagnosisExplanation[]; // Pre-generated for speed
}

// Chat message in conversation
export interface ChatMessage {
  id: string;
  role: "player" | "patient";
  content: string;
  timestamp: number;
  questionQuality?: number; // 1-10 score for player questions
}

// Test/Scan result
export interface TestResult {
  id: string;
  testName: string;
  result: string;
  timestamp: number;
  isAbnormal: boolean;
}

// Physical examination result
export interface ExamResult {
  id: string;
  examName: string;
  finding: string;
  timestamp: number;
  isAbnormal: boolean;
}

// Game state
export interface GameState {
  gameId: string;
  caseId: string;
  domain?: string; // Case domain (e.g., cardiology, respiratory)
  persona: Persona;
  initialComplaint: string;
  diagnoses: Diagnosis[];
  chatHistory: ChatMessage[];
  testResults: TestResult[]; // Ordered test results
  examResults: ExamResult[]; // Physical examination results
  status: "in_progress" | "won" | "lost" | "timeout";
  score: number;
  questionScores: number[]; // Quality score for each question
  selectedDiagnosisId?: string;
  correctDiagnosisId?: string; // Revealed at end
  startTime?: number; // Game start timestamp
  mode: GameMode; // standard or blitz
  timeLimit?: number; // Time limit in ms (only for blitz mode)
}

// API types
export interface NewGameRequest {
  caseId?: string;
  mode?: GameMode; // 'standard' (default) or 'blitz'
}

export interface NewGameResponse {
  gameId: string;
  state: GameState;
}

export interface AskQuestionRequest {
  question: string;
}

export interface AskQuestionResponse {
  answer: string;
  questionQuality: number;
  state: GameState;
}

export interface SubmitDiagnosisRequest {
  diagnosisId: string;
}

export interface SubmitDiagnosisResponse {
  correct: boolean;
  correctDiagnosisId: string;
  correctDiagnosisName: string;
  finalScore: number;
  scoreBreakdown: ScoreBreakdown;
  state: GameState;
}

// ============================================
// NEW COMPREHENSIVE SCORE BREAKDOWN
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

  // Legacy fields (for backwards compatibility)
  questionQualityAvg?: number;
  questionCount?: number;
  correctDiagnosis?: boolean;
  efficiencyBonus?: number;
  total?: number;
}

// Test/Scan API types
export interface OrderTestRequest {
  testName: string;
}

export interface OrderTestResponse {
  result: TestResult;
  state: GameState;
  testsOrdered?: number; // Total tests ordered so far
}

// Examination API types
export interface PerformExamRequest {
  examName: string;
}

export interface PerformExamResponse {
  result: ExamResult;
  state: GameState;
}

// ============================================
// IDEAL PATHWAY & COACHING SYSTEM
// ============================================

// A single step in the ideal diagnostic pathway
export interface PathwayStep {
  order: number;           // Sequence in ideal approach
  type: 'history' | 'examination' | 'investigation';
  action: string;          // What to ask/do
  reasoning: string;       // Why this is important (from textbook)
  expectedFinding: string; // What you'd find in this case
  importance: 'critical' | 'important' | 'helpful';
  textbookReference: string; // Excerpt from textbook
}

// The complete ideal pathway for a case
export interface IdealPathway {
  diseaseName: string;
  domain: string;

  // Key history questions to ask
  keyHistoryQuestions: PathwayStep[];

  // Key physical examinations
  keyExaminations: PathwayStep[];

  // Key investigations (in order of cost-effectiveness)
  keyInvestigations: PathwayStep[];

  // Differential diagnoses to consider
  differentialDiagnoses: {
    name: string;
    howToRuleOut: string;
    textbookReference: string;
  }[];

  // Overall diagnostic approach summary
  diagnosticApproach: string;

  // Textbook sources used
  textbookSources: string[];
}

// Player action for comparison
export interface PlayerAction {
  type: 'question' | 'examination' | 'investigation';
  action: string;
  timestamp: number;
  wasRelevant: boolean;
  matchedPathwayStep?: number; // Which ideal step this matched
}

// Comparison result between player and ideal
export interface PathwayComparison {
  // What the player did right
  correctActions: {
    action: string;
    type: string;
    matchedStep: PathwayStep;
    feedback: string;
  }[];

  // What the player missed
  missedSteps: {
    step: PathwayStep;
    whyImportant: string;
  }[];

  // What the player did that was unnecessary
  unnecessaryActions: {
    action: string;
    type: string;
    feedback: string;
  }[];

  // Actions that helped rule out differential diagnoses
  differentialEliminationActions: {
    action: string;
    ruledOut: string;
    how: string;
  }[];

  // Wrong order issues
  orderingIssues: {
    action: string;
    idealOrder: number;
    actualOrder: number;
    feedback: string;
  }[];

  // Overall pathway adherence score (0-100)
  pathwayScore: number;
}

// Complete coaching feedback
export interface CoachingFeedback {
  // The ideal pathway
  idealPathway: IdealPathway;

  // Comparison with player's approach
  comparison: PathwayComparison;

  // Detailed feedback sections
  whatYouDidWell: string[];
  whatYouMissed: string[];
  whatWasUnnecessary: string[];
  keyLearningPoints: string[];

  // Recommended next steps for learning
  recommendedReading: string[];

  // Overall coaching summary
  coachingSummary: string;
}

// API types for coaching
export interface GetCoachingRequest {
  gameId: string;
}

export interface GetCoachingResponse {
  coaching: CoachingFeedback;
}

// ============================================
// DIAGNOSIS EXPLANATION TYPES
// ============================================

// Explanation of why the correct diagnosis is right
export interface DiagnosisExplanation {
  description: string;                   // 2 sentence description of the disease
  keySymptoms: string[];                 // Key symptoms (with **bold** for important terms)
  diagnosisSteps: string[];              // 2-3 key diagnosis steps
  keyFindings: string[];                 // Key findings that confirm the diagnosis
  clinicalReasoning: string;             // Clinical reasoning process explanation
  correctDiagnosisExplanation?: string;  // Legacy field
}

// Explanation of why an incorrect diagnosis was wrong
export interface IncorrectDiagnosisExplanation {
  description: string;                   // 2 sentence description of what the player chose
  whyIncorrect: string;                  // Brief explanation of why wrong
  keyDifferences: string[];              // Key differences (with **bold**)
  missingFindings: string[];             // Findings expected but not present
  contradictingFindings: string[];       // Findings that contradict the wrong diagnosis
  differentiatingFeatures: string;       // Summary of differences
}

// Enhanced submit diagnosis response with explanations
export interface SubmitDiagnosisResponse {
  correct: boolean;
  correctDiagnosisId: string;
  correctDiagnosisName: string;
  submittedDiagnosisName: string;
  finalScore: number;
  scoreBreakdown: ScoreBreakdown;
  state: GameState;
  // New explanation fields
  diagnosisExplanation: DiagnosisExplanation;
  incorrectExplanation?: IncorrectDiagnosisExplanation;  // Only if answer was wrong
}

// ============================================
// BATCH TEST/EXAM ORDERING (FREE TEXT)
// ============================================

// Validation error for invalid/unclear test/exam requests
export interface ValidationError {
  input: string;      // What the user typed
  message: string;    // Why it's invalid or unclear
}

// Batch test ordering (free text input)
export interface BatchTestRequest {
  freeText: string;   // User's free-text input with test requests
}

export interface BatchTestResponse {
  results: TestResult[];        // Valid tests with generated results
  errors: ValidationError[];    // Invalid/unclear items with feedback
  state: GameState;
  testsOrdered?: number;        // Total tests ordered so far
}

// Batch exam ordering (free text input)
export interface BatchExamRequest {
  freeText: string;   // User's free-text input with exam requests
}

export interface BatchExamResponse {
  results: ExamResult[];        // Valid exams with generated findings
  errors: ValidationError[];    // Invalid/unclear items with feedback
  state: GameState;
}

// ============================================
// CASE HISTORY TYPES
// ============================================

// A single completed case in user's history
export interface CaseHistoryEntry {
  caseId: string;                    // The case ID
  gameId: string;                    // The game session ID
  completedAt: number;               // When the diagnosis was submitted
  domain: string;                    // Medical domain (cardiology, etc.)
  correctDiagnosis: string;          // Name of the correct diagnosis
  submittedDiagnosis: string;        // What the user submitted
  wasCorrect: boolean;               // Did they get it right?
  finalScore: number;                // Final score (0-100)
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';  // Grade achieved
  questionCount: number;             // How many questions asked
  testsOrdered: number;              // How many tests ordered
  examsPerformed: number;            // How many exams performed
  timeElapsedMinutes: number;        // How long the case took
  mode: GameMode;                    // 'standard' or 'blitz'
  timedOut?: boolean;                // True if blitz game ended by timeout

  // Detailed data for case review (optional for backwards compatibility)
  persona?: {
    name: string;
    age: number;
    gender: string;
    occupation?: string;
  };
  initialComplaint?: string;
  chatHistory?: Array<{ role: string; content: string }>;
  testResults?: Array<{ name: string; result: string; isAbnormal: boolean }>;
  examResults?: Array<{ name: string; finding: string; isAbnormal: boolean }>;

  // Score breakdown & coaching data
  scoreBreakdown?: {
    accuracy: number;
    efficiency: number;
    clinicalReasoning: number;
    testEconomy: number;
    time: number;
    summary: string;
    strengths: string[];
    areasForImprovement: string[];
  };
  diagnosisExplanation?: {
    description: string;
    keySymptoms: string[];
    clinicalReasoning: string;
  };
  incorrectExplanation?: {
    whyIncorrect: string;
    keyDifferences: string[];
    missingFindings: string[];
  };
}

// User's case history response
export interface CaseHistoryResponse {
  history: CaseHistoryEntry[];
  totalCases: number;
  correctCount: number;
  averageScore: number;
}

// ============================================
// CASE POOL MANAGEMENT TYPES
// ============================================

// ============================================
// FEEDBACK SYSTEM TYPES
// ============================================

// Feedback status for tracking/triage
export type FeedbackStatus = 'unread' | 'important' | 'solved' | 'irrelevant';

// Context where feedback was submitted
export type FeedbackContext = 'dashboard' | 'during_case' | 'after_case';

// Case snapshot for feedback context
export interface FeedbackCaseSnapshot {
  caseId: string;
  gameId: string;
  domain: string;
  correctDiagnosis: string;
  submittedDiagnosis?: string;
  wasCorrect?: boolean;
  score?: number;
  questionsAsked: number;
  testsOrdered: number;
  examsPerformed: number;
  timeElapsedMinutes: number;
  chatHistory?: Array<{ role: string; content: string }>;
  testResults?: Array<{ name: string; result: string; isAbnormal: boolean }>;
  examResults?: Array<{ name: string; finding: string; isAbnormal: boolean }>;
}

// A single feedback entry
export interface FeedbackEntry {
  id: string;
  createdAt: number;
  updatedAt: number;

  // Who submitted
  userId?: string;
  userEmail?: string;
  isTestUser: boolean;

  // Content
  feedbackText: string;
  context: FeedbackContext;

  // Case context (if during/after case)
  caseSnapshot?: FeedbackCaseSnapshot;

  // Status for triage
  status: FeedbackStatus;

  // Admin notes
  adminNotes?: string;
}

// API types
export interface SubmitFeedbackRequest {
  feedbackText: string;
  context: FeedbackContext;
  caseSnapshot?: FeedbackCaseSnapshot;
  userId?: string;
  userEmail?: string;
  isTestUser?: boolean;
}

export interface SubmitFeedbackResponse {
  success: boolean;
  feedbackId: string;
}

export interface GetFeedbackResponse {
  feedback: FeedbackEntry[];
  totalCount: number;
  unreadCount: number;
}

export interface UpdateFeedbackStatusRequest {
  status: FeedbackStatus;
  adminNotes?: string;
}

// ============================================
// CHALLENGE SYSTEM TYPES
// ============================================

// Challenge status - 'active' until expired (no 'completed' since multiple people can respond)
export type ChallengeStatus = 'active' | 'expired';

// A single response to a challenge (one per person who plays)
export interface ChallengeResponse {
  responseId: string;                  // Unique response ID
  respondentUserId?: string;           // User ID (undefined for guests)
  respondentName: string;              // Display name
  respondentGrade: string;             // Their grade
  respondentScore: number;             // Their score
  result: 'win' | 'lose' | 'tie';      // Result vs challenger
  completedAt: number;                 // When they finished
}

// A challenge that can be shared with multiple people
export interface Challenge {
  id: string;                          // Short unique ID (URL-safe)
  caseId: string;                      // Which case to play (poolCaseId)
  caseDomain: string;                  // For display (e.g., "cardiology")
  gameMode: GameMode;                  // standard or blitz - challenged must play same mode

  // Challenger info
  challengerId: string;                // User ID who created the challenge
  challengerName: string;              // Display name
  challengerGrade: string;             // Their grade (A/B/C/D/F) - shown before playing
  challengerScore: number;             // Their score (hidden until completion)

  // All responses (multiple people can respond)
  responses: ChallengeResponse[];

  // Status
  status: ChallengeStatus;             // 'active' or 'expired'

  // Timestamps
  createdAt: number;                   // When challenge was created
  expiresAt: number;                   // 7 days from creation
}

// Notification types
export type NotificationType = 'challenge_completed' | 'challenge_received';

// A notification for a user
export interface Notification {
  id: string;
  userId: string;                      // Who receives this notification
  type: NotificationType;
  title: string;
  message: string;
  data: {
    challengeId: string;
    challengerName?: string;
    challengedName?: string;
    winnerId?: string;
    winnerName?: string;
  };
  read: boolean;
  createdAt: number;
}

// API types for challenges
export interface CreateChallengeRequest {
  caseId: string;
  caseDomain: string;
  gameMode: GameMode;
  challengerId: string;
  challengerName: string;
  challengerGrade: string;
  challengerScore: number;
}

export interface CreateChallengeResponse {
  challengeId: string;
  shareUrl: string;
}

export interface GetChallengeResponse {
  challenge: Challenge;
  alreadyPlayed?: {
    grade: string;
    score: number;
    beatChallenger: boolean;
  };
}

export interface CompleteChallengeRequest {
  respondentUserId?: string;           // Optional - guest can complete
  respondentName: string;
  respondentGrade: string;
  respondentScore: number;
}

export interface CompleteChallengeResponse {
  challenge: Challenge;
  response: ChallengeResponse;         // The new response that was added
  result: 'win' | 'lose' | 'tie';
  scoreDifference: number;
}

// API types for notifications
export interface GetNotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

// ============================================
// CASE POOL MANAGEMENT TYPES
// ============================================

// Status of a pre-generated case in the pool
export type CaseStatus = 'available' | 'in_use';

// Metadata for a pre-generated case (stored in pool index)
export interface CaseMetadata {
  caseId: string;                    // Unique case identifier (e.g., "case_1704312345678")
  filename: string;                  // JSON filename (e.g., "case_1704312345678.json")
  domain: string;                    // Medical domain (cardiology, respiratory, etc.)
  correctDiagnosis: string;          // Name of correct diagnosis (for filtering/display)
  status: CaseStatus;                // Current availability status
  createdAt: number;                 // Unix timestamp of generation
  usedBy: string[];                  // User IDs who have seen this case
  usedCount: number;                 // Total times this case was used
  lastUsedAt?: number;               // Last time case was assigned
  hasIdealPathway: boolean;          // Whether ideal pathway was generated
}

// The case pool index (stored as pool-index.json)
export interface CasePoolIndex {
  version: string;                   // Schema version for migrations
  lastUpdated: number;               // Last index update timestamp
  totalCases: number;                // Total cases in pool
  availableCases: number;            // Currently available cases
  cases: CaseMetadata[];             // All case metadata
  generationSettings: {
    minPoolSize: number;             // Minimum cases to maintain (trigger auto-gen)
    targetPoolSize: number;          // Target when auto-generating
    domainsEnabled: string[];        // Domains to generate for
  };
}

// Request to allocate a case from the pool
export interface CaseAllocationRequest {
  userId?: string;                   // If provided, exclude cases user has seen
  domain?: string;                   // Filter by medical domain
  excludeCaseIds?: string[];         // Explicit exclusions
}

// Result of case allocation
export interface CaseAllocationResult {
  case: Case;
  metadata: CaseMetadata;
  fromPool: boolean;                 // true if from pool, false if freshly generated
}

// Pool status for monitoring
export interface PoolStatus {
  totalCases: number;
  availableCases: number;
  inUseCases: number;
  byDomain: Record<string, { total: number; available: number }>;
  belowThreshold: boolean;
  needsGeneration: number;           // How many cases should be generated
}
