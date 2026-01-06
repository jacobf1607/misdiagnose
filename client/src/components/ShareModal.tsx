/**
 * Share Modal Component
 * Shows challenge link with copy to clipboard functionality
 */

import { useState } from 'react';
import './ShareModal.css';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  challengeUrl: string;
  domain: string;
  grade: string;
}

export function ShareModal({ isOpen, onClose, challengeUrl, domain, grade }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Grammar: "an" before vowel sounds (A, F, S sound like "ay", "eff", "ess")
  const article = ['A', 'F', 'S'].includes(grade) ? 'an' : 'a';
  const shareMessage = `Think you can diagnose this ${domain} case better than me? I got ${article} ${grade}! ${challengeUrl}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyLinkOnly = async () => {
    try {
      await navigator.clipboard.writeText(challengeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleOpenWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal" onClick={e => e.stopPropagation()}>
        <div className="share-modal-header">
          <h2>Challenge Created!</h2>
          <button className="share-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="share-modal-body">
          <p className="share-instruction">Share this link with a friend to challenge them:</p>

          <div className="share-link-box">
            <code className="share-link">{challengeUrl}</code>
            <button
              className="btn btn-outline copy-link-btn"
              onClick={handleCopyLinkOnly}
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>

          <div className="share-message-section">
            <p className="share-label">Or copy the full message:</p>
            <div className="share-message-box">
              <p className="share-message">{shareMessage}</p>
            </div>
            <button
              className="btn btn-primary copy-message-btn"
              onClick={handleCopy}
            >
              {copied ? 'Copied!' : 'Copy Message'}
            </button>
          </div>

          <div className="share-divider">
            <span>or</span>
          </div>

          <button
            className="btn btn-whatsapp share-whatsapp-btn"
            onClick={handleOpenWhatsApp}
          >
            Open WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
