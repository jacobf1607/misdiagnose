/**
 * Phone Number Input Component
 *
 * Handles phone number input with country code.
 * Default country is India (+91).
 */

import React, { useState, useCallback } from 'react';

interface PhoneInputProps {
  onSubmit: (phoneNumber: string, buttonId: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

// Common country codes
const countryCodes = [
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+1', country: 'USA', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
];

export function PhoneInput({ onSubmit, loading, error }: PhoneInputProps) {
  const [countryCode, setCountryCode] = useState('+91'); // Default to India
  const [phoneNumber, setPhoneNumber] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const buttonId = 'send-otp-button';

  // Format phone number as user types (remove non-digits)
  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setPhoneNumber(value);
    setLocalError(null);
  }, []);

  // Validate and submit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!phoneNumber || phoneNumber.length < 10) {
      setLocalError('Please enter a valid phone number');
      return;
    }

    const fullNumber = `${countryCode}${phoneNumber}`;

    try {
      await onSubmit(fullNumber, buttonId);
    } catch (err) {
      // Error is handled by parent
    }
  }, [countryCode, phoneNumber, onSubmit]);

  const displayError = localError || error;

  return (
    <form className="phone-input-form" onSubmit={handleSubmit}>
      <div className="phone-input-header">
        <h2>Welcome to Misdiagnose</h2>
        <p>Enter your phone number to continue</p>
      </div>

      <div className="phone-input-container">
        <select
          className="country-code-select"
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value)}
          disabled={loading}
        >
          {countryCodes.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.code}
            </option>
          ))}
        </select>

        <input
          type="tel"
          className="phone-number-input"
          placeholder="Phone number"
          value={phoneNumber}
          onChange={handlePhoneChange}
          disabled={loading}
          autoFocus
          maxLength={15}
        />
      </div>

      {displayError && (
        <div className="auth-error">{displayError}</div>
      )}

      <button
        id={buttonId}
        type="submit"
        className="btn btn-primary auth-submit-btn"
        disabled={loading || !phoneNumber}
      >
        {loading ? 'Sending OTP...' : 'Send OTP'}
      </button>

      <p className="auth-hint">
        We'll send you a 6-digit verification code
      </p>
    </form>
  );
}
