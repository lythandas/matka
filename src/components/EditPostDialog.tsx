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
import { Image, Music, MapPin, Loader2, Trash2, Upload, XCircle, Video, LocateFixed, Search } from 'lucide-react'; // Added Video, LocateFixed, Search icons
import { showError, showSuccess } from '@/utils/toast';
import MapComponent from './MapComponent';
import { API_BASE_URL } from '@/config/api'; // Centralized API_BASE_URL
import { MAX_CONTENT_FILE_SIZE_BYTES, SUPPORTED_MEDIA_TYPES } from '@/config/constants'; // Updated import
import { Post, MediaInfo } from '@/types'; // Centralized Post and MediaInfo interfaces
import LocationSearch from './LocationSearch'; // Import the new LocationSearch component

interface EditPostDialogProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  onUpdate: (updatedPost: Post) => void;
}

const EditPostDialog: React.FC<EditPostDialogProps> = ({ isOpen, onClose, post, onUpdate }) => {
  const [title, setTitle] = useState<string>(post.title || '');
  const [message, setMessage] = useState<string>(post.message);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedMediaInfo, setUploadedMediaInfo] = useState<MediaInfo | null>(post.image_urls || null); // Updated to MediaInfo
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null); // For local file preview
  const [isUploadingMedia, setIsUploadingMedia] = useState<boolean>(false); // Changed to isUploadingMedia
  const [spotifyEmbedUrl, setSpotifyEmbedUrl] = useState<string>(post.spotify_embed_url || '');
  const [coordinates, setCoordinates] = useState<typeof post.coordinates>(post.coordinates || null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [locationLoading, setLocationLoading] = useState<boolean>(false);
  const [locationSelectionMode, setLocationSelectionMode] = useState<'current' | 'search'>(
    post.coordinates ? 'current' : 'search' // Default to current if coords exist, else search
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(post.title || '');
    setMessage(post.message);
    setUploadedMediaInfo(post.image_urls || null);
    setSpotifyEmbedUrl(post.spotify_embed_url || '');
    setCoordinates(post.coordinates || null);
    setSelectedFile(null); // Clear selected file on new post prop
    // Set local preview if mediaInfo is already present (e.g., from an existing post)
    if (post.image_urls) {
      if (post.image_urls.type === 'image' && post.image_urls.urls.medium) {
        setLocalPreviewUrl(post.image_urls.urls.medium);
      } else if (post.image_urls.type === 'video' && post.image_urls.url) {
        setLocalPreviewUrl(post.image_urls.url);
      }
    } else {
      setLocalPreviewUrl(null);
    }
    // Set location mode based on existing coordinates
    setLocationSelectionMode(post.coordinates ? 'current' : 'search');
  }, [post]);

  const uploadMediaToServer = async (file: File) => { // Changed to uploadMediaToServer
    setIsUploadingMedia(true);
    try {
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

      const response = await fetch(`${API_BASE_URL}/upload-media`, { // Updated endpoint
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ fileBase64: base64Data, fileType: file.type, isProfileImage: false }), // Pass isProfileImage: false
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload media');
      }

      const data = await response.json();
      setUploadedMediaInfo(data.mediaInfo); // Set the structured mediaInfo
      setLocalPreviewUrl(null); // Clear local preview once server URL is available
      showSuccess('Media uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading media:', error);
      showError(error.message || 'Failed to upload media.');
      setSelectedFile(null);
      setUploadedMediaInfo(null);
      setLocalPreviewUrl(null);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleMediaFileChange = (event: React.ChangeEvent<HTMLInputElement>) => { // Changed to handleMediaFileChange
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];

      if (file.size > MAX_CONTENT_FILE_SIZE_BYTES) { // Use new constant
        showError(`File size exceeds ${MAX_CONTENT_FILE_SIZE_BYTES / (1024 * 1024)}MB limit.`);
        setSelectedFile(null);
        setLocalPreviewUrl(null);
        setUploadedMediaInfo(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        showError('Only image or video files are allowed.');
        setSelectedFile(null);
        setLocalPreviewUrl(null);
        setUploadedMediaInfo(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setSelectedFile(file);
      setLocalPreviewUrl(URL.createObjectURL(file)); // Set local preview
      uploadMediaToServer(file);
    } else {
      setSelectedFile(null);
      setLocalPreviewUrl(null);
      setUploadedMediaInfo(null);
    }
  };

  const handleClearMedia = () => { // Changed to handleClearMedia
    setSelectedFile(null);
    setLocalPreviewUrl(null);
    setUploadedMediaInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    showSuccess('Media cleared.');
  };

  const handleSpotifyInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSpotifyEmbedUrl(e.target.value);
  };

  const handleAddSpotifyEmbed = () => {
    if (spotifyEmbedUrl.trim()) {
      if (spotifyEmbedUrl.includes('spotify.com/embed/')) {
        showSuccess('Spotify embed URL updated!');
      } else {
        showError('Please enter a valid Spotify embed URL (e.g., from Spotify "Share" -> "Embed track").');
      }
    } else {
      showSuccess('Spotify embed URL cleared.');
    }
  };

  const handleClearSpotifyEmbed = () => {
    setSpotifyEmbedUrl('');
    showSuccess('Spotify embed URL cleared.');
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
    if (!message.trim() && !uploadedMediaInfo && !spotifyEmbedUrl && !coordinates) { // Updated to uploadedMediaInfo
      showError('At least a message, media, Spotify URL, or coordinates are required.');
      return;
    }
    if (isUploadingMedia) { // Updated to isUploadingMedia
      showError('Please wait for the media to finish uploading.');
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
          mediaInfo: uploadedMediaInfo, // Send the structured mediaInfo
          spotifyEmbedUrl: spotifyEmbedUrl.trim() || null,
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

  const currentMediaPreviewUrl = localPreviewUrl || (uploadedMediaInfo?.type === 'image' ? uploadedMediaInfo.urls.medium : uploadedMediaInfo?.type === 'video' ? uploadedMediaInfo.url : null);
  const currentMediaType = selectedFile?.type.startsWith('video/') ? 'video' : (uploadedMediaInfo?.type === 'video' ? 'video' : 'image');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] min-h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Post</DialogTitle>
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
            disabled={isSaving || isUploadingMedia}
          />
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            placeholder="What's on your mind today?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="resize-none"
            disabled={isSaving || isUploadingMedia}
          />
        </div>
        <Tabs defaultValue="media" className="w-full flex-grow flex flex-col"> {/* Changed default to media */}
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="media">
              <Image className="h-4 w-4 mr-2" /> Media
            </TabsTrigger>
            <TabsTrigger value="spotify">
              <Music className="h-4 w-4 mr-2" /> Spotify
            </TabsTrigger>
            <TabsTrigger value="location">
              <MapPin className="h-4 w-4 mr-2" /> Location
            </TabsTrigger>
          </TabsList>
          <TabsContent value="media" className="mt-4 space-y-4 flex-grow overflow-y-auto">
            <Label htmlFor="media-upload">Upload Image or Video (Max {MAX_CONTENT_FILE_SIZE_BYTES / (1024 * 1024)}MB)</Label>
            <div className="flex items-center w-full">
              <Input
                id="media-upload"
                type="file"
                accept={SUPPORTED_MEDIA_TYPES} // Use new constant
                onChange={handleMediaFileChange}
                ref={fileInputRef}
                className="hidden"
                disabled={isSaving || isUploadingMedia}
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="flex-1 justify-start text-gray-600 dark:text-gray-400 hover:ring-2 hover:ring-blue-500 ring-inset"
                disabled={isSaving || isUploadingMedia}
              >
                {isUploadingMedia ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {selectedFile ? selectedFile.name : (uploadedMediaInfo ? "Media Selected" : "Choose Media")}
              </Button>
              {(selectedFile || uploadedMediaInfo) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleClearMedia}
                  className="ml-2 hover:ring-2 hover:ring-blue-500 ring-inset"
                  disabled={isSaving || isUploadingMedia}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            {currentMediaPreviewUrl && (
              <div className="w-full max-w-xs mx-auto mt-2">
                {currentMediaType === 'image' ? (
                  <img
                    src={currentMediaPreviewUrl}
                    alt="Media preview"
                    className="w-full h-auto object-cover rounded-md border border-gray-200 dark:border-gray-700"
                  />
                ) : (
                  <video
                    src={currentMediaPreviewUrl}
                    controls
                    className="w-full h-auto object-cover rounded-md border border-gray-200 dark:border-gray-700"
                  />
                )}
                {isUploadingMedia && (
                  <p className="text-sm text-center text-blue-500 dark:text-blue-400 mt-1">Uploading...</p>
                )}
              </div>
            )}
          </TabsContent>
          <TabsContent value="spotify" className="mt-4 space-y-4 flex-grow overflow-y-auto">
            <Label htmlFor="spotify-embed">Spotify Embed URL</Label>
            <Input
              id="spotify-embed"
              placeholder="e.g., https://open.spotify.com/embed/track/..."
              value={spotifyEmbedUrl}
              onChange={handleSpotifyInputChange}
              disabled={isSaving || isUploadingMedia}
            />
            <div className="flex justify-end space-x-2">
              {spotifyEmbedUrl && (
                <Button type="button" variant="outline" onClick={handleClearSpotifyEmbed} className="hover:ring-2 hover:ring-blue-500 ring-inset" disabled={isSaving || isUploadingMedia}>
                  Clear Spotify
                </Button>
              )}
              <Button type="button" onClick={handleAddSpotifyEmbed} className="hover:ring-2 hover:ring-blue-500" disabled={isSaving || isUploadingMedia}>
                {spotifyEmbedUrl ? 'Update Spotify' : 'Add Spotify'}
              </Button>
            </div>
            {spotifyEmbedUrl && (
              <div className="w-full aspect-video mt-4">
                <iframe
                  src={spotifyEmbedUrl}
                  width="100%"
                  height="100%"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  className="rounded-md"
                ></iframe>
              </div>
            )}
          </TabsContent>
          <TabsContent value="location" className="mt-4 space-y-4 flex-grow overflow-y-auto pb-4">
            <div className="flex space-x-2"> {/* Removed mb-4 */}
              <Button
                type="button"
                variant={locationSelectionMode === 'current' ? 'default' : 'outline'}
                onClick={() => {
                  setLocationSelectionMode('current');
                  setCoordinates(null); // Clear search selection when switching
                }}
                className="flex-1 hover:ring-2 hover:ring-blue-500"
                disabled={isSaving || isUploadingMedia}
              >
                <LocateFixed className="mr-2 h-4 w-4" /> Get Current Location
              </Button>
              <Button
                type="button"
                variant={locationSelectionMode === 'search' ? 'default' : 'outline'}
                onClick={() => {
                  setLocationSelectionMode('search');
                  setCoordinates(null); // Clear current location when switching
                }}
                className="flex-1 hover:ring-2 hover:ring-blue-500"
                disabled={isSaving || isUploadingMedia}
              >
                <Search className="mr-2 h-4 w-4" /> Search Location
              </Button>
            </div>

            {locationSelectionMode === 'current' && (
              <div className="space-y-4"> {/* Added wrapper div with space-y-4 */}
                <Button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={locationLoading || isSaving || isUploadingMedia}
                  className="w-full hover:ring-2 hover:ring-blue-500"
                >
                  {locationLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Getting Location...
                    </>
                  ) : (
                    <>
                      <MapPin className="mr-2 h-4 w-4" />
                      Get Current Location
                    </>
                  )}
                </Button>
                {coordinates && (
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                      Lat: {coordinates.lat.toFixed(4)}, Lng: {coordinates.lng.toFixed(4)}
                    </p>
                    <MapComponent coordinates={coordinates} className="h-48" />
                    <Button type="button" variant="outline" onClick={handleClearLocation} className="w-full hover:ring-2 hover:ring-blue-500 ring-inset">
                      Clear Location
                    </Button>
                  </>
                )}
              </div>
            )}

            {locationSelectionMode === 'search' && (
              <LocationSearch
                onSelectLocation={setCoordinates}
                currentCoordinates={coordinates}
                disabled={isSaving || isUploadingMedia}
              />
            )}
          </TabsContent>
        </Tabs>
        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSaving || isUploadingMedia} className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isUploadingMedia || (!message.trim() && !uploadedMediaInfo && !spotifyEmbedUrl && !coordinates)} className="hover:ring-2 hover:ring-blue-500">
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

export default EditPostDialog;