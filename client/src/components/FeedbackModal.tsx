import { useState } from 'react';
import type { FeedbackContext, FeedbackCaseSnapshot, GameState } from '../types';
import * as api from '../services/api';
import './FeedbackModal.css';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: FeedbackContext;
  gameState?: GameState | null;
  scoreInfo?: {
    score: number;
    wasCorrect: boolean;
    correctDiagnosis: string;
    submittedDiagnosis: string;
  };
  userId?: string;
  userEmail?: string;
  isTestUser?: boolean;
}

export function FeedbackModal({
  isOpen,
  onClose,
  context,
  gameState,
  scoreInfo,
  userId,
  userEmail,
  isTestUser
}: FeedbackModalProps) {
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!feedbackText.trim()) {
      setError('Please enter your feedback');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Build case snapshot if we have game state
      let caseSnapshot: FeedbackCaseSnapshot | undefined;

      if (gameState && (context === 'during_case' || context === 'after_case')) {
        const timeElapsed = gameState.startTime
          ? (Date.now() - gameState.startTime) / 60000
          : 0;

        caseSnapshot = {
          caseId: gameState.caseId,
          gameId: gameState.gameId,
          domain: 'general', // Could be enhanced to include actual domain
          correctDiagnosis: scoreInfo?.correctDiagnosis || 'Unknown',
          submittedDiagnosis: scoreInfo?.submittedDiagnosis,
          wasCorrect: scoreInfo?.wasCorrect,
          score: scoreInfo?.score,
          questionsAsked: gameState.chatHistory.filter(m => m.role === 'player').length,
          testsOrdered: gameState.testResults?.length || 0,
          examsPerformed: gameState.examResults?.length || 0,
          timeElapsedMinutes: Math.round(timeElapsed * 10) / 10,
          chatHistory: gameState.chatHistory.map(m => ({
            role: m.role,
            content: m.content
          })),
          testResults: gameState.testResults?.map(t => ({
            name: t.testName,
            result: t.result,
            isAbnormal: t.isAbnormal
          })),
          examResults: gameState.examResults?.map(e => ({
            name: e.examName,
            finding: e.finding,
            isAbnormal: e.isAbnormal
          }))
        };
      }

      await api.submitFeedback(
        feedbackText.trim(),
        context,
        caseSnapshot,
        userId,
        userEmail,
        isTestUser
      );

      setSubmitted(true);
      setFeedbackText('');

      // Auto-close after 2 seconds
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setFeedbackText('');
    setError(null);
    setSubmitted(false);
    onClose();
  };

  const contextLabel = {
    dashboard: 'General Feedback',
    during_case: 'Feedback During Case',
    after_case: 'Case Feedback'
  }[context];

  return (
    <div className="feedback-modal-overlay" onClick={handleClose}>
      <div className="feedback-modal" onClick={e => e.stopPropagation()}>
        <div className="feedback-modal-header">
          <h2>Send Feedback</h2>
          <button className="feedback-close-btn" onClick={handleClose}>
            &times;
          </button>
        </div>

        {submitted ? (
          <div className="feedback-success">
            <div className="feedback-success-icon">&#10003;</div>
            <h3>Thank you!</h3>
            <p>Your feedback has been submitted.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="feedback-context-badge">
              {contextLabel}
              {gameState && context !== 'dashboard' && (
                <span className="feedback-case-info">
                  Case #{gameState.gameId.slice(0, 8)}
                </span>
              )}
            </div>

            {context !== 'dashboard' && gameState && (
              <div className="feedback-case-summary">
                <p>
                  <strong>Patient:</strong> {gameState.persona.name}, {gameState.persona.age}yo
                </p>
                <p>
                  <strong>Questions:</strong> {gameState.chatHistory.filter(m => m.role === 'player').length} |{' '}
                  <strong>Tests:</strong> {gameState.testResults?.length || 0} |{' '}
                  <strong>Exams:</strong> {gameState.examResults?.length || 0}
                </p>
                {scoreInfo && (
                  <p>
                    <strong>Result:</strong>{' '}
                    <span className={scoreInfo.wasCorrect ? 'correct' : 'incorrect'}>
                      {scoreInfo.wasCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                    {scoreInfo.score !== undefined && ` (${scoreInfo.score}/100)`}
                  </p>
                )}
              </div>
            )}

            <div className="feedback-form-group">
              <label htmlFor="feedback-text">Your Feedback</label>
              <textarea
                id="feedback-text"
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
                placeholder="Tell us about bugs, suggestions, or anything else..."
                rows={5}
                disabled={submitting}
                autoFocus
              />
            </div>

            {error && (
              <div className="feedback-error">{error}</div>
            )}

            <div className="feedback-modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !feedbackText.trim()}
              >
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
