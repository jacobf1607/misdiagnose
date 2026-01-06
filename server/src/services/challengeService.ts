/**
 * Challenge Service
 * Handles storage and management of friend challenges
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  Challenge,
  ChallengeResponse,
  ChallengeStatus,
  Notification,
  CreateChallengeRequest
} from '../types';
import { loadCaseFile } from './casePoolManager';
import { getCaseHistory } from './userService';

// Path to storage files
const CHALLENGES_FILE = path.join(__dirname, '../data/challenges.json');
const NOTIFICATIONS_FILE = path.join(__dirname, '../data/notifications.json');

// Challenge expiry: 7 days in ms
const CHALLENGE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// Generate short unique ID (6 chars, URL-safe)
function generateShortId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Ensure data directory exists
function ensureDataDir(): void {
  const dataDir = path.dirname(CHALLENGES_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Load all challenges
function loadChallenges(): Challenge[] {
  ensureDataDir();
  if (!fs.existsSync(CHALLENGES_FILE)) {
    return [];
  }
  try {
    const data = fs.readFileSync(CHALLENGES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[Challenge] Error loading challenges:', error);
    return [];
  }
}

// Save all challenges
function saveChallenges(challenges: Challenge[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(CHALLENGES_FILE, JSON.stringify(challenges, null, 2));
  } catch (error) {
    console.error('[Challenge] Error saving challenges:', error);
    throw error;
  }
}

// Load all notifications
function loadNotifications(): Notification[] {
  ensureDataDir();
  if (!fs.existsSync(NOTIFICATIONS_FILE)) {
    return [];
  }
  try {
    const data = fs.readFileSync(NOTIFICATIONS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[Challenge] Error loading notifications:', error);
    return [];
  }
}

// Save all notifications
function saveNotifications(notifications: Notification[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifications, null, 2));
  } catch (error) {
    console.error('[Challenge] Error saving notifications:', error);
    throw error;
  }
}

/**
 * Create a new challenge
 */
export function createChallenge(request: CreateChallengeRequest): Challenge {
  const challenges = loadChallenges();

  // Generate unique short ID
  let id = generateShortId();
  while (challenges.some(c => c.id === id)) {
    id = generateShortId();
  }

  const now = Date.now();
  const newChallenge: Challenge = {
    id,
    caseId: request.caseId,
    caseDomain: request.caseDomain,
    gameMode: request.gameMode,
    challengerId: request.challengerId,
    challengerName: request.challengerName,
    challengerGrade: request.challengerGrade,
    challengerScore: request.challengerScore,
    responses: [],                       // Multiple people can respond
    status: 'active',                    // Active until expired
    createdAt: now,
    expiresAt: now + CHALLENGE_EXPIRY_MS
  };

  challenges.unshift(newChallenge);
  saveChallenges(challenges);

  console.log(`[Challenge] Created challenge ${id} by ${request.challengerName} (${request.caseDomain}, grade ${request.challengerGrade})`);

  return newChallenge;
}

/**
 * Get a challenge by ID
 */
export function getChallengeById(id: string): Challenge | null {
  const challenges = loadChallenges();
  const challenge = challenges.find(c => c.id === id);

  if (!challenge) {
    return null;
  }

  // Check if expired
  if (challenge.status === 'active' && Date.now() > challenge.expiresAt) {
    // Mark as expired
    challenge.status = 'expired';
    saveChallenges(challenges);
  }

  return challenge;
}

/**
 * Check if a user has already responded to this challenge
 */
export function checkUserRespondedToChallenge(
  challenge: Challenge,
  userId: string | undefined
): ChallengeResponse | null {
  if (!userId) return null; // Guests can play multiple times

  return challenge.responses.find(r => r.respondentUserId === userId) || null;
}

/**
 * Check if a user already played a specific case
 * Returns their result if they have
 */
export function checkUserPlayedCase(
  userId: string,
  caseId: string,
  challengerScore: number
): { grade: string; score: number; beatChallenger: boolean } | null {
  try {
    const historyResponse = getCaseHistory(userId);
    if (!historyResponse) {
      return null;
    }

    const playedCase = historyResponse.history.find(h => h.caseId === caseId);

    if (playedCase) {
      return {
        grade: playedCase.grade,
        score: playedCase.finalScore,
        beatChallenger: playedCase.finalScore > challengerScore
      };
    }
  } catch (error) {
    console.error('[Challenge] Error checking user history:', error);
  }

  return null;
}

/**
 * Get the case data for a challenge
 */
export function getChallengeCase(caseId: string) {
  return loadCaseFile(caseId);
}

/**
 * Add a response to a challenge (when someone completes it)
 * Multiple people can respond to the same challenge
 */
export function addChallengeResponse(
  challengeId: string,
  respondentUserId: string | undefined,
  respondentName: string,
  respondentGrade: string,
  respondentScore: number
): { challenge: Challenge; response: ChallengeResponse; result: 'win' | 'lose' | 'tie' } | null {
  const challenges = loadChallenges();
  const index = challenges.findIndex(c => c.id === challengeId);

  if (index === -1) {
    return null;
  }

  const challenge = challenges[index];

  // Check if expired
  if (challenge.status === 'expired') {
    return null;
  }

  // Check if this user already responded (logged-in users only)
  if (respondentUserId) {
    const existingResponse = challenge.responses.find(r => r.respondentUserId === respondentUserId);
    if (existingResponse) {
      console.log(`[Challenge] User ${respondentName} already responded to challenge ${challengeId}`);
      return null;
    }
  }

  // Determine result vs challenger
  let result: 'win' | 'lose' | 'tie';
  if (respondentScore > challenge.challengerScore) {
    result = 'win';
  } else if (respondentScore < challenge.challengerScore) {
    result = 'lose';
  } else {
    result = 'tie';
  }

  // Create the response
  const response: ChallengeResponse = {
    responseId: generateShortId() + generateShortId(), // 12 char ID
    respondentUserId,
    respondentName,
    respondentGrade,
    respondentScore,
    result,
    completedAt: Date.now()
  };

  // Add to responses array
  challenge.responses.push(response);
  saveChallenges(challenges);

  // Create notification for challenger
  createNotification({
    userId: challenge.challengerId,
    type: 'challenge_completed',
    title: result === 'lose' ? 'You Won!' : result === 'win' ? 'You Lost!' : 'It\'s a Tie!',
    message: result === 'lose'
      ? `${respondentName} tried your ${challenge.caseDomain} challenge but you beat them! (${challenge.challengerGrade} vs ${respondentGrade})`
      : result === 'win'
      ? `${respondentName} beat your score on your ${challenge.caseDomain} challenge! (${respondentGrade} vs ${challenge.challengerGrade})`
      : `${respondentName} tied with you on your ${challenge.caseDomain} challenge! (${respondentGrade})`,
    data: {
      challengeId,
      challengerName: challenge.challengerName,
      challengedName: respondentName,
      winnerId: result === 'win' ? respondentUserId : result === 'lose' ? challenge.challengerId : undefined,
      winnerName: result === 'win' ? respondentName : result === 'lose' ? challenge.challengerName : undefined
    }
  });

  // Also notify the respondent if they're logged in
  if (respondentUserId) {
    createNotification({
      userId: respondentUserId,
      type: 'challenge_completed',
      title: result === 'win' ? 'You Won!' : result === 'lose' ? 'You Lost!' : 'It\'s a Tie!',
      message: result === 'win'
        ? `You beat ${challenge.challengerName}'s ${challenge.caseDomain} challenge! (${respondentGrade} vs ${challenge.challengerGrade})`
        : result === 'lose'
        ? `${challenge.challengerName} beat your score on their ${challenge.caseDomain} challenge! (${respondentGrade} vs ${challenge.challengerGrade})`
        : `You tied with ${challenge.challengerName} on their ${challenge.caseDomain} challenge! (${respondentGrade})`,
      data: {
        challengeId,
        challengerName: challenge.challengerName,
        challengedName: respondentName,
        winnerId: result === 'win' ? respondentUserId : result === 'lose' ? challenge.challengerId : undefined,
        winnerName: result === 'win' ? respondentName : result === 'lose' ? challenge.challengerName : undefined
      }
    });
  }

  console.log(`[Challenge] ${respondentName} responded to challenge ${challengeId}: ${result} (${respondentScore} vs ${challenge.challengerScore}) - Total responses: ${challenge.responses.length}`);

  return { challenge, response, result };
}

/**
 * Get challenges created by a user
 */
export function getUserChallenges(userId: string): Challenge[] {
  const challenges = loadChallenges();
  return challenges.filter(c => c.challengerId === userId);
}

/**
 * Get challenges where user has responded
 */
export function getReceivedChallenges(userId: string): Challenge[] {
  const challenges = loadChallenges();
  return challenges.filter(c =>
    c.responses.some(r => r.respondentUserId === userId)
  );
}

// ============================================
// NOTIFICATION FUNCTIONS
// ============================================

/**
 * Create a notification
 */
export function createNotification(params: {
  userId: string;
  type: 'challenge_completed' | 'challenge_received';
  title: string;
  message: string;
  data: Notification['data'];
}): Notification {
  const notifications = loadNotifications();

  const notification: Notification = {
    id: generateShortId() + generateShortId(), // 12 char ID
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    data: params.data,
    read: false,
    createdAt: Date.now()
  };

  notifications.unshift(notification);
  saveNotifications(notifications);

  console.log(`[Challenge] Created notification for ${params.userId}: ${params.title}`);

  return notification;
}

/**
 * Get notifications for a user
 */
export function getUserNotifications(userId: string): Notification[] {
  const notifications = loadNotifications();
  return notifications.filter(n => n.userId === userId);
}

/**
 * Get unread notification count for a user
 */
export function getUnreadNotificationCount(userId: string): number {
  const notifications = loadNotifications();
  return notifications.filter(n => n.userId === userId && !n.read).length;
}

/**
 * Mark notification as read
 */
export function markNotificationRead(notificationId: string, userId: string): boolean {
  const notifications = loadNotifications();
  const index = notifications.findIndex(n => n.id === notificationId && n.userId === userId);

  if (index === -1) {
    return false;
  }

  notifications[index].read = true;
  saveNotifications(notifications);

  return true;
}

/**
 * Mark all notifications as read for a user
 */
export function markAllNotificationsRead(userId: string): number {
  const notifications = loadNotifications();
  let count = 0;

  for (const notification of notifications) {
    if (notification.userId === userId && !notification.read) {
      notification.read = true;
      count++;
    }
  }

  if (count > 0) {
    saveNotifications(notifications);
  }

  return count;
}

/**
 * Clean up expired challenges (run periodically)
 */
export function cleanupExpiredChallenges(): number {
  const challenges = loadChallenges();
  const now = Date.now();
  let expiredCount = 0;

  for (const challenge of challenges) {
    if (challenge.status === 'active' && now > challenge.expiresAt) {
      challenge.status = 'expired';
      expiredCount++;
    }
  }

  if (expiredCount > 0) {
    saveChallenges(challenges);
    console.log(`[Challenge] Marked ${expiredCount} challenges as expired`);
  }

  return expiredCount;
}
