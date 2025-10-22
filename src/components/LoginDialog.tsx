"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// Removed Dialog imports as it will no longer be a modal

const LoginDialog: React.FC = () => { // Removed isOpen and onClose props
  const { login } = useAuth();
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    await login(username, password);
    setIsLoggingIn(false);
    // LoginPage will handle unmounting this component on successful login
  };

  return (
    <div className="p-8 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow-2xl max-w-sm w-full">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Login to Your Account</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Enter your credentials to access your journeys and posts.
        </p>
      </div>
      <form onSubmit={handleLogin} className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g., admin"
            disabled={isLoggingIn}
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
            disabled={isLoggingIn}
            required
          />
        </div>
        <div className="flex justify-end mt-2">
          <Button type="submit" disabled={!username.trim() || !password.trim() || isLoggingIn} className="w-full hover:ring-2 hover:ring-blue-500">
            {isLoggingIn ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Logging in...
              </>
            ) : (
              'Login'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default LoginDialog;