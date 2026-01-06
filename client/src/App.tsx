import { useState, useCallback, useEffect } from 'react';
import type { GameState, ScoreBreakdown, DiagnosisExplanation, IncorrectDiagnosisExplanation, ValidationError, GameMode, Challenge, Case } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { FeedbackDashboard } from './pages/FeedbackDashboard';
import { PastCasesPage } from './pages/PastCasesPage';
import { ChallengePage } from './pages/ChallengePage';
import { PersonaCard } from './components/PersonaCard';
import { DiagnosisList } from './components/DiagnosisList';
import { ChatInterface } from './components/ChatInterface';
import { TestPanel } from './components/TestPanel';
import { ExaminationPanel } from './components/ExaminationPanel';
import { GameOverModal } from './components/GameOverModal';
import { LoadingOverlay } from './components/LoadingOverlay';
import { GameModeSelector } from './components/GameModeSelector';
import { BlitzTimer } from './components/BlitzTimer';
import { FeedbackButton } from './components/FeedbackButton';
import * as api from './services/api';
import type { TestCase } from './services/api';
import { analytics } from './utils/analytics';
import './App.css';

type Tab = 'chat' | 'exam' | 'tests';
type MobileTab = 'chat' | 'tests' | 'exam' | 'diagnose';

function GameContent() {
  const { isTestUser, userProfile } = useAuth();

  const [gameState, setGameState] = useState<GameState | null>(null);

  // Mobile responsiveness - use function to avoid SSR issues
  const checkIsMobile = () => {
    if (typeof window === 'undefined') return false;
    // Use screen width for device detection (not affected by DevTools)
    // Fall back to innerWidth for browsers that don't support screen
    const width = window.screen?.width || window.innerWidth;
    return width <= 768;
  };

  const [isMobile, setIsMobile] = useState(false); // Start false, detect on mount
  const [mobileTab, setMobileTab] = useState<MobileTab>('chat');
  const [patientInfoExpanded, setPatientInfoExpanded] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Detect screen size changes - also run on mount to set initial value correctly
  useEffect(() => {
    setIsMobile(checkIsMobile());

    const handleResize = () => setIsMobile(checkIsMobile());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-collapse patient info after first interaction on mobile
  useEffect(() => {
    if (!isMobile || !gameState || hasInteracted) return;

    // Check if any interaction has happened (chat message beyond initial, or any test/exam)
    const hasChatMessage = gameState.chatHistory && gameState.chatHistory.length > 0;
    const hasTests = gameState.testResults && gameState.testResults.length > 0;
    const hasExams = gameState.examResults && gameState.examResults.length > 0;

    if (hasChatMessage || hasTests || hasExams) {
      setPatientInfoExpanded(false);
      setHasInteracted(true);
    }
  }, [gameState?.chatHistory?.length, gameState?.testResults?.length, gameState?.examResults?.length, isMobile, hasInteracted]);

  // Set analytics user ID when profile changes
  useEffect(() => {
    analytics.setUserId(userProfile?.uid || null);
  }, [userProfile?.uid]);

  const [loading, setLoading] = useState(false);
  const [submittingDiagnosis, setSubmittingDiagnosis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown | null>(null);
  const [correctDiagnosisName, setCorrectDiagnosisName] = useState<string>('');
  const [submittedDiagnosisName, setSubmittedDiagnosisName] = useState<string>('');
  const [diagnosisExplanation, setDiagnosisExplanation] = useState<DiagnosisExplanation | null>(null);
  const [incorrectExplanation, setIncorrectExplanation] = useState<IncorrectDiagnosisExplanation | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  // Test mode state (only available for test users)
  const [testMode, setTestMode] = useState(false);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [testCaseIndex, setTestCaseIndex] = useState(0);
  const [currentTestCase, setCurrentTestCase] = useState<number | null>(null);

  // Game mode selector state
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [pendingCaseId, setPendingCaseId] = useState<string | undefined>(undefined);

  // Feedback dashboard state (for test users)
  const [showFeedbackDashboard, setShowFeedbackDashboard] = useState(false);

  // Past cases page state
  const [showPastCases, setShowPastCases] = useState(false);

  // Challenge mode state
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [challengeResult, setChallengeResult] = useState<{
    challenge: Challenge;
    result: 'win' | 'lose' | 'tie';
    scoreDifference: number;
  } | null>(null);
  const [showChallengePage, setShowChallengePage] = useState(false);
  const [currentCaseId, setCurrentCaseId] = useState<string | null>(null);
  const [currentCaseDomain, setCurrentCaseDomain] = useState<string | null>(null);

  // Check URL for challenge ID on mount
  useEffect(() => {
    const path = window.location.pathname;
    const challengeMatch = path.match(/^\/challenge\/([a-zA-Z0-9]+)$/);
    if (challengeMatch) {
      setChallengeId(challengeMatch[1]);
      setShowChallengePage(true);
      // Update URL to clean path (optional - keeps challenge in URL until accepted)
    }
  }, []);

  // Show mode selector before starting game
  const requestNewGame = useCallback((caseIdOverride?: string) => {
    setPendingCaseId(caseIdOverride);
    setShowModeSelector(true);
  }, []);

  // Actually start the game with selected mode
  const startNewGame = useCallback(async (mode: GameMode, caseIdOverride?: string) => {
    setShowModeSelector(false);
    setLoading(true);
    setError(null);
    setScoreBreakdown(null);
    setCorrectDiagnosisName('');
    setSubmittedDiagnosisName('');
    setDiagnosisExplanation(null);
    setIncorrectExplanation(null);
    setActiveTab('chat');
    // Reset patient info state for new game
    setPatientInfoExpanded(true);
    setHasInteracted(false);
    // Clear challenge result for new game (but keep activeChallenge if this is a challenge game)
    setChallengeResult(null);

    const startTime = Date.now();
    const MIN_LOADING_TIME = 1500;

    try {
      let caseId = caseIdOverride;
      if (testMode && testCases.length > 0 && !caseIdOverride) {
        caseId = testCases[testCaseIndex].caseId;
        setCurrentTestCase(testCaseIndex);
        setTestCaseIndex((prev) => (prev + 1) % testCases.length);
      }

      const response = await api.startNewGame(caseId, mode, userProfile?.uid);

      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_LOADING_TIME) {
        await new Promise(resolve => setTimeout(resolve, MIN_LOADING_TIME - elapsed));
      }

      setGameState(response.state);
      // Track case info for challenge creation (if not already set from challenge accept)
      if (!currentCaseId) {
        setCurrentCaseId(response.state.caseId);
      }

      // Track case start for analytics
      analytics.trackCaseStart(
        response.state.caseId,
        response.state.gameId,
        mode,
        !!activeChallenge
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start game');
    } finally {
      setLoading(false);
    }
  }, [testMode, testCases, testCaseIndex, activeChallenge, userProfile?.uid]);

  // Handle mode selection
  const handleModeSelect = useCallback((mode: GameMode) => {
    startNewGame(mode, pendingCaseId);
    setPendingCaseId(undefined);
  }, [startNewGame, pendingCaseId]);

  // Handle blitz timeout
  const handleBlitzTimeout = useCallback(async () => {
    if (!gameState || gameState.status !== 'in_progress') return;

    setSubmittingDiagnosis(true);
    setError(null);

    try {
      const userId = userProfile?.uid;
      const response = await api.timeoutGame(gameState.gameId, userId);
      setGameState(response.state);
      setScoreBreakdown(response.scoreBreakdown);
      setCorrectDiagnosisName(response.correctDiagnosisName);
      setSubmittedDiagnosisName(response.submittedDiagnosisName || 'No diagnosis (timeout)');
      // No diagnosis explanations for timeout
      setDiagnosisExplanation(null);
      setIncorrectExplanation(null);

      // Track timeout for analytics
      analytics.track('case_timeout', {
        caseId: gameState.caseId,
        gameId: gameState.gameId,
        duration: gameState.startTime ? Date.now() - gameState.startTime : 0,
        mode: gameState.mode,
        testsOrdered: gameState.testResults?.length || 0,
        examsPerformed: gameState.examResults?.length || 0,
        messagesSent: gameState.chatHistory?.length || 0
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process timeout');
    } finally {
      setSubmittingDiagnosis(false);
    }
  }, [gameState, userProfile]);

  const handleAskQuestion = useCallback(async (question: string) => {
    if (!gameState) return;

    setError(null);
    try {
      const response = await api.askQuestion(gameState.gameId, question);
      setGameState(response.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ask question');
    }
  }, [gameState]);

  const handleOrderTest = useCallback(async (testName: string) => {
    if (!gameState) return;

    setError(null);
    try {
      const response = await api.orderTest(gameState.gameId, testName);
      setGameState(response.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to order test');
    }
  }, [gameState]);

  const handlePerformExam = useCallback(async (examName: string) => {
    if (!gameState) return;

    setError(null);
    try {
      const response = await api.performExam(gameState.gameId, examName);
      setGameState(response.state);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to perform examination');
    }
  }, [gameState]);

  const handleOrderBatchTests = useCallback(async (freeText: string): Promise<ValidationError[]> => {
    if (!gameState) return [];

    setError(null);
    try {
      const response = await api.orderBatchTests(gameState.gameId, freeText);
      setGameState(response.state);
      return response.errors;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to order tests');
      return [];
    }
  }, [gameState]);

  const handlePerformBatchExams = useCallback(async (freeText: string): Promise<ValidationError[]> => {
    if (!gameState) return [];

    setError(null);
    try {
      const response = await api.performBatchExams(gameState.gameId, freeText);
      setGameState(response.state);
      return response.errors;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to perform examinations');
      return [];
    }
  }, [gameState]);

  const handleSubmitDiagnosis = useCallback(async (diagnosisId: string) => {
    if (!gameState) return;

    setSubmittingDiagnosis(true);
    setError(null);
    try {
      // Pass userId to save case history
      const userId = userProfile?.uid;
      const response = await api.submitDiagnosis(gameState.gameId, diagnosisId, userId);
      setGameState(response.state);
      setScoreBreakdown(response.scoreBreakdown);
      setCorrectDiagnosisName(response.correctDiagnosisName);
      setSubmittedDiagnosisName(response.submittedDiagnosisName || '');
      setDiagnosisExplanation(response.diagnosisExplanation || null);
      setIncorrectExplanation(response.incorrectExplanation || null);

      // If this was a challenge game, complete the challenge
      if (activeChallenge && response.scoreBreakdown) {
        try {
          const challengeResponse = await fetch(`${api.API_BASE}/challenge/${activeChallenge.id}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              respondentUserId: userId,
              respondentName: userProfile?.username || 'Guest',
              respondentGrade: response.scoreBreakdown.grade,
              respondentScore: response.scoreBreakdown.totalScore
            })
          });
          const challengeData = await challengeResponse.json();
          if (challengeResponse.ok) {
            setChallengeResult({
              challenge: challengeData.challenge,
              result: challengeData.result,
              scoreDifference: challengeData.scoreDifference
            });
          }
        } catch (challengeErr) {
          console.error('Failed to complete challenge:', challengeErr);
        }
      }

      // Track case completion for analytics
      analytics.trackCaseComplete({
        caseId: gameState.caseId,
        gameId: gameState.gameId,
        score: response.scoreBreakdown.totalScore,
        grade: response.scoreBreakdown.grade,
        duration: gameState.startTime ? Date.now() - gameState.startTime : 0,
        wasCorrect: response.state.status === 'won',
        mode: gameState.mode,
        testsOrdered: gameState.testResults?.length || 0,
        examsPerformed: gameState.examResults?.length || 0,
        messagesSent: gameState.chatHistory?.length || 0,
        correctDiagnosis: response.correctDiagnosisName,
        submittedDiagnosis: response.submittedDiagnosisName || ''
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit diagnosis');
    } finally {
      setSubmittingDiagnosis(false);
    }
  }, [gameState, userProfile, activeChallenge]);

  const toggleTestMode = useCallback(async () => {
    // Only allow test users to toggle test mode
    if (!isTestUser) return;

    if (testMode) {
      setTestMode(false);
      setTestCases([]);
      setTestCaseIndex(0);
      setCurrentTestCase(null);
    } else {
      try {
        const response = await api.getTestModeCases(3);
        if (response.testCases.length > 0) {
          setTestCases(response.testCases);
          setTestCaseIndex(0);
          setTestMode(true);
        } else {
          setError('No cases available in pool for test mode');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to enter test mode');
      }
    }
  }, [testMode, isTestUser]);

  // Close mode selector
  const closeModeSelector = useCallback(() => {
    setShowModeSelector(false);
    setPendingCaseId(undefined);
  }, []);

  // Accept a challenge and start the game
  const handleAcceptChallenge = useCallback((caseData: Case, challenge: Challenge) => {
    setShowChallengePage(false);
    setActiveChallenge(challenge);
    setChallengeResult(null);
    setCurrentCaseId(caseData.id);
    setCurrentCaseDomain(caseData.domain || 'general');
    // Clear URL
    window.history.replaceState({}, '', '/');

    // Start game directly with the challenger's mode (no mode selection)
    // Challenged player must play the same mode as the challenger
    startNewGame(challenge.gameMode || 'standard', caseData.id);
  }, [startNewGame]);

  // Handle returning from challenge page to dashboard
  const handleChallengeBackToDashboard = useCallback(() => {
    setShowChallengePage(false);
    setChallengeId(null);
    setActiveChallenge(null);
    window.history.replaceState({}, '', '/');
  }, []);

  // Return to dashboard
  const handleBackToDashboard = useCallback(() => {
    setGameState(null);
    setTestMode(false);
    setTestCases([]);
    setTestCaseIndex(0);
    setCurrentTestCase(null);
    setError(null);
    // Clear challenge state
    setActiveChallenge(null);
    setChallengeResult(null);
    setCurrentCaseId(null);
    setCurrentCaseDomain(null);
  }, []);

  // Handler for entering test mode and starting a game
  const handleEnterTestMode = useCallback(async () => {
    if (!isTestUser) return;
    try {
      const response = await api.getTestModeCases(3);
      if (response.testCases.length > 0) {
        setTestCases(response.testCases);
        setTestCaseIndex(1); // Will use index 0 for first game
        setTestMode(true);
        setCurrentTestCase(0);
        // Show mode selector for test mode too
        setPendingCaseId(response.testCases[0].caseId);
        setShowModeSelector(true);
      } else {
        setError('No cases available in pool for test mode');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enter test mode');
    }
  }, [isTestUser]);

  // Loading screen for new case generation
  if (loading && !gameState) {
    return (
      <>
        <Header />
        <LoadingOverlay message="Generating new case..." />
      </>
    );
  }

  // Dashboard (no active game)
  if (!gameState) {
    // Show challenge landing page when accessed via challenge URL
    if (showChallengePage && challengeId) {
      return (
        <>
          <Header />
          <ChallengePage
            challengeId={challengeId}
            onAcceptChallenge={handleAcceptChallenge}
            onBackToDashboard={handleChallengeBackToDashboard}
          />
        </>
      );
    }

    // Show feedback dashboard for test users when toggled
    if (showFeedbackDashboard && isTestUser) {
      return (
        <>
          <Header />
          <FeedbackDashboard onBack={() => setShowFeedbackDashboard(false)} />
        </>
      );
    }

    // Show past cases page when toggled
    if (showPastCases) {
      return (
        <>
          <Header />
          <PastCasesPage onBack={() => setShowPastCases(false)} />
        </>
      );
    }

    return (
      <>
        <Header />
        <Dashboard
          onStartGame={() => requestNewGame()}
          onEnterTestMode={isTestUser ? handleEnterTestMode : undefined}
          onViewFeedback={isTestUser ? () => setShowFeedbackDashboard(true) : undefined}
          onViewPastCases={() => setShowPastCases(true)}
        />
        <FeedbackButton
          context="dashboard"
          userId={userProfile?.uid}
          userEmail={userProfile?.username}
          isTestUser={isTestUser}
          showTooltip={true}
        />
        <GameModeSelector
          isOpen={showModeSelector}
          onSelectMode={handleModeSelect}
          onClose={closeModeSelector}
        />
      </>
    );
  }

  // Show loading overlay when generating new case while in-game
  if (loading && gameState) {
    return (
      <>
        <Header />
        <LoadingOverlay message="Generating new case..." />
      </>
    );
  }

  const isDisabled = loading || submittingDiagnosis || gameState.status !== 'in_progress';

  return (
    <div className={`app ${isMobile ? 'mobile' : ''}`}>
      <header className="game-header">
        <div className="game-header-left">
          <button
            className="btn btn-outline btn-back"
            onClick={handleBackToDashboard}
          >
            ←{!isMobile && ' Dashboard'}
          </button>
          {!isMobile && <h1>Case in Progress</h1>}
        </div>
        <div className="header-controls">
          {isTestUser && testMode && (
            <span className="test-mode-indicator">
              TEST{!isMobile && ' MODE'} {currentTestCase !== null ? `(${currentTestCase + 1}/${testCases.length})` : ''}
            </span>
          )}
          {!isMobile && (
            <button
              className="btn btn-outline"
              onClick={() => requestNewGame()}
              disabled={loading}
            >
              New Case
            </button>
          )}
          {isTestUser && testMode && !isMobile && (
            <button
              className="btn btn-outline btn-exit-test"
              onClick={toggleTestMode}
            >
              Exit Test
            </button>
          )}
          {isMobile && (
            <button
              className="btn btn-primary btn-new-case"
              onClick={() => requestNewGame()}
            >
              New Case
            </button>
          )}
        </div>
      </header>

      {/* Blitz Mode Timer Bar */}
      {gameState.mode === 'blitz' && gameState.status === 'in_progress' && gameState.startTime && (
        <div className="blitz-bar">
          <div className="blitz-bar-content">
            <span className="blitz-bar-label">BLITZ MODE</span>
            <BlitzTimer
              startTime={gameState.startTime}
              onTimeout={handleBlitzTimeout}
              isPaused={submittingDiagnosis}
            />
          </div>
        </div>
      )}

      <main className="game-board">
        {/* Desktop: Two-column layout */}
        {!isMobile && (
          <>
            <div className="left-column">
              <PersonaCard
                persona={gameState.persona}
                initialComplaint={gameState.initialComplaint}
              />
              <DiagnosisList
                diagnoses={gameState.diagnoses}
                onSubmitDiagnosis={handleSubmitDiagnosis}
                disabled={isDisabled}
                questionCount={gameState.questionScores.length}
              />
            </div>

            <div className="right-column">
              <div className="tab-bar">
                <button
                  className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
                  onClick={() => setActiveTab('chat')}
                >
                  Interview
                </button>
                <button
                  className={`tab-btn ${activeTab === 'exam' ? 'active' : ''}`}
                  onClick={() => setActiveTab('exam')}
                >
                  Examine ({gameState.examResults?.length || 0})
                </button>
                <button
                  className={`tab-btn ${activeTab === 'tests' ? 'active' : ''}`}
                  onClick={() => setActiveTab('tests')}
                >
                  Tests ({gameState.testResults?.length || 0})
                </button>
              </div>

              <div className="tab-content">
                {activeTab === 'chat' && (
                  <ChatInterface
                    chatHistory={gameState.chatHistory}
                    onAskQuestion={handleAskQuestion}
                    disabled={gameState.status !== 'in_progress'}
                    patientName={gameState.persona.name}
                  />
                )}
                {activeTab === 'exam' && (
                  <ExaminationPanel
                    examResults={gameState.examResults || []}
                    onPerformExam={handlePerformExam}
                    onPerformBatchExams={handlePerformBatchExams}
                    disabled={gameState.status !== 'in_progress'}
                  />
                )}
                {activeTab === 'tests' && (
                  <TestPanel
                    testResults={gameState.testResults || []}
                    onOrderTest={handleOrderTest}
                    onOrderBatchTests={handleOrderBatchTests}
                    disabled={gameState.status !== 'in_progress'}
                  />
                )}
              </div>
            </div>
          </>
        )}

        {/* Mobile: Patient info at top + single panel below */}
        {isMobile && (
          <>
            {/* Patient info always visible at top */}
            <div className="mobile-patient-header">
              <PersonaCard
                persona={gameState.persona}
                initialComplaint={gameState.initialComplaint}
                collapsible
                defaultExpanded
                isExpanded={patientInfoExpanded}
                onToggle={() => setPatientInfoExpanded(!patientInfoExpanded)}
              />
            </div>

            {/* Active panel based on selected tab */}
            <div className="mobile-panel">
              {mobileTab === 'chat' && (
                <ChatInterface
                  chatHistory={gameState.chatHistory}
                  onAskQuestion={handleAskQuestion}
                  disabled={gameState.status !== 'in_progress'}
                  patientName={gameState.persona.name}
                />
              )}
              {mobileTab === 'tests' && (
                <TestPanel
                  testResults={gameState.testResults || []}
                  onOrderTest={handleOrderTest}
                  onOrderBatchTests={handleOrderBatchTests}
                  disabled={gameState.status !== 'in_progress'}
                />
              )}
              {mobileTab === 'exam' && (
                <ExaminationPanel
                  examResults={gameState.examResults || []}
                  onPerformExam={handlePerformExam}
                  onPerformBatchExams={handlePerformBatchExams}
                  disabled={gameState.status !== 'in_progress'}
                />
              )}
              {mobileTab === 'diagnose' && (
                <DiagnosisList
                  diagnoses={gameState.diagnoses}
                  onSubmitDiagnosis={handleSubmitDiagnosis}
                  disabled={isDisabled}
                  questionCount={gameState.questionScores.length}
                />
              )}
            </div>
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation - Order: Interview, Tests, Exam, Diagnose */}
      {isMobile && (
        <nav className="mobile-bottom-nav">
          <button
            className={`nav-tab ${mobileTab === 'chat' ? 'active' : ''}`}
            onClick={() => setMobileTab('chat')}
          >
            <span className="nav-icon">💬</span>
            <span className="nav-label">Interview</span>
          </button>
          <button
            className={`nav-tab ${mobileTab === 'tests' ? 'active' : ''}`}
            onClick={() => setMobileTab('tests')}
          >
            <span className="nav-icon">🔬</span>
            <span className="nav-label">Tests</span>
            {(gameState.testResults?.length || 0) > 0 && (
              <span className="nav-badge">{gameState.testResults?.length}</span>
            )}
          </button>
          <button
            className={`nav-tab ${mobileTab === 'exam' ? 'active' : ''}`}
            onClick={() => setMobileTab('exam')}
          >
            <span className="nav-icon">🩺</span>
            <span className="nav-label">Exam</span>
            {(gameState.examResults?.length || 0) > 0 && (
              <span className="nav-badge">{gameState.examResults?.length}</span>
            )}
          </button>
          <button
            className={`nav-tab ${mobileTab === 'diagnose' ? 'active' : ''}`}
            onClick={() => setMobileTab('diagnose')}
          >
            <span className="nav-icon">💊</span>
            <span className="nav-label">Diagnose</span>
          </button>
        </nav>
      )}

      {error && (
        <div className="error-toast">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {submittingDiagnosis && (
        <div className="submitting-overlay">
          <div className="submitting-content">
            <div className="submitting-spinner"></div>
            <p>Analyzing your diagnosis...</p>
            <span>Calculating score and generating feedback</span>
          </div>
        </div>
      )}

      {gameState.status !== 'in_progress' && scoreBreakdown && (
        <GameOverModal
          state={gameState}
          scoreBreakdown={scoreBreakdown}
          correctDiagnosisName={correctDiagnosisName}
          submittedDiagnosisName={submittedDiagnosisName}
          diagnosisExplanation={diagnosisExplanation || undefined}
          incorrectExplanation={incorrectExplanation || undefined}
          onNewGame={() => requestNewGame()}
          onBackToDashboard={handleBackToDashboard}
          caseId={currentCaseId || gameState.caseId}
          caseDomain={currentCaseDomain || gameState.domain}
          challengeResult={challengeResult || undefined}
        />
      )}

      <GameModeSelector
        isOpen={showModeSelector}
        onSelectMode={handleModeSelect}
        onClose={closeModeSelector}
      />

      {/* Feedback button - context depends on game state */}
      <FeedbackButton
        context={gameState.status === 'in_progress' ? 'during_case' : 'after_case'}
        gameState={gameState}
        scoreInfo={scoreBreakdown && scoreBreakdown.total !== undefined ? {
          score: scoreBreakdown.total,
          wasCorrect: gameState.status === 'won',
          correctDiagnosis: correctDiagnosisName,
          submittedDiagnosis: submittedDiagnosisName
        } : undefined}
        userId={userProfile?.uid}
        userEmail={userProfile?.username}
        isTestUser={isTestUser}
      />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <GameContent />
      </ProtectedRoute>
    </AuthProvider>
  );
}

export default App;
