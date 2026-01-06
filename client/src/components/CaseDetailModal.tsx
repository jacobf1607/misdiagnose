import { useState } from 'react';
import type { CaseHistoryEntry } from '../types';
import './CaseDetailModal.css';

interface CaseDetailModalProps {
  entry: CaseHistoryEntry;
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'conversation' | 'tests' | 'exams';

// Parse markdown bold (**text**) to React elements
function renderMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

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

export function CaseDetailModal({ entry, isOpen, onClose }: CaseDetailModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('conversation');

  if (!isOpen) return null;

  // Check if we have any detailed data (persona, scoreBreakdown, etc.)
  const hasDetailedData = !!(entry.persona || entry.scoreBreakdown || entry.chatHistory);

  return (
    <div className="case-detail-overlay" onClick={onClose}>
      <div className="case-detail-modal" onClick={e => e.stopPropagation()}>
        <div className="case-detail-header">
          <h2>Case Review</h2>
          <button className="case-detail-close" onClick={onClose}>&times;</button>
        </div>

        {/* Single scrollable content area */}
        <div className="case-detail-scroll">
          {/* Summary Section */}
          <div className="case-detail-summary">
            <div className="case-patient-info">
              {entry.persona ? (
                <span className="patient-name">
                  {entry.persona.name}, {entry.persona.age}{entry.persona.gender?.[0]?.toUpperCase()}
                </span>
              ) : (
                <span className="patient-name">Patient Case</span>
              )}
              <span className="case-date">{formatDate(entry.completedAt)}</span>
            </div>

            <div className="case-result-row">
              <div className="case-grade" style={{ backgroundColor: getGradeColor(entry.grade) }}>
                <span className="grade-letter">{entry.grade}</span>
                <span className="grade-score">{entry.finalScore}</span>
              </div>
              <div className={`case-result-badge ${entry.wasCorrect ? 'correct' : entry.timedOut ? 'timeout' : 'incorrect'}`}>
                {entry.wasCorrect ? '✓ Correct' : entry.timedOut ? '⏱ Timeout' : '✗ Incorrect'}
              </div>
            </div>

            <div className="case-meta-row">
              <span className="case-domain">{entry.domain}</span>
              <span className={`case-mode ${entry.mode}`}>
                {entry.mode === 'blitz' ? '⚡ Blitz' : 'Standard'}
              </span>
              <span className="case-stats">
                {entry.questionCount} questions • {entry.testsOrdered} tests • {entry.examsPerformed} exams
              </span>
            </div>

            {/* Diagnosis Summary with Descriptions */}
            <div className="diagnosis-summary">
              <div className="diagnosis-box correct-diagnosis">
                <div className="diagnosis-label">✓ Correct Diagnosis</div>
                <div className="diagnosis-name">{entry.correctDiagnosis}</div>
                {entry.diagnosisExplanation?.description && (
                  <div className="diagnosis-description">{renderMarkdown(entry.diagnosisExplanation.description)}</div>
                )}
              </div>

              {!entry.wasCorrect && !entry.timedOut && (
                <div className="diagnosis-box wrong-diagnosis">
                  <div className="diagnosis-label">✗ Your Answer</div>
                  <div className="diagnosis-name">{entry.submittedDiagnosis}</div>
                  {entry.incorrectExplanation?.whyIncorrect && (
                    <div className="diagnosis-description">{renderMarkdown(entry.incorrectExplanation.whyIncorrect)}</div>
                  )}
                </div>
              )}

              {entry.timedOut && (
                <div className="diagnosis-box timeout-diagnosis">
                  <div className="diagnosis-label">⏱ Timeout</div>
                  <div className="diagnosis-name">No diagnosis submitted</div>
                  <div className="diagnosis-description">Time ran out before you could submit a diagnosis.</div>
                </div>
              )}
            </div>
          </div>

          {hasDetailedData && (
            <>
              {/* Tabs for conversation/tests/exams */}
              <div className="case-detail-tabs">
                <button
                  className={`case-tab ${activeTab === 'conversation' ? 'active' : ''}`}
                  onClick={() => setActiveTab('conversation')}
                >
                  Conversation ({entry.chatHistory?.length || 0})
                </button>
                <button
                  className={`case-tab ${activeTab === 'tests' ? 'active' : ''}`}
                  onClick={() => setActiveTab('tests')}
                >
                  Tests ({entry.testResults?.length || 0})
                </button>
                <button
                  className={`case-tab ${activeTab === 'exams' ? 'active' : ''}`}
                  onClick={() => setActiveTab('exams')}
                >
                  Exams ({entry.examResults?.length || 0})
                </button>
              </div>

              <div className="case-detail-content">
                {activeTab === 'conversation' && (
                  <div className="conversation-list">
                    {entry.initialComplaint && (
                      <div className="conversation-initial">
                        <strong>Chief Complaint:</strong> {entry.initialComplaint}
                      </div>
                    )}
                    {entry.chatHistory && entry.chatHistory.length > 0 ? (
                      entry.chatHistory.map((msg, i) => (
                        <div key={i} className={`conversation-msg ${msg.role}`}>
                          <span className="msg-role">
                            {msg.role === 'player' ? '👤 Doctor' : '🏥 Patient'}:
                          </span>
                          <span className="msg-content">{msg.content}</span>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">No questions were asked during this case</div>
                    )}
                  </div>
                )}

                {activeTab === 'tests' && (
                  <div className="tests-list">
                    {entry.testResults && entry.testResults.length > 0 ? (
                      entry.testResults.map((test, i) => (
                        <div key={i} className={`test-item ${test.isAbnormal ? 'abnormal' : ''}`}>
                          <span className="test-name">{test.name}</span>
                          <span className="test-result">{test.result}</span>
                          {test.isAbnormal && <span className="abnormal-badge">Abnormal</span>}
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">No tests ordered</div>
                    )}
                  </div>
                )}

                {activeTab === 'exams' && (
                  <div className="exams-list">
                    {entry.examResults && entry.examResults.length > 0 ? (
                      entry.examResults.map((exam, i) => (
                        <div key={i} className={`exam-item ${exam.isAbnormal ? 'abnormal' : ''}`}>
                          <span className="exam-name">{exam.name}</span>
                          <span className="exam-finding">{exam.finding}</span>
                          {exam.isAbnormal && <span className="abnormal-badge">Abnormal</span>}
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">No exams performed</div>
                    )}
                  </div>
                )}
              </div>

              {/* Coaching Section - All in one scrollable area */}
              {entry.scoreBreakdown && (
                <div className="coaching-section-wrapper">
                  <h3 className="coaching-title">📊 Performance & Coaching</h3>

                  {/* Score Breakdown */}
                  <div className="score-breakdown">
                    <div className="score-row">
                      <span className="score-label">Accuracy</span>
                      <div className="score-bar">
                        <div className="score-fill" style={{ width: `${(entry.scoreBreakdown.accuracy / 40) * 100}%` }} />
                      </div>
                      <span className="score-value">{entry.scoreBreakdown.accuracy}/40</span>
                    </div>
                    <div className="score-row">
                      <span className="score-label">Efficiency</span>
                      <div className="score-bar">
                        <div className="score-fill" style={{ width: `${(entry.scoreBreakdown.efficiency / 15) * 100}%` }} />
                      </div>
                      <span className="score-value">{entry.scoreBreakdown.efficiency}/15</span>
                    </div>
                    <div className="score-row">
                      <span className="score-label">Reasoning</span>
                      <div className="score-bar">
                        <div className="score-fill" style={{ width: `${(entry.scoreBreakdown.clinicalReasoning / 15) * 100}%` }} />
                      </div>
                      <span className="score-value">{entry.scoreBreakdown.clinicalReasoning}/15</span>
                    </div>
                    <div className="score-row">
                      <span className="score-label">Test Economy</span>
                      <div className="score-bar">
                        <div className="score-fill" style={{ width: `${(entry.scoreBreakdown.testEconomy / 20) * 100}%` }} />
                      </div>
                      <span className="score-value">{entry.scoreBreakdown.testEconomy}/20</span>
                    </div>
                    <div className="score-row">
                      <span className="score-label">Time</span>
                      <div className="score-bar">
                        <div className="score-fill" style={{ width: `${(entry.scoreBreakdown.time / 10) * 100}%` }} />
                      </div>
                      <span className="score-value">{entry.scoreBreakdown.time}/10</span>
                    </div>
                  </div>

                  {/* Strengths */}
                  {entry.scoreBreakdown.strengths && entry.scoreBreakdown.strengths.length > 0 && (
                    <div className="coaching-card strengths">
                      <h4>✅ Strengths</h4>
                      <ul>
                        {entry.scoreBreakdown.strengths.map((s, i) => (
                          <li key={i}>{renderMarkdown(s)}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Areas for Improvement */}
                  {entry.scoreBreakdown.areasForImprovement && entry.scoreBreakdown.areasForImprovement.length > 0 && (
                    <div className="coaching-card improvements">
                      <h4>🔶 Areas for Improvement</h4>
                      <ul>
                        {entry.scoreBreakdown.areasForImprovement.map((a, i) => (
                          <li key={i}>{renderMarkdown(a)}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Why Incorrect */}
                  {entry.incorrectExplanation && (
                    <div className="coaching-card why-incorrect">
                      <h4>❌ Why Your Answer Was Incorrect</h4>
                      {entry.incorrectExplanation.keyDifferences && entry.incorrectExplanation.keyDifferences.length > 0 && (
                        <>
                          <p className="section-label">Key Differences:</p>
                          <ul>
                            {entry.incorrectExplanation.keyDifferences.map((d, i) => (
                              <li key={i}>{renderMarkdown(d)}</li>
                            ))}
                          </ul>
                        </>
                      )}
                      {entry.incorrectExplanation.missingFindings && entry.incorrectExplanation.missingFindings.length > 0 && (
                        <>
                          <p className="section-label">Missing Findings:</p>
                          <ul>
                            {entry.incorrectExplanation.missingFindings.map((f, i) => (
                              <li key={i}>{renderMarkdown(f)}</li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}

                  {/* How to Diagnose This Condition */}
                  {entry.diagnosisExplanation && (
                    <div className="coaching-card how-to-diagnose">
                      <h4>📖 How to Diagnose: {entry.correctDiagnosis}</h4>

                      {entry.diagnosisExplanation.keySymptoms && entry.diagnosisExplanation.keySymptoms.length > 0 && (
                        <>
                          <p className="section-label">Key Symptoms to Look For:</p>
                          <ul>
                            {entry.diagnosisExplanation.keySymptoms.map((s, i) => (
                              <li key={i}>{renderMarkdown(s)}</li>
                            ))}
                          </ul>
                        </>
                      )}

                      {entry.diagnosisExplanation.clinicalReasoning && (
                        <>
                          <p className="section-label">Clinical Reasoning:</p>
                          <p className="clinical-reasoning">{renderMarkdown(entry.diagnosisExplanation.clinicalReasoning)}</p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {!hasDetailedData && (
            <div className="no-detailed-data">
              <p>Detailed case data is not available for this case.</p>
              <p className="hint">Cases played before this feature was added only have summary data.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
