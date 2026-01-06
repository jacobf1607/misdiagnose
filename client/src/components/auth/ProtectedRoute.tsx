/**
 * Protected Route Component
 *
 * Wraps routes that require authentication.
 * Allows guest mode for playing without login.
 * Redirects to login page if user is not authenticated and not a guest.
 */

import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LoginPage } from './LoginPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { firebaseUser, userProfile, loading, needsUsername, isGuest } = useAuth();

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Guest mode - allow access without authentication
  if (isGuest) {
    return <>{children}</>;
  }

  // Not authenticated - show login
  if (!firebaseUser) {
    return <LoginPage />;
  }

  // Authenticated but needs to set username - show login flow
  if (needsUsername) {
    return <LoginPage />;
  }

  // Authenticated and has profile - show protected content
  if (userProfile) {
    return <>{children}</>;
  }

  // Edge case: authenticated but no profile yet (loading profile)
  return (
    <div className="auth-loading">
      <div className="auth-loading-spinner"></div>
      <p>Setting up your account...</p>
    </div>
  );
}

// Add these styles to your global CSS or a separate file
const styles = `
.auth-loading {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  background: var(--gray-50);
}

.auth-loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--gray-200);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.auth-loading p {
  color: var(--gray-500);
  font-size: 0.875rem;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}
