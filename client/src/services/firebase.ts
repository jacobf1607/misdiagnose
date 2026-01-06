/**
 * Firebase Configuration and Initialization
 *
 * This module initializes Firebase and exports auth-related utilities
 * for phone number authentication with OTP.
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  browserLocalPersistence,
  setPersistence,
  ConfirmationResult,
  User as FirebaseUser
} from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDVMkbi7Bmulw9LnTlmZQ66ldBQCh_w9zs",
  authDomain: "misdiagnose-29956.firebaseapp.com",
  projectId: "misdiagnose-29956",
  storageBucket: "misdiagnose-29956.firebasestorage.app",
  messagingSenderId: "842900878718",
  appId: "1:842900878718:web:cf17ccbb6d6a90729daf2f",
  measurementId: "G-GN465XJF64"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with local persistence (survives page reload)
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);

// Store for recaptcha verifier (singleton)
let recaptchaVerifier: RecaptchaVerifier | null = null;

// Store for confirmation result (needed to verify OTP)
let confirmationResult: ConfirmationResult | null = null;

/**
 * Initialize invisible reCAPTCHA verifier
 * Must be called before sending OTP
 * @param buttonId - The ID of the button that triggers OTP send
 */
export function initRecaptcha(buttonId: string): RecaptchaVerifier {
  // Clear existing verifier if any
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
  }

  recaptchaVerifier = new RecaptchaVerifier(auth, buttonId, {
    size: 'invisible',
    callback: () => {
      // reCAPTCHA solved - will proceed with OTP
      console.log('reCAPTCHA verified');
    },
    'expired-callback': () => {
      // reCAPTCHA expired - reset it
      console.log('reCAPTCHA expired');
    }
  });

  return recaptchaVerifier;
}

/**
 * Send OTP to phone number
 * @param phoneNumber - Full phone number with country code (e.g., +919876543210)
 * @returns Promise that resolves when OTP is sent
 */
export async function sendOTP(phoneNumber: string): Promise<void> {
  if (!recaptchaVerifier) {
    throw new Error('reCAPTCHA not initialized. Call initRecaptcha first.');
  }

  try {
    confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    console.log('OTP sent successfully');
  } catch (error: any) {
    // Reset recaptcha on error
    recaptchaVerifier.clear();
    recaptchaVerifier = null;

    // Provide user-friendly error messages
    if (error.code === 'auth/invalid-phone-number') {
      throw new Error('Invalid phone number format');
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error('Too many attempts. Please try again later.');
    } else if (error.code === 'auth/quota-exceeded') {
      throw new Error('SMS quota exceeded. Please try again later.');
    }
    throw error;
  }
}

/**
 * Verify OTP entered by user
 * @param otp - 6-digit OTP code
 * @returns Promise that resolves with the authenticated user
 */
export async function verifyOTP(otp: string): Promise<FirebaseUser> {
  if (!confirmationResult) {
    throw new Error('No OTP request pending. Please request a new OTP.');
  }

  try {
    const result = await confirmationResult.confirm(otp);
    console.log('OTP verified successfully');

    // Clear the confirmation result after successful verification
    confirmationResult = null;

    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/invalid-verification-code') {
      throw new Error('Invalid OTP. Please check and try again.');
    } else if (error.code === 'auth/code-expired') {
      throw new Error('OTP has expired. Please request a new one.');
    }
    throw error;
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  await auth.signOut();
  confirmationResult = null;
  if (recaptchaVerifier) {
    recaptchaVerifier.clear();
    recaptchaVerifier = null;
  }
}

/**
 * Get the current authenticated user
 */
export function getCurrentUser(): FirebaseUser | null {
  return auth.currentUser;
}

// Export auth instance for direct access if needed
export { auth };
export type { FirebaseUser };
