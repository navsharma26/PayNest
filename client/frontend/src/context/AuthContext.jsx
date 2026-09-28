import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const USER_SERVICE_URL = import.meta.env.VITE_USER_SERVICE_URL || 'http://localhost:4001';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('flow_access_token') || null);
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem('flow_user_data');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return null;
      }
    }
    // Default demo user profile for frictionless exploration
    return {
      userId: 'usr_01HXYZ1234567890',
      fullName: 'Jane Doe',
      email: 'jane.doe@flowbank.io',
      kycStatus: 'VERIFIED',
      tier: 'TIER_PREMIUM',
      walletId: 'wal_master_001',
    };
  });
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    if (token) {
      localStorage.setItem('flow_access_token', token);
    } else {
      localStorage.removeItem('flow_access_token');
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem('flow_user_data', JSON.stringify(user));
    } else {
      localStorage.removeItem('flow_user_data');
    }
  }, [user]);

  /**
   * Log in user using credentials
   */
  const login = async (email, password) => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(`${USER_SERVICE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Login failed');
      }

      setToken(json.data.tokens.accessToken);
      if (json.data.tokens.refreshToken) {
        localStorage.setItem('flow_refresh_token', json.data.tokens.refreshToken);
      }
      setUser({
        ...json.data.user,
        walletId: 'wal_master_001',
      });
      return { success: true };
    } catch (err) {
      setAuthError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Register a new user
   */
  const register = async ({ fullName, email, password, tier = 'TIER_STANDARD' }) => {
    setLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(`${USER_SERVICE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, tier }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || 'Registration failed');
      }

      setToken(json.data.tokens.accessToken);
      if (json.data.tokens.refreshToken) {
        localStorage.setItem('flow_refresh_token', json.data.tokens.refreshToken);
      }
      setUser({
        ...json.data.user,
        walletId: 'wal_master_001',
      });
      return { success: true };
    } catch (err) {
      setAuthError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Logout user and flush credentials
   */
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('flow_access_token');
    localStorage.removeItem('flow_refresh_token');
    localStorage.removeItem('flow_user_data');
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: Boolean(token || user),
        loading,
        authError,
        setAuthError,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
