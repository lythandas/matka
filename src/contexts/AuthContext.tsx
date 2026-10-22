"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { showError, showSuccess } from '@/utils/toast';
import { API_BASE_URL } from '@/config/api';

interface User {
  id: string;
  username: string;
  isAdmin: boolean;
  name?: string;
  surname?: string;
  profile_image_url?: string;
  language?: string; // New: User's preferred language
  color_scheme?: string; // User's preferred color scheme
  created_at?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  usersExist: boolean | null;
  fetchUsersExist: () => Promise<void>;
  updateUser: (updatedUserData: Partial<User>, newToken?: string) => void;
  setAuthData: (user: User, token: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [usersExist, setUsersExist] = useState<boolean | null>(null);

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setUsersExist(true);
    if (import.meta.env.DEV) {
      console.log("AuthContext: User logged out.");
    }
  }, []);

  const setAuthData = useCallback((userData: User, authToken: string) => {
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('authUser', JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
    setIsAuthenticated(true);
    setUsersExist(true);
    if (import.meta.env.DEV) {
      console.log("AuthContext: setAuthData called. User:", userData, "Is Admin:", userData.isAdmin);
    }
  }, []);

  const fetchUsersExist = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/exists`);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (jsonError) {
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
        throw new Error(errorData.message || 'Failed to check user existence');
      }

      const data = await response.json();

      setUsersExist(data.exists);
      if (import.meta.env.DEV) {
        console.log("AuthContext: Users exist check:", data.exists);
      }
      if (!data.exists && isAuthenticated) {
        if (import.meta.env.DEV) {
          console.warn("No users found in backend, but frontend is authenticated. Forcing logout.");
        }
        logout();
      }
    } catch (error) {
      console.error('Error fetching user existence:', error);
      setUsersExist(false);
      if (isAuthenticated) {
        logout();
      }
    }
  }, [isAuthenticated, logout]);

  // Validate stored token on app load
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('authUser');

    if (!storedToken || !storedUser) {
      // No stored credentials — not authenticated
      setIsAuthLoading(false);
      fetchUsersExist();
      return;
    }

    // Validate the token by calling the profile endpoint
    (async () => {
      try {
        const parsedUser: User = JSON.parse(storedUser);
        const response = await fetch(`${API_BASE_URL}/users/profile`, {
          headers: { 'Authorization': `Bearer ${storedToken}` },
        });

        if (response.ok) {
          // Token is valid — restore the session
          const freshUser = await response.json();
          setToken(storedToken);
          setUser(freshUser);
          setIsAuthenticated(true);
          setUsersExist(true);
          // Update localStorage with fresh user data
          localStorage.setItem('authUser', JSON.stringify(freshUser));
        } else {
          // Token is expired or invalid — clear it
          if (import.meta.env.DEV) {
            console.log("AuthContext: Stored token is invalid, clearing.");
          }
          localStorage.removeItem('authToken');
          localStorage.removeItem('authUser');
        }
      } catch (error) {
        console.error("Failed to validate stored token:", error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
      } finally {
        setIsAuthLoading(false);
        fetchUsersExist();
      }
    })();
  }, [fetchUsersExist]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      const data = await response.json();
      setAuthData(data.user, data.token);
      showSuccess('Logged in successfully!');
    } catch (error: any) {
      console.error('Login error:', error);
      showError(error.message || 'Failed to log in.');
      logout();
    }
  }, [logout, setAuthData]);

  const updateUser = useCallback((updatedUserData: Partial<User>, newToken?: string) => {
    setUser((prevUser) => {
      if (!prevUser) return null;
      const newUser = { ...prevUser, ...updatedUserData };
      localStorage.setItem('authUser', JSON.stringify(newUser));
      if (import.meta.env.DEV) {
        console.log("AuthContext: User updated. New User:", newUser, "Is Admin:", newUser.isAdmin);
      }
      return newUser;
    });
    if (newToken) {
      setToken(newToken);
      localStorage.setItem('authToken', newToken);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isAuthLoading, user, token, login, logout, usersExist, fetchUsersExist, updateUser, setAuthData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
