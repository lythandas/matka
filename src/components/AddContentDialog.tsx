"use client";

import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Image, Music, MapPin, Loader2, Trash2, Plus } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import MapComponent from './MapComponent'; // Import the new MapComponent

interface AddContentDialogProps {
  onImageSelect: (file: File | null) => void;
  onSpotifyEmbedChange: (url: string) => void;
  onCoordinatesChange: (coords: { lat: number; lng: number } | null) => void;
  uploadedImageUrl: string | null;
  isUploadingImage: boolean;
  currentSpotifyEmbedUrl: string;
  currentCoordinates: { lat: number; lng: number } | null;
  children: React.ReactNode;
}

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

const AddContentDialog: React.FC<AddContentDialogProps> = ({
  onImageSelect,
  onSpotifyEmbedChange,
  onCoordinatesChange,
  uploadedImageUrl,
  isUploadingImage,
  currentSpotifyEmbedUrl,
  currentCoordinates,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [spotifyInput, setSpotifyInput] = useState<string>(currentSpotifyEmbedUrl);
  const [locationLoading, setLocationLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSpotifyInput(currentSpotifyEmbedUrl);
    if (uploadedImageUrl) {
      // If an image was successfully uploaded, we don't need the local preview anymore
      setPreviewImageUrl(uploadedImageUrl);
    } else if (!selectedFile) {
      // If no file is selected and no uploaded URL, clear preview
      setPreviewImageUrl(null);
    }
  }, [currentSpotifyEmbedUrl, uploadedImageUrl, selectedFile]);

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];

      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        showError('Image size exceeds 8MB limit.');
        setSelectedFile(null);
        setPreviewImageUrl(null);
        onImageSelect(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      if (!file.type.startsWith('image/')) {
        showError('Only image files are allowed.');
        setSelectedFile(null);
        setPreviewImageUrl(null);
        onImageSelect(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setSelectedFile(file);
      setPreviewImageUrl(URL.createObjectURL(file));
      onImageSelect(file); // Pass the file up for immediate upload
    } else {
      setSelectedFile(null);
      setPreviewImageUrl(null);
      onImageSelect(null);
    }
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    setPreviewImageUrl(null);
    onImageSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSpotifyInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSpotifyInput(e.target.value);
  };

  const handleAddSpotifyEmbed = () => {
    if (spotifyInput.trim()) {
      // Basic validation for Spotify embed URL
      if (spotifyInput.includes('spotify.com/embed/')) {
        onSpotifyEmbedChange(spotifyInput.trim());
        showSuccess('Spotify embed URL added!');
      } else {
        showError('Please enter a valid Spotify embed URL (e.g., from Spotify "Share" -> "Embed track").');
      }
    } else {
      onSpotifyEmbedChange(''); // Clear if input is empty
      showSuccess('Spotify embed URL cleared.');
    }
  };

  const handleClearSpotifyEmbed = () => {
    setSpotifyInput('');
    onSpotifyEmbedChange('');
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
        onCoordinatesChange({ lat: latitude, lng: longitude });
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
    onCoordinatesChange(null);
    showSuccess('Location cleared.');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Content to Your Post</DialogTitle>
          <DialogDescription>
            Choose what kind of content you want to add.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="image" className="w-full">
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
          <TabsContent value="image" className="mt-4 space-y-4">
            <Label htmlFor="image-upload">Upload Image (Max 8MB)</Label>
            <div className="flex items-center w-full">
              <Input
                id="image-upload"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/bmp,image/tiff"
                onChange={handleImageFileChange}
                ref={fileInputRef}
                className="hidden"
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="flex-1 justify-start text-gray-600 dark:text-gray-400"
                disabled={isUploadingImage}
              >
                {isUploadingImage ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {selectedFile ? selectedFile.name : "Choose Image"}
              </Button>
              {(selectedFile || uploadedImageUrl) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleClearImage}
                  className="ml-2"
                  disabled={isUploadingImage}
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
          <TabsContent value="spotify" className="mt-4 space-y-4">
            <Label htmlFor="spotify-embed">Spotify Embed URL</Label>
            <Input
              id="spotify-embed"
              placeholder="e.g., https://open.spotify.com/embed/track/..."
              value={spotifyInput}
              onChange={handleSpotifyInputChange}
            />
            <div className="flex justify-end space-x-2">
              {currentSpotifyEmbedUrl && (
                <Button type="button" variant="outline" onClick={handleClearSpotifyEmbed}>
                  Clear Spotify
                </Button>
              )}
              <Button type="button" onClick={handleAddSpotifyEmbed}>
                {currentSpotifyEmbedUrl ? 'Update Spotify' : 'Add Spotify'}
              </Button>
            </div>
            {currentSpotifyEmbedUrl && (
              <div className="w-full aspect-video mt-4">
                <iframe
                  src={currentSpotifyEmbedUrl}
                  width="100%"
                  height="100%"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  className="rounded-md"
                ></iframe>
              </div>
            )}
          </TabsContent>
          <TabsContent value="location" className="mt-4 space-y-4">
            <Label>Share Your Location</Label>
            <Button
              type="button"
              onClick={handleGetLocation}
              disabled={locationLoading}
              className="w-full"
            >
              {locationLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="mr-2 h-4 w-4" />
              )}
              {locationLoading ? 'Getting Location...' : 'Get Current Location'}
            </Button>
            {currentCoordinates && (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  Lat: {currentCoordinates.lat.toFixed(4)}, Lng: {currentCoordinates.lng.toFixed(4)}
                </p>
                <MapComponent coordinates={currentCoordinates} className="h-48" />
                <Button type="button" variant="outline" onClick={handleClearLocation} className="w-full">
                  Clear Location
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button type="button" onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddContentDialog;