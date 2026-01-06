import type { GameMode } from '../types';
import './GameModeSelector.css';

interface GameModeSelectorProps {
  isOpen: boolean;
  onSelectMode: (mode: GameMode) => void;
  onClose: () => void;
}

export function GameModeSelector({ isOpen, onSelectMode, onClose }: GameModeSelectorProps) {
  if (!isOpen) return null;

  return (
    <div className="mode-selector-overlay" onClick={onClose}>
      <div className="mode-selector-modal" onClick={(e) => e.stopPropagation()}>
        <button className="mode-selector-close" onClick={onClose}>
          &times;
        </button>
        <h2 className="mode-selector-title">Choose Game Mode</h2>

        <div className="mode-options">
          <button
            className="mode-option mode-standard"
            onClick={() => onSelectMode('standard')}
          >
            <div className="mode-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div className="mode-info">
              <h3>Standard Mode</h3>
              <span className="mode-badge recommended">Recommended for new players</span>
              <p>Take your time to carefully investigate the case. No time pressure - focus on learning and accuracy.</p>
            </div>
          </button>

          <button
            className="mode-option mode-blitz"
            onClick={() => onSelectMode('blitz')}
          >
            <div className="mode-icon blitz-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div className="mode-info">
              <h3>Blitz Mode</h3>
              <span className="mode-badge blitz">2 minute time limit</span>
              <p>Race against the clock! Make quick decisions under pressure. Can you diagnose in time?</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
