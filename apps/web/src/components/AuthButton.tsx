import { LogIn, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useGoogleAuth } from '../hooks/useGoogleAuth';

export function AuthButton() {
  const { user, isLoading, logout } = useAuth();
  const { initiateGoogleAuth } = useGoogleAuth();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        {user.avatar_url && (
          <img
            src={user.avatar_url}
            alt={user.name || 'User'}
            className="h-8 w-8 rounded-full"
          />
        )}
        <span className="text-sm text-foreground hidden sm:inline">
          {user.name || user.email}
        </span>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={initiateGoogleAuth}
      className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
    >
      <LogIn className="h-4 w-4" />
      Sign in with Google
    </button>
  );
}
