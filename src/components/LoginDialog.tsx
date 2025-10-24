"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next'; // Import useTranslation

const LoginDialog: React.FC = () => {
  const { t } = useTranslation(); // Initialize useTranslation
  const { login } = useAuth();
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    await login(username, password);
    setIsLoggingIn(false);
  };

  return (
    <div className="p-8 bg-card rounded-lg shadow-2xl max-w-sm w-full text-card-foreground shadow-neon-blue bg-gradient-blue-light">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">{t('auth.loginToYourAccount')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('auth.enterCredentials')}
        </p>
      </div>
      <form onSubmit={handleLogin} className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="username">{t('common.username')}</Label>
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
          <Label htmlFor="password">{t('common.password')}</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.passwordPlaceholder')}
            disabled={isLoggingIn}
            required
          />
        </div>
        <div className="flex justify-end mt-2">
          <Button type="submit" disabled={!username.trim() || !password.trim() || isLoggingIn} className="w-full hover:ring-2 hover:ring-blue-500">
            {isLoggingIn ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('auth.loggingIn')}
              </>
            ) : (
              t('auth.login')
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default LoginDialog;