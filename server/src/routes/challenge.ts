/**
 * Challenge API Routes
 * Handles friend challenges: create, get, start, complete
 */

import { Router, Request, Response } from 'express';
import {
  CreateChallengeRequest,
  CompleteChallengeRequest
} from '../types';
import {
  createChallenge,
  getChallengeById,
  checkUserPlayedCase,
  checkUserRespondedToChallenge,
  getChallengeCase,
  addChallengeResponse,
  getUserChallenges
} from '../services/challengeService';
import { markCaseAsUsed } from '../services/casePoolManager';

const router = Router();

/**
 * POST /api/challenge - Create a new challenge
 * Called after a player completes a game and wants to challenge a friend
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const request = req.body as CreateChallengeRequest;

    // Validate required fields
    if (!request.caseId || !request.challengerId || !request.challengerName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!request.challengerGrade || request.challengerScore === undefined) {
      return res.status(400).json({ error: 'Challenger score and grade are required' });
    }

    const challenge = createChallenge(request);

    // Generate share URL
    const shareUrl = `/challenge/${challenge.id}`;

    res.json({
      challengeId: challenge.id,
      shareUrl,
      challenge
    });
  } catch (error) {
    console.error('Error creating challenge:', error);
    res.status(500).json({ error: 'Failed to create challenge' });
  }
});

/**
 * GET /api/challenge/:id - Get challenge details
 * Used by challenge landing page to show challenge info
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.query as { userId?: string };

    const challenge = getChallengeById(id);

    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    // Check if expired
    if (challenge.status === 'expired') {
      return res.json({
        challenge,
        expired: true
      });
    }

    // Check if this user has already responded to this challenge
    let userResponse = null;
    if (userId) {
      userResponse = checkUserRespondedToChallenge(challenge, userId);
    }

    // Check if this user has already played this case (from history)
    let alreadyPlayed = null;
    if (userId && !userResponse) {
      alreadyPlayed = checkUserPlayedCase(userId, challenge.caseId, challenge.challengerScore);
    }

    res.json({
      challenge,
      userResponse,    // User's response if they already played via this challenge
      alreadyPlayed    // User's result if they played this case before (not via challenge)
    });
  } catch (error) {
    console.error('Error getting challenge:', error);
    res.status(500).json({ error: 'Failed to get challenge' });
  }
});

/**
 * POST /api/challenge/:id/start - Start playing a challenge
 * Returns the case data for the challenged player to play
 * Multiple people can play the same challenge
 */
router.post('/:id/start', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body as { userId?: string };

    const challenge = getChallengeById(id);

    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    if (challenge.status === 'expired') {
      return res.status(400).json({ error: 'Challenge has expired' });
    }

    // Check if this logged-in user already responded
    if (userId) {
      const existingResponse = checkUserRespondedToChallenge(challenge, userId);
      if (existingResponse) {
        return res.status(400).json({
          error: 'You have already played this challenge',
          existingResponse
        });
      }
    }

    // Load the case data
    const caseData = getChallengeCase(challenge.caseId);

    if (!caseData) {
      return res.status(404).json({ error: 'Challenge case not found' });
    }

    // Mark case as used by this user to prevent seeing it again in normal games
    if (userId) {
      markCaseAsUsed(challenge.caseId, userId);
    }

    res.json({
      challenge,
      caseData
    });
  } catch (error) {
    console.error('Error starting challenge:', error);
    res.status(500).json({ error: 'Failed to start challenge' });
  }
});

/**
 * POST /api/challenge/:id/complete - Complete a challenge
 * Called when a player finishes the challenge game
 * Multiple people can complete the same challenge
 */
router.post('/:id/complete', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const request = req.body as CompleteChallengeRequest;

    if (!request.respondentName || !request.respondentGrade || request.respondentScore === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = addChallengeResponse(
      id,
      request.respondentUserId,
      request.respondentName,
      request.respondentGrade,
      request.respondentScore
    );

    if (!result) {
      return res.status(404).json({ error: 'Challenge not found, expired, or you already responded' });
    }

    const scoreDifference = result.response.respondentScore - result.challenge.challengerScore;

    res.json({
      challenge: result.challenge,
      response: result.response,
      result: result.result,
      scoreDifference
    });
  } catch (error) {
    console.error('Error completing challenge:', error);
    res.status(500).json({ error: 'Failed to complete challenge' });
  }
});

/**
 * GET /api/challenge/user/:userId - Get challenges for a user
 * Returns challenges created by the user
 */
router.get('/user/:userId', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const challenges = getUserChallenges(userId);

    res.json({
      challenges,
      count: challenges.length
    });
  } catch (error) {
    console.error('Error getting user challenges:', error);
    res.status(500).json({ error: 'Failed to get user challenges' });
  }
});

export default router;
