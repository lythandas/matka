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
import { ALL_PERMISSIONS, getPermissionDisplayName } from '@/lib/permissions';
import { API_BASE_URL } from '@/config/api'; // Centralized API_BASE_URL
import { Role } from '@/types'; // Centralized Role interface

interface CreateRoleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRoleCreated: () => void;
}

const CreateRoleDialog: React.FC<CreateRoleDialogProps> = ({ isOpen, onClose, onRoleCreated }) => {
  const { token } = useAuth();
  const [roleName, setRoleName] = useState<string>('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const handlePermissionChange = (permission: string, checked: boolean) => {
    setSelectedPermissions((prev) =>
      checked ? [...prev, permission] : prev.filter((p) => p !== permission)
    );
  };

  const handleCreateRole = async () => {
    if (!roleName.trim()) {
      showError('Role name is required.');
      return;
    }

    if (!token) {
      showError('Authentication token not found. Please log in as an admin.');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: roleName.trim(),
          permissions: selectedPermissions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create role');
      }

      showSuccess(`Role '${roleName}' created successfully!`);
      setRoleName('');
      setSelectedPermissions([]);
      onRoleCreated();
      onClose();
    } catch (error: any) {
      console.error('Error creating role:', error);
      showError(error.message || 'Failed to create role.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create new role</DialogTitle>
          <DialogDescription>
            Define a new role and assign specific permissions to it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="role-name" className="text-right">
              Role name
            </Label>
            <Input
              id="role-name"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., Editor"
              disabled={isCreating}
            />
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
                  <Label htmlFor={`perm-${perm}`}>
                    {getPermissionDisplayName(perm)}
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
          <Button onClick={handleCreateRole} disabled={!roleName.trim() || isCreating} className="hover:ring-2 hover:ring-blue-500">
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create role'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRoleDialog;