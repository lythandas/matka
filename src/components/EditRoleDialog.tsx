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
import { ALL_PERMISSIONS, getPermissionDisplayName } from '@/lib/permissions';
import { API_BASE_URL } from '@/config/api'; // Centralized API_BASE_URL
import { Role } from '@/types'; // Centralized Role interface

interface EditRoleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  role: Role;
  onRoleUpdated: (updatedRole: Role) => void;
}

const EditRoleDialog: React.FC<EditRoleDialogProps> = ({ isOpen, onClose, role, onRoleUpdated }) => {
  const { token } = useAuth();
  const [roleName, setRoleName] = useState<string>(role.name);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(role.permissions);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  useEffect(() => {
    setRoleName(role.name);
    setSelectedPermissions(role.permissions);
  }, [role]);

  const handlePermissionChange = (permission: string, checked: boolean) => {
    setSelectedPermissions((prev) =>
      checked ? [...prev, permission] : prev.filter((p) => p !== permission)
    );
  };

  const handleUpdateRole = async () => {
    if (!roleName.trim()) {
      showError('Role name is required.');
      return;
    }

    if (!token) {
      showError('Authentication token not found. Please log in as an admin.');
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/roles/${role.id}`, {
        method: 'PUT',
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
        throw new Error(errorData.message || 'Failed to update role');
      }

      const updatedRole: Role = await response.json();
      showSuccess(`Role '${updatedRole.name}' updated successfully!`);
      onRoleUpdated(updatedRole);
      onClose();
    } catch (error: any) {
      console.error('Error updating role:', error);
      showError(error.message || 'Failed to update role.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Role: {role.name}</DialogTitle>
          <DialogDescription>
            Update the name and permissions for this role.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="role-name" className="text-right">
              Role Name
            </Label>
            <Input
              id="role-name"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              className="col-span-3"
              placeholder="e.g., Editor"
              disabled={isUpdating || role.name === 'admin' || role.name === 'user'} // Prevent editing default role names
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
                    disabled={isUpdating}
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
          <Button variant="outline" onClick={onClose} disabled={isUpdating} className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
            Cancel
          </Button>
          <Button onClick={handleUpdateRole} disabled={!roleName.trim() || isUpdating} className="hover:ring-2 hover:ring-blue-500">
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

export default EditRoleDialog;