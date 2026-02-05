import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getCurrentUser, logout as logoutApi, updateUserPreferences } from '../lib/auth';
import type { User, UserPreferences } from '../lib/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => Promise<void>;
  updatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  refreshUser: () => Promise<void>;
  clearLoading: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Failed to refresh user:', error);
      setUser(null);
    }
  };

  useEffect(() => {
    // Check for existing session on mount
    const initAuth = async () => {
      setIsLoading(true);

      // If we're in the middle of an OAuth flow (verifier exists) AND we're on
      // the callback page, stay loading - the callback will handle it.
      // Otherwise, the verifier is stale (e.g., failed OAuth, navigated away) - clean it up.
      const isOAuthInProgress = sessionStorage.getItem('google_oauth_verifier') !== null;
      const isOnCallbackPage = window.location.pathname === '/auth/callback';

      if (isOAuthInProgress && isOnCallbackPage) {
        return;
      }

      if (isOAuthInProgress && !isOnCallbackPage) {
        sessionStorage.removeItem('google_oauth_verifier');
        sessionStorage.removeItem('google_oauth_state');
      }

      await refreshUser();
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = (newUser: User) => {
    setUser(newUser);
    setIsLoading(false);
  };

  const clearLoading = () => {
    setIsLoading(false);
  };

  const logout = async () => {
    try {
      await logoutApi();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  };

  const updatePreferences = async (preferences: Partial<UserPreferences>) => {
    if (!user) return;

    try {
      const updatedUser = await updateUserPreferences(preferences);
      setUser(updatedUser);
    } catch (error) {
      console.error('Failed to update preferences:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        updatePreferences,
        refreshUser,
        clearLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
