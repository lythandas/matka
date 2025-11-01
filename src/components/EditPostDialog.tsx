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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Image, MapPin, Loader2, Trash2, Upload, XCircle, Video, LocateFixed, Search, ChevronLeft, ChevronRight, Save, Send } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import MapComponent from './MapComponent';
import { API_BASE_URL } from '@/config/api';
import { MAX_CONTENT_FILE_SIZE_BYTES, SUPPORTED_MEDIA_TYPES } from '@/config/constants';
import { Post, MediaInfo, JourneyCollaborator } from '@/types';
import LocationSearch from './LocationSearch';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import PostDatePicker from './PostDatePicker';
import { parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/hooks/use-mobile'; // Import useIsMobile

interface EditPostDialogProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  onUpdate: (updatedPost: Post) => void;
  journeyOwnerId: string;
  journeyCollaborators: JourneyCollaborator[];
}

const EditPostDialog: React.FC<EditPostDialogProps> = ({ isOpen, onClose, post, onUpdate, journeyOwnerId, journeyCollaborators }) => {
  const { t } = useTranslation();
  const { user: currentUser, token } = useAuth();
  const isMobile = useIsMobile(); // Initialize useIsMobile hook
  const [title, setTitle] = useState<string>(post.title || '');
  const [message, setMessage] = useState<string>(post.message);
  const [currentMediaItems, setCurrentMediaItems] = useState<MediaInfo[]>(post.media_items || []);
  const [newlySelectedFiles, setNewlySelectedFiles] = useState<File[]>([]);
  const [localPreviewUrls, setLocalPreviewUrls] = useState<string[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState<boolean>(false);
  const [coordinates, setCoordinates] = useState<typeof post.coordinates>(post.coordinates || null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [locationLoading, setLocationLoading] = useState<boolean>(false);
  const [locationSelectionMode, setLocationSelectionMode] = useState<'current' | 'search'>(
    post.coordinates ? 'current' : 'search'
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentMediaPreviewIndex, setCurrentMediaPreviewIndex] = useState(0);
  const [postDate, setPostDate] = useState<Date | undefined>(post.created_at ? parseISO(post.created_at) : undefined);
  const [isDraft, setIsDraft] = useState<boolean>(post.is_draft || false); // State for draft status

  useEffect(() => {
    setTitle(post.title || '');
    setMessage(post.message);
    setCurrentMediaItems(post.media_items || []);
    setNewlySelectedFiles([]);
    setLocalPreviewUrls([]);
    setCoordinates(post.coordinates || null);
    setLocationSelectionMode(post.coordinates ? 'current' : 'search');
    setCurrentMediaPreviewIndex(0);
    setPostDate(post.created_at ? parseISO(post.created_at) : undefined);
    setIsDraft(post.is_draft || false); // Initialize isDraft from post prop
  }, [post, isOpen]);

  const uploadMediaToServer = async (files: File[]) => {
    setIsUploadingMedia(true);
    const uploadedMedia: MediaInfo[] = [];
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

        const response = await fetch(`${API_BASE_URL}/media/upload-media`, { // Corrected endpoint
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
        uploadedMedia.push(data.mediaInfo);
      }
      setCurrentMediaItems((prev) => [...prev, ...uploadedMedia]);
      setNewlySelectedFiles([]);
      setLocalPreviewUrls([]);
      showSuccess(t('common.mediaUploadedSuccessfully'));
    } catch (error: any) {
      console.error('Error uploading media:', error);
      showError(error.message || t('common.failedToUploadMediaGeneric'));
      setNewlySelectedFiles([]);
      setLocalPreviewUrls([]);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleMediaFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const files = Array.from(event.target.files);
      const validFiles: File[] = [];
      const newLocalPreviews: string[] = [];

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
        newLocalPreviews.push(URL.createObjectURL(file));
      }

      if (validFiles.length > 0) {
        setNewlySelectedFiles(validFiles);
        setLocalPreviewUrls(newLocalPreviews);
        uploadMediaToServer(validFiles);
      } else {
        setNewlySelectedFiles([]);
        setLocalPreviewUrls([]);
      }
    } else {
      setNewlySelectedFiles([]);
      setLocalPreviewUrls([]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveMedia = (indexToRemove: number) => {
    setCurrentMediaItems((prev) => prev.filter((_, index) => index !== indexToRemove));
    if (currentMediaPreviewIndex >= currentMediaItems.length - 1) {
      setCurrentMediaPreviewIndex(Math.max(0, currentMediaItems.length - 2));
    }
    showSuccess(t('common.mediaItemRemoved'));
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      showError(t('common.geolocationNotSupported'));
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoordinates({ lat: latitude, lng: longitude });
        showSuccess(t('common.locationRetrievedSuccessfully'));
        setLocationLoading(false);
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
        setLocationLoading(false);
        setCoordinates(null); // Clear coordinates on error
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleClearLocation = () => {
    setCoordinates(null);
    showSuccess(t('common.locationCleared'));
  };

  const handleSave = async (publish: boolean = false) => {
    if (!message.trim() && currentMediaItems.length === 0 && !coordinates) {
      showError(t('common.atLeastTitleMessageMediaOrCoordsRequired'));
      return;
    }
    if (isUploadingMedia) {
      showError(t('common.pleaseWaitForMediaUploads'));
      return;
    }
    if (!currentUser) {
      showError(t('common.authRequiredUpdatePost'));
      return;
    }

    const isPostAuthor = currentUser.id === post.user_id;
    const isJourneyOwner = journeyOwnerId === currentUser.id;
    const isAdmin = currentUser.isAdmin;
    const canModifyAsCollaborator = journeyCollaborators.some(collab => collab.user_id === currentUser.id && collab.can_modify_post);
    const canPublishAsCollaborator = journeyCollaborators.some(collab => collab.user_id === currentUser.id && collab.can_publish_posts);

    const canEdit = isPostAuthor || isJourneyOwner || isAdmin || canModifyAsCollaborator;
    const canPublish = isPostAuthor || isJourneyOwner || isAdmin || canPublishAsCollaborator;

    if (!canEdit) {
      showError(t('common.noPermissionEditPost'));
      return;
    }

    // If trying to publish (is_draft changes from true to false)
    if (isDraft && publish && !canPublish) {
      showError(t('editPostDialog.noPermissionPublishDraft'));
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/posts/${post.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim() || null,
          message: message.trim(),
          media_items: currentMediaItems.length > 0 ? currentMediaItems : null,
          coordinates: coordinates || null,
          created_at: postDate ? postDate.toISOString() : undefined,
          is_draft: publish ? false : isDraft, // Corrected logic: if publishing, it's not a draft. Otherwise, use current draft status.
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('common.failedToUpdatePost'));
      }

      const updatedPost: Post = await response.json();
      onUpdate(updatedPost);
      showSuccess(publish ? t('editPostDialog.postPublishedSuccessfully') : t('common.postUpdatedSuccessfully'));
      onClose();
    } catch (error: any) {
      console.error('Error updating post:', error);
      showError(error.message || t('common.failedToUpdatePost'));
    } finally {
      setIsSaving(false);
    }
  };

  const canEditPostUI = currentUser && (currentUser.id === post.user_id || currentUser.id === journeyOwnerId || currentUser.isAdmin || journeyCollaborators.some(collab => collab.user_id === currentUser.id && collab.can_modify_post));
  const canPublishPostUI = currentUser && (currentUser.id === post.user_id || currentUser.id === journeyOwnerId || currentUser.isAdmin || journeyCollaborators.some(collab => collab.user_id === currentUser.id && collab.can_publish_posts));

  const displayedMedia = [...currentMediaItems];
  const currentPreviewMedia = displayedMedia[currentMediaPreviewIndex];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-[500px] max-h-[90vh] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()} // Stop event propagation here
      >
        <DialogHeader>
          <DialogTitle>{isDraft ? t('editPostDialog.editDraft') : t('editPostDialog.editPost')}</DialogTitle>
          <DialogDescription>
            {t('editPostDialog.modifyPostContent')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto p-4">
          <div className="grid gap-4 py-4">
            <Label htmlFor="title">{t('editPostDialog.title')}</Label>
            <Input
              id="title"
              placeholder={t('editPostDialog.titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSaving || isUploadingMedia || !canEditPostUI}
            />
            <Label htmlFor="message">{t('editPostDialog.message')}</Label>
            <Textarea
              id="message"
              placeholder={t('editPostDialog.messagePlaceholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="resize-none mb-4" /* Added mb-4 here */
              disabled={isSaving || isUploadingMedia || !canEditPostUI}
            />
            <Label htmlFor="post-date">{t('editPostDialog.postDate')}</Label>
            <PostDatePicker
              selectedDate={postDate}
              onDateSelect={setPostDate}
              disabled={isSaving || isUploadingMedia || !canEditPostUI}
            />
          </div>
          <Tabs defaultValue="media" className="w-full flex-grow flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="media" disabled={!canEditPostUI}>
                <Image className="h-4 w-4 mr-2" /> {t('editPostDialog.media')}
              </TabsTrigger>
              <TabsTrigger value="location" disabled={!canEditPostUI}>
                <MapPin className="h-4 w-4 mr-2" /> {t('editPostDialog.location')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="location" className="p-4 space-y-4 flex-grow overflow-y-auto">
              <div className="flex flex-col space-y-2">
                <Button
                  type="button"
                  variant={locationSelectionMode === 'current' ? 'default' : 'outline'}
                  onClick={() => {
                    setLocationSelectionMode('current');
                    setCoordinates(null); // Clear coordinates when switching mode
                    handleGetLocation(); // Directly trigger geolocation
                  }}
                  className="w-full hover:ring-2 hover:ring-blue-500"
                  disabled={isSaving || isUploadingMedia || !canEditPostUI || (locationLoading && locationSelectionMode === 'current')}
                >
                  {locationLoading && locationSelectionMode === 'current' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('editPostDialog.gettingLocation')}
                    </>
                  ) : (
                    <>
                      <LocateFixed className="mr-2 h-4 w-4" /> {t('editPostDialog.getCurrentLocation')}
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant={locationSelectionMode === 'search' ? 'default' : 'outline'}
                  onClick={() => {
                    setLocationSelectionMode('search');
                    setCoordinates(null); // Clear coordinates when switching mode
                    setLocationLoading(false); // Ensure loading is false if switching from current
                  }}
                  className="w-full hover:ring-2 hover:ring-blue-500"
                  disabled={isSaving || isUploadingMedia || !canEditPostUI}
                >
                  <Search className="mr-2 h-4 w-4" /> {t('editPostDialog.searchLocation')}
                </Button>
              </div>

              {locationSelectionMode === 'current' && coordinates && (
                <div className="space-y-4 mt-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                    {t('locationSearch.selected', { lat: coordinates.lat.toFixed(4), lng: coordinates.lng.toFixed(4) })}
                  </p>
                  <MapComponent coordinates={coordinates} className="h-48" />
                  <Button type="button" variant="outline" onClick={handleClearLocation} className="w-full hover:ring-2 hover:ring-blue-500 ring-inset" disabled={!canEditPostUI}>
                    {t('editPostDialog.clearLocation')}
                  </Button>
                </div>
              )}
              {locationSelectionMode === 'current' && !coordinates && !locationLoading && (
                <p className="text-center text-muted-foreground mt-4">{t('editPostDialog.clickGetLocation')}</p>
              )}

              {locationSelectionMode === 'search' && (
                <LocationSearch
                  onSelectLocation={setCoordinates}
                  currentCoordinates={coordinates}
                  disabled={isSaving || isUploadingMedia || !canEditPostUI}
                />
              )}
            </TabsContent>
            <TabsContent value="media" className="p-4 space-y-4 flex-grow overflow-y-auto">
              <Label htmlFor="media-upload">{t('editPostDialog.uploadMedia', { maxSize: MAX_CONTENT_FILE_SIZE_BYTES / (1024 * 1024) })}</Label>
              <div className="flex items-center w-full">
                <Input
                  id="media-upload"
                  type="file"
                  accept={SUPPORTED_MEDIA_TYPES}
                  onChange={handleMediaFileChange}
                  ref={fileInputRef}
                  className="hidden"
                  multiple
                  disabled={isSaving || isUploadingMedia || !canEditPostUI}
                />
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="flex-1 justify-start text-gray-600 dark:text-gray-400 hover:ring-2 hover:ring-blue-500 ring-inset"
                  disabled={isSaving || isUploadingMedia || !canEditPostUI}
                >
                  {isUploadingMedia ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('editPostDialog.uploadingMedia')}
                    </>
                  ) : (
                    newlySelectedFiles.length > 0 ? `${newlySelectedFiles.length} ${t('common.filesSelected')}` : (currentMediaItems.length > 0 ? t('editPostDialog.changeAddMedia') : t('editPostDialog.chooseMedia'))
                  )}
                </Button>
              </div>
              {isUploadingMedia && (
                <p className="text-sm text-center text-blue-500 dark:text-blue-400 mt-1">{t('editPostDialog.uploadingMedia')}</p>
              )}

              {displayedMedia.length > 0 && (
                <div className="relative w-full max-w-xs mx-auto mt-4 border rounded-md p-2">
                  {currentPreviewMedia?.type === 'image' ? (
                    <img
                      src={currentPreviewMedia.urls.medium || '/placeholder.svg'}
                      alt="Media preview"
                      className="w-full h-auto object-cover rounded-md"
                    />
                  ) : (
                    <video
                      src={currentPreviewMedia?.url || ''}
                      controls
                      className="w-full h-auto object-cover rounded-md"
                    />
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveMedia(currentMediaPreviewIndex)}
                    className="absolute top-2 right-2 bg-white/70 dark:bg-gray-900/70 rounded-full hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                    disabled={isSaving || isUploadingMedia || !canEditPostUI}
                  >
                    <XCircle className="h-5 w-5 text-red-500" />
                  </Button>

                  {displayedMedia.length > 1 && (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full z-10 bg-background/80 backdrop-blur-sm hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                        onClick={() => setCurrentMediaIndex((prev) => (prev === 0 ? displayedMedia.length - 1 : prev - 1))}
                        disabled={isSaving || isUploadingMedia || !canEditPostUI}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full z-10 bg-background/80 backdrop-blur-sm hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                        onClick={() => setCurrentMediaIndex((prev) => (prev === displayedMedia.length - 1 ? 0 : prev + 1))}
                        disabled={isSaving || isUploadingMedia || !canEditPostUI}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1 z-10">
                        {displayedMedia.map((_, idx) => (
                          <span
                            key={idx}
                            className={cn(
                              "h-2 w-2 rounded-full bg-white/50",
                              idx === currentMediaPreviewIndex && "bg-white"
                            )}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
        <DialogFooter className="flex flex-wrap justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSaving || isUploadingMedia} className="w-full sm:w-auto hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
            {t('common.cancel')}
          </Button>
          {isDraft && canPublishPostUI && (
            <Button onClick={() => handleSave(true)} disabled={isSaving || isUploadingMedia || (!message.trim() && currentMediaItems.length === 0 && !coordinates) || !canEditPostUI} className="w-full sm:w-auto hover:ring-2 hover:ring-blue-500">
              {isSaving ? (
                <>
                  {isMobile ? null : <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <span>{t('editPostDialog.publishing')}</span>
                </>
              ) : (
                <>
                  {isMobile ? null : <Send className="mr-2 h-4 w-4" />}
                  <span>{t('editPostDialog.publishPost')}</span>
                </>
              )}
            </Button>
          )}
          <Button onClick={() => handleSave(false)} disabled={isSaving || isUploadingMedia || (!message.trim() && currentMediaItems.length === 0 && !coordinates) || !canEditPostUI} className="w-full sm:w-auto hover:ring-2 hover:ring-blue-500">
            {isSaving && !isDraft ? ( // Only show saving text if not publishing a draft
              <>
                {isMobile ? null : <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <span>{t('editPostDialog.saving')}</span>
              </>
            ) : (
              <>
                {isMobile ? null : <Save className="mr-2 h-4 w-4" />}
                <span>{t('common.saveChanges')}</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditPostDialog;