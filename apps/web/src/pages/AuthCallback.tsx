import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { useGoogleAuth } from '../hooks/useGoogleAuth';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleCallback } = useGoogleAuth();
  const [error, setError] = useState<string | null>(null);
  const processedRef = useRef(false);

  useEffect(() => {
    // Guard against StrictMode double-invocation — OAuth codes are single-use
    if (processedRef.current) return;
    processedRef.current = true;

    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const errorParam = searchParams.get('error');

      if (errorParam) {
        sessionStorage.removeItem('google_oauth_verifier');
        sessionStorage.removeItem('google_oauth_state');
        setError(`Google authentication failed: ${errorParam}`);
        return;
      }

      if (!code || !state) {
        sessionStorage.removeItem('google_oauth_verifier');
        sessionStorage.removeItem('google_oauth_state');
        setError('Missing authorization code or state');
        return;
      }

      const result = await handleCallback(code, state);

      if (result.success) {
        setTimeout(() => navigate('/', { replace: true }), 100);
      } else {
        setError(result.error || 'Authentication failed');
      }
    };

    processCallback();
  }, [searchParams, handleCallback, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-6">
          <AlertCircle className="h-12 w-12 text-stat-negative mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Authentication Failed
          </h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent mx-auto mb-4" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}
