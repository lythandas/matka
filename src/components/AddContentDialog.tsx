"use client";

import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl'; // Corrected import path
import { showError } from '@/utils/toast';
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
import { Image, Music, MapPin, Loader2, Trash2, Plus, Upload, XCircle, Video, LocateFixed, Search } from 'lucide-react'; // Added Video, LocateFixed, Search icons
import MapComponent from './MapComponent';
import { MAX_CONTENT_FILE_SIZE_BYTES, SUPPORTED_MEDIA_TYPES } from '@/config/constants'; // Updated import
import { MediaInfo } from '@/types'; // Import MediaInfo type
import LocationSearch from './LocationSearch'; // Import the new LocationSearch component

interface AddContentDialogProps {
  onMediaSelect: (file: File | null) => void; // Changed to onMediaSelect
  onSpotifyEmbedChange: (url: string) => void;
  onCoordinatesChange: (coords: { lat: number; lng: number } | null) => void;
  uploadedMediaInfo: MediaInfo | null; // Changed to uploadedMediaInfo
  isUploadingMedia: boolean; // Changed to isUploadingMedia
  currentSpotifyEmbedUrl: string;
  currentCoordinates: { lat: number; lng: number } | null;
  children: React.ReactNode;
}

const AddContentDialog: React.FC<AddContentDialogProps> = ({
  onMediaSelect,
  onSpotifyEmbedChange,
  onCoordinatesChange,
  uploadedMediaInfo,
  isUploadingMedia,
  currentSpotifyEmbedUrl,
  currentCoordinates,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null); // For local file preview
  const [spotifyInput, setSpotifyInput] = useState<string>(currentSpotifyEmbedUrl);
  const [locationLoading, setLocationLoading] = useState<boolean>(false);
  const [locationSelectionMode, setLocationSelectionMode] = useState<'current' | 'search'>(
    currentCoordinates ? 'current' : 'search' // Default to current if coords exist, else search
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSpotifyInput(currentSpotifyEmbedUrl);
    // Set local preview if mediaInfo is already present (e.g., from an existing post)
    if (uploadedMediaInfo) {
      if (uploadedMediaInfo.type === 'image' && uploadedMediaInfo.urls.medium) {
        setLocalPreviewUrl(uploadedMediaInfo.urls.medium);
      } else if (uploadedMediaInfo.type === 'video' && uploadedMediaInfo.url) {
        setLocalPreviewUrl(uploadedMediaInfo.url);
      }
    } else {
      setLocalPreviewUrl(null);
    }
  }, [currentSpotifyEmbedUrl, uploadedMediaInfo]);

  useEffect(() => {
    // When dialog opens, if there are current coordinates, set mode to 'current', otherwise 'search'
    if (open) {
      setLocationSelectionMode(currentCoordinates ? 'current' : 'search');
    }
  }, [open, currentCoordinates]);

  const handleMediaFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];

      if (file.size > MAX_CONTENT_FILE_SIZE_BYTES) { // Use new constant
        showError(`File size exceeds ${MAX_CONTENT_FILE_SIZE_BYTES / (1024 * 1024)}MB limit.`);
        setSelectedFile(null);
        setLocalPreviewUrl(null);
        onMediaSelect(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        showError('Only image or video files are allowed.');
        setSelectedFile(null);
        setLocalPreviewUrl(null);
        onMediaSelect(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      setSelectedFile(file);
      setLocalPreviewUrl(URL.createObjectURL(file)); // Set local preview
      onMediaSelect(file);
    } else {
      setSelectedFile(null);
      setLocalPreviewUrl(null);
      onMediaSelect(null);
    }
  };

  const handleClearMedia = () => { // Changed to handleClearMedia
    setSelectedFile(null);
    setLocalPreviewUrl(null);
    onMediaSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSpotifyInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSpotifyInput(e.target.value);
  };

  const handleAddSpotifyEmbed = () => {
    if (spotifyInput.trim()) {
      if (spotifyInput.includes('spotify.com/embed/')) {
        onSpotifyEmbedChange(spotifyInput.trim());
        showSuccess('Spotify embed URL added!');
      } else {
        showError('Please enter a valid Spotify embed URL (e.g., from Spotify "Share" -> "Embed track").');
      }
    } else {
      onSpotifyEmbedChange('');
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

  const currentMediaPreviewUrl = localPreviewUrl || (uploadedMediaInfo?.type === 'image' ? uploadedMediaInfo.urls.medium : uploadedMediaInfo?.type === 'video' ? uploadedMediaInfo.url : null);
  const currentMediaType = selectedFile?.type.startsWith('video/') ? 'video' : (uploadedMediaInfo?.type === 'video' ? 'video' : 'image');


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] min-h-[550px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Content to Your Post</DialogTitle>
          <DialogDescription>
            Choose what kind of content you want to add.
          </DialogDescription>
        </DialogHeader>
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
                disabled={isUploadingMedia}
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="flex-1 justify-start text-gray-600 dark:text-gray-400 hover:ring-2 hover:ring-blue-500 ring-inset"
                disabled={isUploadingMedia}
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
                  disabled={isUploadingMedia}
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
              value={spotifyInput}
              onChange={handleSpotifyInputChange}
            />
            <div className="flex justify-end space-x-2">
              {currentSpotifyEmbedUrl && (
                <Button type="button" variant="outline" onClick={handleClearSpotifyEmbed} className="hover:ring-2 hover:ring-blue-500 ring-inset">
                  Clear Spotify
                </Button>
              )}
              <Button type="button" onClick={handleAddSpotifyEmbed} className="hover:ring-2 hover:ring-blue-500">
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
          <TabsContent value="location" className="mt-4 space-y-4 flex-grow overflow-y-auto pb-4">
            <div className="flex space-x-2"> {/* Removed mb-4 */}
              <Button
                type="button"
                variant={locationSelectionMode === 'current' ? 'default' : 'outline'}
                onClick={() => {
                  setLocationSelectionMode('current');
                  onCoordinatesChange(null); // Clear search selection when switching
                }}
                className="flex-1 hover:ring-2 hover:ring-blue-500"
                disabled={isUploadingMedia}
              >
                <LocateFixed className="mr-2 h-4 w-4" /> Get Current Location
              </Button>
              <Button
                type="button"
                variant={locationSelectionMode === 'search' ? 'default' : 'outline'}
                onClick={() => {
                  setLocationSelectionMode('search');
                  onCoordinatesChange(null); // Clear current location when switching
                }}
                className="flex-1 hover:ring-2 hover:ring-blue-500"
                disabled={isUploadingMedia}
              >
                <Search className="mr-2 h-4 w-4" /> Search Location
              </Button>
            </div>

            {locationSelectionMode === 'current' && (
              <div className="space-y-4"> {/* Added wrapper div with space-y-4 */}
                <Button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={locationLoading || isUploadingMedia}
                  className="w-full hover:ring-2 hover:ring-blue-500"
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
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center"> {/* Removed mb-2, will be spaced by parent */}
                      Lat: {currentCoordinates.lat.toFixed(4)}, Lng: {currentCoordinates.lng.toFixed(4)}
                    </p>
                    <MapComponent coordinates={currentCoordinates} className="h-48" /> {/* Removed mt-2, will be spaced by parent */}
                    <Button type="button" variant="outline" onClick={handleClearLocation} className="w-full hover:ring-2 hover:ring-blue-500 ring-inset"> {/* Removed mt-4, will be spaced by parent */}
                      Clear Location
                    </Button>
                  </>
                )}
              </div>
            )}

            {locationSelectionMode === 'search' && (
              <LocationSearch
                onSelectLocation={onCoordinatesChange}
                currentCoordinates={currentCoordinates}
                disabled={isUploadingMedia}
              />
            )}
          </TabsContent>
        </Tabs>
        <DialogFooter className="pt-4">
          <Button type="button" onClick={() => setOpen(false)} className="hover:ring-2 hover:ring-blue-500">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddContentDialog;