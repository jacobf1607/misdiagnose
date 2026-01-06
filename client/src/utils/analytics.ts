/**
 * Analytics Utility
 *
 * Lightweight analytics tracking for MVP experimentation.
 * Tracks user behavior, engagement, and learning metrics.
 *
 * Identity hierarchy:
 * - userId: Firebase UID (logged-in users only)
 * - deviceId: Persistent across sessions (localStorage)
 * - sessionId: Single browser session (sessionStorage)
 */

// Storage keys
const DEVICE_ID_KEY = 'dg_device_id';
const SESSION_ID_KEY = 'dg_session_id';
const SESSION_START_KEY = 'dg_session_start';
const CASES_THIS_SESSION_KEY = 'dg_cases_session';

// Event types for type safety
export type AnalyticsEventType =
  // Session events
  | 'session_start'
  | 'session_end'

  // Navigation
  | 'page_view'
  | 'dashboard_view'
  | 'past_cases_view'

  // Game lifecycle
  | 'game_mode_selector_open'
  | 'game_mode_selected'
  | 'case_start'
  | 'case_abandon'
  | 'case_complete'
  | 'case_timeout'

  // In-game actions
  | 'message_sent'
  | 'test_ordered'
  | 'exam_performed'
  | 'diagnosis_submitted'

  // Post-game
  | 'coaching_view_start'
  | 'coaching_view_end'
  | 'coaching_section_view'
  | 'case_review_view'

  // Social
  | 'challenge_create'
  | 'challenge_share'
  | 'challenge_start'
  | 'challenge_complete'

  // Feedback
  | 'feedback_prompt_shown'
  | 'feedback_rating_click'
  | 'feedback_submit'
  | 'feedback_skip'
  | 'feedback_dismiss_forever'

  // Auth
  | 'signup_start'
  | 'signup_complete'
  | 'login'
  | 'logout'
  | 'guest_continue';

// Identity interface
interface Identity {
  userId: string | null;
  deviceId: string;
  sessionId: string;
  isGuest: boolean;
}

// Event interface
interface AnalyticsEvent {
  eventType: AnalyticsEventType;
  eventData: Record<string, unknown>;
  identity: Identity;
  context: {
    sessionStartTime: number;
    eventsThisSession: number;
    casesThisSession: number;
    gameId?: string;
    caseId?: string;
  };
  timestamp: number;
  userAgent: string;
  screenSize: string;
  referrer: string;
  url: string;
}

// Generate UUID v4
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Get or create device ID (persists across sessions)
function getDeviceId(): string {
  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = generateUUID();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch {
    // localStorage might be blocked
    return 'unknown-device';
  }
}

// Get or create session ID (single browser session)
function getSessionId(): string {
  try {
    let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
    if (!sessionId) {
      sessionId = generateUUID();
      sessionStorage.setItem(SESSION_ID_KEY, sessionId);
    }
    return sessionId;
  } catch {
    return 'unknown-session';
  }
}

// Get session start time
function getSessionStartTime(): number {
  try {
    const stored = sessionStorage.getItem(SESSION_START_KEY);
    if (stored) {
      return parseInt(stored, 10);
    }
    const now = Date.now();
    sessionStorage.setItem(SESSION_START_KEY, now.toString());
    return now;
  } catch {
    return Date.now();
  }
}

// Get cases this session
function getCasesThisSession(): number {
  try {
    const stored = sessionStorage.getItem(CASES_THIS_SESSION_KEY);
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

// Increment cases this session
function incrementCasesThisSession(): number {
  try {
    const current = getCasesThisSession();
    const newCount = current + 1;
    sessionStorage.setItem(CASES_THIS_SESSION_KEY, newCount.toString());
    return newCount;
  } catch {
    return 0;
  }
}

class Analytics {
  private eventCount: number = 0;
  private userId: string | null = null;
  private currentGameId: string | null = null;
  private currentCaseId: string | null = null;
  private initialized: boolean = false;
  private queue: AnalyticsEvent[] = [];
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Initialize on first use
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private init() {
    if (this.initialized) return;
    this.initialized = true;

    // Check if this is a new session
    const existingSession = sessionStorage.getItem(SESSION_ID_KEY);
    if (!existingSession) {
      // New session - track session start
      this.track('session_start', {
        referrer: document.referrer,
        entryUrl: window.location.href,
        entryPath: window.location.pathname
      });
    }

    // Track session end on page unload
    window.addEventListener('beforeunload', () => this.endSession());

    // Also track on visibility change (mobile)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });
  }

  /**
   * Set the current user ID (call when user logs in)
   */
  setUserId(userId: string | null) {
    this.userId = userId;
    if (userId) {
      this.track('login', { method: 'firebase' });
    }
  }

  /**
   * Set current game context
   */
  setGameContext(gameId: string | null, caseId: string | null) {
    this.currentGameId = gameId;
    this.currentCaseId = caseId;
  }

  /**
   * Clear game context (call when game ends)
   */
  clearGameContext() {
    this.currentGameId = null;
    this.currentCaseId = null;
  }

  /**
   * Get current identity
   */
  private getIdentity(): Identity {
    return {
      userId: this.userId,
      deviceId: getDeviceId(),
      sessionId: getSessionId(),
      isGuest: !this.userId
    };
  }

  /**
   * Track an event
   */
  track(eventType: AnalyticsEventType, eventData: Record<string, unknown> = {}) {
    if (typeof window === 'undefined') return;

    this.eventCount++;

    const event: AnalyticsEvent = {
      eventType,
      eventData,
      identity: this.getIdentity(),
      context: {
        sessionStartTime: getSessionStartTime(),
        eventsThisSession: this.eventCount,
        casesThisSession: getCasesThisSession(),
        gameId: this.currentGameId || undefined,
        caseId: this.currentCaseId || undefined
      },
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      screenSize: `${window.innerWidth}x${window.innerHeight}`,
      referrer: document.referrer,
      url: window.location.href
    };

    this.queue.push(event);
    this.scheduleFlush();
  }

  /**
   * Track case start (convenience method)
   */
  trackCaseStart(caseId: string, gameId: string, mode: 'blitz' | 'standard', isChallenge: boolean = false) {
    incrementCasesThisSession();
    this.setGameContext(gameId, caseId);
    this.track('case_start', {
      caseId,
      gameId,
      mode,
      isChallenge,
      caseNumber: getCasesThisSession()
    });
  }

  /**
   * Track case completion (convenience method)
   */
  trackCaseComplete(data: {
    caseId: string;
    gameId: string;
    score: number;
    grade: string;
    duration: number;
    wasCorrect: boolean;
    mode: 'blitz' | 'standard';
    testsOrdered: number;
    examsPerformed: number;
    messagesSent: number;
    correctDiagnosis: string;
    submittedDiagnosis: string;
  }) {
    this.track('case_complete', data);
    this.clearGameContext();
  }

  /**
   * Track case abandon (convenience method)
   */
  trackCaseAbandon(data: {
    caseId: string;
    gameId: string;
    phase: 'chat' | 'tests' | 'diagnosis';
    timeSpent: number;
    reason?: string;
  }) {
    this.track('case_abandon', data);
    this.clearGameContext();
  }

  /**
   * Schedule a flush (batch events for efficiency)
   */
  private scheduleFlush() {
    if (this.flushTimeout) return;

    this.flushTimeout = setTimeout(() => {
      this.flush();
    }, 1000); // Batch events every 1 second
  }

  /**
   * Flush queued events to server
   */
  private flush() {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    if (this.queue.length === 0) return;

    const events = [...this.queue];
    this.queue = [];

    // Use sendBeacon for reliability on page unload
    const useBeacon = document.visibilityState === 'hidden';

    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/telemetry/events',
        JSON.stringify({ events })
      );
    } else {
      fetch('/api/telemetry/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
        keepalive: true
      }).catch(() => {
        // Silent fail - analytics should not disrupt user experience
      });
    }
  }

  /**
   * End session tracking
   */
  private endSession() {
    const sessionDuration = Date.now() - getSessionStartTime();

    this.track('session_end', {
      duration: sessionDuration,
      totalEvents: this.eventCount,
      totalCases: getCasesThisSession()
    });

    this.flush();
  }

  /**
   * Link guest data to user on signup
   */
  async linkGuestToUser(newUserId: string) {
    const deviceId = getDeviceId();
    const sessionId = getSessionId();

    try {
      await fetch('/api/telemetry/link-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newUserId,
          deviceId,
          sessionId
        })
      });
    } catch {
      // Silent fail
    }
  }
}

// Singleton instance
export const analytics = new Analytics();

// Export helper for getting device ID (useful for other purposes)
export { getDeviceId, getSessionId };
