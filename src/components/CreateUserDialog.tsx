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
import { User } from '@/types'; // Import User type
import { useTranslation } from 'react-i18next'; // Import useTranslation

interface CreateUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: (newUser: User) => void;
}

const CreateUserDialog: React.FC<CreateUserDialogProps> = ({ isOpen, onClose, onUserCreated }) => {
  const { t } = useTranslation(); // Initialize useTranslation
  const { token, user: currentUser } = useAuth();
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [surname, setSurname] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const handleCreateUser = async () => {
    if (!username.trim() || !password.trim()) {
      showError(t('common.usernameAndPasswordRequired')); // Translated error
      return;
    }

    if (!token || !currentUser?.isAdmin) {
      showError(t('common.authRequiredNotAuthorizedCreateUsers')); // Translated error
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
          name: name.trim() || null,
          surname: surname.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('common.failedToCreateUser')); // Translated error
      }

      const newUser: User = await response.json();
      showSuccess(t('common.userCreatedSuccessfully', { username: newUser.username })); // Translated success
      onUserCreated(newUser);
      onClose();
      setUsername('');
      setPassword('');
      setName('');
      setSurname('');
    } catch (error: any) {
      console.error('Error creating user:', error);
      showError(error.message || t('common.failedToCreateUser')); // Translated error
    } finally {
      setIsCreating(false);
    }
  };

  // Only allow admin to open this dialog
  if (!currentUser?.isAdmin) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('createUserDialog.createNewUser')}</DialogTitle>
          <DialogDescription>
            {t('createUserDialog.fillUserDetails')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="username" className="text-right">
              {t('common.username')}
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="col-span-3"
              placeholder={t('createUserDialog.newUsername')}
              disabled={isCreating}
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="password" className="text-right">
              {t('common.password')}
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="col-span-3"
              placeholder={t('createUserDialog.passwordPlaceholder')}
              disabled={isCreating}
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              {t('common.name')}
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              placeholder={t('createUserDialog.firstNameOptional')}
              disabled={isCreating}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="surname" className="text-right">
              {t('common.surname')}
            </Label>
            <Input
              id="surname"
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              className="col-span-3"
              placeholder={t('createUserDialog.lastNameOptional')}
              disabled={isCreating}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCreating} className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
            {t('common.cancel')}
          </Button>
          <Button onClick={handleCreateUser} disabled={!username.trim() || !password.trim() || isCreating} className="hover:ring-2 hover:ring-blue-500">
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('createUserDialog.creating')}
              </>
            ) : (
              t('createUserDialog.createUser')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateUserDialog;