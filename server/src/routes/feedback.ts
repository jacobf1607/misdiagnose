/**
 * Feedback API Routes
 * Handles feedback submission and management
 */

import { Router, Request, Response } from 'express';
import {
  SubmitFeedbackRequest,
  UpdateFeedbackStatusRequest,
  FeedbackStatus
} from '../types';
import {
  submitFeedback,
  getAllFeedback,
  getFeedbackById,
  updateFeedbackStatus,
  deleteFeedback,
  getFeedbackStats
} from '../services/feedbackService';

const router = Router();

/**
 * POST /api/feedback - Submit new feedback
 * Anyone can submit feedback
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const request = req.body as SubmitFeedbackRequest;

    if (!request.feedbackText || request.feedbackText.trim().length === 0) {
      return res.status(400).json({ error: 'Feedback text is required' });
    }

    if (!request.context) {
      return res.status(400).json({ error: 'Feedback context is required' });
    }

    const entry = submitFeedback({
      ...request,
      feedbackText: request.feedbackText.trim()
    });

    res.json({
      success: true,
      feedbackId: entry.id
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

/**
 * GET /api/feedback - Get all feedback (test users only)
 * Query params:
 *   - status: Filter by status (unread, important, solved, irrelevant)
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const statusFilter = req.query.status as FeedbackStatus | undefined;

    // Validate status if provided
    if (statusFilter && !['unread', 'important', 'solved', 'irrelevant'].includes(statusFilter)) {
      return res.status(400).json({ error: 'Invalid status filter' });
    }

    const feedback = getAllFeedback(statusFilter);
    const stats = getFeedbackStats();

    res.json({
      feedback,
      totalCount: stats.total,
      unreadCount: stats.unread
    });
  } catch (error) {
    console.error('Error getting feedback:', error);
    res.status(500).json({ error: 'Failed to get feedback' });
  }
});

/**
 * GET /api/feedback/stats - Get feedback statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = getFeedbackStats();
    res.json({ stats });
  } catch (error) {
    console.error('Error getting feedback stats:', error);
    res.status(500).json({ error: 'Failed to get feedback stats' });
  }
});

/**
 * GET /api/feedback/:id - Get specific feedback entry
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const entry = getFeedbackById(id);

    if (!entry) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    res.json({ feedback: entry });
  } catch (error) {
    console.error('Error getting feedback:', error);
    res.status(500).json({ error: 'Failed to get feedback' });
  }
});

/**
 * PATCH /api/feedback/:id/status - Update feedback status (test users only)
 */
router.patch('/:id/status', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body as UpdateFeedbackStatusRequest;

    if (!status || !['unread', 'important', 'solved', 'irrelevant'].includes(status)) {
      return res.status(400).json({ error: 'Valid status is required' });
    }

    const updated = updateFeedbackStatus(id, status, adminNotes);

    if (!updated) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    res.json({
      success: true,
      feedback: updated
    });
  } catch (error) {
    console.error('Error updating feedback status:', error);
    res.status(500).json({ error: 'Failed to update feedback status' });
  }
});

/**
 * DELETE /api/feedback/:id - Delete feedback entry (test users only)
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = deleteFeedback(id);

    if (!deleted) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

export default router;
