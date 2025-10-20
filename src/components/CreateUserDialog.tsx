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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { showError, showSuccess } from '@/utils/toast';

interface CreateUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const ALL_PERMISSIONS = [
  'create_post',
  'delete_post',
  'create_journey',
  'delete_journey',
  'manage_users',
  'edit_any_journey',
  'delete_any_journey',
  'delete_any_post',
];

const CreateUserDialog: React.FC<CreateUserDialogProps> = ({ isOpen, onClose }) => {
  const { token, user: currentUser } = useAuth();
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<string>('user'); // Default role
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const handlePermissionChange = (permission: string, checked: boolean) => {
    setSelectedPermissions((prev) =>
      checked ? [...prev, permission] : prev.filter((p) => p !== permission)
    );
  };

  const handleCreateUser = async () => {
    if (!username.trim() || !password.trim()) {
      showError('Username and password are required.');
      return;
    }

    if (!token) {
      showError('Authentication token not found. Please log in as an admin.');
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
          role,
          permissions: selectedPermissions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create user');
      }

      showSuccess(`User '${username}' created successfully!`);
      setUsername('');
      setPassword('');
      setRole('user');
      setSelectedPermissions([]);
      onClose();
    } catch (error: any) {
      console.error('Error creating user:', error);
      showError(error.message || 'Failed to create user.');
    } finally {
      setIsCreating(false);
    }
  };

  // Only allow admin to create users
  if (currentUser?.role !== 'admin') {
    return null; // Or render a message indicating lack of permission
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Create a new user account and assign their role and permissions.
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
              placeholder="e.g., john.doe"
              disabled={isCreating}
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
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="role" className="text-right">
              Role
            </Label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="col-span-3 p-2 border rounded-md bg-background text-foreground"
              disabled={isCreating}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right mt-2">Permissions</Label>
            <div className="col-span-3 space-y-2">
              {ALL_PERMISSIONS.map((perm) => (
                <div key={perm} className="flex items-center space-x-2">
                  <Checkbox
                    id={`perm-${perm}`}
                    checked={selectedPermissions.includes(perm)}
                    onCheckedChange={(checked) => handlePermissionChange(perm, !!checked)}
                    disabled={isCreating}
                  />
                  <Label htmlFor={`perm-${perm}`} className="capitalize">
                    {perm.replace(/_/g, ' ')}
                  </Label>
                </div>
              ))}
            </div>
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
              'Create User'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateUserDialog;