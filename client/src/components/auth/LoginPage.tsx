/**
 * Login Page Component
 *
 * Orchestrates the full login flow:
 * 1. Phone number input
 * 2. OTP verification
 * 3. Username setup (first-time users only)
 */

import { useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { PhoneInput } from './PhoneInput';
import { OTPInput } from './OTPInput';
import { UsernameInput } from './UsernameInput';
import './LoginPage.css';

export function LoginPage() {
  const {
    otpSent,
    otpLoading,
    needsUsername,
    error,
    sendOTP,
    verifyOTP,
    setUsername,
    resetAuthFlow,
    clearError
  } = useAuth();

  // Handle phone number submission
  const handlePhoneSubmit = useCallback(async (phoneNumber: string, buttonId: string) => {
    await sendOTP(phoneNumber, buttonId);
  }, [sendOTP]);

  // Handle OTP verification
  const handleOTPSubmit = useCallback(async (otp: string) => {
    await verifyOTP(otp);
  }, [verifyOTP]);

  // Handle resend OTP
  const handleResendOTP = useCallback(() => {
    clearError();
    resetAuthFlow();
  }, [clearError, resetAuthFlow]);

  // Handle back to phone input
  const handleBack = useCallback(() => {
    clearError();
    resetAuthFlow();
  }, [clearError, resetAuthFlow]);

  // Handle username submission
  const handleUsernameSubmit = useCallback(async (username: string) => {
    await setUsername(username);
  }, [setUsername]);

  // Determine which step to show
  const renderStep = () => {
    if (needsUsername) {
      return (
        <UsernameInput
          onSubmit={handleUsernameSubmit}
          loading={otpLoading}
          error={error}
        />
      );
    }

    if (otpSent) {
      return (
        <OTPInput
          onSubmit={handleOTPSubmit}
          onResend={handleResendOTP}
          onBack={handleBack}
          loading={otpLoading}
          error={error}
        />
      );
    }

    return (
      <PhoneInput
        onSubmit={handlePhoneSubmit}
        loading={otpLoading}
        error={error}
      />
    );
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-logo">
          <span className="logo-icon">🏥</span>
          <span className="logo-text">Misdiagnose</span>
        </div>

        {renderStep()}

        <div className="login-footer">
          <p>Practice clinical reasoning with AI-powered cases</p>
        </div>
      </div>
    </div>
  );
}
