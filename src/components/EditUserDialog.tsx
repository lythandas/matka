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
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { showError, showSuccess } from '@/utils/toast';
import { getPermissionDisplayName } from '@/lib/permissions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface User {
  id: string;
  username: string;
  role: string; // Now role name
  permissions: string[]; // Permissions derived from the role
  created_at: string;
}

interface Role {
  id: string;
  name: string;
  permissions: string[];
}

interface EditUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUserUpdated: (updatedUser: User) => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const EditUserDialog: React.FC<EditUserDialogProps> = ({ isOpen, onClose, user, onUserUpdated }) => {
  const { token, user: currentUser } = useAuth();
  const [username, setUsername] = useState<string>(user.username);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [loadingRoles, setLoadingRoles] = useState<boolean>(true);
  const [currentRolePermissions, setCurrentRolePermissions] = useState<string[]>(user.permissions);

  useEffect(() => {
    setUsername(user.username);
    setCurrentRolePermissions(user.permissions); // Update permissions when user prop changes
    const fetchRoles = async () => {
      if (!token) return;
      setLoadingRoles(true);
      try {
        const response = await fetch(`${API_BASE_URL}/roles`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          throw new Error('Failed to fetch roles');
        }
        const data: Role[] = await response.json();
        setRoles(data);
        const userCurrentRole = data.find(r => r.name === user.role);
        setSelectedRoleId(userCurrentRole ? userCurrentRole.id : (data.length > 0 ? data[0].id : ''));
      } catch (error) {
        console.error('Error fetching roles:', error);
        showError('Failed to load roles for user editing.');
      } finally {
        setLoadingRoles(false);
      }
    };

    if (isOpen) {
      fetchRoles();
    }
  }, [isOpen, token, user]);

  // Update displayed permissions when selected role changes
  useEffect(() => {
    const selectedRole = roles.find(r => r.id === selectedRoleId);
    if (selectedRole) {
      setCurrentRolePermissions(selectedRole.permissions);
    } else {
      setCurrentRolePermissions([]);
    }
  }, [selectedRoleId, roles]);


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
          role_id: selectedRoleId,
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
            Update user details and role.
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
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId} disabled={isUpdating || loadingRoles || user.id === currentUser?.id}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {loadingRoles ? (
                  <SelectItem value="loading" disabled>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading roles...
                  </SelectItem>
                ) : (
                  roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right mt-2">Permissions (from selected role)</Label>
            <div className="col-span-3 space-y-2 p-2 border rounded-md bg-muted/50">
              {currentRolePermissions.length > 0 ? (
                currentRolePermissions.map((perm) => (
                  <div key={perm} className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    <span>{getPermissionDisplayName(perm)}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No permissions assigned to this role.</p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isUpdating} className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
            Cancel
          </Button>
          <Button onClick={handleUpdateUser} disabled={!username.trim() || !selectedRoleId || isUpdating} className="hover:ring-2 hover:ring-blue-500">
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