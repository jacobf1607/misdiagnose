import './TurnTracker.css';

interface TurnTrackerProps {
  turnsUsed: number;
  maxTurns: number;
  turnsRemaining: number;
  score: number;
  status: 'in_progress' | 'won' | 'lost';
}

export function TurnTracker({
  turnsUsed,
  maxTurns,
  turnsRemaining,
  score,
  status
}: TurnTrackerProps) {
  const progress = (turnsUsed / maxTurns) * 100;
  const isLow = turnsRemaining <= 3;

  return (
    <div className="turn-tracker card">
      <div className="tracker-header">
        <div className="turn-info">
          <span className="turn-label">Turns</span>
          <span className={`turn-count ${isLow ? 'low' : ''}`}>
            {turnsRemaining} / {maxTurns}
          </span>
        </div>
        <div className="score-info">
          <span className="score-label">Score</span>
          <span className="score-count">{score}</span>
        </div>
      </div>

      <div className="progress-bar">
        <div
          className={`progress-fill ${isLow ? 'low' : ''}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {status !== 'in_progress' && (
        <div className={`status-badge ${status}`}>
          {status === 'won' ? 'Solved!' : 'Case Closed'}
        </div>
      )}
    </div>
  );
}
