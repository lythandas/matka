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
import { Image, Music, MapPin, Loader2, Trash2, Upload, XCircle } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import MapComponent from './MapComponent';
import { API_BASE_URL } from '@/config/api'; // Centralized API_BASE_URL
import { MAX_IMAGE_SIZE_BYTES } from '@/config/constants'; // Centralized MAX_IMAGE_SIZE_BYTES
import { Post } from '@/types'; // Centralized Post interface

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
  const [uploadedImageUrls, setUploadedImageUrls] = useState<typeof post.image_urls>(post.image_urls || null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(post.image_urls?.medium || null);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [spotifyEmbedUrl, setSpotifyEmbedUrl] = useState<string>(post.spotify_embed_url || '');
  const [coordinates, setCoordinates] = useState<typeof post.coordinates>(post.coordinates || null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [locationLoading, setLocationLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(post.title || '');
    setMessage(post.message);
    setUploadedImageUrls(post.image_urls || null);
    setPreviewImageUrl(post.image_urls?.medium || null);
    setSpotifyEmbedUrl(post.spotify_embed_url || '');
    setCoordinates(post.coordinates || null);
    setSelectedFile(null); // Clear selected file on new post prop
  }, [post]);

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
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ imageBase64: base64Data, imageType: file.type }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload image');
      }

      const data = await response.json();
      setUploadedImageUrls(data.imageUrls);
      setPreviewImageUrl(data.imageUrls.medium);
      showSuccess('Image uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading image:', error);
      showError(error.message || 'Failed to upload image.');
      setSelectedFile(null);
      setUploadedImageUrls(null);
      setPreviewImageUrl(null);
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
        setPreviewImageUrl(null);
        setUploadedImageUrls(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      if (!file.type.startsWith('image/')) {
        showError('Only image files are allowed.');
        setSelectedFile(null);
        setPreviewImageUrl(null);
        setUploadedImageUrls(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setSelectedFile(file);
      setPreviewImageUrl(URL.createObjectURL(file));
      uploadImageToServer(file);
    } else {
      setSelectedFile(null);
      setPreviewImageUrl(null);
      setUploadedImageUrls(null);
    }
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    setPreviewImageUrl(null);
    setUploadedImageUrls(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    showSuccess('Image cleared.');
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
    if (!message.trim() && !uploadedImageUrls && !spotifyEmbedUrl && !coordinates) {
      showError('At least a message, image, Spotify URL, or coordinates are required.');
      return;
    }
    if (isUploadingImage) {
      showError('Please wait for the image to finish uploading.');
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
          imageUrls: uploadedImageUrls,
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
            disabled={isSaving || isUploadingImage}
          />
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            placeholder="What's on your mind today?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="resize-none"
            disabled={isSaving || isUploadingImage}
          />
        </div>
        <Tabs defaultValue="image" className="w-full flex-grow flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="image">
              <Image className="h-4 w-4 mr-2" /> Image
            </TabsTrigger>
            <TabsTrigger value="spotify">
              <Music className="h-4 w-4 mr-2" /> Spotify
            </TabsTrigger>
            <TabsTrigger value="location">
              <MapPin className="h-4 w-4 mr-2" /> Location
            </TabsTrigger>
          </TabsList>
          <TabsContent value="image" className="mt-4 space-y-4 flex-grow overflow-y-auto">
            <Label htmlFor="image-upload">Upload Image (Max {MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB)</Label>
            <div className="flex items-center w-full">
              <Input
                id="image-upload"
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
                className="flex-1 justify-start text-gray-600 dark:text-gray-400 hover:ring-2 hover:ring-blue-500 ring-inset"
                disabled={isSaving || isUploadingImage}
              >
                {isUploadingImage ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {selectedFile ? selectedFile.name : (uploadedImageUrls ? "Image Selected" : "Choose Image")}
              </Button>
              {(selectedFile || uploadedImageUrls) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleClearImage}
                  className="ml-2 hover:ring-2 hover:ring-blue-500 ring-inset"
                  disabled={isSaving || isUploadingImage}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            {previewImageUrl && (
              <div className="w-full max-w-xs mx-auto mt-2">
                <img
                  src={previewImageUrl}
                  alt="Image preview"
                  className="w-full h-auto object-cover rounded-md border border-gray-200 dark:border-gray-700"
                />
                {isUploadingImage && (
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
              disabled={isSaving || isUploadingImage}
            />
            <div className="flex justify-end space-x-2">
              {spotifyEmbedUrl && (
                <Button type="button" variant="outline" onClick={handleClearSpotifyEmbed} className="hover:ring-2 hover:ring-blue-500 ring-inset" disabled={isSaving || isUploadingImage}>
                  Clear Spotify
                </Button>
              )}
              <Button type="button" onClick={handleAddSpotifyEmbed} className="hover:ring-2 hover:ring-blue-500" disabled={isSaving || isUploadingImage}>
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
            <Label>Share Your Location</Label>
            <Button
              type="button"
              onClick={handleGetLocation}
              disabled={locationLoading || isSaving || isUploadingImage}
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
                <Button type="button" variant="outline" onClick={handleClearLocation} className="w-full hover:ring-2 hover:ring-blue-500 ring-inset" disabled={isSaving || isUploadingImage}>
                  Clear Location
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSaving || isUploadingImage} className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isUploadingImage || (!message.trim() && !uploadedImageUrls && !spotifyEmbedUrl && !coordinates)} className="hover:ring-2 hover:ring-blue-500">
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