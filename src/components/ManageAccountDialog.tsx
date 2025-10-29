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
import { Loader2, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { showError, showSuccess } from '@/utils/toast';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarInitials } from '@/lib/utils';
import { API_BASE_URL } from '@/config/api';
import { MAX_PROFILE_IMAGE_SIZE_BYTES, SUPPORTED_IMAGE_TYPES } from '@/config/constants';
import { User } from '@/types';
import { ThreeButtonThemeToggle } from '@/components/ThreeButtonThemeToggle';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import ImageCropper from './ImageCropper'; // Import the new ImageCropper component

interface ManageAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
}

const ManageAccountDialog: React.FC<ManageAccountDialogProps> = ({ isOpen, onClose, currentUser }) => {
  const { t } = useTranslation();
  const { token, updateUser } = useAuth();
  const [name, setName] = useState<string>(currentUser.name || '');
  const [surname, setSurname] = useState<string>(currentUser.surname || '');
  const [profileImageUrl, setProfileImageUrl] = useState<string | undefined>(currentUser.profile_image_url);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(currentUser.language || 'en');

  const [isCropperOpen, setIsCropperOpen] = useState<boolean>(false); // State for cropper dialog
  const [imageToCrop, setImageToCrop] = useState<string | null>(null); // Image source for cropper

  useEffect(() => {
    setName(currentUser.name || '');
    setSurname(currentUser.surname || '');
    setProfileImageUrl(currentUser.profile_image_url);
    setLocalPreviewUrl(null);
    setSelectedFile(null);
    setSelectedLanguage(currentUser.language || 'en');
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

      const response = await fetch(`${API_BASE_URL}/media/upload-media`, { // Updated endpoint
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ fileBase64: base64Data, fileType: file.type, isProfileImage: true }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload image');
      }

      const data = await response.json();
      setProfileImageUrl(data.mediaInfo.urls.medium || data.mediaInfo.urls.original);
      setLocalPreviewUrl(null);
      showSuccess(t('common.successProfileImageUpload'));
    } catch (error: any) {
      console.error('Error uploading image:', error);
      showError(error.message || t('common.errorUploadingImage'));
      setSelectedFile(null);
      setProfileImageUrl(currentUser.profile_image_url);
      setLocalPreviewUrl(null);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];

      if (file.size > MAX_PROFILE_IMAGE_SIZE_BYTES) {
        showError(t('common.imageSizeExceeds', { maxSize: MAX_PROFILE_IMAGE_SIZE_BYTES / (1024 * 1024) }));
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      if (!file.type.startsWith('image/')) {
        showError(t('common.onlyImageFilesAllowed'));
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setImageToCrop(e.target.result as string);
          setIsCropperOpen(true);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedFile(null);
      setProfileImageUrl(currentUser.profile_image_url);
      setLocalPreviewUrl(null);
    }
  };

  const handleCroppedImageUpload = async (croppedBlob: Blob) => {
    const croppedFile = new File([croppedBlob], selectedFile?.name || 'profile_image.jpeg', {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
    setLocalPreviewUrl(URL.createObjectURL(croppedFile)); // Show local preview of cropped image
    await uploadImageToServer(croppedFile);
    setSelectedFile(null); // Clear selected file after upload
    setImageToCrop(null); // Clear image to crop
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    setProfileImageUrl(undefined);
    setLocalPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    showSuccess(t('manageAccountDialog.profileImageCleared'));
  };

  const handleSave = async () => {
    if (!token) {
      showError(t('common.authRequiredUpdateProfile'));
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
          language: selectedLanguage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('common.failedToUpdateProfile'));
      }

      const data = await response.json();
      updateUser(data.user, data.token);
      i18n.changeLanguage(selectedLanguage);
      showSuccess(t('common.profileUpdatedSuccessfully'));
      onClose();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      showError(error.message || t('common.failedToUpdateProfile'));
    } finally {
      setIsSaving(false);
    }
  };

  const currentImageSrc = localPreviewUrl || profileImageUrl;

  return (
    <React.Fragment>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('manageAccountDialog.manageYourAccount')}</DialogTitle>
            <DialogDescription>
              {t('manageAccountDialog.updatePersonalInfo')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto p-4 space-y-4">
            <div className="flex flex-col items-center gap-4">
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
                  accept={SUPPORTED_IMAGE_TYPES}
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
                      {t('common.uploading')}
                    </>
                  ) : (
                    selectedFile ? selectedFile.name : (profileImageUrl ? t('manageAccountDialog.changeImage') : t('manageAccountDialog.uploadImage'))
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
                <p className="text-sm text-center text-blue-500 dark:text-blue-400 mt-1">{t('common.uploading')}</p>
              )}
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="username" className="text-right">
                {t('common.username')}
              </Label>
              <Input
                id="username"
                value={currentUser.username}
                className="col-span-3"
                disabled
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
                placeholder={t('manageAccountDialog.yourFirstName')}
                disabled={isSaving || isUploadingImage}
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
                placeholder={t('manageAccountDialog.yourLastName')}
                disabled={isSaving || isUploadingImage}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="language" className="text-right">
                {t('common.language')}
              </Label>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage} disabled={isSaving || isUploadingImage}>
                <SelectTrigger id="language" className="col-span-3">
                  <SelectValue placeholder={t('manageAccountDialog.selectLanguage')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">{t('manageAccountDialog.english')}</SelectItem>
                  <SelectItem value="fr">{t('manageAccountDialog.french')}</SelectItem>
                  <SelectItem value="de">{t('manageAccountDialog.german')}</SelectItem>
                  <SelectItem value="es">{t('manageAccountDialog.spanish')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">{t('common.theme')}</Label>
              <div className="col-span-3">
                <ThreeButtonThemeToggle className="w-full justify-start" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={isSaving || isUploadingImage} className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={isSaving || isUploadingImage} className="hover:ring-2 hover:ring-blue-500">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('common.saving')}
                </>
              ) : (
                t('common.saveChanges')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {imageToCrop && (
        <ImageCropper
          isOpen={isCropperOpen}
          imageSrc={imageToCrop}
          onClose={() => {
            setIsCropperOpen(false);
            setImageToCrop(null);
            if (fileInputRef.current) fileInputRef.current.value = ''; // Clear file input
          }}
          onCropComplete={handleCroppedImageUpload}
        />
      )}
    </React.Fragment>
  );
};

export default ManageAccountDialog;