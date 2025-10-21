"use client";

import React, { useState, useEffect } from 'react';
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

interface User {
  id: string;
  username: string;
  role: string;
  permissions: string[];
  created_at: string;
}

interface EditUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUserUpdated: (updatedUser: User) => void;
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

const EditUserDialog: React.FC<EditUserDialogProps> = ({ isOpen, onClose, user, onUserUpdated }) => {
  const { token, user: currentUser } = useAuth();
  const [username, setUsername] = useState<string>(user.username);
  const [role, setRole] = useState<string>(user.role);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(user.permissions);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  useEffect(() => {
    setUsername(user.username);
    setRole(user.role);
    setSelectedPermissions(user.permissions);
  }, [user]);

  const handlePermissionChange = (permission: string, checked: boolean) => {
    setSelectedPermissions((prev) =>
      checked ? [...prev, permission] : prev.filter((p) => p !== permission)
    );
  };

  const handleUpdateUser = async () => {
    if (!username.trim()) {
      showError('Username is required.');
      return;
    }

    if (!token) {
      showError('Authentication token not found. Please log in as an admin.');
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: username.trim(),
          role,
          permissions: selectedPermissions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update user');
      }

      const updatedUser: User = await response.json();
      showSuccess(`User '${updatedUser.username}' updated successfully!`);
      onUserUpdated(updatedUser); // Notify parent component of update
      onClose();
    } catch (error: any) {
      console.error('Error updating user:', error);
      showError(error.message || 'Failed to update user.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Only allow admin to edit users
  if (currentUser?.role !== 'admin') {
    return null; // Or render a message indicating lack of permission
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit User: {user.username}</DialogTitle>
          <DialogDescription>
            Update user details, role, and permissions.
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
              disabled={isUpdating}
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
              disabled={isUpdating}
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
                    disabled={isUpdating}
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
          <Button variant="outline" onClick={onClose} disabled={isUpdating} className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
            Cancel
          </Button>
          <Button onClick={handleUpdateUser} disabled={!username.trim() || isUpdating} className="hover:ring-2 hover:ring-blue-500">
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditUserDialog;