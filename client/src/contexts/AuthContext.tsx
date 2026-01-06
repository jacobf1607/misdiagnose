/**
 * Authentication Context
 *
 * Provides authentication state and methods throughout the app.
 * Handles Firebase auth state changes and user profile management.
 */

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  initRecaptcha,
  sendOTP as firebaseSendOTP,
  verifyOTP as firebaseVerifyOTP,
  signOut as firebaseSignOut,
  FirebaseUser
} from '../services/firebase';
import { API_BASE } from '../services/api';

// App user profile (stored in our backend)
export interface UserProfile {
  uid: string;
  phone_number: string;
  username: string;
  created_at: number;
  last_login: number;
  is_test_user?: boolean;
}

// Auth context state
interface AuthContextType {
  // State
  firebaseUser: FirebaseUser | null;  // Firebase auth user
  userProfile: UserProfile | null;     // Our app's user profile
  loading: boolean;                    // Initial auth check loading
  error: string | null;                // Auth error message
  isTestUser: boolean;                 // Whether user is a test/dev account
  isGuest: boolean;                    // Whether user is in guest mode

  // Auth flow state
  otpSent: boolean;                    // Whether OTP has been sent
  otpLoading: boolean;                 // Sending/verifying OTP
  needsUsername: boolean;              // First-time user needs to set username

  // Methods
  sendOTP: (phoneNumber: string, buttonId: string) => Promise<void>;
  verifyOTP: (otp: string) => Promise<void>;
  setUsername: (username: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  resetAuthFlow: () => void;
  continueAsGuest: () => void;         // Enter guest mode
  exitGuestMode: () => void;           // Exit guest mode to show login
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Firebase user state
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Guest mode state - default to true so users can play immediately
  const [isGuest, setIsGuest] = useState(true);

  // Auth flow state
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [pendingPhoneNumber, setPendingPhoneNumber] = useState<string | null>(null);

  // Result type for fetchUserProfile to distinguish 404 from network errors
  type FetchProfileResult =
    | { user: UserProfile; notFound: false; networkError: false }
    | { user: null; notFound: true; networkError: false }
    | { user: null; notFound: false; networkError: true };

  // Fetch user profile from backend
  // IMPORTANT: Distinguishes between "user not found" (404) and "network error"
  // This prevents treating network failures as "new user"
  const fetchUserProfile = useCallback(async (uid: string): Promise<FetchProfileResult> => {
    try {
      const response = await fetch(`${API_BASE}/user/${uid}`);

      if (response.ok) {
        const data = await response.json();
        return { user: data.user, notFound: false, networkError: false };
      }

      if (response.status === 404) {
        // User genuinely doesn't exist
        return { user: null, notFound: true, networkError: false };
      }

      // Other HTTP errors (500, etc.) - treat as network error
      console.error('Failed to fetch user profile: HTTP', response.status);
      return { user: null, notFound: false, networkError: true };
    } catch (err) {
      // Network error (CORS, timeout, etc.) - NOT the same as "user not found"
      console.error('Network error fetching user profile:', err);
      return { user: null, notFound: false, networkError: true };
    }
  }, []);

  // Create or update user in backend
  const createOrUpdateUser = useCallback(async (
    uid: string,
    phoneNumber: string,
    username?: string
  ): Promise<UserProfile> => {
    const response = await fetch(`${API_BASE}/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, phone_number: phoneNumber, username })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to create user');
    }

    const data = await response.json();
    return data.user;
  }, []);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (user) {
        // User is signed in - fetch their profile
        const result = await fetchUserProfile(user.uid);

        if (result.user) {
          // Existing user found
          setUserProfile(result.user);
          setNeedsUsername(false);
          setIsGuest(false);
          setError(null);
        } else if (result.notFound) {
          // User genuinely doesn't exist - needs to set username
          setNeedsUsername(true);
          setPendingPhoneNumber(user.phoneNumber);
          setError(null);
        } else if (result.networkError) {
          // Network error - DO NOT assume new user, show error
          setError('Unable to connect to server. Please check your connection and try again.');
          // Keep user in limbo state - don't set needsUsername
          setNeedsUsername(false);
        }
      } else {
        // User is signed out - back to guest mode
        setUserProfile(null);
        setNeedsUsername(false);
        setIsGuest(true);
        setError(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchUserProfile]);

  // Send OTP to phone number
  const sendOTP = useCallback(async (phoneNumber: string, buttonId: string) => {
    setError(null);
    setOtpLoading(true);

    try {
      // Initialize invisible reCAPTCHA on the button
      initRecaptcha(buttonId);

      // Send OTP
      await firebaseSendOTP(phoneNumber);
      setPendingPhoneNumber(phoneNumber);
      setOtpSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
      throw err;
    } finally {
      setOtpLoading(false);
    }
  }, []);

  // Verify OTP
  const verifyOTP = useCallback(async (otp: string) => {
    setError(null);
    setOtpLoading(true);

    try {
      const user = await firebaseVerifyOTP(otp);

      // Check if user exists in our backend
      const result = await fetchUserProfile(user.uid);

      if (result.user) {
        // Existing user - update last_login
        const updatedProfile = await createOrUpdateUser(
          user.uid,
          user.phoneNumber || pendingPhoneNumber || ''
        );
        setUserProfile(updatedProfile);
        setNeedsUsername(false);
        setIsGuest(false);
      } else if (result.notFound) {
        // New user - needs to set username
        setNeedsUsername(true);
      } else if (result.networkError) {
        // Network error - show error, don't assume new user
        setError('Unable to connect to server. Please try again.');
        // User is authenticated in Firebase but we can't check backend
        // Don't set needsUsername to avoid accidental account creation
      }

      setOtpSent(false);
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
      throw err;
    } finally {
      setOtpLoading(false);
    }
  }, [fetchUserProfile, createOrUpdateUser, pendingPhoneNumber]);

  // Set username for first-time users
  const setUsername = useCallback(async (username: string) => {
    if (!firebaseUser) {
      throw new Error('No authenticated user');
    }

    setError(null);
    setOtpLoading(true);

    try {
      const profile = await createOrUpdateUser(
        firebaseUser.uid,
        firebaseUser.phoneNumber || pendingPhoneNumber || '',
        username
      );
      setUserProfile(profile);
      setNeedsUsername(false);
      setPendingPhoneNumber(null);
      setIsGuest(false); // No longer a guest after setting username
    } catch (err: any) {
      setError(err.message || 'Failed to set username');
      throw err;
    } finally {
      setOtpLoading(false);
    }
  }, [firebaseUser, createOrUpdateUser, pendingPhoneNumber]);

  // Logout
  const logout = useCallback(async () => {
    try {
      await firebaseSignOut();
      setUserProfile(null);
      setOtpSent(false);
      setNeedsUsername(false);
      setPendingPhoneNumber(null);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to logout');
      throw err;
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Reset auth flow (go back to phone input)
  const resetAuthFlow = useCallback(() => {
    setOtpSent(false);
    setError(null);
  }, []);

  // Enter guest mode
  const continueAsGuest = useCallback(() => {
    setIsGuest(true);
    setError(null);
  }, []);

  // Exit guest mode (to show login)
  const exitGuestMode = useCallback(() => {
    setIsGuest(false);
    setError(null);
  }, []);

  // Check if user is a test/dev account (set via CLI: npm run set-test-user)
  const isTestUser = userProfile?.is_test_user === true;

  const value: AuthContextType = {
    firebaseUser,
    userProfile,
    loading,
    error,
    isTestUser,
    isGuest,
    otpSent,
    otpLoading,
    needsUsername,
    sendOTP,
    verifyOTP,
    setUsername,
    logout,
    clearError,
    resetAuthFlow,
    continueAsGuest,
    exitGuestMode
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
