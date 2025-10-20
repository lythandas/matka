"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { showError } from '@/utils/toast';

interface RegisterDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const RegisterDialog: React.FC<RegisterDialogProps> = ({ isOpen, onClose }) => {
  const { login } = useAuth(); // We'll use login to handle the token after registration
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isRegistering, setIsRegistering] = useState<boolean>(false);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

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
      // After successful registration, automatically log in the user
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('authUser', JSON.stringify(data.user));
      // The AuthContext's useEffect will pick this up and update state
      onClose(); // Close the dialog
      window.location.reload(); // Reload to ensure all contexts and data are fresh
    } catch (error: any) {
      console.error('Registration error:', error);
      showError(error.message || 'Failed to register.');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Welcome! Register Your Admin Account</DialogTitle>
          <DialogDescription>
            This will be the first (and only) user you can register. This user will be an administrator.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleRegister} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="username" className="text-right">
              Username
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="col-span-3"
              placeholder="e.g., admin"
              disabled={isRegistering}
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="password" className="text-right">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="col-span-3"
              placeholder="••••••••"
              disabled={isRegistering}
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="confirm-password" className="text-right">
              Confirm Password
            </Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="col-span-3"
              placeholder="••••••••"
              disabled={isRegistering}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!username.trim() || !password.trim() || !confirmPassword.trim() || isRegistering} className="hover:ring-2 hover:ring-blue-500">
              {isRegistering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering...
                </>
              ) : (
                'Register Admin'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RegisterDialog;