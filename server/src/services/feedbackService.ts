/**
 * Feedback Service
 * Handles storage and management of user feedback
 * Stores feedback in a JSON file for persistence
 */

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  FeedbackEntry,
  FeedbackStatus,
  FeedbackContext,
  FeedbackCaseSnapshot,
  SubmitFeedbackRequest
} from '../types';

// Path to feedback storage file
const FEEDBACK_FILE = path.join(__dirname, '../data/feedback.json');

// Ensure data directory exists
function ensureDataDir(): void {
  const dataDir = path.dirname(FEEDBACK_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Load all feedback from file
function loadFeedback(): FeedbackEntry[] {
  ensureDataDir();

  if (!fs.existsSync(FEEDBACK_FILE)) {
    return [];
  }

  try {
    const data = fs.readFileSync(FEEDBACK_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading feedback:', error);
    return [];
  }
}

// Save all feedback to file
function saveFeedback(feedback: FeedbackEntry[]): void {
  ensureDataDir();

  try {
    fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedback, null, 2));
  } catch (error) {
    console.error('Error saving feedback:', error);
    throw error;
  }
}

/**
 * Submit new feedback
 */
export function submitFeedback(request: SubmitFeedbackRequest): FeedbackEntry {
  const feedback = loadFeedback();

  const now = Date.now();
  const newEntry: FeedbackEntry = {
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
    userId: request.userId,
    userEmail: request.userEmail,
    isTestUser: request.isTestUser || false,
    feedbackText: request.feedbackText,
    context: request.context,
    caseSnapshot: request.caseSnapshot,
    status: 'unread'
  };

  feedback.unshift(newEntry); // Add to beginning (newest first)
  saveFeedback(feedback);

  console.log(`[Feedback] New feedback submitted: ${newEntry.id} (${newEntry.context})`);

  return newEntry;
}

/**
 * Get all feedback (optionally filtered by status)
 */
export function getAllFeedback(statusFilter?: FeedbackStatus): FeedbackEntry[] {
  const feedback = loadFeedback();

  if (statusFilter) {
    return feedback.filter(f => f.status === statusFilter);
  }

  return feedback;
}

/**
 * Get feedback by ID
 */
export function getFeedbackById(id: string): FeedbackEntry | null {
  const feedback = loadFeedback();
  return feedback.find(f => f.id === id) || null;
}

/**
 * Update feedback status
 */
export function updateFeedbackStatus(
  id: string,
  status: FeedbackStatus,
  adminNotes?: string
): FeedbackEntry | null {
  const feedback = loadFeedback();
  const index = feedback.findIndex(f => f.id === id);

  if (index === -1) {
    return null;
  }

  feedback[index].status = status;
  feedback[index].updatedAt = Date.now();

  if (adminNotes !== undefined) {
    feedback[index].adminNotes = adminNotes;
  }

  saveFeedback(feedback);

  console.log(`[Feedback] Updated ${id} to status: ${status}`);

  return feedback[index];
}

/**
 * Delete feedback entry
 */
export function deleteFeedback(id: string): boolean {
  const feedback = loadFeedback();
  const index = feedback.findIndex(f => f.id === id);

  if (index === -1) {
    return false;
  }

  feedback.splice(index, 1);
  saveFeedback(feedback);

  console.log(`[Feedback] Deleted ${id}`);

  return true;
}

/**
 * Get feedback statistics
 */
export function getFeedbackStats(): {
  total: number;
  unread: number;
  important: number;
  solved: number;
  irrelevant: number;
  byContext: Record<FeedbackContext, number>;
} {
  const feedback = loadFeedback();

  const stats = {
    total: feedback.length,
    unread: 0,
    important: 0,
    solved: 0,
    irrelevant: 0,
    byContext: {
      dashboard: 0,
      during_case: 0,
      after_case: 0
    } as Record<FeedbackContext, number>
  };

  for (const entry of feedback) {
    // Count by status
    switch (entry.status) {
      case 'unread': stats.unread++; break;
      case 'important': stats.important++; break;
      case 'solved': stats.solved++; break;
      case 'irrelevant': stats.irrelevant++; break;
    }

    // Count by context
    stats.byContext[entry.context]++;
  }

  return stats;
}
