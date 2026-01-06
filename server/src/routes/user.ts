/**
 * User Routes
 *
 * API endpoints for user management.
 */

import { Router, Request, Response } from 'express';
import {
  getUserByUid,
  createOrUpdateUser,
  getUserCount,
  getCaseHistory
} from '../services/userService';

const router = Router();

/**
 * GET /api/user/:uid
 * Get user by Firebase UID
 */
router.get('/:uid', (req: Request, res: Response) => {
  try {
    const { uid } = req.params;

    if (!uid) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const user = getUserByUid(uid);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error: any) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * POST /api/user
 * Create or update user
 *
 * Body:
 * - uid: Firebase UID (required)
 * - phone_number: Phone number (required)
 * - username: Display name (required for new users)
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const { uid, phone_number, username } = req.body;

    if (!uid) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!phone_number) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Check if this is an existing user
    const existingUser = getUserByUid(uid);

    // New users need a username
    if (!existingUser && !username) {
      return res.status(400).json({ error: 'Username is required for new users' });
    }

    // Validate username format for new users
    if (!existingUser && username) {
      if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
      }
      if (username.length > 20) {
        return res.status(400).json({ error: 'Username must be 20 characters or less' });
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({
          error: 'Username can only contain letters, numbers, and underscores'
        });
      }
    }

    const user = createOrUpdateUser(uid, phone_number, username);
    res.json({ user });
  } catch (error: any) {
    console.error('Error creating/updating user:', error);

    if (error.message === 'Username is already taken') {
      return res.status(409).json({ error: error.message });
    }

    res.status(500).json({ error: error.message || 'Failed to create/update user' });
  }
});

/**
 * GET /api/user/stats/count
 * Get total user count (for admin/stats)
 */
router.get('/stats/count', (_req: Request, res: Response) => {
  try {
    const count = getUserCount();
    res.json({ count });
  } catch (error: any) {
    console.error('Error getting user count:', error);
    res.status(500).json({ error: 'Failed to get user count' });
  }
});

/**
 * GET /api/user/:uid/history
 * Get user's case history with summary stats
 */
router.get('/:uid/history', (req: Request, res: Response) => {
  try {
    const { uid } = req.params;

    if (!uid) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const historyData = getCaseHistory(uid);

    if (!historyData) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(historyData);
  } catch (error: any) {
    console.error('Error fetching case history:', error);
    res.status(500).json({ error: 'Failed to fetch case history' });
  }
});

export default router;
