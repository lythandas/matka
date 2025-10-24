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
import { getAvatarInitials } from '@/lib/utils'; // Import getAvatarInitials
import { API_BASE_URL } from '@/config/api'; // Centralized API_BASE_URL
import { MAX_PROFILE_IMAGE_SIZE_BYTES, SUPPORTED_IMAGE_TYPES } from '@/config/constants'; // Updated import
import { User } from '@/types'; // Centralized User interface
import { ThreeButtonThemeToggle } from '@/components/ThreeButtonThemeToggle'; // Import ThreeButtonThemeToggle

interface ManageAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
}

const ManageAccountDialog: React.FC<ManageAccountDialogProps> = ({ isOpen, onClose, currentUser }) => {
  const { token, updateUser } = useAuth(); // Get token from useAuth
  const [name, setName] = useState<string>(currentUser.name || '');
  const [surname, setSurname] = useState<string>(currentUser.surname || '');
  const [profileImageUrl, setProfileImageUrl] = useState<string | undefined>(currentUser.profile_image_url);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null); // NEW STATE for local file preview
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(currentUser.name || '');
    setSurname(currentUser.surname || '');
    setProfileImageUrl(currentUser.profile_image_url);
    setLocalPreviewUrl(null); // Clear local preview on user change/dialog open
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

      const response = await fetch(`${API_BASE_URL}/upload-media`, { // Updated endpoint
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // Use token from context
        },
        body: JSON.stringify({ fileBase64: base64Data, fileType: file.type, isProfileImage: true }), // Pass isProfileImage
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload image');
      }

      const data = await response.json();
      // For profile images, mediaInfo.urls.medium will contain the URL
      setProfileImageUrl(data.mediaInfo.urls.medium || data.mediaInfo.urls.original);
      setLocalPreviewUrl(null); // Clear local preview once server URL is available
      showSuccess('Profile image uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading image:', error);
      showError(error.message || 'Failed to upload image.');
      setSelectedFile(null);
      setProfileImageUrl(currentUser.profile_image_url); // Revert to current user's image on error
      setLocalPreviewUrl(null); // Clear local preview on error
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];

      if (file.size > MAX_PROFILE_IMAGE_SIZE_BYTES) { // Use new constant
        showError(`Image size exceeds ${MAX_PROFILE_IMAGE_SIZE_BYTES / (1024 * 1024)}MB limit.`);
        setSelectedFile(null);
        setProfileImageUrl(currentUser.profile_image_url);
        setLocalPreviewUrl(null); // Clear local preview
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      if (!file.type.startsWith('image/')) {
        showError('Only image files are allowed for profile pictures.');
        setSelectedFile(null);
        setProfileImageUrl(currentUser.profile_image_url);
        setLocalPreviewUrl(null); // Clear local preview
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setSelectedFile(file);
      // Show a local preview immediately
      setLocalPreviewUrl(URL.createObjectURL(file));
      uploadImageToServer(file);
    } else {
      setSelectedFile(null);
      setProfileImageUrl(currentUser.profile_image_url);
      setLocalPreviewUrl(null); // Clear local preview
    }
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    setProfileImageUrl(undefined); // Set to undefined to clear it in the backend
    setLocalPreviewUrl(null); // Clear local preview
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
          'Authorization': `Bearer ${token}`, // Use token from context
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

  const currentImageSrc = localPreviewUrl || profileImageUrl; // Prioritize local preview

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Manage your account</DialogTitle>
          <DialogDescription>
            Update your personal information and profile picture.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col items-center gap-4 mb-4">
            <Avatar className="h-24 w-24">
              {currentImageSrc ? (
                <AvatarImage src={currentImageSrc} alt={currentUser.name || currentUser.username} />
              ) : (
                <AvatarFallback className="bg-blue-500 text-white text-4xl">
                  {getAvatarInitials(currentUser.name, currentUser.username)}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="flex items-center space-x-2">
              <Input
                id="profile-image-upload"
                type="file"
                accept={SUPPORTED_IMAGE_TYPES} // Use new constant
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
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  selectedFile ? selectedFile.name : (profileImageUrl ? "Change image" : "Upload image")
                )}
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
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Theme</Label>
            <div className="col-span-3">
              <ThreeButtonThemeToggle className="w-full justify-start" />
            </div>
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
              'Save changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageAccountDialog;