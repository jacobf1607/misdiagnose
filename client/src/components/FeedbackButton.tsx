import { useState, useEffect } from 'react';
import type { FeedbackContext, GameState } from '../../../shared/types';
import { FeedbackModal } from './FeedbackModal';
import './FeedbackModal.css';

// Session storage key for tooltip
const TOOLTIP_SHOWN_KEY = 'feedback_tooltip_shown_session';

interface FeedbackButtonProps {
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
  variant?: 'floating' | 'link' | 'button';
  label?: string;
  showTooltip?: boolean; // Show one-time tooltip hint
}

export function FeedbackButton({
  context,
  gameState,
  scoreInfo,
  userId,
  userEmail,
  isTestUser,
  variant = 'floating',
  label = 'Feedback',
  showTooltip = false
}: FeedbackButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  // Show tooltip once per session on dashboard
  useEffect(() => {
    if (showTooltip && variant === 'floating') {
      const alreadyShown = sessionStorage.getItem(TOOLTIP_SHOWN_KEY);
      if (!alreadyShown) {
        // Delay showing tooltip so it appears after page load
        const timer = setTimeout(() => {
          setTooltipVisible(true);
          sessionStorage.setItem(TOOLTIP_SHOWN_KEY, 'true');
          // Auto-hide after 5 seconds
          setTimeout(() => setTooltipVisible(false), 5000);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [showTooltip, variant]);

  const handleOpen = () => {
    setTooltipVisible(false);
    setIsOpen(true);
  };
  const handleClose = () => setIsOpen(false);

  // Message bubble icon SVG
  const FeedbackIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );

  return (
    <>
      {variant === 'floating' && (
        <div className="feedback-button-wrapper">
          {tooltipVisible && (
            <div className="feedback-tooltip">
              <span>Having issues or ideas?</span>
              <span>Click here anytime!</span>
              <button
                className="feedback-tooltip-close"
                onClick={() => setTooltipVisible(false)}
              >
                ×
              </button>
            </div>
          )}
          <button
            className={`feedback-button ${tooltipVisible ? 'with-tooltip' : ''}`}
            onClick={handleOpen}
            title="Send Feedback"
            aria-label="Send Feedback"
          >
            <FeedbackIcon />
          </button>
        </div>
      )}

      {variant === 'link' && (
        <button className="feedback-link" onClick={handleOpen}>
          <FeedbackIcon />
          {label}
        </button>
      )}

      {variant === 'button' && (
        <button className="btn btn-outline" onClick={handleOpen}>
          {label}
        </button>
      )}

      <FeedbackModal
        isOpen={isOpen}
        onClose={handleClose}
        context={context}
        gameState={gameState}
        scoreInfo={scoreInfo}
        userId={userId}
        userEmail={userEmail}
        isTestUser={isTestUser}
      />
    </>
  );
}
