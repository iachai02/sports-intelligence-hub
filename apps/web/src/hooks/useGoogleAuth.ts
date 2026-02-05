import { useCallback } from 'react';
import { googleAuth } from '../lib/auth';
import { useAuth } from '../contexts/AuthContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const REDIRECT_URI = `${window.location.origin}/auth/callback`;
const STORAGE_KEY = 'google_oauth_verifier';
const STATE_KEY = 'google_oauth_state';

function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return crypto.subtle.digest('SHA-256', data);
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = await sha256(verifier);
  return base64UrlEncode(hash);
}

export function useGoogleAuth() {
  const { login, clearLoading } = useAuth();

  const initiateGoogleAuth = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) {
      console.error('VITE_GOOGLE_CLIENT_ID is not configured');
      return;
    }

    // Generate PKCE code verifier and challenge
    const codeVerifier = generateRandomString(32);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Generate state for CSRF protection
    const state = generateRandomString(16);

    // Store verifier and state in sessionStorage
    sessionStorage.setItem(STORAGE_KEY, codeVerifier);
    sessionStorage.setItem(STATE_KEY, state);

    // Build Google OAuth URL
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: state,
      access_type: 'offline',
      prompt: 'consent',
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    window.location.href = authUrl;
  }, []);

  const handleCallback = useCallback(
    async (code: string, state: string): Promise<{ success: boolean; error?: string }> => {
      // Verify state
      const storedState = sessionStorage.getItem(STATE_KEY);
      if (state !== storedState) {
        clearLoading();
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STATE_KEY);
        return { success: false, error: 'Invalid state parameter' };
      }

      // Get code verifier
      const codeVerifier = sessionStorage.getItem(STORAGE_KEY);
      if (!codeVerifier) {
        clearLoading();
        sessionStorage.removeItem(STATE_KEY);
        return { success: false, error: 'Missing code verifier' };
      }

      try {
        // Exchange code for tokens
        const user = await googleAuth({
          code,
          redirect_uri: REDIRECT_URI,
          code_verifier: codeVerifier,
        });

        // Update auth context (this also clears loading state)
        login(user);

        return { success: true };
      } catch (error) {
        console.error('OAuth callback error:', error);
        clearLoading();
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Authentication failed',
        };
      } finally {
        // Always clean up storage
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STATE_KEY);
      }
    },
    [login, clearLoading]
  );

  return {
    initiateGoogleAuth,
    handleCallback,
  };
}
