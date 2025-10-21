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
import { Loader2, Upload, XCircle, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { showError, showSuccess } from '@/utils/toast';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface User {
  id: string;
  username: string;
  role: string;
  permissions: string[];
  name?: string;
  surname?: string;
  profile_image_url?: string;
}

interface ManageAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

const ManageAccountDialog: React.FC<ManageAccountDialogProps> = ({ isOpen, onClose, currentUser }) => {
  const { token, updateUser } = useAuth();
  const [name, setName] = useState<string>(currentUser.name || '');
  const [surname, setSurname] = useState<string>(currentUser.surname || '');
  const [profileImageUrl, setProfileImageUrl] = useState<string | undefined>(currentUser.profile_image_url);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(currentUser.name || '');
    setSurname(currentUser.surname || '');
    setProfileImageUrl(currentUser.profile_image_url);
    setSelectedFile(null); // Clear selected file on dialog open/user change
  }, [currentUser, isOpen]);

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
      // Assuming the backend returns an object with different sizes, we'll use the medium or original for profile
      setProfileImageUrl(data.imageUrls.medium || data.imageUrls.original);
      showSuccess('Profile image uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading image:', error);
      showError(error.message || 'Failed to upload image.');
      setSelectedFile(null);
      setProfileImageUrl(currentUser.profile_image_url); // Revert to current user's image on error
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];

      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        showError('Image size exceeds 8MB limit.');
        setSelectedFile(null);
        setProfileImageUrl(currentUser.profile_image_url);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      if (!file.type.startsWith('image/')) {
        showError('Only image files are allowed.');
        setSelectedFile(null);
        setProfileImageUrl(currentUser.profile_image_url);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setSelectedFile(file);
      // Show a local preview immediately
      setProfileImageUrl(URL.createObjectURL(file));
      uploadImageToServer(file);
    } else {
      setSelectedFile(null);
      setProfileImageUrl(currentUser.profile_image_url);
    }
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    setProfileImageUrl(undefined); // Set to undefined to clear it in the backend
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    showSuccess('Profile image cleared.');
  };

  const handleSave = async () => {
    if (!token) {
      showError('Authentication required to update profile.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim() || null,
          surname: surname.trim() || null,
          profile_image_url: profileImageUrl || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }

      const data = await response.json();
      updateUser(data.user, data.token); // Update context and local storage
      showSuccess('Profile updated successfully!');
      onClose();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      showError(error.message || 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const fallbackInitials = currentUser.name ? currentUser.name.split(' ').map(n => n[0]).join('') : currentUser.username[0];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage Your Account</DialogTitle>
          <DialogDescription>
            Update your personal information and profile picture.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col items-center gap-4 mb-4">
            <Avatar className="h-24 w-24">
              {profileImageUrl ? (
                <AvatarImage src={profileImageUrl} alt={currentUser.name || currentUser.username} />
              ) : (
                <AvatarFallback className="bg-blue-500 text-white text-4xl">
                  {fallbackInitials}
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
                disabled={isSaving || isUploadingImage}
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="flex-1 justify-center text-gray-600 dark:text-gray-400 hover:ring-2 hover:ring-blue-500 ring-inset"
                disabled={isSaving || isUploadingImage}
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
                  disabled={isSaving || isUploadingImage}
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
              value={currentUser.username}
              className="col-span-3"
              disabled // Username cannot be changed here
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
              placeholder="Your first name"
              disabled={isSaving || isUploadingImage}
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
              placeholder="Your last name"
              disabled={isSaving || isUploadingImage}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving || isUploadingImage} className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isUploadingImage} className="hover:ring-2 hover:ring-blue-500">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
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

export default ManageAccountDialog;