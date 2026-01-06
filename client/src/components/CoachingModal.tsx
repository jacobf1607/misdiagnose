import { useState } from 'react';
import type { CoachingFeedback, PathwayStep } from '../types';
import './CoachingModal.css';

interface CoachingModalProps {
  coaching: CoachingFeedback;
  onClose: () => void;
}

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

function PathwayStepCard({ step, wasMatched }: { step: PathwayStep; wasMatched: boolean }) {
  const [expanded, setExpanded] = useState(false);

  const importanceColors = {
    critical: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
    important: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
    helpful: { bg: '#f0fdf4', border: '#22c55e', text: '#166534' }
  };

  const colors = importanceColors[step.importance];

  return (
    <div
      className={`pathway-step ${wasMatched ? 'matched' : 'missed'}`}
      style={{ backgroundColor: colors.bg, borderLeftColor: colors.border }}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="step-header">
        <span className="step-order">#{step.order}</span>
        <span className="step-action">{step.action}</span>
        <span className="step-importance" style={{ color: colors.text }}>
          {step.importance.toUpperCase()}
        </span>
        {wasMatched && <span className="step-check">✓</span>}
        <span className="step-expand">{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div className="step-details">
          <ul className="step-details-list">
            <li>
              <span className="detail-label">Why:</span>
              <span className="detail-value">{step.reasoning}</span>
            </li>
            <li>
              <span className="detail-label">Expected Finding:</span>
              <span className="detail-value">{step.expectedFinding}</span>
            </li>
            <li>
              <span className="detail-label">Textbook:</span>
              <span className="detail-value detail-quote">"{step.textbookReference}"</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

export function CoachingModal({ coaching, onClose }: CoachingModalProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'pathway' | 'comparison' | 'learning'>('summary');

  const { idealPathway, comparison } = coaching;

  // Determine which steps were matched
  const matchedStepActions = new Set(
    comparison.correctActions.map(a => a.matchedStep.action)
  );

  return (
    <div className="modal-overlay">
      <div className="modal-content coaching-modal">
        {/* Header */}
        <div className="coaching-header">
          <div className="coaching-title-section">
            <h2 className="coaching-title">Coaching Feedback</h2>
            <div className="coaching-disease">{idealPathway.diseaseName}</div>
          </div>
          <button className="coaching-close" onClick={onClose}>×</button>
        </div>

        {/* Score Display */}
        <div className="coaching-score-bar">
          <div className="score-label">Pathway Adherence</div>
          <div className="score-track">
            <div
              className="score-fill"
              style={{
                width: `${comparison.pathwayScore}%`,
                backgroundColor: comparison.pathwayScore >= 70 ? '#22c55e' :
                  comparison.pathwayScore >= 40 ? '#f59e0b' : '#ef4444'
              }}
            />
          </div>
          <div className="score-value">{comparison.pathwayScore}%</div>
        </div>

        {/* Tabs */}
        <div className="coaching-tabs">
          <button
            className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            Summary
          </button>
          <button
            className={`tab ${activeTab === 'pathway' ? 'active' : ''}`}
            onClick={() => setActiveTab('pathway')}
          >
            Ideal Pathway
          </button>
          <button
            className={`tab ${activeTab === 'comparison' ? 'active' : ''}`}
            onClick={() => setActiveTab('comparison')}
          >
            Your Approach
          </button>
          <button
            className={`tab ${activeTab === 'learning' ? 'active' : ''}`}
            onClick={() => setActiveTab('learning')}
          >
            Key Learnings
          </button>
        </div>

        {/* Tab Content */}
        <div className="coaching-content">
          {activeTab === 'summary' && (
            <div className="tab-content summary-tab">
              <div className="coaching-summary">
                <FormattedText text={coaching.coachingSummary} />
              </div>

              {coaching.whatYouDidWell.length > 0 && (
                <div className="feedback-section strengths">
                  <h4>What You Did Well</h4>
                  <ul>
                    {coaching.whatYouDidWell.map((item, i) => (
                      <li key={i}><FormattedText text={item} /></li>
                    ))}
                  </ul>
                </div>
              )}

              {coaching.whatYouMissed.length > 0 && (
                <div className="feedback-section missed">
                  <h4>What You Missed</h4>
                  <ul>
                    {coaching.whatYouMissed.map((item, i) => (
                      <li key={i}><FormattedText text={item} /></li>
                    ))}
                  </ul>
                </div>
              )}

              {coaching.whatWasUnnecessary.length > 0 && (
                <div className="feedback-section unnecessary">
                  <h4>Unnecessary Actions</h4>
                  <ul>
                    {coaching.whatWasUnnecessary.map((item, i) => (
                      <li key={i}><FormattedText text={item} /></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === 'pathway' && (
            <div className="tab-content pathway-tab">
              <div className="pathway-intro">
                <p><strong>Diagnostic Approach:</strong> {idealPathway.diagnosticApproach}</p>
              </div>

              {/* History Questions */}
              <div className="pathway-section">
                <h4>Key History Questions</h4>
                {idealPathway.keyHistoryQuestions.map((step, i) => (
                  <PathwayStepCard
                    key={i}
                    step={step}
                    wasMatched={matchedStepActions.has(step.action)}
                  />
                ))}
              </div>

              {/* Examinations */}
              <div className="pathway-section">
                <h4>Key Physical Examinations</h4>
                {idealPathway.keyExaminations.map((step, i) => (
                  <PathwayStepCard
                    key={i}
                    step={step}
                    wasMatched={matchedStepActions.has(step.action)}
                  />
                ))}
              </div>

              {/* Investigations */}
              <div className="pathway-section">
                <h4>Key Investigations (Cost-Effective Order)</h4>
                {idealPathway.keyInvestigations.map((step, i) => (
                  <PathwayStepCard
                    key={i}
                    step={step}
                    wasMatched={matchedStepActions.has(step.action)}
                  />
                ))}
              </div>

              {/* Differentials */}
              {idealPathway.differentialDiagnoses.length > 0 && (
                <div className="pathway-section">
                  <h4>Key Differential Diagnoses</h4>
                  {idealPathway.differentialDiagnoses.map((diff, i) => (
                    <div key={i} className="differential-card">
                      <div className="diff-name">{diff.name}</div>
                      <div className="diff-rule-out">{diff.howToRuleOut}</div>
                      <div className="diff-reference">"{diff.textbookReference}"</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'comparison' && (
            <div className="tab-content comparison-tab">
              {/* Correct Actions */}
              <div className="comparison-section">
                <h4>Correct Actions ({comparison.correctActions.length})</h4>
                {comparison.correctActions.length === 0 ? (
                  <p className="no-items">No actions matched the ideal pathway</p>
                ) : (
                  <ul className="action-list">
                    {comparison.correctActions.map((action, i) => (
                      <li key={i} className="action-item correct">
                        <div className="action-header">
                          <span className="action-type-badge">{action.type}</span>
                          <span className="action-name">{action.action}</span>
                        </div>
                        <div className="action-feedback">{action.feedback}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Missed Steps */}
              <div className="comparison-section">
                <h4>Missed Steps ({comparison.missedSteps.length})</h4>
                {comparison.missedSteps.length === 0 ? (
                  <p className="no-items">You covered all key steps!</p>
                ) : (
                  <ul className="action-list">
                    {comparison.missedSteps.map((missed, i) => (
                      <li key={i} className="action-item missed">
                        <div className="action-header">
                          <span className="action-type-badge">{missed.step.type}</span>
                          <span className="action-name">{missed.step.action}</span>
                        </div>
                        <div className="action-details">
                          <span className="action-label">Why important:</span> {missed.whyImportant}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Unnecessary Actions */}
              <div className="comparison-section">
                <h4>Unnecessary Actions ({comparison.unnecessaryActions.length})</h4>
                {comparison.unnecessaryActions.length === 0 ? (
                  <p className="no-items">All your actions were relevant!</p>
                ) : (
                  <ul className="action-list">
                    {comparison.unnecessaryActions.map((action, i) => (
                      <li key={i} className="action-item unnecessary">
                        <div className="action-header">
                          <span className="action-type-badge">{action.type}</span>
                          <span className="action-name">{action.action}</span>
                        </div>
                        <div className="action-feedback">{action.feedback}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Ordering Issues */}
              {comparison.orderingIssues.length > 0 && (
                <div className="comparison-section">
                  <h4>Ordering Issues ({comparison.orderingIssues.length})</h4>
                  <ul className="action-list">
                    {comparison.orderingIssues.map((issue, i) => (
                      <li key={i} className="action-item ordering">
                        <div className="action-header">
                          <span className="action-name">{issue.action}</span>
                        </div>
                        <div className="action-feedback">{issue.feedback}</div>
                        <div className="order-comparison">
                          <span className="order-label">Ideal:</span> #{issue.idealOrder}
                          <span className="order-arrow">→</span>
                          <span className="order-label">Actual:</span> #{issue.actualOrder}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === 'learning' && (
            <div className="tab-content learning-tab">
              <div className="learning-section">
                <h4>Key Learning Points</h4>
                <ul className="learning-list">
                  {coaching.keyLearningPoints.map((point, i) => (
                    <li key={i}><FormattedText text={point} /></li>
                  ))}
                </ul>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="coaching-footer">
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
