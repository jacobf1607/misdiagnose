export type GameMode = 'standard' | 'blitz';
export declare const BLITZ_TIME_LIMIT_MS = 120000;
export declare const BLITZ_GRACE_PERIOD_MS = 3000;
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
export interface Diagnosis {
    id: string;
    name: string;
    description: string;
}
export interface PrecomputedDiagnosisExplanation {
    diagnosisId: string;
    diagnosisName: string;
    description: string;
    keySymptoms: string[];
    clinicalReasoning: string;
    whyIncorrectForCase?: string;
    keyDifferencesFromCorrect?: string[];
    missingFindings?: string[];
}
export interface Case {
    id: string;
    persona: Persona;
    diagnoses: Diagnosis[];
    correctDiagnosisId: string;
    initialComplaint: string;
    medicalHistory: string;
    symptoms: string;
    relevantFindings: string;
    redHerrings: string;
    domain?: string;
    idealPathway?: IdealPathway;
    precomputedExplanations?: PrecomputedDiagnosisExplanation[];
}
export interface ChatMessage {
    id: string;
    role: "player" | "patient";
    content: string;
    timestamp: number;
    questionQuality?: number;
}
export interface TestResult {
    id: string;
    testName: string;
    result: string;
    timestamp: number;
    isAbnormal: boolean;
}
export interface ExamResult {
    id: string;
    examName: string;
    finding: string;
    timestamp: number;
    isAbnormal: boolean;
}
export interface GameState {
    gameId: string;
    caseId: string;
    domain?: string;
    persona: Persona;
    initialComplaint: string;
    diagnoses: Diagnosis[];
    chatHistory: ChatMessage[];
    testResults: TestResult[];
    examResults: ExamResult[];
    status: "in_progress" | "won" | "lost" | "timeout";
    score: number;
    questionScores: number[];
    selectedDiagnosisId?: string;
    correctDiagnosisId?: string;
    startTime?: number;
    mode: GameMode;
    timeLimit?: number;
}
export interface NewGameRequest {
    caseId?: string;
    mode?: GameMode;
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
export interface TimeScore {
    raw: number;
    weighted: number;
    timeElapsedMinutes: number;
    bonusApplied: boolean;
    details: string;
}
export interface BudgetScore {
    raw: number;
    weighted: number;
    testsOrdered: number;
    optimalTests: number;
    penaltyPerTest: number;
    bonusApplied: boolean;
    details: string;
}
export interface EfficiencyScore {
    raw: number;
    weighted: number;
    unnecessaryTests: string[];
    redundantTests: string[];
    lowYieldTests: string[];
    totalPenalty: number;
    details: string;
}
export interface AccuracyScore {
    raw: number;
    weighted: number;
    correct: boolean;
    firstAttempt: boolean;
    details: string;
}
export interface ClinicalReasoningScore {
    raw: number;
    weighted: number;
    relevantActionsCount: number;
    totalActionsCount: number;
    systematicApproach: boolean;
    questionQualityAvg: number;
    details: string;
}
export interface ScoreBreakdown {
    time: TimeScore;
    budget: BudgetScore;
    efficiency: EfficiencyScore;
    accuracy: AccuracyScore;
    clinicalReasoning: ClinicalReasoningScore;
    totalScore: number;
    grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
    rank: string;
    summary: string;
    strengths: string[];
    areasForImprovement: string[];
    calculatedAt: number;
    questionQualityAvg?: number;
    questionCount?: number;
    correctDiagnosis?: boolean;
    efficiencyBonus?: number;
    total?: number;
}
export interface OrderTestRequest {
    testName: string;
}
export interface OrderTestResponse {
    result: TestResult;
    state: GameState;
    testsOrdered?: number;
}
export interface PerformExamRequest {
    examName: string;
}
export interface PerformExamResponse {
    result: ExamResult;
    state: GameState;
}
export interface PathwayStep {
    order: number;
    type: 'history' | 'examination' | 'investigation';
    action: string;
    reasoning: string;
    expectedFinding: string;
    importance: 'critical' | 'important' | 'helpful';
    textbookReference: string;
}
export interface IdealPathway {
    diseaseName: string;
    domain: string;
    keyHistoryQuestions: PathwayStep[];
    keyExaminations: PathwayStep[];
    keyInvestigations: PathwayStep[];
    differentialDiagnoses: {
        name: string;
        howToRuleOut: string;
        textbookReference: string;
    }[];
    diagnosticApproach: string;
    textbookSources: string[];
}
export interface PlayerAction {
    type: 'question' | 'examination' | 'investigation';
    action: string;
    timestamp: number;
    wasRelevant: boolean;
    matchedPathwayStep?: number;
}
export interface PathwayComparison {
    correctActions: {
        action: string;
        type: string;
        matchedStep: PathwayStep;
        feedback: string;
    }[];
    missedSteps: {
        step: PathwayStep;
        whyImportant: string;
    }[];
    unnecessaryActions: {
        action: string;
        type: string;
        feedback: string;
    }[];
    differentialEliminationActions: {
        action: string;
        ruledOut: string;
        how: string;
    }[];
    orderingIssues: {
        action: string;
        idealOrder: number;
        actualOrder: number;
        feedback: string;
    }[];
    pathwayScore: number;
}
export interface CoachingFeedback {
    idealPathway: IdealPathway;
    comparison: PathwayComparison;
    whatYouDidWell: string[];
    whatYouMissed: string[];
    whatWasUnnecessary: string[];
    keyLearningPoints: string[];
    recommendedReading: string[];
    coachingSummary: string;
}
export interface GetCoachingRequest {
    gameId: string;
}
export interface GetCoachingResponse {
    coaching: CoachingFeedback;
}
export interface DiagnosisExplanation {
    description: string;
    keySymptoms: string[];
    diagnosisSteps: string[];
    keyFindings: string[];
    clinicalReasoning: string;
    correctDiagnosisExplanation?: string;
}
export interface IncorrectDiagnosisExplanation {
    description: string;
    whyIncorrect: string;
    keyDifferences: string[];
    missingFindings: string[];
    contradictingFindings: string[];
    differentiatingFeatures: string;
}
export interface SubmitDiagnosisResponse {
    correct: boolean;
    correctDiagnosisId: string;
    correctDiagnosisName: string;
    submittedDiagnosisName: string;
    finalScore: number;
    scoreBreakdown: ScoreBreakdown;
    state: GameState;
    diagnosisExplanation: DiagnosisExplanation;
    incorrectExplanation?: IncorrectDiagnosisExplanation;
}
export interface ValidationError {
    input: string;
    message: string;
}
export interface BatchTestRequest {
    freeText: string;
}
export interface BatchTestResponse {
    results: TestResult[];
    errors: ValidationError[];
    state: GameState;
    testsOrdered?: number;
}
export interface BatchExamRequest {
    freeText: string;
}
export interface BatchExamResponse {
    results: ExamResult[];
    errors: ValidationError[];
    state: GameState;
}
export interface CaseHistoryEntry {
    caseId: string;
    gameId: string;
    completedAt: number;
    domain: string;
    correctDiagnosis: string;
    submittedDiagnosis: string;
    wasCorrect: boolean;
    finalScore: number;
    grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
    questionCount: number;
    testsOrdered: number;
    examsPerformed: number;
    timeElapsedMinutes: number;
    mode: GameMode;
    timedOut?: boolean;
    persona?: {
        name: string;
        age: number;
        gender: string;
        occupation?: string;
    };
    initialComplaint?: string;
    chatHistory?: Array<{
        role: string;
        content: string;
    }>;
    testResults?: Array<{
        name: string;
        result: string;
        isAbnormal: boolean;
    }>;
    examResults?: Array<{
        name: string;
        finding: string;
        isAbnormal: boolean;
    }>;
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
export interface CaseHistoryResponse {
    history: CaseHistoryEntry[];
    totalCases: number;
    correctCount: number;
    averageScore: number;
}
export type FeedbackStatus = 'unread' | 'important' | 'solved' | 'irrelevant';
export type FeedbackContext = 'dashboard' | 'during_case' | 'after_case';
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
    chatHistory?: Array<{
        role: string;
        content: string;
    }>;
    testResults?: Array<{
        name: string;
        result: string;
        isAbnormal: boolean;
    }>;
    examResults?: Array<{
        name: string;
        finding: string;
        isAbnormal: boolean;
    }>;
}
export interface FeedbackEntry {
    id: string;
    createdAt: number;
    updatedAt: number;
    userId?: string;
    userEmail?: string;
    isTestUser: boolean;
    feedbackText: string;
    context: FeedbackContext;
    caseSnapshot?: FeedbackCaseSnapshot;
    status: FeedbackStatus;
    adminNotes?: string;
}
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
export type ChallengeStatus = 'pending' | 'completed' | 'expired';
export interface Challenge {
    id: string;
    caseId: string;
    caseDomain: string;
    challengerId: string;
    challengerName: string;
    challengerGrade: string;
    challengerScore: number;
    challengedUserId?: string;
    challengedName?: string;
    challengedGrade?: string;
    challengedScore?: number;
    winnerId?: string;
    winnerName?: string;
    status: ChallengeStatus;
    createdAt: number;
    completedAt?: number;
    expiresAt: number;
}
export type NotificationType = 'challenge_completed' | 'challenge_received';
export interface Notification {
    id: string;
    userId: string;
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
export interface CreateChallengeRequest {
    caseId: string;
    caseDomain: string;
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
    challengedUserId?: string;
    challengedName: string;
    challengedGrade: string;
    challengedScore: number;
}
export interface CompleteChallengeResponse {
    challenge: Challenge;
    result: 'win' | 'lose' | 'tie';
    scoreDifference: number;
}
export interface GetNotificationsResponse {
    notifications: Notification[];
    unreadCount: number;
}
export type CaseStatus = 'available' | 'in_use';
export interface CaseMetadata {
    caseId: string;
    filename: string;
    domain: string;
    correctDiagnosis: string;
    status: CaseStatus;
    createdAt: number;
    usedBy: string[];
    usedCount: number;
    lastUsedAt?: number;
    hasIdealPathway: boolean;
}
export interface CasePoolIndex {
    version: string;
    lastUpdated: number;
    totalCases: number;
    availableCases: number;
    cases: CaseMetadata[];
    generationSettings: {
        minPoolSize: number;
        targetPoolSize: number;
        domainsEnabled: string[];
    };
}
export interface CaseAllocationRequest {
    userId?: string;
    domain?: string;
    excludeCaseIds?: string[];
}
export interface CaseAllocationResult {
    case: Case;
    metadata: CaseMetadata;
    fromPool: boolean;
}
export interface PoolStatus {
    totalCases: number;
    availableCases: number;
    inUseCases: number;
    byDomain: Record<string, {
        total: number;
        available: number;
    }>;
    belowThreshold: boolean;
    needsGeneration: number;
}
//# sourceMappingURL=types.d.ts.map