/**
 * Username Input Component
 *
 * Shown to first-time users after OTP verification.
 * Username becomes their identifier in the app.
 */

import React, { useState, useCallback } from 'react';

interface UsernameInputProps {
  onSubmit: (username: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function UsernameInput({ onSubmit, loading, error }: UsernameInputProps) {
  const [username, setUsername] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  // Validate username format
  const validateUsername = useCallback((value: string): string | null => {
    if (value.length < 3) {
      return 'Username must be at least 3 characters';
    }
    if (value.length > 20) {
      return 'Username must be 20 characters or less';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      return 'Username can only contain letters, numbers, and underscores';
    }
    return null;
  }, []);

  // Handle input change
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    setLocalError(null);
  }, []);

  // Handle submit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateUsername(username);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    try {
      await onSubmit(username);
    } catch (err) {
      // Error is handled by parent
    }
  }, [username, validateUsername, onSubmit]);

  const displayError = localError || error;

  return (
    <form className="username-input-form" onSubmit={handleSubmit}>
      <div className="username-input-header">
        <h2>Welcome!</h2>
        <p>Choose a username to get started</p>
      </div>

      <div className="username-input-container">
        <input
          type="text"
          className="username-input"
          placeholder="Enter username"
          value={username}
          onChange={handleChange}
          disabled={loading}
          autoFocus
          maxLength={20}
        />
      </div>

      {displayError && (
        <div className="auth-error">{displayError}</div>
      )}

      <p className="username-hint">
        This will be your display name in the app
      </p>

      <button
        type="submit"
        className="btn btn-primary auth-submit-btn"
        disabled={loading || !username}
      >
        {loading ? 'Creating account...' : 'Continue'}
      </button>
    </form>
  );
}
