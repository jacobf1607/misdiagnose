import { useState, useEffect } from 'react';
import type { ExamResult, ValidationError } from '../types';
import './ExaminationPanel.css';

interface ExaminationPanelProps {
  examResults: ExamResult[];
  onPerformExam: (examName: string) => Promise<void>;
  onPerformBatchExams?: (freeText: string) => Promise<ValidationError[]>;
  disabled: boolean;
  isMobile?: boolean;
}

const AVAILABLE_EXAMS = [
  { category: 'Vital Signs', exams: [
    'Heart Rate',
    'Blood Pressure',
    'Respiratory Rate',
    'Temperature',
    'Oxygen Saturation (SpO2)',
  ]},
  { category: 'General Inspection', exams: [
    'General Appearance',
    'General Physical Examination (PICCLE)',
    'Skin Examination',
    'Lymph Node Examination',
  ]},
  { category: 'Cardiovascular', exams: [
    'Heart Auscultation',
    'Peripheral Pulses',
    'Jugular Venous Pressure (JVP)',
    'Capillary Refill Time',
  ]},
  { category: 'Respiratory', exams: [
    'Lung Auscultation',
    'Chest Percussion',
    'Chest Expansion',
    'Breathing Pattern',
  ]},
  { category: 'Abdominal', exams: [
    'Abdominal Inspection',
    'Abdominal Palpation',
    'Abdominal Percussion',
    'Bowel Sounds',
    'Liver Palpation',
    'Spleen Palpation',
  ]},
  { category: 'Neurological', exams: [
    'Pupil Response',
    'Reflexes',
    'Motor Strength',
    'Sensory Examination',
    'Cranial Nerves',
  ]},
  { category: 'Musculoskeletal', exams: [
    'Joint Examination',
    'Range of Motion',
    'Muscle Tenderness',
  ]},
];

export function ExaminationPanel({ examResults, onPerformExam, onPerformBatchExams, disabled, isMobile = false }: ExaminationPanelProps) {
  const [selectedExams, setSelectedExams] = useState<string[]>([]);
  const [isExamining, setIsExamining] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Vital Signs');
  const [customInput, setCustomInput] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [showExamList, setShowExamList] = useState(false);
  const [showFindings, setShowFindings] = useState(true);

  // Detect mobile via screen width (not affected by DevTools) - start false, detect on mount
  const [detectMobile, setDetectMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window === 'undefined') return false;
      const width = window.screen?.width || window.innerWidth;
      return width <= 768;
    };
    setDetectMobile(checkMobile()); // Set on mount
    const handleResize = () => setDetectMobile(checkMobile());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobileView = isMobile || detectMobile;

  const toggleExamSelection = (exam: string) => {
    setSelectedExams(prev =>
      prev.includes(exam)
        ? prev.filter(e => e !== exam)
        : [...prev, exam]
    );
  };

  const clearSelection = () => {
    setSelectedExams([]);
  };

  const handlePerformExams = async () => {
    if (selectedExams.length === 0 || disabled || isExamining) return;

    setIsExamining(true);
    try {
      for (const exam of selectedExams) {
        await onPerformExam(exam);
      }
      setSelectedExams([]);
    } finally {
      setIsExamining(false);
    }
  };

  const handleBatchExam = async () => {
    if (!customInput.trim() || disabled || isProcessingBatch || !onPerformBatchExams) return;

    setIsProcessingBatch(true);
    setValidationErrors([]);
    try {
      const errors = await onPerformBatchExams(customInput);
      setValidationErrors(errors);
      if (errors.length === 0) {
        setCustomInput('');
      }
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const performedExamNames = examResults.map(e => e.examName);

  // Mobile layout
  if (isMobileView) {
    return (
      <div className="examination-panel mobile-exam-panel">
        {/* Select Exams Button */}
        <button
          className="btn btn-primary mobile-select-btn"
          onClick={() => setShowExamList(!showExamList)}
        >
          <span>{showExamList ? '−' : '+'}</span>
          Select Exams
          {selectedExams.length > 0 && <span className="selected-count">{selectedExams.length}</span>}
        </button>

        {/* Collapsible Exam List */}
        {showExamList && (
          <div className="mobile-exam-list">
            <div className="exam-categories">
              {AVAILABLE_EXAMS.map(category => (
                <div key={category.category} className="exam-category">
                  <button
                    className={`category-header ${expandedCategory === category.category ? 'expanded' : ''}`}
                    onClick={() => setExpandedCategory(
                      expandedCategory === category.category ? null : category.category
                    )}
                  >
                    {category.category}
                    <span className="expand-icon">{expandedCategory === category.category ? '−' : '+'}</span>
                  </button>

                  {expandedCategory === category.category && (
                    <div className="exam-list">
                      {category.exams.map(exam => {
                        const isPerformed = performedExamNames.includes(exam);
                        const isSelected = selectedExams.includes(exam);
                        return (
                          <button
                            key={exam}
                            className={`exam-option ${isSelected ? 'selected' : ''} ${isPerformed ? 'performed' : ''}`}
                            onClick={() => !isPerformed && toggleExamSelection(exam)}
                            disabled={isPerformed || disabled}
                          >
                            {exam}
                            {isPerformed && <span className="performed-badge">Done</span>}
                            {isSelected && !isPerformed && <span className="selected-badge">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="action-buttons">
              <button
                className="btn btn-warning perform-btn"
                onClick={() => { handlePerformExams(); setShowExamList(false); }}
                disabled={selectedExams.length === 0 || disabled || isExamining}
              >
                {isExamining ? 'Examining...' : `Perform ${selectedExams.length === 0 ? 'Examination' : `${selectedExams.length} Exam${selectedExams.length > 1 ? 's' : ''}`}`}
              </button>
              {selectedExams.length > 0 && (
                <button
                  className="btn btn-outline clear-btn"
                  onClick={clearSelection}
                  disabled={disabled || isExamining}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Custom Exam Input */}
        {onPerformBatchExams && (
          <div className="mobile-custom-section">
            <div className="custom-order-divider">
              <span>Or type your own</span>
            </div>
            <textarea
              className="custom-order-input"
              placeholder="Type exams here, one per line"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              disabled={disabled || isProcessingBatch}
              rows={2}
            />
            <button
              className="btn btn-warning perform-btn"
              onClick={handleBatchExam}
              disabled={!customInput.trim() || disabled || isProcessingBatch}
            >
              {isProcessingBatch ? 'Processing...' : 'Perform Custom Exams'}
            </button>

            {validationErrors.length > 0 && (
              <div className="validation-errors">
                {validationErrors.map((error, idx) => (
                  <div key={idx} className="validation-error">
                    <span className="error-input">"{error.input}"</span>
                    <span className="error-message">{error.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Collapsible Findings */}
        <div className="mobile-findings-section">
          <button
            className="findings-toggle"
            onClick={() => setShowFindings(!showFindings)}
          >
            <span className="toggle-icon">{showFindings ? '−' : '+'}</span>
            Exam Findings ({examResults.length})
          </button>

          {showFindings && (
            <div className="findings-content">
              {examResults.length === 0 ? (
                <p className="no-results">No exams performed yet.</p>
              ) : (
                <div className="results-list">
                  {examResults.map(result => (
                    <div key={result.id} className={`result-card ${result.isAbnormal ? 'abnormal' : 'normal'}`}>
                      <div className="result-header">
                        <span className="result-name">{result.examName}</span>
                        <span className={`result-badge ${result.isAbnormal ? 'abnormal' : 'normal'}`}>
                          {result.isAbnormal ? 'Abnormal' : 'Normal'}
                        </span>
                      </div>
                      <div className="result-content">
                        {result.finding}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="examination-panel">
      <div className="exam-order-section">
        <h3>Physical Examination</h3>

        <div className="exam-categories">
          {AVAILABLE_EXAMS.map(category => (
            <div key={category.category} className="exam-category">
              <button
                className={`category-header ${expandedCategory === category.category ? 'expanded' : ''}`}
                onClick={() => setExpandedCategory(
                  expandedCategory === category.category ? null : category.category
                )}
              >
                {category.category}
                <span className="expand-icon">{expandedCategory === category.category ? '−' : '+'}</span>
              </button>

              {expandedCategory === category.category && (
                <div className="exam-list">
                  {category.exams.map(exam => {
                    const isPerformed = performedExamNames.includes(exam);
                    const isSelected = selectedExams.includes(exam);
                    return (
                      <button
                        key={exam}
                        className={`exam-option ${isSelected ? 'selected' : ''} ${isPerformed ? 'performed' : ''}`}
                        onClick={() => !isPerformed && toggleExamSelection(exam)}
                        disabled={isPerformed || disabled}
                      >
                        {exam}
                        {isPerformed && <span className="performed-badge">Done</span>}
                        {isSelected && !isPerformed && <span className="selected-badge">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="action-buttons">
          <button
            className="btn btn-warning perform-btn"
            onClick={handlePerformExams}
            disabled={selectedExams.length === 0 || disabled || isExamining}
          >
            {isExamining ? 'Examining...' : `Perform ${selectedExams.length === 0 ? 'Examination' : `${selectedExams.length} Exam${selectedExams.length > 1 ? 's' : ''}`}`}
          </button>
          {selectedExams.length > 0 && (
            <button
              className="btn btn-outline clear-btn"
              onClick={clearSelection}
              disabled={disabled || isExamining}
            >
              Clear
            </button>
          )}
        </div>

        {onPerformBatchExams && (
          <div className="custom-order-section">
            <div className="custom-order-divider">
              <span>Or type your own</span>
            </div>
            <textarea
              className="custom-order-input"
              placeholder="Type exams here, one per line&#10;e.g. heart sounds&#10;     check lungs&#10;     bp"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              disabled={disabled || isProcessingBatch}
              rows={3}
            />
            <button
              className="btn btn-warning perform-btn"
              onClick={handleBatchExam}
              disabled={!customInput.trim() || disabled || isProcessingBatch}
            >
              {isProcessingBatch ? 'Processing...' : 'Perform Custom Exams'}
            </button>

            {validationErrors.length > 0 && (
              <div className="validation-errors">
                {validationErrors.map((error, idx) => (
                  <div key={idx} className="validation-error">
                    <span className="error-input">"{error.input}"</span>
                    <span className="error-message">{error.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="exam-results-section">
        <h3>Examination Findings ({examResults.length})</h3>

        {examResults.length === 0 ? (
          <p className="no-results">No examinations performed yet. Select an exam above.</p>
        ) : (
          <div className="results-list">
            {examResults.map(result => (
              <div key={result.id} className={`result-card ${result.isAbnormal ? 'abnormal' : 'normal'}`}>
                <div className="result-header">
                  <span className="result-name">{result.examName}</span>
                  <span className={`result-badge ${result.isAbnormal ? 'abnormal' : 'normal'}`}>
                    {result.isAbnormal ? 'Abnormal' : 'Normal'}
                  </span>
                </div>
                <div className="result-content">
                  {result.finding}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
