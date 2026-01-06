import { useState } from 'react';
import type { GameState, ScoreBreakdown, CoachingFeedback, DiagnosisExplanation, IncorrectDiagnosisExplanation, Challenge } from '../../../shared/types';
import { useAuth } from '../contexts/AuthContext';
import { CoachingModal } from './CoachingModal';
import { ShareModal } from './ShareModal';
import { FeedbackPrompt } from './FeedbackPrompt';
import { createChallenge, shareVictoryViaWhatsApp } from '../utils/share';
import './GameOverModal.css';

// Helper to render text with **bold** markdown-like formatting
function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

interface GameOverModalProps {
  state: GameState;
  scoreBreakdown: ScoreBreakdown;
  correctDiagnosisName: string;
  submittedDiagnosisName?: string;
  diagnosisExplanation?: DiagnosisExplanation;
  incorrectExplanation?: IncorrectDiagnosisExplanation;
  onNewGame: () => void;
  onBackToDashboard?: () => void;
  // Challenge props
  caseId?: string;
  caseDomain?: string;
  // If this game was a challenge, these are set
  challengeResult?: {
    challenge: Challenge;
    result: 'win' | 'lose' | 'tie';
    scoreDifference: number;
  };
}

// Grade colors
const gradeColors: Record<string, { bg: string; text: string }> = {
  'S': { bg: '#fef3c7', text: '#92400e' },
  'A': { bg: '#dcfce7', text: '#166534' },
  'B': { bg: '#dbeafe', text: '#1e40af' },
  'C': { bg: '#e0e7ff', text: '#3730a3' },
  'D': { bg: '#fee2e2', text: '#991b1b' },
  'F': { bg: '#fecaca', text: '#7f1d1d' }
};


function ScoreComponent({ title, icon, raw, weighted, details, color }: {
  title: string;
  icon: string;
  raw: number;
  weighted: number;
  details: string;
  color: string;
}) {
  return (
    <div className="score-component">
      <div className="score-component-header">
        <span className="score-component-icon">{icon}</span>
        <span className="score-component-title">{title}</span>
        <span className="score-component-points" style={{ color }}>
          +{weighted.toFixed(1)}
        </span>
      </div>
      <div className="score-component-bar">
        <div
          className="score-component-fill"
          style={{ width: `${raw}%`, backgroundColor: color }}
        />
      </div>
      <div className="score-component-details">{details}</div>
    </div>
  );
}

export function GameOverModal({
  state,
  scoreBreakdown,
  correctDiagnosisName,
  submittedDiagnosisName,
  diagnosisExplanation,
  incorrectExplanation,
  onNewGame,
  onBackToDashboard,
  caseId,
  caseDomain,
  challengeResult
}: GameOverModalProps) {
  const { isGuest, exitGuestMode, userProfile } = useAuth();
  const [showCoaching, setShowCoaching] = useState(false);
  const [coaching, setCoaching] = useState<CoachingFeedback | null>(null);
  const [loadingCoaching, setLoadingCoaching] = useState(false);
  const [coachingError, setCoachingError] = useState<string | null>(null);
  const [showGuestPrompt, setShowGuestPrompt] = useState(isGuest);
  const [creatingChallenge, setCreatingChallenge] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [challengeUrl, setChallengeUrl] = useState('');

  const isWon = state.status === 'won';
  const canChallenge = !isGuest && caseId && userProfile;

  // Fetch coaching data
  const handleViewCoaching = async () => {
    if (coaching) {
      setShowCoaching(true);
      return;
    }

    setLoadingCoaching(true);
    setCoachingError(null);

    try {
      const response = await fetch(`/api/game/${state.gameId}/coaching`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load coaching');
      }

      setCoaching(data.coaching);
      setShowCoaching(true);
    } catch (error) {
      setCoachingError(error instanceof Error ? error.message : 'Failed to load coaching');
    } finally {
      setLoadingCoaching(false);
    }
  };

  // Create and share challenge
  const handleChallengeAFriend = async () => {
    if (!canChallenge || !caseId || !userProfile) return;

    setCreatingChallenge(true);
    try {
      const { shareUrl } = await createChallenge({
        caseId,
        caseDomain: caseDomain || 'general',
        gameMode: state.mode || 'standard',
        challengerId: userProfile.uid,
        challengerName: userProfile.username,
        challengerGrade: scoreBreakdown.grade,
        challengerScore: scoreBreakdown.totalScore
      });

      // Show share modal with the challenge URL
      setChallengeUrl(shareUrl);
      setShowShareModal(true);
    } catch (error) {
      console.error('Failed to create challenge:', error);
    } finally {
      setCreatingChallenge(false);
    }
  };

  // Share victory when user won a challenge
  const handleShareVictory = () => {
    if (!challengeResult || challengeResult.result !== 'win') return;

    shareVictoryViaWhatsApp({
      opponentName: challengeResult.challenge.challengerName,
      yourGrade: scoreBreakdown.grade,
      opponentGrade: challengeResult.challenge.challengerGrade,
      domain: caseDomain || 'medical'
    });
  };

  // Handle both old and new score breakdown formats
  const hasNewFormat = scoreBreakdown.time !== undefined;

  if (!hasNewFormat) {
    // Legacy format fallback
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className={`modal-header ${isWon ? 'won' : 'lost'}`}>
            <div className="modal-icon">
              {isWon ? '✓' : '✗'}
            </div>
            <h2 className="modal-title">
              {isWon ? 'Correct Diagnosis!' : 'Incorrect Diagnosis'}
            </h2>
          </div>
          <div className="modal-body">
            <div className="diagnosis-result">
              <span className="result-label">The correct diagnosis was:</span>
              <span className="result-value">{correctDiagnosisName}</span>
            </div>
            <div className="score-breakdown">
              <h3>Score: {scoreBreakdown.total || 0}</h3>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary btn-large" onClick={onNewGame}>
              Play Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { time, budget, efficiency, accuracy, clinicalReasoning, totalScore, grade, rank, strengths, areasForImprovement } = scoreBreakdown;
  const gradeStyle = gradeColors[grade] || gradeColors['C'];

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-content-large">
        {/* Header with Grade */}
        <div className={`modal-header ${isWon ? 'won' : 'lost'}`}>
          <div className="grade-display" style={{ backgroundColor: gradeStyle.bg }}>
            <span className="grade-letter" style={{ color: gradeStyle.text }}>{grade}</span>
          </div>
          <h2 className="modal-title">
            {isWon ? 'Correct Diagnosis!' : 'Incorrect Diagnosis'}
          </h2>
          <div className="rank-display">{rank}</div>
        </div>

        {/* Challenge Result Comparison (if this was a challenge) */}
        {challengeResult && (
          <div className={`challenge-result-banner ${challengeResult.result}`}>
            <div className="challenge-result-title">
              {challengeResult.result === 'win' && 'You Won!'}
              {challengeResult.result === 'lose' && 'They Won!'}
              {challengeResult.result === 'tie' && "It's a Tie!"}
            </div>
            <div className="challenge-result-scores">
              <div className="challenge-score you">
                <span className="score-label">You</span>
                <span className="score-grade">{scoreBreakdown.grade}</span>
                <span className="score-value">{scoreBreakdown.totalScore}</span>
              </div>
              <div className="challenge-vs">vs</div>
              <div className="challenge-score opponent">
                <span className="score-label">{challengeResult.challenge.challengerName}</span>
                <span className="score-grade">{challengeResult.challenge.challengerGrade}</span>
                <span className="score-value">{challengeResult.challenge.challengerScore}</span>
              </div>
            </div>
            {challengeResult.result === 'win' && (
              <button
                className="btn btn-success share-victory-btn"
                onClick={handleShareVictory}
              >
                Share Victory
              </button>
            )}
          </div>
        )}

        <div className="modal-body">
          {/* Diagnosis Result */}
          <div className="diagnosis-result">
            <span className="result-label">The correct diagnosis was:</span>
            <span className="result-value">{correctDiagnosisName}</span>
          </div>

          {/* Why Incorrect - shown only for wrong answers */}
          {!isWon && incorrectExplanation && (
            <div className="explanation-section incorrect-section">
              <h3>Why Your Answer Was Incorrect</h3>
              <div className="your-answer">
                <span className="answer-label">You selected:</span>
                <span className="answer-value">{submittedDiagnosisName}</span>
              </div>

              {/* Description of what the player chose */}
              {incorrectExplanation.description && (
                <p className="explanation-text">
                  <FormattedText text={incorrectExplanation.description} />
                </p>
              )}

              {/* Why incorrect - brief explanation */}
              {incorrectExplanation.whyIncorrect && (
                <div className="why-incorrect">
                  <h4>Why This Doesn't Fit</h4>
                  <p><FormattedText text={incorrectExplanation.whyIncorrect} /></p>
                </div>
              )}

              {/* Key Differences - bulleted list */}
              {incorrectExplanation.keyDifferences && incorrectExplanation.keyDifferences.length > 0 && (
                <div className="key-differences">
                  <h4>Key Differences</h4>
                  <ul>
                    {incorrectExplanation.keyDifferences.map((d, i) => (
                      <li key={i}><FormattedText text={d} /></li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Contradicting Findings */}
              {incorrectExplanation.contradictingFindings && incorrectExplanation.contradictingFindings.length > 0 && (
                <div className="findings-list">
                  <h4>Findings That Contradict Your Answer</h4>
                  <ul>
                    {incorrectExplanation.contradictingFindings.map((f, i) => (
                      <li key={i}><FormattedText text={f} /></li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing Findings */}
              {incorrectExplanation.missingFindings && incorrectExplanation.missingFindings.length > 0 && (
                <div className="findings-list">
                  <h4>Expected Findings That Were Missing</h4>
                  <ul>
                    {incorrectExplanation.missingFindings.map((f, i) => (
                      <li key={i}><FormattedText text={f} /></li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Summary */}
              {incorrectExplanation.differentiatingFeatures && (
                <div className="differentiating-features">
                  <h4>Summary</h4>
                  <p><FormattedText text={incorrectExplanation.differentiatingFeatures} /></p>
                </div>
              )}
            </div>
          )}

          {/* Correct Diagnosis Explanation */}
          {diagnosisExplanation && (
            <div className="explanation-section correct-section">
              <h3>Why {correctDiagnosisName} Is The Correct Diagnosis</h3>

              {/* Description - 2 line overview */}
              {diagnosisExplanation.description && (
                <p className="explanation-text">
                  <FormattedText text={diagnosisExplanation.description} />
                </p>
              )}

              {/* Key Symptoms */}
              {diagnosisExplanation.keySymptoms && diagnosisExplanation.keySymptoms.length > 0 && (
                <div className="key-symptoms">
                  <h4>Key Symptoms</h4>
                  <ul>
                    {diagnosisExplanation.keySymptoms.map((s, i) => (
                      <li key={i}><FormattedText text={s} /></li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Diagnosis Steps */}
              {diagnosisExplanation.diagnosisSteps && diagnosisExplanation.diagnosisSteps.length > 0 && (
                <div className="diagnosis-steps">
                  <h4>How To Diagnose</h4>
                  <ul>
                    {diagnosisExplanation.diagnosisSteps.map((step, i) => (
                      <li key={i}><FormattedText text={step} /></li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Key Findings */}
              {diagnosisExplanation.keyFindings && diagnosisExplanation.keyFindings.length > 0 && (
                <div className="key-findings">
                  <h4>Key Findings In This Case</h4>
                  <ul>
                    {diagnosisExplanation.keyFindings.map((f, i) => (
                      <li key={i}><FormattedText text={f} /></li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Clinical Reasoning */}
              {diagnosisExplanation.clinicalReasoning && (
                <div className="clinical-reasoning">
                  <h4>Clinical Reasoning</h4>
                  <p><FormattedText text={diagnosisExplanation.clinicalReasoning} /></p>
                </div>
              )}
            </div>
          )}

          {/* Total Score */}
          <div className="total-score-display">
            <div className="total-score-circle">
              <span className="total-score-value">{totalScore}</span>
              <span className="total-score-max">/100</span>
            </div>
          </div>

          {/* Score Components */}
          <div className="score-components">
            <h3>Score Breakdown</h3>

            <ScoreComponent
              title="Time"
              icon="⏱️"
              raw={time.raw}
              weighted={time.weighted}
              details={time.details}
              color="#3b82f6"
            />

            <ScoreComponent
              title="Test Economy"
              icon="🧪"
              raw={budget.raw}
              weighted={budget.weighted}
              details={budget.details}
              color="#10b981"
            />

            <ScoreComponent
              title="Efficiency"
              icon="🎯"
              raw={efficiency.raw}
              weighted={efficiency.weighted}
              details={efficiency.details}
              color="#8b5cf6"
            />

            <ScoreComponent
              title="Accuracy"
              icon="✓"
              raw={accuracy.raw}
              weighted={accuracy.weighted}
              details={accuracy.details}
              color={accuracy.correct ? '#22c55e' : '#ef4444'}
            />

            <ScoreComponent
              title="Clinical Reasoning"
              icon="🧠"
              raw={clinicalReasoning.raw}
              weighted={clinicalReasoning.weighted}
              details={clinicalReasoning.details}
              color="#f59e0b"
            />
          </div>

          {/* Stats Grid */}
          <div className="stats-grid">
            <div className="stat-box">
              <span className="stat-box-value">{time.timeElapsedMinutes.toFixed(1)}</span>
              <span className="stat-box-label">Minutes</span>
            </div>
            <div className="stat-box">
              <span className="stat-box-value">{budget.testsOrdered || state.testResults?.length || 0}</span>
              <span className="stat-box-label">Tests Ordered</span>
            </div>
            <div className="stat-box">
              <span className="stat-box-value">{budget.optimalTests || 3}</span>
              <span className="stat-box-label">Optimal Tests</span>
            </div>
            <div className="stat-box">
              <span className="stat-box-value">{clinicalReasoning.questionQualityAvg.toFixed(1)}</span>
              <span className="stat-box-label">Avg Quality</span>
            </div>
          </div>

          {/* Feedback */}
          {(strengths.length > 0 || areasForImprovement.length > 0) && (
            <div className="feedback-section">
              {strengths.length > 0 && (
                <div className="feedback-box feedback-strengths">
                  <h4>Strengths</h4>
                  <ul>
                    {strengths.map((s, i) => (
                      <li key={i}><FormattedText text={s} /></li>
                    ))}
                  </ul>
                </div>
              )}

              {areasForImprovement.length > 0 && (
                <div className="feedback-box feedback-improve">
                  <h4>Areas for Improvement</h4>
                  <ul>
                    {areasForImprovement.map((a, i) => (
                      <li key={i}><FormattedText text={a} /></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Efficiency Issues */}
          {(efficiency.redundantTests.length > 0 || efficiency.lowYieldTests.length > 0) && (
            <div className="efficiency-issues">
              {efficiency.redundantTests.length > 0 && (
                <div className="issue-group">
                  <span className="issue-label">Redundant tests:</span>
                  <span className="issue-value">{efficiency.redundantTests.join(', ')}</span>
                </div>
              )}
              {efficiency.lowYieldTests.length > 0 && (
                <div className="issue-group">
                  <span className="issue-label">Low-yield tests:</span>
                  <span className="issue-value">{efficiency.lowYieldTests.join(', ')}</span>
                </div>
              )}
            </div>
          )}

          {/* Feedback Prompt - shows after 1st case and every 3rd case */}
          <FeedbackPrompt />
        </div>

        {/* Guest Save Prompt */}
        {isGuest && showGuestPrompt && (
          <div className="guest-save-prompt">
            <div className="guest-save-content">
              <span className="guest-save-icon">💾</span>
              <div className="guest-save-text">
                <strong>Want to save your progress?</strong>
                <span>Login to track your history and stats</span>
              </div>
            </div>
            <div className="guest-save-actions">
              <button
                className="btn btn-primary"
                onClick={exitGuestMode}
              >
                Login to Save
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setShowGuestPrompt(false)}
              >
                Skip
              </button>
            </div>
          </div>
        )}

        <div className="modal-footer">
          {onBackToDashboard && (
            <button className="btn btn-outline btn-large" onClick={onBackToDashboard}>
              Back to Dashboard
            </button>
          )}
          {/* Challenge a Friend button - only show if logged in and not already a challenge */}
          {canChallenge && !challengeResult && (
            <button
              className="btn btn-whatsapp btn-large"
              onClick={handleChallengeAFriend}
              disabled={creatingChallenge}
            >
              {creatingChallenge ? 'Creating...' : 'Challenge a Friend'}
            </button>
          )}
          <button
            className="btn btn-secondary btn-large"
            onClick={handleViewCoaching}
            disabled={loadingCoaching}
          >
            {loadingCoaching ? 'Loading...' : 'View Coaching'}
          </button>
          <button className="btn btn-primary btn-large" onClick={onNewGame}>
            New Case
          </button>
        </div>

        {coachingError && (
          <div className="coaching-error">
            {coachingError}
          </div>
        )}
      </div>

      {/* Coaching Modal */}
      {showCoaching && coaching && (
        <CoachingModal
          coaching={coaching}
          onClose={() => setShowCoaching(false)}
        />
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        challengeUrl={challengeUrl}
        domain={caseDomain || 'medical'}
        grade={scoreBreakdown.grade}
      />
    </div>
  );
}
