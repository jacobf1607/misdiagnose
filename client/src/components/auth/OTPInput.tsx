/**
 * OTP Input Component
 *
 * 6-digit OTP input with auto-focus on next field.
 * Auto-submits when all 6 digits are entered.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';

interface OTPInputProps {
  onSubmit: (otp: string) => Promise<void>;
  onResend: () => void;
  onBack: () => void;
  loading: boolean;
  error: string | null;
}

const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 90;

export function OTPInput({ onSubmit, onResend, onBack, loading, error }: OTPInputProps) {
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [timeLeft, setTimeLeft] = useState(OTP_EXPIRY_SECONDS);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) {
      setCanResend(true);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Handle input change
  const handleChange = useCallback((index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-focus next input
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when complete
    if (digit && index === OTP_LENGTH - 1) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === OTP_LENGTH) {
        onSubmit(fullOtp);
      }
    }
  }, [otp, onSubmit]);

  // Handle key down for backspace navigation
  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [otp]);

  // Handle paste
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);

    if (pastedData) {
      const newOtp = [...otp];
      for (let i = 0; i < pastedData.length; i++) {
        newOtp[i] = pastedData[i];
      }
      setOtp(newOtp);

      // Focus last filled input or submit if complete
      if (pastedData.length === OTP_LENGTH) {
        onSubmit(pastedData);
      } else {
        inputRefs.current[pastedData.length]?.focus();
      }
    }
  }, [otp, onSubmit]);

  // Handle resend
  const handleResend = useCallback(() => {
    setOtp(Array(OTP_LENGTH).fill(''));
    setTimeLeft(OTP_EXPIRY_SECONDS);
    setCanResend(false);
    inputRefs.current[0]?.focus();
    onResend();
  }, [onResend]);

  // Manual submit
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otp.join('');
    if (fullOtp.length === OTP_LENGTH) {
      onSubmit(fullOtp);
    }
  }, [otp, onSubmit]);

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <form className="otp-input-form" onSubmit={handleSubmit}>
      <div className="otp-input-header">
        <h2>Verify OTP</h2>
        <p>Enter the 6-digit code sent to your phone</p>
      </div>

      <div className="otp-input-container">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            className="otp-digit-input"
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={loading}
            maxLength={1}
            autoComplete="one-time-code"
          />
        ))}
      </div>

      {error && (
        <div className="auth-error">{error}</div>
      )}

      <div className="otp-timer">
        {canResend ? (
          <button
            type="button"
            className="resend-btn"
            onClick={handleResend}
            disabled={loading}
          >
            Resend OTP
          </button>
        ) : (
          <span className="timer-text">
            Resend OTP in {formatTime(timeLeft)}
          </span>
        )}
      </div>

      <button
        type="submit"
        className="btn btn-primary auth-submit-btn"
        disabled={loading || otp.join('').length !== OTP_LENGTH}
      >
        {loading ? 'Verifying...' : 'Verify'}
      </button>

      <button
        type="button"
        className="back-btn"
        onClick={onBack}
        disabled={loading}
      >
        ← Change phone number
      </button>
    </form>
  );
}
