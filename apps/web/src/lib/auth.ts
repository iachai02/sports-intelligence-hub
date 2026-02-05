import type { User, UserPreferences } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface GoogleAuthRequest {
  code: string;
  redirect_uri: string;
  code_verifier?: string;
}

export async function googleAuth(request: GoogleAuthRequest): Promise<User> {
  const response = await fetch(`${API_URL}/api/v1/auth/google`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Authentication failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const response = await fetch(`${API_URL}/api/v1/auth/me`, {
      credentials: 'include',
    });

    if (response.status === 401) {
      return null;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    // Network error or other issue - treat as not authenticated
    console.error('Failed to get current user:', error);
    return null;
  }
}

export async function updateUserPreferences(preferences: Partial<UserPreferences>): Promise<User> {
  const response = await fetch(`${API_URL}/api/v1/auth/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ preferences }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export async function logout(): Promise<void> {
  const response = await fetch(`${API_URL}/api/v1/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
}
