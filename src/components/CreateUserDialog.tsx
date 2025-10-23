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

interface CreateUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: (newUser: User) => void;
}

const CreateUserDialog: React.FC<CreateUserDialogProps> = ({ isOpen, onClose, onUserCreated }) => {
  const { token, user: currentUser } = useAuth();
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [surname, setSurname] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const handleCreateUser = async () => {
    if (!username.trim() || !password.trim()) {
      showError('Username and password are required.');
      return;
    }

    if (!token || !currentUser?.isAdmin) {
      showError('Authentication required or not authorized to create users.');
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
        throw new Error(errorData.message || 'Failed to create user');
      }

      const newUser: User = await response.json();
      showSuccess(`User '${newUser.username}' created successfully!`);
      onUserCreated(newUser);
      onClose();
      setUsername('');
      setPassword('');
      setName('');
      setSurname('');
    } catch (error: any) {
      console.error('Error creating user:', error);
      showError(error.message || 'Failed to create user.');
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
          <DialogTitle>Create new user</DialogTitle>
          <DialogDescription>
            Fill in the details for the new user account.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="username" className="text-right">
              Username
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="col-span-3"
              placeholder="e.g., newuser"
              disabled={isCreating}
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
              disabled={isCreating}
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              placeholder="First name (optional)"
              disabled={isCreating}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="surname" className="text-right">
              Surname
            </Label>
            <Input
              id="surname"
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              className="col-span-3"
              placeholder="Last name (optional)"
              disabled={isCreating}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isCreating} className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
            Cancel
          </Button>
          <Button onClick={handleCreateUser} disabled={!username.trim() || !password.trim() || isCreating} className="hover:ring-2 hover:ring-blue-500">
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create user'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateUserDialog;