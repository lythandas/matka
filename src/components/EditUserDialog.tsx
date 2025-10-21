"use client";

import React, { useState, useEffect, useRef } from 'react';
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
import { Loader2, Upload, XCircle } from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarInitials } from '@/lib/utils'; // Import getAvatarInitials
import { API_BASE_URL } from '@/config/api'; // Centralized API_BASE_URL
import { MAX_IMAGE_SIZE_BYTES } from '@/config/constants'; // Centralized MAX_IMAGE_SIZE_BYTES
import { User, Role } from '@/types'; // Centralized User and Role interfaces

interface EditUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUserUpdated: (updatedUser: User) => void;
}

const EditUserDialog: React.FC<EditUserDialogProps> = ({ isOpen, onClose, user, onUserUpdated }) => {
  const { token, user: currentUser } = useAuth();
  const [username, setUsername] = useState<string>(user.username);
  const [name, setName] = useState<string>(user.name || '');
  const [surname, setSurname] = useState<string>(user.surname || '');
  const [profileImageUrl, setProfileImageUrl] = useState<string | undefined>(user.profile_image_url);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null); // NEW STATE for local file preview
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [loadingRoles, setLoadingRoles] = useState<boolean>(true);
  const [currentRolePermissions, setCurrentRolePermissions] = useState<string[]>(user.permissions);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUsername(user.username);
    setName(user.name || '');
    setSurname(user.surname || '');
    setProfileImageUrl(user.profile_image_url);
    setLocalPreviewUrl(null); // Clear local preview on user change/dialog open
    setSelectedFile(null); // Clear selected file on new user prop
    setCurrentRolePermissions(user.permissions);

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

  useEffect(() => {
    const selectedRole = roles.find(r => r.id === selectedRoleId);
    if (selectedRole) {
      setCurrentRolePermissions(selectedRole.permissions);
    } else {
      setCurrentRolePermissions([]);
    }
  }, [selectedRoleId, roles]);

  const uploadImageToServer = async (file: File) => {
    setIsUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      const base64Data: string = await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result.split(',')[1]);
          } else {
            reject(new Error("Failed to read image file."));
          }
        };
        reader.onerror = (error) => {
          console.error("FileReader error:", error);
          reject(new Error("Failed to read image file."));
        };
      });

      const response = await fetch(`${API_BASE_URL}/upload-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ imageBase64: base64Data, imageType: file.type }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload image');
      }

      const data = await response.json();
      setProfileImageUrl(data.imageUrls.medium || data.imageUrls.original);
      setLocalPreviewUrl(null); // Clear local preview once server URL is available
      showSuccess('Profile image uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading image:', error);
      showError(error.message || 'Failed to upload image.');
      setSelectedFile(null);
      setProfileImageUrl(user.profile_image_url); // Revert to current user's image on error
      setLocalPreviewUrl(null); // Clear local preview on error
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];

      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        showError(`Image size exceeds ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB limit.`);
        setSelectedFile(null);
        setProfileImageUrl(user.profile_image_url);
        setLocalPreviewUrl(null); // Clear local preview
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      if (!file.type.startsWith('image/')) {
        showError('Only image files are allowed.');
        setSelectedFile(null);
        setProfileImageUrl(user.profile_image_url);
        setLocalPreviewUrl(null); // Clear local preview
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setSelectedFile(file);
      setLocalPreviewUrl(URL.createObjectURL(file)); // Set local preview
      uploadImageToServer(file);
    } else {
      setSelectedFile(null);
      setProfileImageUrl(user.profile_image_url);
      setLocalPreviewUrl(null); // Clear local preview
    }
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    setProfileImageUrl(undefined);
    setLocalPreviewUrl(null); // Clear local preview
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    showSuccess('Profile image cleared.');
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
          role_id: selectedRoleId,
          name: name.trim() || null,
          surname: surname.trim() || null,
          profile_image_url: profileImageUrl || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update user');
      }

      const updatedUser: User = await response.json();
      showSuccess(`User '${updatedUser.username}' updated successfully!`);
      onUserUpdated(updatedUser);
      onClose();
    } catch (error: any) {
      console.error('Error updating user:', error);
      showError(error.message || 'Failed to update user.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (currentUser?.role !== 'admin') {
    return null;
  }

  const currentImageSrc = localPreviewUrl || profileImageUrl; // Prioritize local preview

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
          <div className="flex flex-col items-center gap-4 mb-4">
            <Avatar className="h-24 w-24">
              {currentImageSrc ? (
                <AvatarImage src={currentImageSrc} alt={user.name || user.username} />
              ) : (
                <AvatarFallback className="bg-blue-500 text-white text-4xl">
                  {getAvatarInitials(user.name, user.username)}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="flex items-center space-x-2">
              <Input
                id="profile-image-upload"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/bmp,image/tiff"
                onChange={handleImageFileChange}
                ref={fileInputRef}
                className="hidden"
                disabled={isUpdating || isUploadingImage}
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="flex-1 justify-center text-gray-600 dark:text-gray-400 hover:ring-2 hover:ring-blue-500 ring-inset"
                disabled={isUpdating || isUploadingImage}
              >
                {isUploadingImage ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {selectedFile ? selectedFile.name : (profileImageUrl ? "Change Image" : "Upload Image")}
              </Button>
              {profileImageUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleClearImage}
                  className="hover:ring-2 hover:ring-blue-500 ring-inset"
                  disabled={isUpdating || isUploadingImage}
                >
                  <XCircle className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
            {isUploadingImage && (
              <p className="text-sm text-center text-blue-500 dark:text-blue-400 mt-1">Uploading...</p>
            )}
          </div>

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
              disabled={isUpdating || isUploadingImage}
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
              placeholder="First Name (optional)"
              disabled={isUpdating || isUploadingImage}
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
              placeholder="Last Name (optional)"
              disabled={isUpdating || isUploadingImage}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="role" className="text-right">
              Role
            </Label>
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId} disabled={isUpdating || loadingRoles || user.id === currentUser?.id || isUploadingImage}>
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
          <Button variant="outline" onClick={onClose} disabled={isUpdating || isUploadingImage} className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
            Cancel
          </Button>
          <Button onClick={handleUpdateUser} disabled={!username.trim() || !selectedRoleId || isUpdating || isUploadingImage} className="hover:ring-2 hover:ring-blue-500">
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