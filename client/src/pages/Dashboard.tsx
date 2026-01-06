/**
 * Dashboard Page
 *
 * Main landing page after login.
 * Shows welcome message, stats, and case history.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getCaseHistory } from '../services/api';
import { CaseDetailModal } from '../components/CaseDetailModal';
import type { CaseHistoryEntry } from '../../../shared/types';
import './Dashboard.css';

interface DashboardProps {
  onStartGame: () => void;
  onEnterTestMode?: () => void;
  onViewFeedback?: () => void;
  onViewPastCases?: () => void;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'S': return 'var(--success)';
    case 'A': return '#22c55e';
    case 'B': return '#84cc16';
    case 'C': return 'var(--warning)';
    case 'D': return '#f97316';
    case 'F': return 'var(--danger)';
    default: return 'var(--gray-600)';
  }
}

export function Dashboard({ onStartGame, onEnterTestMode, onViewFeedback, onViewPastCases }: DashboardProps) {
  const { userProfile, isTestUser, isGuest, exitGuestMode } = useAuth();
  const [history, setHistory] = useState<CaseHistoryEntry[]>([]);
  const [stats, setStats] = useState({ totalCases: 0, correctCount: 0, averageScore: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<CaseHistoryEntry | null>(null);

  useEffect(() => {
    if (userProfile?.uid) {
      getCaseHistory(userProfile.uid)
        .then(data => {
          setHistory(data.history);
          setStats({
            totalCases: data.totalCases,
            correctCount: data.correctCount,
            averageScore: data.averageScore
          });
        })
        .catch(err => console.error('Failed to load history:', err))
        .finally(() => setLoading(false));
    } else {
      // Guest mode - no history to load
      setLoading(false);
    }
  }, [userProfile?.uid]);

  const bestGrade = history.length > 0
    ? ['S', 'A', 'B', 'C', 'D', 'F'].find(g => history.some(h => h.grade === g)) || '-'
    : '-';

  const accuracy = stats.totalCases > 0
    ? Math.round((stats.correctCount / stats.totalCases) * 100)
    : 0;

  return (
    <div className="dashboard">
      <div className="dashboard-content">
        <div className="welcome-section">
          {isGuest ? (
            <>
              <h1 className="welcome-title">
                Welcome, <span className="username">Guest</span>!
              </h1>
              <p className="welcome-subtitle">
                Practice your clinical reasoning skills
              </p>
            </>
          ) : (
            <>
              <h1 className="welcome-title">
                Welcome back, <span className="username">{userProfile?.username}</span>!
              </h1>
              <p className="welcome-subtitle">
                Ready to practice your clinical reasoning skills?
              </p>
            </>
          )}
        </div>

        <div className="action-section">
          <div className="action-row-primary">
            <button
              className="btn btn-primary start-case-btn"
              onClick={onStartGame}
            >
              <span className="btn-icon">🩺</span>
              Start New Case
            </button>
            {!isGuest && history.length > 0 && onViewPastCases && (
              <button
                className="btn btn-outline past-cases-btn"
                onClick={onViewPastCases}
              >
                <span className="btn-icon">📋</span>
                Past Cases
              </button>
            )}
          </div>
          <div className="action-row-secondary">
            {isGuest && (
              <button
                className="btn btn-outline login-prompt-btn"
                onClick={exitGuestMode}
              >
                <span className="btn-icon">🔐</span>
                Login to Save Progress
              </button>
            )}
            {isTestUser && onEnterTestMode && (
              <button
                className="btn btn-outline test-mode-btn"
                onClick={onEnterTestMode}
              >
                <span className="btn-icon">🧪</span>
                Enter Test Mode
              </button>
            )}
            {isTestUser && onViewFeedback && (
              <button
                className="btn btn-outline feedback-dashboard-btn"
                onClick={onViewFeedback}
              >
                <span className="btn-icon">💬</span>
                View Feedback
              </button>
            )}
          </div>
        </div>

        {/* Only show stats for logged-in users */}
        {!isGuest && (
          <div className="stats-section">
            <div className="stat-card">
              <span className="stat-icon">📊</span>
              <span className="stat-label">Cases Played</span>
              <span className="stat-value">{loading ? '-' : stats.totalCases}</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon">🎯</span>
              <span className="stat-label">Accuracy</span>
              <span className="stat-value">{loading ? '-' : `${accuracy}%`}</span>
            </div>
            <div className="stat-card">
              <span className="stat-icon">⭐</span>
              <span className="stat-label">Best Grade</span>
              <span className="stat-value" style={{ color: getGradeColor(bestGrade) }}>
                {loading ? '-' : bestGrade}
              </span>
            </div>
          </div>
        )}

        {!isGuest && history.length > 0 && (
          <div className="history-section">
            <h2 className="history-title">Recent Cases</h2>
            <div className="history-list">
              {history.slice(0, 5).map((entry, index) => (
                <div
                  key={index}
                  className="history-item clickable"
                  onClick={() => setSelectedCase(entry)}
                >
                  <div className="history-main">
                    <span className={`history-result ${entry.wasCorrect ? 'correct' : entry.timedOut ? 'timeout' : 'incorrect'}`}>
                      {entry.wasCorrect ? '✓' : entry.timedOut ? '⏱' : '✗'}
                    </span>
                    <div className="history-details">
                      <span className="history-diagnosis">
                        {entry.wasCorrect ? entry.correctDiagnosis : (
                          <>
                            <span className="history-submitted">
                              {entry.timedOut ? 'Timeout' : entry.submittedDiagnosis}
                            </span>
                            <span className="history-arrow"> → </span>
                            <span className="history-correct">{entry.correctDiagnosis}</span>
                          </>
                        )}
                      </span>
                      <div className="history-tags">
                        <span className="history-domain">{entry.domain}</span>
                        {entry.mode && (
                          <span className={`history-mode-tag ${entry.mode}`}>
                            {entry.mode === 'blitz' ? '⚡ Blitz' : 'Standard'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="history-meta">
                    <span
                      className="history-grade"
                      style={{ color: getGradeColor(entry.grade) }}
                    >
                      {entry.grade}
                    </span>
                    <span className="history-score">{entry.finalScore}</span>
                    <span className="history-date">{formatDate(entry.completedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="info-section">
          <p>
            Misdiagnose presents you with realistic patient cases.
            Ask questions, order tests, and make your diagnosis.
            Your performance is graded on accuracy, efficiency, and clinical reasoning.
          </p>
        </div>
      </div>

      {selectedCase && (
        <CaseDetailModal
          entry={selectedCase}
          isOpen={!!selectedCase}
          onClose={() => setSelectedCase(null)}
        />
      )}
    </div>
  );
}
