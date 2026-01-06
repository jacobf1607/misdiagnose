/**
 * User Service
 *
 * Handles user CRUD operations.
 * Users are stored in a JSON file for simplicity.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CaseHistoryEntry, CaseHistoryResponse } from '../types';

// User model
export interface User {
  uid: string;
  phone_number: string;
  username: string;
  created_at: number;
  last_login: number;
  is_test_user?: boolean;
  case_history?: CaseHistoryEntry[];
}

// Users index (all users by UID)
interface UsersIndex {
  users: Record<string, User>;
}

// Path to users data file
const USERS_FILE = path.join(__dirname, '../data/users/users.json');

/**
 * Load users from file
 */
function loadUsers(): UsersIndex {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading users:', error);
  }

  return { users: {} };
}

/**
 * Save users to file
 */
function saveUsers(index: UsersIndex): void {
  try {
    // Ensure directory exists
    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(USERS_FILE, JSON.stringify(index, null, 2));
  } catch (error) {
    console.error('Error saving users:', error);
    throw new Error('Failed to save user data');
  }
}

/**
 * Get user by UID
 */
export function getUserByUid(uid: string): User | null {
  const index = loadUsers();
  return index.users[uid] || null;
}

/**
 * Get user by username
 */
export function getUserByUsername(username: string): User | null {
  const index = loadUsers();
  const users = Object.values(index.users);
  return users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
}

/**
 * Create or update user
 * - If user doesn't exist: creates new user with provided username
 * - If user exists: updates last_login timestamp
 */
export function createOrUpdateUser(
  uid: string,
  phoneNumber: string,
  username?: string
): User {
  const index = loadUsers();
  const existingUser = index.users[uid];
  const now = Date.now();

  if (existingUser) {
    // Update existing user's last_login
    existingUser.last_login = now;
    index.users[uid] = existingUser;
    saveUsers(index);
    return existingUser;
  }

  // New user - username is required
  if (!username) {
    throw new Error('Username is required for new users');
  }

  // Check if username is already taken
  const usernameExists = getUserByUsername(username);
  if (usernameExists) {
    throw new Error('Username is already taken');
  }

  // Create new user
  const newUser: User = {
    uid,
    phone_number: phoneNumber,
    username,
    created_at: now,
    last_login: now
  };

  index.users[uid] = newUser;
  saveUsers(index);

  console.log(`Created new user: ${username} (${uid})`);
  return newUser;
}

/**
 * Delete user by UID
 */
export function deleteUser(uid: string): boolean {
  const index = loadUsers();

  if (!index.users[uid]) {
    return false;
  }

  delete index.users[uid];
  saveUsers(index);
  return true;
}

/**
 * Get all users (for admin purposes)
 */
export function getAllUsers(): User[] {
  const index = loadUsers();
  return Object.values(index.users);
}

/**
 * Get user count
 */
export function getUserCount(): number {
  const index = loadUsers();
  return Object.keys(index.users).length;
}

/**
 * Set test user status by username
 */
export function setTestUser(username: string, isTestUser: boolean): User | null {
  const index = loadUsers();
  const users = Object.values(index.users);
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

  if (!user) {
    return null;
  }

  user.is_test_user = isTestUser;
  index.users[user.uid] = user;
  saveUsers(index);

  console.log(`Set is_test_user=${isTestUser} for user: ${user.username}`);
  return user;
}

/**
 * Add a completed case to user's history
 */
export function addCaseToHistory(uid: string, entry: CaseHistoryEntry): User | null {
  const index = loadUsers();
  const user = index.users[uid];

  if (!user) {
    return null;
  }

  // Initialize history array if needed
  if (!user.case_history) {
    user.case_history = [];
  }

  // Add new entry at the beginning (most recent first)
  user.case_history.unshift(entry);

  // Keep only last 100 entries to prevent unbounded growth
  if (user.case_history.length > 100) {
    user.case_history = user.case_history.slice(0, 100);
  }

  index.users[uid] = user;
  saveUsers(index);

  console.log(`Added case ${entry.caseId} to history for user: ${user.username}`);
  return user;
}

/**
 * Get user's case history with summary stats
 */
export function getCaseHistory(uid: string): CaseHistoryResponse | null {
  const user = getUserByUid(uid);

  if (!user) {
    return null;
  }

  const history = user.case_history || [];
  const totalCases = history.length;
  const correctCount = history.filter(h => h.wasCorrect).length;
  const averageScore = totalCases > 0
    ? history.reduce((sum, h) => sum + h.finalScore, 0) / totalCases
    : 0;

  return {
    history,
    totalCases,
    correctCount,
    averageScore: Math.round(averageScore * 10) / 10
  };
}

/**
 * Get active users (logged in within last N days)
 * Used by background generator to check per-user case availability
 */
export function getActiveUsers(daysActive: number = 7): User[] {
  const index = loadUsers();
  const cutoffTime = Date.now() - (daysActive * 24 * 60 * 60 * 1000);

  return Object.values(index.users).filter(user => {
    return user.last_login >= cutoffTime;
  });
}

/**
 * Get all user IDs (for case pool tracking)
 */
export function getAllUserIds(): string[] {
  const index = loadUsers();
  return Object.keys(index.users);
}
