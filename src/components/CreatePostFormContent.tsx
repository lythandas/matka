"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { showSuccess, showError } from '@/utils/toast';
import { format, parseISO } from 'date-fns'; // Ensure format is imported
import { Plus, XCircle, Edit, Upload, MapPin, LocateFixed, Search, Loader2, Save, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import MapComponent from '@/components/MapComponent';
import LocationSearch from './LocationSearch';
import PostDatePicker from './PostDatePicker';
import { API_BASE_URL } from '@/config/api';
import { MAX_CONTENT_FILE_SIZE_BYTES, SUPPORTED_MEDIA_TYPES } from '@/config/constants';
import { Post, MediaInfo, Journey, User, JourneyCollaborator } from '@/types';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '@/utils/date-locales';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { cn } from '@/lib/utils';

const AUTO_SAVE_INTERVAL_MS = 60 * 1000; // 1 minute

interface CreatePostFormContentProps {
  selectedJourney: Journey | null;
  user: User | null;
  token: string | null;
  journeyCollaborators: JourneyCollaborator[];
  onPostCreated: (newPost: Post) => void;
  onDraftSaved: () => void;
  fetchDrafts: (journeyId: string) => Promise<void>;
  fetchPosts: (journeyId: string) => Promise<void>;
  onClose?: () => void; // Optional, for when used in a dialog
}

const CreatePostFormContent: React.FC<CreatePostFormContentProps> = ({
  selectedJourney,
  user,
  token,
  journeyCollaborators,
  onPostCreated,
  onDraftSaved,
  fetchDrafts,
  fetchPosts,
  onClose,
}) => {
  const { t } = useTranslation();
  const currentLocale = getDateFnsLocale();

  const [title, setTitle] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedMediaItems, setUploadedMediaItems] = useState<MediaInfo[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState<boolean>(false);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [locationSelectionMode, setLocationSelectionMode] = useState<'none' | 'current' | 'search'>('none');
  const [locationLoading, setLoadingLocation] = useState<boolean>(false);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const [postDate, setPostDate] = useState<Date | undefined>(new Date());
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);

  const canCreatePostUI = user && selectedJourney && (user.id === selectedJourney.user_id || user.isAdmin || journeyCollaborators.some(collab => collab.user_id === user.id && collab.can_publish_posts));

  useEffect(() => {
    // Reset form when selectedJourney changes
    resetForm();
  }, [selectedJourney]);

  const uploadMediaToServer = async (files: File[]) => {
    setIsUploadingMedia(true);
    const newUploadedMedia: MediaInfo[] = [];
    try {
      for (const file of files) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        const base64Data: string = await new Promise((resolve, reject) => {
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result.split(',')[1]);
            } else {
              reject(new Error("Failed to read file."));
            }
          };
          reader.onerror = (error) => {
            console.error("FileReader error:", error);
            reject(new Error("Failed to read file."));
          };
        });

        const response = await fetch(`${API_BASE_URL}/media/upload-media`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ fileBase64: base64Data, fileType: file.type, isProfileImage: false }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || t('common.failedToUploadMedia', { fileName: file.name }));
        }

        const data = await response.json();
        newUploadedMedia.push(data.mediaInfo);
      }
      setUploadedMediaItems((prev) => [...prev, ...newUploadedMedia]);
      setSelectedFiles([]);
      showSuccess(t('common.mediaUploadedSuccessfully'));
    } catch (error: any) {
      console.error('Error uploading media:', error);
      showError(error.message || t('common.failedToUploadMediaGeneric'));
      setSelectedFiles([]);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleMediaFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const files = Array.from(event.target.files);
      const validFiles: File[] = [];

      for (const file of files) {
        if (file.size > MAX_CONTENT_FILE_SIZE_BYTES) {
          showError(t('common.fileSizeExceeds', { fileName: file.name, maxSize: MAX_CONTENT_FILE_SIZE_BYTES / (1024 * 1024) }));
          continue;
        }
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
          showError(t('common.fileNotImageOrVideo', { fileName: file.name }));
          continue;
        }
        validFiles.push(file);
      }

      if (validFiles.length > 0) {
        setSelectedFiles(validFiles);
        uploadMediaToServer(validFiles);
      } else {
        setSelectedFiles([]);
      }
    } else {
      setSelectedFiles([]);
    }
    if (mediaFileInputRef.current) mediaFileInputRef.current.value = '';
  };

  const handleRemoveMediaItem = (indexToRemove: number) => {
    setUploadedMediaItems((prev) => prev.filter((_, index) => index !== indexToRemove));
    showSuccess(t('common.mediaItemRemoved'));
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      showError(t('common.geolocationNotSupported'));
      return;
    }

    setLoadingLocation(true);
    setLocationSelectionMode('current');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoordinates({ lat: latitude, lng: longitude });
        showSuccess(t('common.locationRetrievedSuccessfully'));
        setLoadingLocation(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMessage = t('common.failedToGetLocation');
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = t('common.permissionDeniedLocation');
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = t('common.locationUnavailable');
            break;
          case error.TIMEOUT:
            errorMessage = t('common.locationRequestTimedOut');
            break;
        }
        showError(errorMessage);
        setLoadingLocation(false);
        setCoordinates(null);
        setLocationSelectionMode('none');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleClearLocation = () => {
    setCoordinates(null);
    setLocationSelectionMode('none');
    showSuccess(t('common.locationCleared'));
  };

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setSelectedFiles([]);
    setUploadedMediaItems([]);
    setCoordinates(null);
    setLocationSelectionMode('none');
    setPostDate(new Date());
    setCurrentDraftId(null);
  };

  const saveDraft = useCallback(async () => {
    if (!user || !selectedJourney || isUploadingMedia || isSavingDraft) return;

    if (!canCreatePostUI) return;

    if (!title.trim() && !message.trim() && uploadedMediaItems.length === 0 && !coordinates) {
      return;
    }

    setIsSavingDraft(true);
    try {
      const postData = {
        journeyId: selectedJourney.id,
        title: title.trim() || undefined,
        message: message.trim(),
        media_items: uploadedMediaItems.length > 0 ? uploadedMediaItems : undefined,
        coordinates: coordinates || undefined,
        created_at: postDate ? postDate.toISOString() : undefined,
        is_draft: true,
      };

      let response;
      if (currentDraftId) {
        response = await fetch(`${API_BASE_URL}/posts/${currentDraftId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(postData),
        });
      } else {
        response = await fetch(`${API_BASE_URL}/posts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(postData),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('indexPage.failedToSaveDraft'));
      }

      const savedDraft: Post = await response.json();
      setCurrentDraftId(savedDraft.id);
      fetchDrafts(selectedJourney.id);
      onDraftSaved(); // Notify parent that a draft was saved
      showSuccess(t('indexPage.draftSavedSuccessfully'));
    } catch (error: any) {
      console.error('Error saving draft:', error);
      showError(error.message || t('indexPage.failedToSaveDraft'));
    } finally {
      setIsSavingDraft(false);
    }
  }, [user, selectedJourney, isUploadingMedia, isSavingDraft, canCreatePostUI, title, message, uploadedMediaItems, coordinates, postDate, currentDraftId, token, fetchDrafts, onDraftSaved, t]);

  useEffect(() => {
    let autoSaveTimer: number;
    if (user && selectedJourney) {
      autoSaveTimer = window.setInterval(saveDraft, AUTO_SAVE_INTERVAL_MS);
    }
    return () => {
      if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
      }
    };
  }, [user, selectedJourney, saveDraft]);

  const handleSubmit = async (event: React.FormEvent, publish: boolean = true) => {
    event.preventDefault();

    if (!user) {
      showError(t('common.authRequiredCreatePost'));
      return;
    }

    if (!selectedJourney) {
      showError(t('common.selectJourneyBeforePost'));
      return;
    }

    if (!canCreatePostUI) {
      showError(t('common.noPermissionCreatePost'));
      return;
    }

    if (!title.trim() && !message.trim() && uploadedMediaItems.length === 0 && !coordinates) {
      showError(t('common.atLeastTitleMessageMediaOrCoordsRequired'));
      return;
    }
    if (isUploadingMedia) {
      showError(t('common.pleaseWaitForMediaUploads'));
      return;
    }

    try {
      const postData = {
        journeyId: selectedJourney.id,
        title: title.trim() || undefined,
        message: message.trim(),
        media_items: uploadedMediaItems.length > 0 ? uploadedMediaItems : undefined,
        coordinates: coordinates || undefined,
        created_at: postDate ? postDate.toISOString() : undefined,
        is_draft: !publish,
      };

      let response;
      if (currentDraftId) {
        response = await fetch(`${API_BASE_URL}/posts/${currentDraftId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(postData),
        });
      } else {
        response = await fetch(`${API_BASE_URL}/posts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(postData),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || (publish ? t('common.failedToCreatePost') : t('indexPage.failedToSaveDraft')));
      }

      const resultPost: Post = await response.json();
      if (publish) {
        onPostCreated(resultPost); // Notify parent
        showSuccess(t('common.postCreatedSuccessfully'));
      } else {
        fetchDrafts(selectedJourney.id);
        onDraftSaved(); // Notify parent that a draft was saved
        showSuccess(t('indexPage.draftSavedSuccessfully'));
      }
      resetForm();
      onClose?.(); // Close dialog if provided
    } catch (error: any) {
      console.error('Error creating/saving post:', error);
      showError(error.message || (publish ? t('common.failedToCreatePost') : t('indexPage.failedToSaveDraft')));
    }
  };

  const handleLoadDraft = (draft: Post) => {
    setTitle(draft.title || '');
    setMessage(draft.message);
    setUploadedMediaItems(draft.media_items || []);
    setCoordinates(draft.coordinates || null);
    setPostDate(draft.created_at ? parseISO(draft.created_at) : new Date());
    setCurrentDraftId(draft.id);
    showSuccess(t('indexPage.draftLoadedSuccessfully', { title: draft.title || draft.message.substring(0, 20) + '...' }));
  };

  return (
    <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <Input
          placeholder={t('indexPage.titleOptional')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-grow"
          disabled={!canCreatePostUI}
        />
        <PostDatePicker
          selectedDate={postDate}
          onDateSelect={setPostDate}
          disabled={!canCreatePostUI || isUploadingMedia}
          className="w-full sm:w-auto"
        />
      </div>
      <Textarea
        placeholder={t('indexPage.messagePlaceholder')}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        className="w-full resize-none"
        disabled={!canCreatePostUI}
      />

      {(uploadedMediaItems.length > 0 || coordinates) && (
        <div className="space-y-4 p-4 border rounded-md bg-gray-50 dark:bg-gray-800">
          <h4 className="text-lg font-semibold">{t('indexPage.contentPreview')}</h4>
          {uploadedMediaItems.map((mediaItem, index) => (
            <div key={index} className="relative">
              {mediaItem.type === 'image' ? (
                <img
                  src={mediaItem.urls.medium || '/placeholder.svg'}
                  alt={t('common.postImageAlt', { index: index + 1 })}
                  className="w-full h-auto max-h-64 object-cover rounded-md"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder.svg';
                    e.currentTarget.onerror = null;
                    showError(t('common.failedToLoadMedia', { fileName: `media-${index + 1}` }));
                  }}
                />
              ) : (
                <video
                  src={mediaItem.url}
                  controls
                  className="w-full h-auto max-h-64 object-cover rounded-md"
                />
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveMediaItem(index)}
                className="absolute top-2 right-2 bg-white/70 dark:bg-gray-900/70 rounded-full hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
              >
                <XCircle className="h-5 w-5 text-red-500" />
              </Button>
            </div>
          ))}
          {isUploadingMedia && (
            <p className="text-sm text-center text-blue-500 dark:text-blue-400 mt-1">{t('common.uploading')}</p>
          )}
          {coordinates && (
            <div className="relative">
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-2">
                {t('locationSearch.selected', { lat: coordinates.lat.toFixed(4), lng: coordinates.lng.toFixed(4) })}
              </p>
              <MapComponent coordinates={coordinates} className="h-48" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleClearLocation}
                className="absolute top-2 right-2 bg-white/70 dark:bg-gray-900/70 rounded-full hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
              >
                <XCircle className="h-5 w-5 text-red-500" />
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <Input
          id="media-upload"
          type="file"
          accept={SUPPORTED_MEDIA_TYPES}
          onChange={handleMediaFileChange}
          ref={mediaFileInputRef}
          className="hidden"
          multiple
          disabled={!canCreatePostUI || isUploadingMedia}
        />
        <Button
          type="button"
          onClick={() => mediaFileInputRef.current?.click()}
          variant="outline"
          className="flex items-center hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit flex-grow sm:flex-grow-0"
          disabled={!canCreatePostUI || isUploadingMedia}
        >
          {isUploadingMedia ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('indexPage.uploadingMedia')}
            </>
          ) : (
            selectedFiles.length > 0 ? `${selectedFiles.length} ${t('common.filesSelected')}` : (uploadedMediaItems.length > 0 ? t('editPostDialog.changeAddMedia') : t('editPostDialog.chooseMedia'))
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={handleGetLocation}
          className="flex items-center hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit flex-grow sm:flex-grow-0"
          disabled={!canCreatePostUI || isUploadingMedia || locationLoading}
        >
          {locationLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('indexPage.gettingLocation')}
            </>
          ) : (
            <>
              <LocateFixed className="mr-2 h-4 w-4" /> {t('indexPage.getLocation')}
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setLocationSelectionMode('search');
            setCoordinates(null);
          }}
          className="flex items-center hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit flex-grow sm:flex-grow-0"
          disabled={!canCreatePostUI || isUploadingMedia}
        >
          <Search className="mr-2 h-4 w-4" /> {t('indexPage.searchLocation')}
        </Button>
      </div>

      {locationSelectionMode === 'search' && !coordinates && (
        <div className="space-y-4 p-4 border rounded-md bg-gray-50 dark:bg-gray-800">
          <LocationSearch
            onSelectLocation={setCoordinates}
            currentCoordinates={coordinates}
            disabled={!canCreatePostUI || isUploadingMedia}
          />
        </div>
      )}

      <div className="flex justify-center gap-2">
        <Button
          type="button"
          onClick={(e) => handleSubmit(e, false)} // Save as draft
          className="bg-gray-600 hover:bg-gray-700 text-white hover:ring-2 hover:ring-gray-500"
          disabled={isUploadingMedia || !canCreatePostUI || (!title.trim() && !message.trim() && uploadedMediaItems.length === 0 && !coordinates) || isSavingDraft}
        >
          {isSavingDraft ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('indexPage.savingDraft')}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {t('indexPage.saveDraft')}
            </>
          )}
        </Button>
        <Button
          type="submit" // Publish post
          className="bg-blue-600 hover:bg-blue-700 text-white hover:ring-2 hover:ring-blue-500"
          disabled={isUploadingMedia || !canCreatePostUI || (!title.trim() && !message.trim() && uploadedMediaItems.length === 0 && !coordinates)}
        >
          <Send className="mr-2 h-4 w-4" /> {t('indexPage.post')}
        </Button>
      </div>
    </form>
  );
};

export default CreatePostFormContent;