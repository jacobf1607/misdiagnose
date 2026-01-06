import { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../../../shared/types';
import './ChatInterface.css';

interface ChatInterfaceProps {
  chatHistory: ChatMessage[];
  onAskQuestion: (question: string) => Promise<void>;
  disabled: boolean;
  patientName: string;
}

export function ChatInterface({
  chatHistory,
  onAskQuestion,
  disabled,
  patientName
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Focus input when not disabled
  useEffect(() => {
    if (!disabled && !isAsking) {
      inputRef.current?.focus();
    }
  }, [disabled, isAsking]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled || isAsking) return;

    const question = input.trim();
    setInput('');
    setIsAsking(true);

    try {
      await onAskQuestion(question);
    } finally {
      setIsAsking(false);
    }
  };

  const isEmpty = chatHistory.length === 0;

  return (
    <div className={`chat-interface ${isEmpty ? 'chat-empty' : ''}`}>
      <div className="chat-messages">
        {isEmpty && (
          <div className="chat-hint">
            <div className="chat-hint-icon">💬</div>
            <div className="chat-hint-title">Interview the Patient</div>
            <div className="chat-hint-text">Ask {patientName} questions to learn about their symptoms, medical history, and concerns.</div>
          </div>
        )}

        {chatHistory.map((msg) => (
          <div
            key={msg.id}
            className={`chat-message ${msg.role}`}
          >
            <div className="message-header">
              <span className="message-role">
                {msg.role === 'player' ? 'You (Doctor)' : patientName}
              </span>
              {msg.questionQuality && (
                <span className={`quality-badge quality-${getQualityLevel(msg.questionQuality)}`}>
                  Q: {msg.questionQuality}/10
                </span>
              )}
            </div>
            <div className="message-content">
              {msg.content}
            </div>
          </div>
        ))}

        {isAsking && (
          <div className="chat-message patient typing">
            <div className="message-header">
              <span className="message-role">{patientName}</span>
            </div>
            <div className="message-content">
              <span className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={disabled ? "Select a diagnosis to finish" : "Ask the patient a question..."}
          disabled={disabled || isAsking}
          className="chat-input"
        />
        <button
          type="submit"
          disabled={disabled || isAsking || !input.trim()}
          className="btn btn-primary send-btn"
        >
          {isAsking ? '...' : 'Ask'}
        </button>
      </form>
    </div>
  );
}

function getQualityLevel(quality: number): string {
  if (quality >= 8) return 'high';
  if (quality >= 5) return 'medium';
  return 'low';
}
