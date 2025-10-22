"use client";

import React, { useState, useEffect } from 'react';
import { Compass, Loader2 } from 'lucide-react';
import LoginDialog from '@/components/LoginDialog';
import RegisterDialog from '@/components/RegisterDialog';
import { useAuth } from '@/contexts/AuthContext';
import { showError } from '@/utils/toast'; // Keep showError for other potential issues

const LoginPage: React.FC = () => {
  const { isAuthenticated, usersExist, fetchUsersExist } = useAuth();
  const [showRegister, setShowRegister] = useState<boolean>(false);

  useEffect(() => {
    // Fetch user existence status on component mount
    fetchUsersExist();
  }, [fetchUsersExist]);

  useEffect(() => {
    // Determine whether to show register or login dialog
    if (usersExist !== null) {
      setShowRegister(usersExist === false);
    }
  }, [usersExist]);

  // If already authenticated, this page shouldn't be shown
  if (isAuthenticated) {
    return null; // Or redirect to home, but App.tsx handles routing
  }

  const handleRegistrationSuccess = () => {
    fetchUsersExist(); // Re-check user status after registration
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-background">
      {/* Matka Logo and Name */}
      <div className="absolute top-6 left-6 flex items-center z-10">
        <Compass className="mr-2 h-8 w-8 text-blue-600 dark:text-foreground" />
        <h1 className="text-3xl font-extrabold text-blue-600 dark:text-foreground">Matka</h1>
      </div>

      {/* Central Dialog */}
      <div className="relative z-10 p-4">
        {usersExist === null ? (
          <div className="flex flex-col items-center justify-center p-8 bg-card rounded-lg shadow-2xl max-w-sm w-full text-card-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-lg">Checking user status...</p>
          </div>
        ) : showRegister ? (
          <RegisterDialog onRegistrationSuccess={handleRegistrationSuccess} />
        ) : (
          <LoginDialog />
        )}
      </div>
    </div>
  );
};

export default LoginPage;