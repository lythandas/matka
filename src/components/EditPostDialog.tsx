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
import { Image, MapPin, Loader2, Trash2, Upload, XCircle, Video, LocateFixed, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import MapComponent from './MapComponent';
import { API_BASE_URL } from '@/config/api';
import { MAX_CONTENT_FILE_SIZE_BYTES, SUPPORTED_MEDIA_TYPES } from '@/config/constants';
import { Post, MediaInfo, JourneyCollaborator } from '@/types';
import LocationSearch from './LocationSearch';
import { useAuth } from '@/contexts/AuthContext';
import { userHasPermission } from '@/lib/permissions';
import { cn } from '@/lib/utils';

interface EditPostDialogProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  onUpdate: (updatedPost: Post) => void;
  journeyOwnerId: string;
  journeyCollaborators: JourneyCollaborator[];
}

const EditPostDialog: React.FC<EditPostDialogProps> = ({ isOpen, onClose, post, onUpdate, journeyOwnerId, journeyCollaborators }) => {
  const { user: currentUser } = useAuth();
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

  useEffect(() => {
    setTitle(post.title || '');
    setMessage(post.message);
    setCurrentMediaItems(post.media_items || []);
    setNewlySelectedFiles([]);
    setLocalPreviewUrls([]);
    setCoordinates(post.coordinates || null);
    setLocationSelectionMode(post.coordinates ? 'current' : 'search');
    setCurrentMediaPreviewIndex(0);
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

        const response = await fetch(`${API_BASE_URL}/upload-media`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          },
          body: JSON.stringify({ fileBase64: base64Data, fileType: file.type, isProfileImage: false }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to upload media: ${file.name}`);
        }

        const data = await response.json();
        uploadedMedia.push(data.mediaInfo);
      }
      setCurrentMediaItems((prev) => [...prev, ...uploadedMedia]);
      setNewlySelectedFiles([]);
      setLocalPreviewUrls([]);
      showSuccess('Media uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading media:', error);
      showError(error.message || 'Failed to upload media.');
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
          showError(`File '${file.name}' size exceeds ${MAX_CONTENT_FILE_SIZE_BYTES / (1024 * 1024)}MB limit.`);
          continue;
        }
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
          showError(`File '${file.name}' is not an image or video.`);
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
    if (fileInputRef.current) fileInputRef.current.value = ''; // Clear input
  };

  const handleRemoveMedia = (indexToRemove: number) => {
    setCurrentMediaItems((prev) => prev.filter((_, index) => index !== indexToRemove));
    if (currentMediaPreviewIndex >= currentMediaItems.length - 1) {
      setCurrentMediaPreviewIndex(Math.max(0, currentMediaItems.length - 2));
    }
    showSuccess('Media item removed.');
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      showError('Geolocation is not supported by your browser.');
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoordinates({ lat: latitude, lng: longitude });
        showSuccess('Location retrieved successfully!');
        setLocationLoading(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMessage = 'Failed to get your location.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Permission to access location was denied. Please enable it in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'The request to get user location timed out.';
            break;
        }
        showError(errorMessage);
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleClearLocation = () => {
    setCoordinates(null);
    showSuccess('Location cleared.');
  };

  const handleSave = async () => {
    if (!message.trim() && currentMediaItems.length === 0 && !coordinates) {
      showError('At least a message, media, or coordinates are required.');
      return;
    }
    if (isUploadingMedia) {
      showError('Please wait for media uploads to finish.');
      return;
    }
    if (!currentUser) {
      showError('Authentication required to update post.');
      return;
    }

    const canEdit = userHasPermission(currentUser, 'edit_post', journeyOwnerId, journeyCollaborators, post.id, post.user_id);
    if (!canEdit) {
      showError('You do not have permission to edit this post.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/posts/${post.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          title: title.trim() || null,
          message: message.trim(),
          media_items: currentMediaItems.length > 0 ? currentMediaItems : null, // Use media_items
          coordinates: coordinates || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update post');
      }

      const updatedPost: Post = await response.json();
      onUpdate(updatedPost);
      showSuccess('Post updated successfully!');
      onClose();
    } catch (error: any) {
      console.error('Error updating post:', error);
      showError(error.message || 'Failed to update post.');
    } finally {
      setIsSaving(false);
    }
  };

  const canEditPost = currentUser && userHasPermission(currentUser, 'edit_post', journeyOwnerId, journeyCollaborators, post.id, post.user_id);

  const displayedMedia = [...currentMediaItems];
  const currentPreviewMedia = displayedMedia[currentMediaPreviewIndex];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] min-h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit post</DialogTitle>
          <DialogDescription>
            Modify the content of your post.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="Add a title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSaving || isUploadingMedia || !canEditPost}
          />
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            placeholder="What's on your mind today?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="resize-none"
            disabled={isSaving || isUploadingMedia || !canEditPost}
          />
        </div>
        <Tabs defaultValue="media" className="w-full flex-grow flex flex-col">
          <TabsList className="grid w-full grid-cols-2"> {/* Removed Spotify tab */}
            <TabsTrigger value="media" disabled={!canEditPost}>
              <Image className="h-4 w-4 mr-2" /> Media
            </TabsTrigger>
            <TabsTrigger value="location" disabled={!canEditPost}>
              <MapPin className="h-4 w-4 mr-2" /> Location
            </TabsTrigger>
          </TabsList>
          <TabsContent value="media" className="p-4 space-y-4 flex-grow overflow-y-auto">
            <Label htmlFor="media-upload">Upload images or videos (Max {MAX_CONTENT_FILE_SIZE_BYTES / (1024 * 1024)}MB per file)</Label>
            <div className="flex items-center w-full">
              <Input
                id="media-upload"
                type="file"
                accept={SUPPORTED_MEDIA_TYPES}
                onChange={handleMediaFileChange}
                ref={fileInputRef}
                className="hidden"
                multiple // Allow multiple file selection
                disabled={isSaving || isUploadingMedia || !canEditPost}
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="flex-1 justify-start text-gray-600 dark:text-gray-400 hover:ring-2 hover:ring-blue-500 ring-inset"
                disabled={isSaving || isUploadingMedia || !canEditPost}
              >
                {isUploadingMedia ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {newlySelectedFiles.length > 0 ? `${newlySelectedFiles.length} files selected` : (currentMediaItems.length > 0 ? "Change/Add media" : "Choose media")}
              </Button>
            </div>
            {isUploadingMedia && (
              <p className="text-sm text-center text-blue-500 dark:text-blue-400 mt-1">Uploading...</p>
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
                  disabled={isSaving || isUploadingMedia || !canEditPost}
                >
                  <XCircle className="h-5 w-5 text-red-500" />
                </Button>

                {displayedMedia.length > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full z-10 bg-background/80 backdrop-blur-sm hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                      onClick={() => setCurrentMediaPreviewIndex((prev) => (prev === 0 ? displayedMedia.length - 1 : prev - 1))}
                      disabled={isSaving || isUploadingMedia || !canEditPost}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full z-10 bg-background/80 backdrop-blur-sm hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                      onClick={() => setCurrentMediaPreviewIndex((prev) => (prev === displayedMedia.length - 1 ? 0 : prev + 1))}
                      disabled={isSaving || isUploadingMedia || !canEditPost}
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
          <TabsContent value="location" className="p-4 space-y-4 flex-grow overflow-y-auto">
            <div className="flex space-x-2">
              <Button
                type="button"
                variant={locationSelectionMode === 'current' ? 'default' : 'outline'}
                onClick={() => {
                  setLocationSelectionMode('current');
                  setCoordinates(null);
                }}
                className="flex-1 hover:ring-2 hover:ring-blue-500"
                disabled={isSaving || isUploadingMedia || !canEditPost}
              >
                <LocateFixed className="mr-2 h-4 w-4" /> Get current location
              </Button>
              <Button
                type="button"
                variant={locationSelectionMode === 'search' ? 'default' : 'outline'}
                onClick={() => {
                  setLocationSelectionMode('search');
                  setCoordinates(null);
                }}
                className="flex-1 hover:ring-2 hover:ring-blue-500"
                disabled={isSaving || isUploadingMedia || !canEditPost}
              >
                <Search className="mr-2 h-4 w-4" /> Search location
              </Button>
            </div>

            {locationSelectionMode === 'current' && (
              <div className="space-y-4">
                <Button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={locationLoading || isSaving || isUploadingMedia || !canEditPost}
                  className="w-full hover:ring-2 hover:ring-blue-500"
                >
                  {locationLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Getting location...
                    </>
                  ) : (
                    <>
                      <MapPin className="mr-2 h-4 w-4" />
                      Get current location
                    </>
                  )}
                </Button>
                {coordinates && (
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                      Lat: {coordinates.lat.toFixed(4)}, Lng: {coordinates.lng.toFixed(4)}
                    </p>
                    <MapComponent coordinates={coordinates} className="h-48" />
                    <Button type="button" variant="outline" onClick={handleClearLocation} className="w-full hover:ring-2 hover:ring-blue-500 ring-inset" disabled={!canEditPost}>
                      Clear location
                    </Button>
                  </>
                )}
              </div>
            )}

            {locationSelectionMode === 'search' && (
              <LocationSearch
                onSelectLocation={setCoordinates}
                currentCoordinates={coordinates}
                disabled={isSaving || isUploadingMedia || !canEditPost}
              />
            )}
          </TabsContent>
        </Tabs>
        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSaving || isUploadingMedia} className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isUploadingMedia || (!message.trim() && currentMediaItems.length === 0 && !coordinates) || !canEditPost} className="hover:ring-2 hover:ring-blue-500">
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

export default EditPostDialog;