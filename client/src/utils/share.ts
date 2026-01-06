/**
 * Share Utilities
 * Handles sharing challenges via WhatsApp and other platforms
 */

import type { GameMode } from '../types';
import { API_BASE } from '../services/api';

/**
 * Create a challenge and get the share URL
 */
export async function createChallenge(params: {
  caseId: string;
  caseDomain: string;
  gameMode: GameMode;
  challengerId: string;
  challengerName: string;
  challengerGrade: string;
  challengerScore: number;
}): Promise<{ challengeId: string; shareUrl: string }> {
  const response = await fetch(`${API_BASE}/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to create challenge');
  }

  const data = await response.json();
  return {
    challengeId: data.challengeId,
    shareUrl: `${window.location.origin}${data.shareUrl}`
  };
}

/**
 * Share challenge via WhatsApp
 */
export function shareViaWhatsApp(params: {
  challengeUrl: string;
  domain: string;
  grade: string;
}) {
  const message = `Think you can diagnose this ${params.domain} case better than me? I got ${params.grade}!`;
  const fullMessage = `${message} ${params.challengeUrl}`;

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(fullMessage)}`;
  window.open(whatsappUrl, '_blank');
}

/**
 * Share victory via WhatsApp
 */
export function shareVictoryViaWhatsApp(params: {
  opponentName: string;
  yourGrade: string;
  opponentGrade: string;
  domain: string;
}) {
  const message = `I just beat ${params.opponentName} on a ${params.domain} diagnosis challenge! My score: ${params.yourGrade} vs their ${params.opponentGrade}`;

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, '_blank');
}

/**
 * Copy challenge link to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Check if Web Share API is available
 */
export function canShare(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.share;
}

/**
 * Share using native share dialog (mobile)
 */
export async function shareNative(params: {
  title: string;
  text: string;
  url: string;
}): Promise<boolean> {
  if (!canShare()) {
    return false;
  }

  try {
    await navigator.share(params);
    return true;
  } catch (error) {
    // User cancelled or error
    console.error('Share failed:', error);
    return false;
  }
}
