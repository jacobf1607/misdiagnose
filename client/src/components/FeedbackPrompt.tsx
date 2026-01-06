/**
 * Feedback Prompt Component
 * Shows inline feedback collection after games
 * - Full version after 1st case (celebratory)
 * - Subtle banner every 3rd case
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../services/api';
import './FeedbackPrompt.css';

// LocalStorage keys
const STORAGE_KEYS = {
  CASE_COUNT: 'feedback_case_count',
  DISMISSED_FOREVER: 'feedback_dismissed_forever',
  FIRST_CASE_PROMPTED: 'feedback_first_case_prompted'
};

interface FeedbackPromptProps {
  onSubmit?: (feedback: { rating: string; text: string }) => void;
}

type Rating = 'great' | 'okay' | 'frustrating' | null;

export function FeedbackPrompt({ onSubmit }: FeedbackPromptProps) {
  const { userProfile } = useAuth();
  const [caseCount, setCaseCount] = useState(0);
  const [dismissedForever, setDismissedForever] = useState(false);
  const [firstCasePrompted, setFirstCasePrompted] = useState(false);
  const [rating, setRating] = useState<Rating>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load state from localStorage on mount
  useEffect(() => {
    const count = parseInt(localStorage.getItem(STORAGE_KEYS.CASE_COUNT) || '0', 10);
    const dismissed = localStorage.getItem(STORAGE_KEYS.DISMISSED_FOREVER) === 'true';
    const firstPrompted = localStorage.getItem(STORAGE_KEYS.FIRST_CASE_PROMPTED) === 'true';

    setCaseCount(count);
    setDismissedForever(dismissed);
    setFirstCasePrompted(firstPrompted);
  }, []);

  // Increment case count when component mounts (new game completed)
  useEffect(() => {
    const newCount = caseCount + 1;
    localStorage.setItem(STORAGE_KEYS.CASE_COUNT, newCount.toString());
    setCaseCount(newCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Determine which prompt to show
  const isFirstCase = caseCount === 1 && !firstCasePrompted;
  const isEveryThirdCase = caseCount > 1 && caseCount % 3 === 0;
  const shouldShowPrompt = !dismissedForever && !dismissed && !submitted && (isFirstCase || isEveryThirdCase);

  // Handle rating selection
  const handleRatingClick = (selectedRating: Rating) => {
    setRating(selectedRating);
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!rating) return;

    setSubmitting(true);

    try {
      // Submit feedback to API
      const response = await fetch(`${API_BASE}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedbackText: feedbackText || `Rating: ${rating}`,
          context: 'after_case',
          userId: userProfile?.uid,
          userEmail: userProfile?.username,
          isTestUser: false,
          rating,
          caseNumber: caseCount
        })
      });

      if (response.ok) {
        setSubmitted(true);
        if (isFirstCase) {
          localStorage.setItem(STORAGE_KEYS.FIRST_CASE_PROMPTED, 'true');
        }
        onSubmit?.({ rating, text: feedbackText });
      }
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle skip/dismiss
  const handleSkip = () => {
    setDismissed(true);
    if (isFirstCase) {
      localStorage.setItem(STORAGE_KEYS.FIRST_CASE_PROMPTED, 'true');
    }
  };

  // Handle "Don't ask again"
  const handleDismissForever = () => {
    localStorage.setItem(STORAGE_KEYS.DISMISSED_FOREVER, 'true');
    setDismissedForever(true);
    setDismissed(true);
  };

  // Don't show if conditions not met
  if (!shouldShowPrompt) {
    return null;
  }

  // Show thank you message after submission
  if (submitted) {
    return (
      <div className="feedback-prompt feedback-submitted">
        <span className="feedback-thanks-icon">🙏</span>
        <span className="feedback-thanks-text">Thanks for your feedback!</span>
      </div>
    );
  }

  // First case - Full celebratory prompt
  if (isFirstCase) {
    return (
      <div className="feedback-prompt feedback-first-case">
        <div className="feedback-celebration">
          <span className="celebration-icon">🎉</span>
          <span className="celebration-text">You completed your first case!</span>
        </div>

        <div className="feedback-question">
          <span>How was your experience?</span>
        </div>

        <div className="feedback-ratings">
          <button
            className={`rating-btn ${rating === 'frustrating' ? 'selected' : ''}`}
            onClick={() => handleRatingClick('frustrating')}
          >
            <span className="rating-emoji">😞</span>
            <span className="rating-label">Frustrating</span>
          </button>
          <button
            className={`rating-btn ${rating === 'okay' ? 'selected' : ''}`}
            onClick={() => handleRatingClick('okay')}
          >
            <span className="rating-emoji">😐</span>
            <span className="rating-label">Okay</span>
          </button>
          <button
            className={`rating-btn ${rating === 'great' ? 'selected' : ''}`}
            onClick={() => handleRatingClick('great')}
          >
            <span className="rating-emoji">😊</span>
            <span className="rating-label">Great</span>
          </button>
        </div>

        {rating && (
          <div className="feedback-text-section">
            <textarea
              className="feedback-textarea"
              placeholder="Any thoughts? (optional)"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={2}
            />
          </div>
        )}

        <div className="feedback-actions">
          <button
            className="btn btn-primary feedback-submit-btn"
            onClick={handleSubmit}
            disabled={!rating || submitting}
          >
            {submitting ? 'Sending...' : 'Send Feedback'}
          </button>
          <button
            className="feedback-skip-link"
            onClick={handleSkip}
          >
            Skip for now
          </button>
        </div>

        <div className="feedback-tip">
          <span className="tip-icon">💡</span>
          <span>You can always give feedback using the blue button at the bottom</span>
        </div>
      </div>
    );
  }

  // Every 3rd case - Subtle banner
  return (
    <div className="feedback-prompt feedback-banner">
      <div className="banner-content">
        <span className="banner-icon">💬</span>
        <span className="banner-text">Thoughts on Misdiagnose?</span>
      </div>

      <div className="banner-ratings">
        <button
          className={`rating-btn-small ${rating === 'frustrating' ? 'selected' : ''}`}
          onClick={() => handleRatingClick('frustrating')}
          title="Frustrating"
        >
          😞
        </button>
        <button
          className={`rating-btn-small ${rating === 'okay' ? 'selected' : ''}`}
          onClick={() => handleRatingClick('okay')}
          title="Okay"
        >
          😐
        </button>
        <button
          className={`rating-btn-small ${rating === 'great' ? 'selected' : ''}`}
          onClick={() => handleRatingClick('great')}
          title="Great"
        >
          😊
        </button>
      </div>

      {rating && (
        <div className="banner-expanded">
          <textarea
            className="feedback-textarea-small"
            placeholder="Quick thought? (optional)"
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            rows={1}
          />
          <button
            className="btn btn-primary btn-small"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '...' : 'Send'}
          </button>
        </div>
      )}

      <div className="banner-actions">
        <button className="banner-dismiss" onClick={handleSkip} title="Dismiss">
          Maybe Later
        </button>
        <button className="banner-dismiss-forever" onClick={handleDismissForever}>
          Don't ask again
        </button>
      </div>
    </div>
  );
}

/**
 * Hook to get current case count for external use
 */
export function useFeedbackCaseCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.CASE_COUNT);
    setCount(parseInt(stored || '0', 10));
  }, []);

  return count;
}

/**
 * Utility to reset feedback prompts (for testing)
 */
export function resetFeedbackPrompts(): void {
  localStorage.removeItem(STORAGE_KEYS.CASE_COUNT);
  localStorage.removeItem(STORAGE_KEYS.DISMISSED_FOREVER);
  localStorage.removeItem(STORAGE_KEYS.FIRST_CASE_PROMPTED);
}
