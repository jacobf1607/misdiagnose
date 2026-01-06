import { useState, useEffect, useRef, useCallback } from 'react';
import './BlitzTimer.css';

// Blitz mode time limit (must match server constant)
const BLITZ_TIME_LIMIT_MS = 120000; // 2 minutes

interface BlitzTimerProps {
  startTime: number;
  onTimeout: () => void;
  isPaused?: boolean;
}

// Time thresholds for color changes
const YELLOW_THRESHOLD = 60000;  // 1 minute remaining
const ORANGE_THRESHOLD = 30000;  // 30 seconds remaining
const RED_THRESHOLD = 10000;     // 10 seconds remaining

// Sound effect URLs (using Web Audio API for generated sounds)
function createBeepSound(frequency: number, duration: number, volume: number = 0.3): () => void {
  return () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
      // Audio not supported or blocked
    }
  };
}

const playWarningBeep = createBeepSound(800, 0.15, 0.2);
const playUrgentBeep = createBeepSound(1000, 0.1, 0.3);
const playTimeoutSound = createBeepSound(400, 0.5, 0.4);

export function BlitzTimer({ startTime, onTimeout, isPaused = false }: BlitzTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(BLITZ_TIME_LIMIT_MS);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const lastSecondRef = useRef<number>(-1);
  const hasPlayedWarningRef = useRef(false);

  const formatTime = useCallback((ms: number): string => {
    if (ms <= 0) return '0:00';
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    if (isPaused || hasTimedOut) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, BLITZ_TIME_LIMIT_MS - elapsed);
      setTimeRemaining(remaining);

      // Calculate current second for beep timing
      const currentSecond = Math.ceil(remaining / 1000);

      // Play warning sound when hitting 30 seconds
      if (remaining <= ORANGE_THRESHOLD && remaining > ORANGE_THRESHOLD - 1000 && !hasPlayedWarningRef.current) {
        playWarningBeep();
        hasPlayedWarningRef.current = true;
      }

      // Play urgent beeps in last 10 seconds (once per second)
      if (remaining <= RED_THRESHOLD && remaining > 0 && currentSecond !== lastSecondRef.current) {
        playUrgentBeep();
        lastSecondRef.current = currentSecond;
      }

      // Handle timeout
      if (remaining <= 0 && !hasTimedOut) {
        setHasTimedOut(true);
        playTimeoutSound();
        onTimeout();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [startTime, onTimeout, isPaused, hasTimedOut]);

  // Reset when game changes
  useEffect(() => {
    setHasTimedOut(false);
    hasPlayedWarningRef.current = false;
    lastSecondRef.current = -1;
  }, [startTime]);

  // Determine timer color class
  const getTimerClass = (): string => {
    if (timeRemaining <= RED_THRESHOLD) return 'timer-red';
    if (timeRemaining <= ORANGE_THRESHOLD) return 'timer-orange';
    if (timeRemaining <= YELLOW_THRESHOLD) return 'timer-yellow';
    return 'timer-green';
  };

  // Calculate progress percentage
  const progressPercent = (timeRemaining / BLITZ_TIME_LIMIT_MS) * 100;

  return (
    <div className={`blitz-timer ${getTimerClass()} ${isPaused ? 'paused' : ''}`}>
      <div className="timer-content">
        <svg className="timer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        <span className="timer-text">{formatTime(timeRemaining)}</span>
      </div>
      <div className="timer-progress-bar">
        <div
          className="timer-progress-fill"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
