/**
 * Header Component
 *
 * App header with logo, notifications, and logout button.
 * Only shows logout when user is authenticated.
 */

import { useCallback, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { NotificationDropdown } from './NotificationDropdown';
import './Header.css';

interface HeaderProps {
  showLogout?: boolean;
}

export function Header({ showLogout = true }: HeaderProps) {
  const { userProfile, logout, isGuest, exitGuestMode } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setLoggingOut(false);
    }
  }, [logout]);

  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-logo">
          <span className="header-logo-icon">🏥</span>
          <span className="header-logo-text">Misdiagnose</span>
        </div>

        {/* Show login button for guests */}
        {isGuest && (
          <div className="header-user">
            <span className="header-guest-label">Guest</span>
            <button
              className="login-btn"
              onClick={exitGuestMode}
            >
              Login
            </button>
          </div>
        )}

        {/* Show user info, notifications, and logout for authenticated users */}
        {showLogout && userProfile && !isGuest && (
          <div className="header-user">
            <NotificationDropdown />
            <span className="header-username">{userProfile.username}</span>
            <button
              className="logout-btn"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
