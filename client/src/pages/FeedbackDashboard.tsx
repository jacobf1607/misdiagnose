import { useState, useEffect, useCallback } from 'react';
import type { FeedbackEntry, FeedbackStatus } from '../../../shared/types';
import * as api from '../services/api';
import './FeedbackDashboard.css';

interface FeedbackDashboardProps {
  onBack: () => void;
}

export function FeedbackDashboard({ onBack }: FeedbackDashboardProps) {
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FeedbackStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, unread: 0, important: 0, solved: 0, irrelevant: 0 });

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.getAllFeedback(filter === 'all' ? undefined : filter);
      setFeedback(response.feedback);

      const statsResponse = await api.getFeedbackStats();
      setStats(statsResponse.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const handleStatusChange = async (id: string, newStatus: FeedbackStatus) => {
    try {
      await api.updateFeedbackStatus(id, newStatus);
      await loadFeedback();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this feedback?')) return;

    try {
      await api.deleteFeedback(id);
      await loadFeedback();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete feedback');
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (status: FeedbackStatus) => {
    switch (status) {
      case 'unread': return 'status-unread';
      case 'important': return 'status-important';
      case 'solved': return 'status-solved';
      case 'irrelevant': return 'status-irrelevant';
    }
  };

  const getContextLabel = (context: string) => {
    switch (context) {
      case 'dashboard': return 'Dashboard';
      case 'during_case': return 'During Case';
      case 'after_case': return 'After Case';
      default: return context;
    }
  };

  return (
    <div className="feedback-dashboard">
      <header className="feedback-dashboard-header">
        <div className="feedback-header-left">
          <button className="btn btn-outline btn-back" onClick={onBack}>
            &larr; Back
          </button>
          <h1>Feedback Dashboard</h1>
        </div>
        <div className="feedback-stats">
          <span className="stat-badge stat-total">{stats.total} Total</span>
          <span className="stat-badge stat-unread">{stats.unread} Unread</span>
          <span className="stat-badge stat-important">{stats.important} Important</span>
          <span className="stat-badge stat-solved">{stats.solved} Solved</span>
        </div>
      </header>

      <div className="feedback-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
          onClick={() => setFilter('unread')}
        >
          Unread
        </button>
        <button
          className={`filter-btn ${filter === 'important' ? 'active' : ''}`}
          onClick={() => setFilter('important')}
        >
          Important
        </button>
        <button
          className={`filter-btn ${filter === 'solved' ? 'active' : ''}`}
          onClick={() => setFilter('solved')}
        >
          Solved
        </button>
        <button
          className={`filter-btn ${filter === 'irrelevant' ? 'active' : ''}`}
          onClick={() => setFilter('irrelevant')}
        >
          Irrelevant
        </button>
      </div>

      {error && (
        <div className="feedback-error-banner">
          {error}
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      {loading ? (
        <div className="feedback-loading">Loading feedback...</div>
      ) : feedback.length === 0 ? (
        <div className="feedback-empty">
          <p>No feedback found{filter !== 'all' ? ` with status "${filter}"` : ''}.</p>
        </div>
      ) : (
        <div className="feedback-list">
          {feedback.map(entry => (
            <div
              key={entry.id}
              className={`feedback-card ${getStatusColor(entry.status)} ${expandedId === entry.id ? 'expanded' : ''}`}
            >
              <div
                className="feedback-card-header"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                <div className="feedback-card-meta">
                  <span className={`status-badge ${getStatusColor(entry.status)}`}>
                    {entry.status.toUpperCase()}
                  </span>
                  <span className="context-badge">{getContextLabel(entry.context)}</span>
                  <span className="feedback-date">{formatDate(entry.createdAt)}</span>
                </div>
                <div className="feedback-preview">
                  {entry.feedbackText.substring(0, 100)}
                  {entry.feedbackText.length > 100 ? '...' : ''}
                </div>
                <div className="feedback-expand-icon">
                  {expandedId === entry.id ? '▼' : '▶'}
                </div>
              </div>

              {expandedId === entry.id && (
                <div className="feedback-card-body">
                  <div className="feedback-full-text">
                    <h4>Feedback</h4>
                    <p>{entry.feedbackText}</p>
                  </div>

                  {entry.userEmail && (
                    <div className="feedback-user-info">
                      <strong>User:</strong> {entry.userEmail}
                      {entry.isTestUser && <span className="test-user-badge">Test User</span>}
                    </div>
                  )}

                  {entry.caseSnapshot && (
                    <div className="feedback-case-details">
                      <h4>Case Details</h4>
                      <div className="case-info-grid">
                        <div><strong>Case ID:</strong> {entry.caseSnapshot.caseId}</div>
                        <div><strong>Domain:</strong> {entry.caseSnapshot.domain}</div>
                        <div><strong>Correct Diagnosis:</strong> {entry.caseSnapshot.correctDiagnosis}</div>
                        {entry.caseSnapshot.submittedDiagnosis && (
                          <div><strong>Submitted:</strong> {entry.caseSnapshot.submittedDiagnosis}</div>
                        )}
                        <div>
                          <strong>Result:</strong>{' '}
                          <span className={entry.caseSnapshot.wasCorrect ? 'correct' : 'incorrect'}>
                            {entry.caseSnapshot.wasCorrect ? 'Correct' : 'Incorrect'}
                          </span>
                          {entry.caseSnapshot.score !== undefined && ` (${entry.caseSnapshot.score}/100)`}
                        </div>
                        <div><strong>Questions:</strong> {entry.caseSnapshot.questionsAsked}</div>
                        <div><strong>Tests:</strong> {entry.caseSnapshot.testsOrdered}</div>
                        <div><strong>Exams:</strong> {entry.caseSnapshot.examsPerformed}</div>
                        <div><strong>Time:</strong> {entry.caseSnapshot.timeElapsedMinutes} min</div>
                      </div>

                      {entry.caseSnapshot.chatHistory && entry.caseSnapshot.chatHistory.length > 0 && (
                        <div className="case-chat-history">
                          <h5>Chat History</h5>
                          <div className="chat-history-list">
                            {entry.caseSnapshot.chatHistory.map((msg, i) => (
                              <div key={i} className={`chat-msg ${msg.role}`}>
                                <span className="chat-role">{msg.role === 'player' ? 'Doctor' : 'Patient'}:</span>
                                <span className="chat-content">{msg.content}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {entry.caseSnapshot.testResults && entry.caseSnapshot.testResults.length > 0 && (
                        <div className="case-test-results">
                          <h5>Test Results</h5>
                          <ul>
                            {entry.caseSnapshot.testResults.map((t, i) => (
                              <li key={i} className={t.isAbnormal ? 'abnormal' : ''}>
                                <strong>{t.name}:</strong> {t.result}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {entry.caseSnapshot.examResults && entry.caseSnapshot.examResults.length > 0 && (
                        <div className="case-exam-results">
                          <h5>Exam Findings</h5>
                          <ul>
                            {entry.caseSnapshot.examResults.map((e, i) => (
                              <li key={i} className={e.isAbnormal ? 'abnormal' : ''}>
                                <strong>{e.name}:</strong> {e.finding}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="feedback-actions">
                    <div className="status-buttons">
                      <button
                        className={`status-btn btn-important ${entry.status === 'important' ? 'active' : ''}`}
                        onClick={() => handleStatusChange(entry.id, 'important')}
                      >
                        Important
                      </button>
                      <button
                        className={`status-btn btn-solved ${entry.status === 'solved' ? 'active' : ''}`}
                        onClick={() => handleStatusChange(entry.id, 'solved')}
                      >
                        Solved
                      </button>
                      <button
                        className={`status-btn btn-irrelevant ${entry.status === 'irrelevant' ? 'active' : ''}`}
                        onClick={() => handleStatusChange(entry.id, 'irrelevant')}
                      >
                        Irrelevant
                      </button>
                      {entry.status !== 'unread' && (
                        <button
                          className="status-btn btn-unread"
                          onClick={() => handleStatusChange(entry.id, 'unread')}
                        >
                          Mark Unread
                        </button>
                      )}
                    </div>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(entry.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
