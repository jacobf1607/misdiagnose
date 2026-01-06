/**
 * Analytics Routes
 *
 * Endpoints for tracking and retrieving analytics data.
 */

import { Router, Request, Response } from 'express';
import {
  storeEvents,
  linkGuestToUser,
  getKeyMetrics,
  generateDailySummary,
  getUserMetrics,
  getAllEvents,
  getEventsByDevice,
  getEventsByUser
} from '../services/analyticsService';

const router = Router();

/**
 * POST /api/analytics/events
 * Store batch of analytics events
 */
router.post('/events', (req: Request, res: Response) => {
  try {
    const { events } = req.body;

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'Events array required' });
    }

    // Validate events have required fields
    const validEvents = events.filter(event =>
      event.eventType &&
      event.identity &&
      event.identity.deviceId &&
      event.identity.sessionId &&
      event.timestamp
    );

    if (validEvents.length === 0) {
      return res.status(400).json({ error: 'No valid events provided' });
    }

    storeEvents(validEvents);

    return res.json({
      success: true,
      stored: validEvents.length,
      dropped: events.length - validEvents.length
    });
  } catch (err) {
    console.error('Failed to store analytics events:', err);
    return res.status(500).json({ error: 'Failed to store events' });
  }
});

/**
 * POST /api/analytics/link-guest
 * Link guest events to a new user account
 */
router.post('/link-guest', (req: Request, res: Response) => {
  try {
    const { newUserId, deviceId } = req.body;

    if (!newUserId || !deviceId) {
      return res.status(400).json({ error: 'newUserId and deviceId required' });
    }

    const linkedCount = linkGuestToUser(deviceId, newUserId);

    return res.json({
      success: true,
      linkedCount
    });
  } catch (err) {
    console.error('Failed to link guest to user:', err);
    return res.status(500).json({ error: 'Failed to link guest' });
  }
});

/**
 * GET /api/analytics/metrics
 * Get key metrics dashboard
 */
router.get('/metrics', (_req: Request, res: Response) => {
  try {
    const metrics = getKeyMetrics();
    return res.json(metrics);
  } catch (err) {
    console.error('Failed to get metrics:', err);
    return res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * GET /api/analytics/daily/:date?
 * Get daily summary (defaults to today)
 */
router.get('/daily/:date?', (req: Request, res: Response) => {
  try {
    const date = req.params.date;
    const summary = generateDailySummary(date);
    return res.json(summary);
  } catch (err) {
    console.error('Failed to get daily summary:', err);
    return res.status(500).json({ error: 'Failed to get daily summary' });
  }
});

/**
 * GET /api/analytics/user/:identifier
 * Get metrics for a specific user or device
 */
router.get('/user/:identifier', (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;
    const { type = 'user' } = req.query;

    const isUserId = type === 'user';
    const metrics = getUserMetrics(identifier, isUserId);

    if (!metrics) {
      return res.status(404).json({ error: 'No data found for identifier' });
    }

    return res.json(metrics);
  } catch (err) {
    console.error('Failed to get user metrics:', err);
    return res.status(500).json({ error: 'Failed to get user metrics' });
  }
});

/**
 * GET /api/analytics/events
 * Get all events (admin only - for MVP debugging)
 */
router.get('/events', (req: Request, res: Response) => {
  try {
    const { deviceId, userId, limit = '100' } = req.query;

    let events;
    if (deviceId) {
      events = getEventsByDevice(deviceId as string);
    } else if (userId) {
      events = getEventsByUser(userId as string);
    } else {
      events = getAllEvents();
    }

    // Sort by timestamp descending and limit
    events = events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, parseInt(limit as string, 10));

    return res.json({
      count: events.length,
      events
    });
  } catch (err) {
    console.error('Failed to get events:', err);
    return res.status(500).json({ error: 'Failed to get events' });
  }
});

/**
 * GET /api/analytics/report
 * Get comprehensive readable report for MVP analysis
 */
router.get('/report', (req: Request, res: Response) => {
  try {
    const { format = 'json' } = req.query;
    const events = getAllEvents();

    // Group events by user/device
    interface UserData {
      userId: string | null;
      deviceId: string;
      isGuest: boolean;
      firstSeen: number;
      lastSeen: number;
      sessions: Set<string>;
      sessionDurations: number[];
      cases: Array<{
        caseId: string;
        gameId: string;
        mode: string;
        startedAt: number;
        completedAt?: number;
        score?: number;
        grade?: string;
        wasCorrect?: boolean;
        correctDiagnosis?: string;
        submittedDiagnosis?: string;
        duration?: number;
      }>;
    }

    const userMap: Record<string, UserData> = {};

    // First pass: collect all user data
    events.forEach(e => {
      const key = e.identity.userId || e.identity.deviceId;
      if (!userMap[key]) {
        userMap[key] = {
          userId: e.identity.userId,
          deviceId: e.identity.deviceId,
          isGuest: e.identity.isGuest,
          firstSeen: e.timestamp,
          lastSeen: e.timestamp,
          sessions: new Set(),
          sessionDurations: [],
          cases: []
        };
      }

      const user = userMap[key];
      user.firstSeen = Math.min(user.firstSeen, e.timestamp);
      user.lastSeen = Math.max(user.lastSeen, e.timestamp);
      user.sessions.add(e.identity.sessionId);

      if (e.eventType === 'case_start') {
        const data = e.eventData as { caseId?: string; gameId?: string; mode?: string };
        user.cases.push({
          caseId: data.caseId || e.context.caseId || 'unknown',
          gameId: data.gameId || e.context.gameId || 'unknown',
          mode: data.mode || 'standard',
          startedAt: e.timestamp
        });
      }

      if (e.eventType === 'case_complete') {
        const data = e.eventData as {
          caseId?: string;
          gameId?: string;
          score?: number;
          grade?: string;
          wasCorrect?: boolean;
          correctDiagnosis?: string;
          submittedDiagnosis?: string;
          duration?: number;
        };
        // Find matching case start and update it
        const caseEntry = user.cases.find(
          c => c.gameId === (data.gameId || e.context.gameId) && !c.completedAt
        );
        if (caseEntry) {
          caseEntry.completedAt = e.timestamp;
          caseEntry.score = data.score;
          caseEntry.grade = data.grade;
          caseEntry.wasCorrect = data.wasCorrect;
          caseEntry.correctDiagnosis = data.correctDiagnosis;
          caseEntry.submittedDiagnosis = data.submittedDiagnosis;
          caseEntry.duration = data.duration;
        }
      }

      if (e.eventType === 'session_end') {
        const data = e.eventData as { duration?: number };
        if (typeof data.duration === 'number') {
          user.sessionDurations.push(data.duration);
        }
      }
    });

    // Calculate summary stats
    const totalUsers = Object.keys(userMap).length;
    const totalCasesStarted = Object.values(userMap).reduce((sum, u) => sum + u.cases.length, 0);
    const completedCases = Object.values(userMap).flatMap(u => u.cases.filter(c => c.completedAt));
    const totalCasesCompleted = completedCases.length;
    const correctCases = completedCases.filter(c => c.wasCorrect).length;
    const allScores = completedCases.map(c => c.score).filter((s): s is number => typeof s === 'number');
    const allSessionDurations = Object.values(userMap).flatMap(u => u.sessionDurations);
    const avgSessionDurationMs = allSessionDurations.length > 0
      ? allSessionDurations.reduce((a, b) => a + b, 0) / allSessionDurations.length
      : null;

    // Build readable report
    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalUsers,
        totalCasesStarted,
        totalCasesCompleted,
        completionRate: totalCasesStarted > 0 ? `${Math.round(totalCasesCompleted / totalCasesStarted * 100)}%` : '0%',
        accuracyRate: totalCasesCompleted > 0 ? `${Math.round(correctCases / totalCasesCompleted * 100)}%` : '0%',
        avgScore: allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null,
        avgSessionDuration: avgSessionDurationMs !== null
          ? `${Math.round(avgSessionDurationMs / 1000 / 60)}m ${Math.round((avgSessionDurationMs / 1000) % 60)}s`
          : 'N/A',
        gradeDistribution: {
          S: completedCases.filter(c => c.grade === 'S').length,
          A: completedCases.filter(c => c.grade === 'A').length,
          B: completedCases.filter(c => c.grade === 'B').length,
          C: completedCases.filter(c => c.grade === 'C').length,
          D: completedCases.filter(c => c.grade === 'D').length,
          F: completedCases.filter(c => c.grade === 'F').length
        }
      },
      users: Object.entries(userMap).map(([key, user]) => {
        const userCasesCompleted = user.cases.filter(c => c.completedAt);
        const userScores = userCasesCompleted.map(c => c.score).filter((s): s is number => typeof s === 'number');
        const userCorrect = userCasesCompleted.filter(c => c.wasCorrect).length;

        const avgSessionMs = user.sessionDurations.length > 0
          ? user.sessionDurations.reduce((a, b) => a + b, 0) / user.sessionDurations.length
          : null;

        return {
          identifier: user.userId || `guest_${user.deviceId.substring(0, 8)}`,
          isGuest: user.isGuest,
          firstSeen: new Date(user.firstSeen).toLocaleString(),
          lastSeen: new Date(user.lastSeen).toLocaleString(),
          totalSessions: user.sessions.size,
          stats: {
            casesStarted: user.cases.length,
            casesCompleted: userCasesCompleted.length,
            correctCount: userCorrect,
            accuracy: userCasesCompleted.length > 0 ? `${Math.round(userCorrect / userCasesCompleted.length * 100)}%` : 'N/A',
            avgScore: userScores.length > 0 ? Math.round(userScores.reduce((a, b) => a + b, 0) / userScores.length) : null,
            bestGrade: userCasesCompleted.length > 0
              ? ['S', 'A', 'B', 'C', 'D', 'F'].find(g => userCasesCompleted.some(c => c.grade === g)) || 'N/A'
              : 'N/A',
            avgSessionDuration: avgSessionMs !== null
              ? `${Math.round(avgSessionMs / 1000 / 60)}m ${Math.round((avgSessionMs / 1000) % 60)}s`
              : 'N/A'
          },
          cases: user.cases.map(c => ({
            date: new Date(c.startedAt).toLocaleString(),
            mode: c.mode,
            status: c.completedAt ? (c.wasCorrect ? 'CORRECT' : 'INCORRECT') : 'ABANDONED',
            score: c.score ?? '-',
            grade: c.grade ?? '-',
            diagnosis: c.completedAt
              ? c.wasCorrect
                ? c.correctDiagnosis
                : `${c.submittedDiagnosis} (correct: ${c.correctDiagnosis})`
              : 'Not submitted',
            duration: c.duration ? `${Math.round(c.duration / 1000)}s` : '-'
          }))
        };
      })
    };

    // Return as formatted text if requested
    if (format === 'text') {
      let text = `
========================================
  DIAGNOSIS GRID - ANALYTICS REPORT
  Generated: ${report.generatedAt}
========================================

SUMMARY
-------
Total Users:        ${report.summary.totalUsers}
Cases Started:      ${report.summary.totalCasesStarted}
Cases Completed:    ${report.summary.totalCasesCompleted}
Completion Rate:    ${report.summary.completionRate}
Accuracy Rate:      ${report.summary.accuracyRate}
Average Score:      ${report.summary.avgScore ?? 'N/A'}
Avg Session:        ${report.summary.avgSessionDuration}

Grade Distribution:
  S: ${report.summary.gradeDistribution.S}  A: ${report.summary.gradeDistribution.A}  B: ${report.summary.gradeDistribution.B}
  C: ${report.summary.gradeDistribution.C}  D: ${report.summary.gradeDistribution.D}  F: ${report.summary.gradeDistribution.F}

`;

      report.users.forEach(user => {
        text += `
----------------------------------------
USER: ${user.identifier} ${user.isGuest ? '(Guest)' : ''}
----------------------------------------
First Seen:      ${user.firstSeen}
Last Seen:       ${user.lastSeen}
Sessions:        ${user.totalSessions}
Avg Session:     ${user.stats.avgSessionDuration}
Cases Started:   ${user.stats.casesStarted}
Cases Completed: ${user.stats.casesCompleted}
Accuracy:        ${user.stats.accuracy}
Average Score:   ${user.stats.avgScore ?? 'N/A'}
Best Grade:      ${user.stats.bestGrade}

CASE HISTORY:
`;
        user.cases.forEach((c, i) => {
          text += `  ${i + 1}. [${c.date}] ${c.mode.toUpperCase()} - ${c.status} - Score: ${c.score} (${c.grade}) - ${c.diagnosis}\n`;
        });
      });

      res.setHeader('Content-Type', 'text/plain');
      return res.send(text);
    }

    return res.json(report);
  } catch (err) {
    console.error('Failed to generate report:', err);
    return res.status(500).json({ error: 'Failed to generate report' });
  }
});

export default router;
