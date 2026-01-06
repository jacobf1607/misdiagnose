import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getCaseHistory } from '../services/api';
import { CaseDetailModal } from '../components/CaseDetailModal';
import type { CaseHistoryEntry } from '../../../shared/types';
import './PastCasesPage.css';

interface PastCasesPageProps {
  onBack: () => void;
}

type Filter = 'all' | 'correct' | 'incorrect' | 'blitz' | 'standard';

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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

export function PastCasesPage({ onBack }: PastCasesPageProps) {
  const { userProfile } = useAuth();
  const [allHistory, setAllHistory] = useState<CaseHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedCase, setSelectedCase] = useState<CaseHistoryEntry | null>(null);

  useEffect(() => {
    if (userProfile?.uid) {
      getCaseHistory(userProfile.uid)
        .then(data => {
          setAllHistory(data.history);
        })
        .catch(err => console.error('Failed to load history:', err))
        .finally(() => setLoading(false));
    }
  }, [userProfile?.uid]);

  const filteredHistory = allHistory.filter(entry => {
    switch (filter) {
      case 'correct':
        return entry.wasCorrect;
      case 'incorrect':
        return !entry.wasCorrect;
      case 'blitz':
        return entry.mode === 'blitz';
      case 'standard':
        return entry.mode === 'standard';
      default:
        return true;
    }
  });

  const stats = {
    total: allHistory.length,
    correct: allHistory.filter(e => e.wasCorrect).length,
    incorrect: allHistory.filter(e => !e.wasCorrect).length,
    blitz: allHistory.filter(e => e.mode === 'blitz').length,
    standard: allHistory.filter(e => e.mode === 'standard').length
  };

  return (
    <div className="past-cases-page">
      <header className="past-cases-header">
        <div className="past-cases-header-left">
          <button className="btn btn-outline btn-back" onClick={onBack}>
            &larr; Dashboard
          </button>
          <h1>Past Cases</h1>
        </div>
        <div className="past-cases-stats">
          <span className="stat-pill">{stats.total} Total</span>
          <span className="stat-pill correct">{stats.correct} Correct</span>
          <span className="stat-pill incorrect">{stats.incorrect} Incorrect</span>
        </div>
      </header>

      <div className="past-cases-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({stats.total})
        </button>
        <button
          className={`filter-btn ${filter === 'correct' ? 'active' : ''}`}
          onClick={() => setFilter('correct')}
        >
          Correct ({stats.correct})
        </button>
        <button
          className={`filter-btn ${filter === 'incorrect' ? 'active' : ''}`}
          onClick={() => setFilter('incorrect')}
        >
          Incorrect ({stats.incorrect})
        </button>
        <button
          className={`filter-btn ${filter === 'blitz' ? 'active' : ''}`}
          onClick={() => setFilter('blitz')}
        >
          Blitz ({stats.blitz})
        </button>
        <button
          className={`filter-btn ${filter === 'standard' ? 'active' : ''}`}
          onClick={() => setFilter('standard')}
        >
          Standard ({stats.standard})
        </button>
      </div>

      {loading ? (
        <div className="past-cases-loading">Loading cases...</div>
      ) : filteredHistory.length === 0 ? (
        <div className="past-cases-empty">
          <p>No cases found{filter !== 'all' ? ` matching "${filter}" filter` : ''}.</p>
        </div>
      ) : (
        <div className="past-cases-list">
          {filteredHistory.map((entry, index) => (
            <div
              key={index}
              className="past-case-card"
              onClick={() => setSelectedCase(entry)}
            >
              <div className="past-case-left">
                <div className={`past-case-result ${entry.wasCorrect ? 'correct' : entry.timedOut ? 'timeout' : 'incorrect'}`}>
                  {entry.wasCorrect ? '✓' : entry.timedOut ? '⏱' : '✗'}
                </div>
                <div className="past-case-info">
                  <div className="past-case-diagnosis">
                    {entry.wasCorrect ? (
                      <span className="diagnosis-text">{entry.correctDiagnosis}</span>
                    ) : (
                      <>
                        <span className="submitted-diagnosis">
                          {entry.timedOut ? 'Timeout' : entry.submittedDiagnosis}
                        </span>
                        <span className="arrow">→</span>
                        <span className="correct-diagnosis">{entry.correctDiagnosis}</span>
                      </>
                    )}
                  </div>
                  <div className="past-case-tags">
                    <span className="domain-tag">{entry.domain}</span>
                    <span className={`mode-tag ${entry.mode}`}>
                      {entry.mode === 'blitz' ? '⚡ Blitz' : 'Standard'}
                    </span>
                    <span className="stats-tag">
                      {entry.questionCount}Q • {entry.testsOrdered}T • {entry.examsPerformed}E
                    </span>
                  </div>
                </div>
              </div>
              <div className="past-case-right">
                <div className="past-case-grade" style={{ backgroundColor: getGradeColor(entry.grade) }}>
                  <span className="grade-letter">{entry.grade}</span>
                  <span className="grade-score">{entry.finalScore}</span>
                </div>
                <div className="past-case-date">{formatDate(entry.completedAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

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
