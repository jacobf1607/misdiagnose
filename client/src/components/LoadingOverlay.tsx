import './LoadingOverlay.css';

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = 'Generating new case...' }: LoadingOverlayProps) {
  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="loading-spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        <p className="loading-message">{message}</p>
        <p className="loading-submessage">Creating patient profile and medical history...</p>
      </div>
    </div>
  );
}
