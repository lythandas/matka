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
import { showError, showSuccess } from '@/utils/toast';
import { API_BASE_URL } from '@/config/api';
import { useTranslation } from 'react-i18next'; // Import useTranslation

interface ResetPasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  username: string;
}

const ResetPasswordDialog: React.FC<ResetPasswordDialogProps> = ({ isOpen, onClose, userId, username }) => {
  const { t } = useTranslation(); // Initialize useTranslation
  const { token, user: currentUser } = useAuth();
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isResetting, setIsResetting] = useState<boolean>(false);

  const handleResetPassword = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      showError(t('common.newPasswordConfirmRequired')); // Translated error
      return;
    }
    if (newPassword !== confirmPassword) {
      showError(t('common.passwordsDoNotMatch')); // Translated error
      return;
    }
    if (newPassword.length < 6) { // Basic password strength check
      showError(t('common.passwordMinLength')); // Translated error
      return;
    }

    if (!token || !currentUser?.isAdmin) {
      showError(t('common.authRequiredNotAuthorizedResetPasswords')); // Translated error
      return;
    }

    setIsResetting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}/reset-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('common.failedToResetPassword')); // Translated error
      }

      showSuccess(t('common.passwordResetSuccessfully', { username })); // Translated success
      onClose();
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      showError(error.message || t('common.failedToResetPassword')); // Translated error
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('resetPasswordDialog.resetPasswordFor', { username })}</DialogTitle>
          <DialogDescription>
            {t('resetPasswordDialog.enterNewPassword')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="new-password" className="text-right">
              {t('resetPasswordDialog.newPassword')}
            </Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="col-span-3"
              placeholder={t('createUserDialog.passwordPlaceholder')}
              disabled={isResetting}
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="confirm-password" className="text-right">
              {t('resetPasswordDialog.confirmPassword')}
            </Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="col-span-3"
              placeholder={t('createUserDialog.passwordPlaceholder')}
              disabled={isResetting}
              required
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isResetting} className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleResetPassword} disabled={!newPassword.trim() || !confirmPassword.trim() || isResetting} className="hover:ring-2 hover:ring-blue-500">
            {isResetting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('resetPasswordDialog.resetting')}
              </>
            ) : (
              t('resetPasswordDialog.resetPassword')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ResetPasswordDialog;