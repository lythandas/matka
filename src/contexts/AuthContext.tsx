"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { showError, showSuccess } from '@/utils/toast';

interface User {
  id: string;
  username: string;
  role: string;
  permissions: string[];
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  usersExist: boolean | null; // New state to track if any users exist
  fetchUsersExist: () => Promise<void>; // Function to fetch user existence status
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [usersExist, setUsersExist] = useState<boolean | null>(null); // null means loading/unknown

  const fetchUsersExist = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/exists`);
      if (!response.ok) {
        throw new Error('Failed to check user existence');
      }
      const data = await response.json();
      setUsersExist(data.exists);
    } catch (error) {
      console.error('Error fetching user existence:', error);
      showError('Failed to determine if users exist.');
      setUsersExist(false); // Assume no users exist if check fails
    }
  }, []);

  // Load auth state from localStorage on initial render
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('authUser');
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      } catch (error) {
        console.error("Failed to parse stored user data:", error);
        logout(); // Clear invalid data
      }
    }
    fetchUsersExist(); // Check user existence on app load
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
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('authUser', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setIsAuthenticated(true);
      showSuccess('Logged in successfully!');
    } catch (error: any) {
      console.error('Login error:', error);
      showError(error.message || 'Failed to log in.');
      logout(); // Ensure state is cleared on failed login
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    showSuccess('Logged out successfully!');
    setUsersExist(true); // Assume users still exist after logout
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, token, login, logout, usersExist, fetchUsersExist }}>
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