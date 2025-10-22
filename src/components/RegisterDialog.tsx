"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { showError } from '@/utils/toast';
import { API_BASE_URL } from '@/config/api'; // Centralized API_BASE_URL

// Removed Dialog imports as it will no longer be a modal

interface RegisterDialogProps {
  // Removed onRegistrationSuccess prop as it's no longer needed
}

const RegisterDialog: React.FC<RegisterDialogProps> = () => { // Removed isOpen and onClose props
  const { setAuthData } = useAuth(); // Use setAuthData directly
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isRegistering, setIsRegistering] = useState<boolean>(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
      showError('All fields are required.');
      return;
    }

    if (password !== confirmPassword) {
      showError('Passwords do not match.');
      return;
    }

    setIsRegistering(true);
    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }

      const data = await response.json();
      setAuthData(data.user, data.token); // Immediately log in the user
      // LoginPage will handle unmounting this component on successful login
    } catch (error: any) {
      console.error('Registration error:', error);
      showError(error.message || 'Failed to register.');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="p-8 bg-card rounded-lg shadow-2xl max-w-sm w-full text-card-foreground shadow-neon-blue bg-gradient-blue-light">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">Welcome! Register your admin account</h2>
        <p className="text-sm text-muted-foreground mt-1">
          This will be the first (and only) user you can register. This user will be an administrator.
        </p>
      </div>
      <form onSubmit={handleRegister} className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g., admin"
            disabled={isRegistering}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={isRegistering}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            disabled={isRegistering}
            required
          />
        </div>
        <div className="flex justify-end mt-2">
          <Button type="submit" disabled={!username.trim() || !password.trim() || !confirmPassword.trim() || isRegistering} className="w-full hover:ring-2 hover:ring-blue-500">
            {isRegistering ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Registering...
              </>
            ) : (
              'Register admin'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default RegisterDialog;