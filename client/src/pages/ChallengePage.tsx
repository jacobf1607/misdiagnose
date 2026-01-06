/**
 * Challenge Landing Page
 * Shows challenge details and allows user to accept/start the challenge
 * Displays leaderboard of all responses
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../services/api';
import type { Challenge, ChallengeResponse, Case } from '../types';
import './ChallengePage.css';

interface ChallengePageProps {
  challengeId: string;
  onAcceptChallenge: (caseData: Case, challenge: Challenge) => void;
  onBackToDashboard: () => void;
}

// Grade colors
const gradeColors: Record<string, { bg: string; text: string }> = {
  'S': { bg: '#fef3c7', text: '#92400e' },
  'A': { bg: '#dcfce7', text: '#166534' },
  'B': { bg: '#dbeafe', text: '#1e40af' },
  'C': { bg: '#e0e7ff', text: '#3730a3' },
  'D': { bg: '#fee2e2', text: '#991b1b' },
  'F': { bg: '#fecaca', text: '#7f1d1d' }
};

export function ChallengePage({ challengeId, onAcceptChallenge, onBackToDashboard }: ChallengePageProps) {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [userResponse, setUserResponse] = useState<ChallengeResponse | null>(null);
  const [alreadyPlayed, setAlreadyPlayed] = useState<{
    grade: string;
    score: number;
    beatChallenger: boolean;
  } | null>(null);
  const [starting, setStarting] = useState(false);

  // Fetch challenge info
  useEffect(() => {
    async function fetchChallenge() {
      setLoading(true);
      setError(null);

      try {
        const url = userProfile
          ? `${API_BASE}/challenge/${challengeId}?userId=${userProfile.uid}`
          : `${API_BASE}/challenge/${challengeId}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load challenge');
        }

        setChallenge(data.challenge);
        setUserResponse(data.userResponse || null);
        setAlreadyPlayed(data.alreadyPlayed || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load challenge');
      } finally {
        setLoading(false);
      }
    }

    fetchChallenge();
  }, [challengeId, userProfile]);

  // Start playing the challenge
  const handleAccept = async () => {
    if (!challenge) return;

    setStarting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/challenge/${challengeId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userProfile?.uid })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start challenge');
      }

      onAcceptChallenge(data.caseData, data.challenge);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start challenge');
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="challenge-page">
        <div className="challenge-loading">
          <div className="loading-spinner"></div>
          <p>Loading challenge...</p>
        </div>
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div className="challenge-page">
        <div className="challenge-error">
          <div className="error-icon">!</div>
          <h2>Challenge Not Found</h2>
          <p>{error || 'This challenge does not exist or has been removed.'}</p>
          <button className="btn btn-primary" onClick={onBackToDashboard}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Challenge expired
  if (challenge.status === 'expired') {
    return (
      <div className="challenge-page">
        <div className="challenge-expired">
          <div className="expired-icon">⏰</div>
          <h2>Challenge Expired</h2>
          <p>This challenge from {challenge.challengerName} has expired.</p>
          <p className="expired-hint">Challenges are valid for 7 days after creation.</p>
          {challenge.responses.length > 0 && (
            <div className="expired-leaderboard">
              <h3>Final Leaderboard</h3>
              <Leaderboard challenge={challenge} currentUserId={userProfile?.uid} />
            </div>
          )}
          <button className="btn btn-primary" onClick={onBackToDashboard}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // User already responded to this challenge
  if (userResponse) {
    const yourStyle = gradeColors[userResponse.respondentGrade];
    const challengerStyle = gradeColors[challenge.challengerGrade];

    return (
      <div className="challenge-page">
        <div className="challenge-already-played">
          <h2>Challenge Complete!</h2>
          <div className="result-announcement">
            {userResponse.result === 'win' ? (
              <p className="result-text win">You beat {challenge.challengerName}!</p>
            ) : userResponse.result === 'tie' ? (
              <p className="result-text tie">It's a tie!</p>
            ) : (
              <p className="result-text lose">{challenge.challengerName} won!</p>
            )}
          </div>

          <div className="already-result">
            <div className="your-result">
              <span className="result-label">Your Score</span>
              <div className="grade-badge large" style={{ backgroundColor: yourStyle.bg, color: yourStyle.text }}>
                {userResponse.respondentGrade}
              </div>
              <span className="result-score">{userResponse.respondentScore}</span>
            </div>
            <div className="vs-divider">vs</div>
            <div className="their-result">
              <span className="result-label">{challenge.challengerName}</span>
              <div className="grade-badge large" style={{ backgroundColor: challengerStyle.bg, color: challengerStyle.text }}>
                {challenge.challengerGrade}
              </div>
              <span className="result-score">{challenge.challengerScore}</span>
            </div>
          </div>

          {challenge.responses.length > 1 && (
            <div className="leaderboard-section">
              <h3>Leaderboard ({challenge.responses.length} players)</h3>
              <Leaderboard challenge={challenge} currentUserId={userProfile?.uid} />
            </div>
          )}

          <button className="btn btn-primary" onClick={onBackToDashboard}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // User already played this case (not via this challenge)
  if (alreadyPlayed) {
    const alreadyStyle = gradeColors[alreadyPlayed.grade];
    const challengerStyle = gradeColors[challenge.challengerGrade];

    return (
      <div className="challenge-page">
        <div className="challenge-already-played">
          <h2>You've Already Played This Case!</h2>
          <div className="already-result">
            <div className="your-result">
              <span className="result-label">Your Score</span>
              <div className="grade-badge large" style={{ backgroundColor: alreadyStyle.bg, color: alreadyStyle.text }}>
                {alreadyPlayed.grade}
              </div>
              <span className="result-score">{alreadyPlayed.score}</span>
            </div>
            <div className="vs-divider">vs</div>
            <div className="their-result">
              <span className="result-label">{challenge.challengerName}</span>
              <div className="grade-badge large" style={{ backgroundColor: challengerStyle.bg, color: challengerStyle.text }}>
                {challenge.challengerGrade}
              </div>
              <span className="result-score">{challenge.challengerScore}</span>
            </div>
          </div>
          <div className="already-verdict">
            {alreadyPlayed.beatChallenger ? (
              <p className="verdict win">You already beat {challenge.challengerName}!</p>
            ) : alreadyPlayed.score === challenge.challengerScore ? (
              <p className="verdict tie">It's a tie!</p>
            ) : (
              <p className="verdict lose">{challenge.challengerName} scored higher.</p>
            )}
          </div>

          {challenge.responses.length > 0 && (
            <div className="leaderboard-section">
              <h3>Leaderboard ({challenge.responses.length} players)</h3>
              <Leaderboard challenge={challenge} currentUserId={userProfile?.uid} />
            </div>
          )}

          <button className="btn btn-primary" onClick={onBackToDashboard}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Show challenge invitation
  const gradeStyle = gradeColors[challenge.challengerGrade];

  return (
    <div className="challenge-page">
      <div className="challenge-card">
        <div className="challenge-header">
          <div className="challenge-icon">🎯</div>
          <h1>You've Been Challenged!</h1>
        </div>

        <div className="challenger-info">
          <p className="challenger-name">{challenge.challengerName}</p>
          <p className="challenger-text">scored</p>
          <div className="challenger-grade" style={{ backgroundColor: gradeStyle.bg, color: gradeStyle.text }}>
            {challenge.challengerGrade}
          </div>
          <p className="challenger-text">on a</p>
          <p className="case-domain">{challenge.caseDomain}</p>
          <p className="challenger-text">case</p>
          {challenge.gameMode === 'blitz' && (
            <div className="challenge-mode-badge blitz">BLITZ MODE</div>
          )}
        </div>

        <div className="challenge-taunt">
          <p>Think you can do better?</p>
        </div>

        {challenge.responses.length > 0 && (
          <div className="leaderboard-preview">
            <p className="leaderboard-preview-text">
              {challenge.responses.length} {challenge.responses.length === 1 ? 'person has' : 'people have'} already taken this challenge
            </p>
            <Leaderboard challenge={challenge} currentUserId={userProfile?.uid} />
          </div>
        )}

        <div className="challenge-actions">
          <button
            className="btn btn-primary btn-large accept-btn"
            onClick={handleAccept}
            disabled={starting}
          >
            {starting ? 'Starting...' : 'Accept Challenge'}
          </button>
          <button
            className="btn btn-outline"
            onClick={onBackToDashboard}
            disabled={starting}
          >
            Maybe Later
          </button>
        </div>

        {error && <p className="challenge-error-msg">{error}</p>}
      </div>
    </div>
  );
}

// Leaderboard component
interface LeaderboardProps {
  challenge: Challenge;
  currentUserId?: string;
}

function Leaderboard({ challenge, currentUserId }: LeaderboardProps) {
  // Create entries for challenger and all respondents
  const entries = [
    {
      name: challenge.challengerName,
      grade: challenge.challengerGrade,
      score: challenge.challengerScore,
      isChallenger: true,
      isCurrentUser: currentUserId === challenge.challengerId
    },
    ...challenge.responses.map(r => ({
      name: r.respondentName,
      grade: r.respondentGrade,
      score: r.respondentScore,
      isChallenger: false,
      isCurrentUser: currentUserId === r.respondentUserId
    }))
  ];

  // Sort by score descending
  entries.sort((a, b) => b.score - a.score);

  return (
    <div className="leaderboard">
      {entries.map((entry, index) => {
        const gradeStyle = gradeColors[entry.grade];
        const position = index + 1;
        const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : null;

        return (
          <div
            key={`${entry.name}-${index}`}
            className={`leaderboard-entry ${entry.isCurrentUser ? 'is-you' : ''} ${entry.isChallenger ? 'is-challenger' : ''}`}
          >
            <span className="leaderboard-position">
              {medal || `#${position}`}
            </span>
            <span className="leaderboard-name">
              {entry.name}
              {entry.isChallenger && <span className="challenger-tag">(Challenger)</span>}
              {entry.isCurrentUser && <span className="you-tag">(You)</span>}
            </span>
            <div
              className="leaderboard-grade"
              style={{ backgroundColor: gradeStyle.bg, color: gradeStyle.text }}
            >
              {entry.grade}
            </div>
            <span className="leaderboard-score">{entry.score}</span>
          </div>
        );
      })}
    </div>
  );
}
