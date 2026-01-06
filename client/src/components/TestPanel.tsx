import { useState, useEffect } from 'react';
import type { TestResult, ValidationError } from '../../../shared/types';
import './TestPanel.css';

interface TestPanelProps {
  testResults: TestResult[];
  onOrderTest: (testName: string) => Promise<void>;
  onOrderBatchTests?: (freeText: string) => Promise<ValidationError[]>;
  disabled: boolean;
  isMobile?: boolean;
}

const AVAILABLE_TESTS = [
  { category: 'Blood Tests', tests: [
    'Complete Blood Count (CBC)',
    'Basic Metabolic Panel (BMP)',
    'Comprehensive Metabolic Panel (CMP)',
    'Liver Function Tests (LFTs)',
    'Thyroid Panel (TSH, T3, T4)',
    'Lipid Panel',
    'Hemoglobin A1C',
    'Cardiac Enzymes (Troponin)',
    'D-Dimer',
    'Prothrombin Time (PT/INR)',
    'Erythrocyte Sedimentation Rate (ESR)',
    'C-Reactive Protein (CRP)',
  ]},
  { category: 'Imaging', tests: [
    'Chest X-Ray',
    'Abdominal X-Ray',
    'CT Scan - Head',
    'CT Scan - Chest',
    'CT Scan - Abdomen/Pelvis',
    'MRI - Brain',
    'MRI - Spine',
    'Ultrasound - Abdominal',
    'Echocardiogram',
    'Doppler Ultrasound',
  ]},
  { category: 'Other Tests', tests: [
    'Electrocardiogram (ECG/EKG)',
    'Urinalysis',
    'Urine Culture',
    'Blood Culture',
    'Stool Sample',
    'Lumbar Puncture',
    'Pulmonary Function Test',
    'Stress Test',
    'Endoscopy',
    'Colonoscopy',
  ]},
];

export function TestPanel({ testResults, onOrderTest, onOrderBatchTests, disabled, isMobile = false }: TestPanelProps) {
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [isOrdering, setIsOrdering] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Blood Tests');
  const [customInput, setCustomInput] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [showTestList, setShowTestList] = useState(false);
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

  const toggleTestSelection = (test: string) => {
    setSelectedTests(prev =>
      prev.includes(test)
        ? prev.filter(t => t !== test)
        : [...prev, test]
    );
  };

  const clearSelection = () => {
    setSelectedTests([]);
  };

  const handleOrderTests = async () => {
    if (selectedTests.length === 0 || disabled || isOrdering) return;

    setIsOrdering(true);
    try {
      for (const test of selectedTests) {
        await onOrderTest(test);
      }
      setSelectedTests([]);
    } finally {
      setIsOrdering(false);
    }
  };

  const handleBatchOrder = async () => {
    if (!customInput.trim() || disabled || isProcessingBatch || !onOrderBatchTests) return;

    setIsProcessingBatch(true);
    setValidationErrors([]);
    try {
      const errors = await onOrderBatchTests(customInput);
      setValidationErrors(errors);
      if (errors.length === 0) {
        setCustomInput('');
      }
    } finally {
      setIsProcessingBatch(false);
    }
  };

  const orderedTestNames = testResults.map(t => t.testName);

  // Mobile layout
  if (isMobileView) {
    return (
      <div className="test-panel mobile-test-panel">
        {/* Select Tests Button */}
        <button
          className="btn btn-primary mobile-select-btn"
          onClick={() => setShowTestList(!showTestList)}
        >
          <span>{showTestList ? '−' : '+'}</span>
          Select Tests
          {selectedTests.length > 0 && <span className="selected-count">{selectedTests.length}</span>}
        </button>

        {/* Collapsible Test List */}
        {showTestList && (
          <div className="mobile-test-list">
            <div className="test-categories">
              {AVAILABLE_TESTS.map(category => (
                <div key={category.category} className="test-category">
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
                    <div className="test-list">
                      {category.tests.map(test => {
                        const isOrdered = orderedTestNames.includes(test);
                        const isSelected = selectedTests.includes(test);
                        return (
                          <button
                            key={test}
                            className={`test-option ${isSelected ? 'selected' : ''} ${isOrdered ? 'ordered' : ''}`}
                            onClick={() => !isOrdered && toggleTestSelection(test)}
                            disabled={isOrdered || disabled}
                          >
                            {test}
                            {isOrdered && <span className="ordered-badge">Done</span>}
                            {isSelected && !isOrdered && <span className="selected-badge">✓</span>}
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
                className="btn btn-warning order-btn"
                onClick={() => { handleOrderTests(); setShowTestList(false); }}
                disabled={selectedTests.length === 0 || disabled || isOrdering}
              >
                {isOrdering ? 'Ordering...' : `Order ${selectedTests.length === 0 ? 'Tests' : `${selectedTests.length} Test${selectedTests.length > 1 ? 's' : ''}`}`}
              </button>
              {selectedTests.length > 0 && (
                <button
                  className="btn btn-outline clear-btn"
                  onClick={clearSelection}
                  disabled={disabled || isOrdering}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Custom Test Input */}
        {onOrderBatchTests && (
          <div className="mobile-custom-section">
            <div className="custom-order-divider">
              <span>Or type your own</span>
            </div>
            <textarea
              className="custom-order-input"
              placeholder="Type tests here, one per line"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              disabled={disabled || isProcessingBatch}
              rows={2}
            />
            <button
              className="btn btn-warning order-btn"
              onClick={handleBatchOrder}
              disabled={!customInput.trim() || disabled || isProcessingBatch}
            >
              {isProcessingBatch ? 'Processing...' : 'Order Custom Tests'}
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
            Test Results ({testResults.length})
          </button>

          {showFindings && (
            <div className="findings-content">
              {testResults.length === 0 ? (
                <p className="no-results">No tests ordered yet.</p>
              ) : (
                <div className="results-list">
                  {testResults.map(result => (
                    <div key={result.id} className={`result-card ${result.isAbnormal ? 'abnormal' : 'normal'}`}>
                      <div className="result-header">
                        <span className="result-name">{result.testName}</span>
                        <span className={`result-badge ${result.isAbnormal ? 'abnormal' : 'normal'}`}>
                          {result.isAbnormal ? 'Abnormal' : 'Normal'}
                        </span>
                      </div>
                      <div className="result-content">
                        {result.result}
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
    <div className="test-panel">
      <div className="test-order-section">
        <h3>Order Tests & Scans</h3>

        <div className="test-categories">
          {AVAILABLE_TESTS.map(category => (
            <div key={category.category} className="test-category">
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
                <div className="test-list">
                  {category.tests.map(test => {
                    const isOrdered = orderedTestNames.includes(test);
                    const isSelected = selectedTests.includes(test);
                    return (
                      <button
                        key={test}
                        className={`test-option ${isSelected ? 'selected' : ''} ${isOrdered ? 'ordered' : ''}`}
                        onClick={() => !isOrdered && toggleTestSelection(test)}
                        disabled={isOrdered || disabled}
                      >
                        {test}
                        {isOrdered && <span className="ordered-badge">Done</span>}
                        {isSelected && !isOrdered && <span className="selected-badge">✓</span>}
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
            className="btn btn-warning order-btn"
            onClick={handleOrderTests}
            disabled={selectedTests.length === 0 || disabled || isOrdering}
          >
            {isOrdering ? 'Ordering...' : `Order ${selectedTests.length === 0 ? 'Tests' : `${selectedTests.length} Test${selectedTests.length > 1 ? 's' : ''}`}`}
          </button>
          {selectedTests.length > 0 && (
            <button
              className="btn btn-outline clear-btn"
              onClick={clearSelection}
              disabled={disabled || isOrdering}
            >
              Clear
            </button>
          )}
        </div>

        {onOrderBatchTests && (
          <div className="custom-order-section">
            <div className="custom-order-divider">
              <span>Or type your own</span>
            </div>
            <textarea
              className="custom-order-input"
              placeholder="Type tests here, one per line&#10;e.g. cbc&#10;     chest xray&#10;     blood sugar"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              disabled={disabled || isProcessingBatch}
              rows={3}
            />
            <button
              className="btn btn-warning order-btn"
              onClick={handleBatchOrder}
              disabled={!customInput.trim() || disabled || isProcessingBatch}
            >
              {isProcessingBatch ? 'Processing...' : 'Order Custom Tests'}
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

      <div className="test-results-section">
        <h3>Test Results ({testResults.length})</h3>

        {testResults.length === 0 ? (
          <p className="no-results">No tests ordered yet. Select a test above to order.</p>
        ) : (
          <div className="results-list">
            {testResults.map(result => (
              <div key={result.id} className={`result-card ${result.isAbnormal ? 'abnormal' : 'normal'}`}>
                <div className="result-header">
                  <span className="result-name">{result.testName}</span>
                  <span className={`result-badge ${result.isAbnormal ? 'abnormal' : 'normal'}`}>
                    {result.isAbnormal ? 'Abnormal' : 'Normal'}
                  </span>
                </div>
                <div className="result-content">
                  {result.result}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
