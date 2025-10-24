"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { showError, showSuccess } from '@/utils/toast';
import { API_BASE_URL } from '@/config/api'; // Centralized API_BASE_URL

// Updated User interface for the new permission model
interface User {
  id: string;
  username: string;
  isAdmin: boolean; // Simplified: first user is admin, others are not
  name?: string;
  surname?: string;
  profile_image_url?: string;
  created_at?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  usersExist: boolean | null; // New state to track if any users exist
  fetchUsersExist: () => Promise<void>; // Function to fetch user existence status
  updateUser: (updatedUserData: Partial<User>, newToken?: string) => void; // New function to update user in context
  setAuthData: (user: User, token: string) => void; // New function to directly set auth data
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [usersExist, setUsersExist] = useState<boolean | null>(null); // null means loading/unknown

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    showSuccess('Logged out successfully!');
    setUsersExist(true); // Assume users still exist after logout, or will be created
    console.log("AuthContext: User logged out.");
  }, []);

  const setAuthData = useCallback((userData: User, authToken: string) => {
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('authUser', JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
    setIsAuthenticated(true);
    setUsersExist(true); // After successful login/registration, we know users exist
    console.log("AuthContext: setAuthData called. User:", userData, "Is Admin:", userData.isAdmin);
  }, []);

  const fetchUsersExist = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/exists`);
      if (!response.ok) {
        throw new Error('Failed to check user existence');
      }
      const data = await response.json();
      setUsersExist(data.exists);
      console.log("AuthContext: Users exist check:", data.exists);
      if (!data.exists && isAuthenticated) { // If no users exist in DB but frontend thinks it's authenticated
        console.warn("No users found in backend, but frontend is authenticated. Forcing logout.");
        logout(); // Force logout to clear stale token
      }
    } catch (error) {
      console.error('Error fetching user existence:', error);
      showError('Failed to determine if users exist.');
      setUsersExist(false); // Assume no users exist if check fails
      if (isAuthenticated) {
        logout(); // Force logout if check fails and frontend is authenticated
      }
    }
  }, [isAuthenticated, logout, setAuthData]);

  // Load auth state from localStorage on initial render
  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('authUser');
    if (storedToken && storedUser) {
      try {
        const parsedUser: User = JSON.parse(storedUser); // Cast to new User type
        setAuthData(parsedUser, storedToken); // Use new setAuthData
      } catch (error) {
        console.error("Failed to parse stored user data:", error);
        logout(); // Clear invalid data
      }
    }
    fetchUsersExist(); // Check user existence on app load
  }, [fetchUsersExist, logout, setAuthData]); // Add setAuthData to dependencies

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
      setAuthData(data.user, data.token); // Use new setAuthData
      showSuccess('Logged in successfully!');
    } catch (error: any) {
      console.error('Login error:', error);
      showError(error.message || 'Failed to log in.');
      logout(); // Ensure state is cleared on failed login
    }
  }, [logout, setAuthData]);

  const updateUser = useCallback((updatedUserData: Partial<User>, newToken?: string) => {
    setUser((prevUser) => {
      if (!prevUser) return null;
      const newUser = { ...prevUser, ...updatedUserData };
      localStorage.setItem('authUser', JSON.stringify(newUser));
      console.log("AuthContext: User updated. New User:", newUser, "Is Admin:", newUser.isAdmin);
      return newUser;
    });
    if (newToken) {
      setToken(newToken);
      localStorage.setItem('authToken', newToken);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, token, login, logout, usersExist, fetchUsersExist, updateUser, setAuthData }}>
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