/**
 * Notification API Routes
 * Handles user notifications for challenges
 */

import { Router, Request, Response } from 'express';
import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead
} from '../services/challengeService';

const router = Router();

/**
 * GET /api/notifications/:userId - Get notifications for a user
 */
router.get('/:userId', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const notifications = getUserNotifications(userId);
    const unreadCount = getUnreadNotificationCount(userId);

    res.json({
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

/**
 * GET /api/notifications/:userId/count - Get unread count only
 */
router.get('/:userId/count', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const unreadCount = getUnreadNotificationCount(userId);

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error getting notification count:', error);
    res.status(500).json({ error: 'Failed to get notification count' });
  }
});

/**
 * POST /api/notifications/:notificationId/read - Mark notification as read
 */
router.post('/:notificationId/read', (req: Request, res: Response) => {
  try {
    const { notificationId } = req.params;
    const { userId } = req.body as { userId: string };

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const success = markNotificationRead(notificationId, userId);

    if (!success) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * POST /api/notifications/:userId/read-all - Mark all notifications as read
 */
router.post('/:userId/read-all', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const count = markAllNotificationsRead(userId);

    res.json({
      success: true,
      markedRead: count
    });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

export default router;
