/**
 * Analytics Service
 *
 * Handles storage and retrieval of analytics events.
 * Uses JSON file storage for MVP (2-3 users).
 */

import fs from 'fs';
import path from 'path';

// Data directory
const DATA_DIR = path.join(__dirname, '../data');
const ANALYTICS_DIR = path.join(DATA_DIR, 'analytics');
const EVENTS_FILE = path.join(ANALYTICS_DIR, 'events.json');
const DAILY_DIR = path.join(ANALYTICS_DIR, 'daily');

// Event interface (matches client)
export interface AnalyticsEvent {
  id: string;
  eventType: string;
  eventData: Record<string, unknown>;
  identity: {
    userId: string | null;
    deviceId: string;
    sessionId: string;
    isGuest: boolean;
  };
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
  serverTimestamp: number;
}

// Events storage structure
interface EventsStore {
  events: AnalyticsEvent[];
  lastUpdated: number;
}

// Daily summary structure
export interface DailySummary {
  date: string;
  totalEvents: number;
  uniqueDevices: number;
  uniqueUsers: number;
  totalSessions: number;
  totalCasesStarted: number;
  totalCasesCompleted: number;
  avgSessionDuration: number;
  avgCasesPerSession: number;
  modeBreakdown: { blitz: number; standard: number };
  coachingViews: number;
  eventCounts: Record<string, number>;
}

// Ensure directories exist
function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ANALYTICS_DIR)) {
    fs.mkdirSync(ANALYTICS_DIR, { recursive: true });
  }
  if (!fs.existsSync(DAILY_DIR)) {
    fs.mkdirSync(DAILY_DIR, { recursive: true });
  }
}

// Load events store
function loadEventsStore(): EventsStore {
  ensureDirectories();

  if (!fs.existsSync(EVENTS_FILE)) {
    return { events: [], lastUpdated: Date.now() };
  }

  try {
    const data = fs.readFileSync(EVENTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load events store:', err);
    return { events: [], lastUpdated: Date.now() };
  }
}

// Save events store
function saveEventsStore(store: EventsStore) {
  ensureDirectories();

  try {
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(store, null, 2));
  } catch (err) {
    console.error('Failed to save events store:', err);
  }
}

// Generate event ID
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Store analytics events
 */
export function storeEvents(events: Omit<AnalyticsEvent, 'id' | 'serverTimestamp'>[]): void {
  const store = loadEventsStore();

  const newEvents: AnalyticsEvent[] = events.map(event => ({
    ...event,
    id: generateEventId(),
    serverTimestamp: Date.now()
  }));

  store.events.push(...newEvents);
  store.lastUpdated = Date.now();

  saveEventsStore(store);

  // Log for debugging during MVP
  console.log(`[Analytics] Stored ${newEvents.length} events. Total: ${store.events.length}`);
}

/**
 * Get all events (for analysis)
 */
export function getAllEvents(): AnalyticsEvent[] {
  const store = loadEventsStore();
  return store.events;
}

/**
 * Get events by device ID
 */
export function getEventsByDevice(deviceId: string): AnalyticsEvent[] {
  const store = loadEventsStore();
  return store.events.filter(e => e.identity.deviceId === deviceId);
}

/**
 * Get events by user ID
 */
export function getEventsByUser(userId: string): AnalyticsEvent[] {
  const store = loadEventsStore();
  return store.events.filter(e => e.identity.userId === userId);
}

/**
 * Get events by session ID
 */
export function getEventsBySession(sessionId: string): AnalyticsEvent[] {
  const store = loadEventsStore();
  return store.events.filter(e => e.identity.sessionId === sessionId);
}

/**
 * Get events by date range
 */
export function getEventsByDateRange(startTime: number, endTime: number): AnalyticsEvent[] {
  const store = loadEventsStore();
  return store.events.filter(e => e.timestamp >= startTime && e.timestamp <= endTime);
}

/**
 * Get events by type
 */
export function getEventsByType(eventType: string): AnalyticsEvent[] {
  const store = loadEventsStore();
  return store.events.filter(e => e.eventType === eventType);
}

/**
 * Link guest events to user (call on signup)
 */
export function linkGuestToUser(deviceId: string, newUserId: string): number {
  const store = loadEventsStore();
  let linkedCount = 0;

  store.events = store.events.map(event => {
    if (event.identity.deviceId === deviceId && event.identity.isGuest) {
      linkedCount++;
      return {
        ...event,
        identity: {
          ...event.identity,
          userId: newUserId,
          isGuest: false
        }
      };
    }
    return event;
  });

  if (linkedCount > 0) {
    store.lastUpdated = Date.now();
    saveEventsStore(store);
    console.log(`[Analytics] Linked ${linkedCount} guest events to user ${newUserId}`);
  }

  return linkedCount;
}

/**
 * Generate daily summary
 */
export function generateDailySummary(dateStr?: string): DailySummary {
  const targetDate = dateStr || new Date().toISOString().split('T')[0];
  const dayStart = new Date(targetDate).getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;

  const events = getEventsByDateRange(dayStart, dayEnd);

  const uniqueDevices = new Set(events.map(e => e.identity.deviceId));
  const uniqueUsers = new Set(events.filter(e => e.identity.userId).map(e => e.identity.userId));
  const uniqueSessions = new Set(events.map(e => e.identity.sessionId));

  const sessionStarts = events.filter(e => e.eventType === 'session_start');
  const sessionEnds = events.filter(e => e.eventType === 'session_end');
  const caseStarts = events.filter(e => e.eventType === 'case_start');
  const caseCompletes = events.filter(e => e.eventType === 'case_complete');

  // Calculate avg session duration from session_end events
  const sessionDurations = sessionEnds
    .map(e => (e.eventData as { duration?: number }).duration)
    .filter((d): d is number => typeof d === 'number');
  const avgSessionDuration = sessionDurations.length > 0
    ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length
    : 0;

  // Calculate cases per session
  const casesPerSession = sessionEnds
    .map(e => (e.eventData as { totalCases?: number }).totalCases)
    .filter((c): c is number => typeof c === 'number');
  const avgCasesPerSession = casesPerSession.length > 0
    ? casesPerSession.reduce((a, b) => a + b, 0) / casesPerSession.length
    : 0;

  // Mode breakdown
  const blitzCases = caseStarts.filter(e => (e.eventData as { mode?: string }).mode === 'blitz').length;
  const standardCases = caseStarts.filter(e => (e.eventData as { mode?: string }).mode === 'standard').length;

  // Coaching views
  const coachingViews = events.filter(e => e.eventType === 'coaching_view_start').length;

  // Event counts
  const eventCounts: Record<string, number> = {};
  events.forEach(e => {
    eventCounts[e.eventType] = (eventCounts[e.eventType] || 0) + 1;
  });

  const summary: DailySummary = {
    date: targetDate,
    totalEvents: events.length,
    uniqueDevices: uniqueDevices.size,
    uniqueUsers: uniqueUsers.size,
    totalSessions: Math.max(sessionStarts.length, uniqueSessions.size),
    totalCasesStarted: caseStarts.length,
    totalCasesCompleted: caseCompletes.length,
    avgSessionDuration,
    avgCasesPerSession,
    modeBreakdown: { blitz: blitzCases, standard: standardCases },
    coachingViews,
    eventCounts
  };

  // Save daily summary
  const summaryFile = path.join(DAILY_DIR, `${targetDate}.json`);
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

  return summary;
}

/**
 * Get user metrics
 */
export function getUserMetrics(identifier: string, isUserId: boolean = true): {
  firstSeen: number;
  lastSeen: number;
  totalSessions: number;
  totalCasesPlayed: number;
  totalCasesCompleted: number;
  avgScore: number;
  scores: number[];
  preferredMode: 'blitz' | 'standard' | 'mixed';
  coachingViewRate: number;
} | null {
  const events = isUserId
    ? getEventsByUser(identifier)
    : getEventsByDevice(identifier);

  if (events.length === 0) return null;

  const timestamps = events.map(e => e.timestamp);
  const sessions = new Set(events.map(e => e.identity.sessionId));
  const caseStarts = events.filter(e => e.eventType === 'case_start');
  const caseCompletes = events.filter(e => e.eventType === 'case_complete');
  const coachingViews = events.filter(e => e.eventType === 'coaching_view_start');

  const scores = caseCompletes
    .map(e => (e.eventData as { score?: number }).score)
    .filter((s): s is number => typeof s === 'number');
  const avgScore = scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 0;

  const blitzCount = caseStarts.filter(e => (e.eventData as { mode?: string }).mode === 'blitz').length;
  const standardCount = caseStarts.filter(e => (e.eventData as { mode?: string }).mode === 'standard').length;

  let preferredMode: 'blitz' | 'standard' | 'mixed' = 'mixed';
  if (blitzCount > standardCount * 2) preferredMode = 'blitz';
  else if (standardCount > blitzCount * 2) preferredMode = 'standard';

  const coachingViewRate = caseCompletes.length > 0
    ? coachingViews.length / caseCompletes.length
    : 0;

  return {
    firstSeen: Math.min(...timestamps),
    lastSeen: Math.max(...timestamps),
    totalSessions: sessions.size,
    totalCasesPlayed: caseStarts.length,
    totalCasesCompleted: caseCompletes.length,
    avgScore,
    scores,
    preferredMode,
    coachingViewRate
  };
}

/**
 * Get key metrics for dashboard
 */
export function getKeyMetrics(): {
  totalEvents: number;
  totalDevices: number;
  totalUsers: number;
  totalSessions: number;
  totalCasesStarted: number;
  totalCasesCompleted: number;
  completionRate: number;
  secondCaseRate: number;
  coachingViewRate: number;
  todayEvents: number;
} {
  const store = loadEventsStore();
  const events = store.events;

  const uniqueDevices = new Set(events.map(e => e.identity.deviceId));
  const uniqueUsers = new Set(events.filter(e => e.identity.userId).map(e => e.identity.userId));
  const uniqueSessions = new Set(events.map(e => e.identity.sessionId));

  const caseStarts = events.filter(e => e.eventType === 'case_start');
  const caseCompletes = events.filter(e => e.eventType === 'case_complete');
  const coachingViews = events.filter(e => e.eventType === 'coaching_view_start');

  // Calculate second case rate (users who played more than 1 case)
  const casesByDevice: Record<string, number> = {};
  caseStarts.forEach(e => {
    casesByDevice[e.identity.deviceId] = (casesByDevice[e.identity.deviceId] || 0) + 1;
  });
  const devicesWithCases = Object.keys(casesByDevice).length;
  const devicesWithMultipleCases = Object.values(casesByDevice).filter(c => c > 1).length;
  const secondCaseRate = devicesWithCases > 0 ? devicesWithMultipleCases / devicesWithCases : 0;

  // Today's events
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todayEvents = events.filter(e => e.timestamp >= todayStart).length;

  return {
    totalEvents: events.length,
    totalDevices: uniqueDevices.size,
    totalUsers: uniqueUsers.size,
    totalSessions: uniqueSessions.size,
    totalCasesStarted: caseStarts.length,
    totalCasesCompleted: caseCompletes.length,
    completionRate: caseStarts.length > 0 ? caseCompletes.length / caseStarts.length : 0,
    secondCaseRate,
    coachingViewRate: caseCompletes.length > 0 ? coachingViews.length / caseCompletes.length : 0,
    todayEvents
  };
}
