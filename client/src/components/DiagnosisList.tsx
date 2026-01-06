import { useState } from 'react';
import type { Diagnosis } from '../types';
import './DiagnosisList.css';

interface DiagnosisListProps {
  diagnoses: Diagnosis[];
  onSubmitDiagnosis: (diagnosisId: string) => void;
  disabled: boolean;
  questionCount: number;
}

export function DiagnosisList({
  diagnoses,
  onSubmitDiagnosis,
  disabled,
  questionCount
}: DiagnosisListProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSelect = (id: string) => {
    if (disabled) return;
    setSelectedId(id);
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    if (selectedId) {
      onSubmitDiagnosis(selectedId);
    }
  };

  const handleCancel = () => {
    setSelectedId(null);
    setShowConfirm(false);
  };

  return (
    <div className="diagnosis-list card">
      <div className="diagnosis-header">
        <h3 className="diagnosis-title">Possible Diagnoses</h3>
        <span className="question-count">{questionCount} questions asked</span>
      </div>

      <p className="diagnosis-instruction">
        When you're ready, select your diagnosis:
      </p>

      <div className="diagnosis-items">
        {diagnoses.map((diagnosis) => (
          <button
            key={diagnosis.id}
            className={`diagnosis-item ${selectedId === diagnosis.id ? 'selected' : ''}`}
            onClick={() => handleSelect(diagnosis.id)}
            disabled={disabled}
          >
            <span className="diagnosis-name">{diagnosis.name}</span>
            <span className="diagnosis-desc">{diagnosis.description}</span>
          </button>
        ))}
      </div>

      {showConfirm && selectedId && (
        <div className="confirm-dialog">
          <p>
            Submit <strong>{diagnoses.find(d => d.id === selectedId)?.name}</strong> as your final diagnosis?
          </p>
          <div className="confirm-actions">
            <button className="btn btn-outline" onClick={handleCancel}>
              Cancel
            </button>
            <button className="btn btn-warning" onClick={handleConfirm}>
              Confirm Diagnosis
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
