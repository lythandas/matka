"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { showSuccess, showError } from '@/utils/toast';
import { format, isSameDay, parseISO } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Plus, XCircle, Compass, Edit, Upload, MapPin, LocateFixed, Search, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from "@/components/ui/badge";
import MapComponent from '@/components/MapComponent';
import PostDetailDialog from '@/components/PostDetailDialog';
import ShineCard from '@/components/ShineCard';
import { useJourneys } from '@/contexts/JourneyContext';
import ViewToggle from '@/components/ViewToggle';
import GridPostCard from '@/components/GridPostCard';
import EditPostDialog from '@/components/EditPostDialog';
import UserProfileDropdown from '@/components/UserProfileDropdown';
import { getAvatarInitials } from '@/lib/utils';
import { API_BASE_URL } from '@/config/api';
import { MAX_CONTENT_FILE_SIZE_BYTES, SUPPORTED_MEDIA_TYPES } from '@/config/constants';
import { Post, Journey, MediaInfo, JourneyCollaborator } from '@/types';
import { useCreateJourneyDialog } from '@/contexts/CreateJourneyDialogContext';
import ManageJourneyDialog from '@/components/ManageJourneyDialog';
import LocationSearch from '@/components/LocationSearch';
import JourneyMapDialog from '@/components/JourneyMapDialog';
import PostDatePicker from '@/components/PostDatePicker'; // Import PostDatePicker
import { useIsMobile } from '@/hooks/use-mobile';

const Index = () => {
  const { isAuthenticated, user, token } = useAuth();
  const { selectedJourney, loadingJourneys, journeys, fetchJourneys } = useJourneys();
  const { setIsCreateJourneyDialogOpen } = useCreateJourneyDialog();
  const isMobile = useIsMobile();

  const [title, setTitle] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedMediaItems, setUploadedMediaItems] = useState<MediaInfo[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState<boolean>(false);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(true);
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'map'>('list');

  const [selectedPostForDetail, setSelectedPostForDetail] = useState<Post | null>(null);
  const [selectedPostIndex, setSelectedPostIndex] = useState<number | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState<boolean>(false);

  const [isEditPostDialogOpen, setIsEditPostDialogOpen] = useState<boolean>(false);
  const [postToEdit, setPostToEdit] = useState<Post | null>(null);

  const [isManageJourneyDialogOpen, setIsManageJourneyDialogOpen] = useState<boolean>(false);
  const [journeyCollaborators, setJourneyCollaborators] = useState<JourneyCollaborator[]>([]);

  const [locationSelectionMode, setLocationSelectionMode] = useState<'none' | 'current' | 'search'>('none');
  const [locationLoading, setLoadingLocation] = useState<boolean>(false);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);

  const [postDate, setPostDate] = useState<Date | undefined>(new Date()); // New state for post date, defaults to today

  useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/`);
        setBackendConnected(response.ok);
      } catch (error) {
        console.error('Backend connection check failed:', error);
        setBackendConnected(false);
      }
    };
    checkBackendStatus();
    const interval = setInterval(checkBackendStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchJourneyCollaborators = useCallback(async (journeyId: string) => {
    if (!user || !user.id || !token) {
      setJourneyCollaborators([]);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/journeys/${journeyId}/collaborators`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
          setJourneyCollaborators([]);
          return;
        }
        throw new Error('Failed to fetch journey collaborators');
      }
      const data: JourneyCollaborator[] = await response.json();
      setJourneyCollaborators(data);
    } catch (error) {
      console.error('Error fetching journey collaborators:', error);
      setJourneyCollaborators([]);
    }
  }, [user, token]);

  const fetchPosts = async (journeyId: string) => {
    setLoadingPosts(true);
    try {
      const response = await fetch(`${API_BASE_URL}/posts?journeyId=${journeyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }
      const data: Post[] = await response.json();
      setPosts(data);
    } catch (error) {
      console.error('Error fetching posts:', error);
      showError('Failed to load posts.');
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    if (selectedJourney) {
      fetchPosts(selectedJourney.id);
      fetchJourneyCollaborators(selectedJourney.id);
    } else {
      setPosts([]);
      setLoadingPosts(false);
      setJourneyCollaborators([]);
    }
  }, [selectedJourney, isAuthenticated, fetchJourneyCollaborators, token]);

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

        const response = await fetch(`${API_BASE_URL}/upload-media`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ fileBase64: base64Data, fileType: file.type, isProfileImage: false }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to upload media: ${file.name}`);
        }

        const data = await response.json();
        newUploadedMedia.push(data.mediaInfo);
      }
      setUploadedMediaItems((prev) => [...prev, ...newUploadedMedia]);
      setSelectedFiles([]);
      showSuccess('Media uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading media:', error);
      showError(error.message || 'Failed to upload media.');
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
          showError(`File '${file.name}' size exceeds ${MAX_CONTENT_FILE_SIZE_BYTES / (1024 * 1024)}MB limit.`);
          continue;
        }
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
          showError(`File '${file.name}' is not an image or video.`);
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
    showSuccess('Media item removed.');
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      showError('Geolocation is not supported by your browser.');
      return;
    }

    setLoadingLocation(true);
    setLocationSelectionMode('current');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoordinates({ lat: latitude, lng: longitude });
        showSuccess('Location retrieved successfully!');
        setLoadingLocation(false);
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
    showSuccess('Location cleared.');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isAuthenticated) {
      showError('You must be logged in to create a post.');
      return;
    }

    if (!selectedJourney) {
      showError('Please select a journey before creating a post.');
      return;
    }

    // Permission check for creating a post
    const isOwner = user?.id === selectedJourney.user_id;
    const isAdmin = user?.isAdmin;
    const canPublishAsCollaborator = journeyCollaborators.some(collab => collab.user_id === user?.id && collab.can_publish_posts);
    const canCreatePost = isOwner || isAdmin || canPublishAsCollaborator;

    if (!canCreatePost) {
      showError('You do not have permission to create posts in this journey.');
      return;
    }

    if (!title.trim() && !message.trim() && uploadedMediaItems.length === 0 && !coordinates) {
      showError('Please enter a title, message, or add some content (media, location).');
      return;
    }
    if (isUploadingMedia) {
      showError('Please wait for media uploads to finish.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          journeyId: selectedJourney.id,
          title: title.trim() || undefined,
          message: message.trim(),
          media_items: uploadedMediaItems.length > 0 ? uploadedMediaItems : undefined,
          coordinates: coordinates || undefined,
          created_at: postDate ? postDate.toISOString() : undefined, // Include selected post date
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create post');
      }

      const newPost: Post = await response.json();
      setPosts([newPost, ...posts]);
      setTitle('');
      setMessage('');
      setSelectedFiles([]);
      setUploadedMediaItems([]);
      setCoordinates(null);
      setLocationSelectionMode('none');
      setPostDate(new Date()); // Reset post date to today
      showSuccess('Post created successfully!');
    } catch (error: any) {
      console.error('Error creating post:', error);
      showError(error.message || 'Failed to create post.');
    }
  };

  const handleDeletePost = async (id: string, journeyId: string, postAuthorId: string) => {
    if (!isAuthenticated) {
      showError('You must be logged in to delete a post.');
      return;
    }

    // Permission check for deleting a post
    const isPostAuthor = user?.id === postAuthorId;
    const isJourneyOwner = selectedJourney?.user_id === user?.id;
    const isAdmin = user?.isAdmin;
    const canDeleteAsCollaborator = journeyCollaborators.some(collab => collab.user_id === user?.id && collab.can_delete_posts);

    if (!isPostAuthor && !isJourneyOwner && !isAdmin && !canDeleteAsCollaborator) {
      showError('You do not have permission to delete this post.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/posts/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete post');
      }

      setPosts(posts.filter((post) => post.id !== id));
      showSuccess('Post deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting post:', error);
      showError(error.message || 'Failed to delete post.');
    }
  };

  const handlePostClick = (post: Post, index: number) => {
    setSelectedPostForDetail(post);
    setSelectedPostIndex(index);
    setIsDetailDialogOpen(true);
  };

  const handleNextPost = () => {
    if (selectedPostIndex !== null && selectedPostIndex < posts.length - 1) {
      const nextIndex = selectedPostIndex + 1;
      setSelectedPostIndex(nextIndex);
      setSelectedPostForDetail(posts[nextIndex]);
    }
  };

  const handlePreviousPost = () => {
    if (selectedPostIndex !== null && selectedPostIndex > 0) {
      const prevIndex = selectedPostIndex - 1;
      setSelectedPostIndex(prevIndex);
      setSelectedPostForDetail(posts[prevIndex]);
    }
  };

  const handleCloseDetailDialog = () => {
    setIsDetailDialogOpen(false);
    setSelectedPostForDetail(null);
    setSelectedPostIndex(null);
  };

  const handleEditPost = (post: Post) => {
    setPostToEdit(post);
    setIsEditPostDialogOpen(true);
  };

  const handlePostUpdated = (updatedPost: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
    if (selectedPostForDetail?.id === updatedPost.id) {
      setSelectedPostForDetail(updatedPost);
    }
  };

  const handleSelectPostFromMap = (post: Post, index: number) => {
    handlePostClick(post, index); // Open post detail dialog
  };

  // Filter posts by selected date (logic remains, but calendar UI is gone)
  const filteredPosts = postDate
    ? posts.filter(post => isSameDay(parseISO(post.created_at), postDate))
    : posts;

  // Permission check for creating a post (used for disabling UI)
  const canCreatePostUI = isAuthenticated && selectedJourney && (user?.id === selectedJourney.user_id || user?.isAdmin || journeyCollaborators.some(collab => collab.user_id === user?.id && collab.can_publish_posts));
  const canCreateJourneyUI = isAuthenticated; // All authenticated users can create journeys
  const hasPostsWithCoordinates = posts.some(post => post.coordinates);

  return (
    <div className="flex-grow max-w-3xl mx-auto w-full p-4 sm:p-6 lg:p-8"> {/* Main content area for posts and form */}
      {isAuthenticated ? (
        selectedJourney ? (
          <Card className="mb-8 shadow-lg shadow-neon-blue">
            <CardHeader className="flex flex-row items-center justify-end">
              {/* Removed the "Manage Collaborators" button from here */}
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2 mb-4"> {/* Flex container for title and date picker */}
                  <Input
                    placeholder="Add a title (optional)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="flex-grow"
                    disabled={!canCreatePostUI}
                  />
                  <PostDatePicker
                    selectedDate={postDate}
                    onDateSelect={setPostDate}
                    disabled={!canCreatePostUI || isUploadingMedia}
                    className="w-full sm:w-auto" // Adjust width for responsiveness
                  />
                </div>
                <Textarea
                  placeholder="What's on your mind today?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="w-full resize-none"
                  disabled={!canCreatePostUI}
                />

                {(uploadedMediaItems.length > 0 || coordinates) && (
                  <div className="space-y-4 p-4 border rounded-md bg-gray-50 dark:bg-gray-800">
                    <h4 className="text-lg font-semibold">Content preview:</h4>
                    {uploadedMediaItems.map((mediaItem, index) => (
                      <div key={index} className="relative">
                        {mediaItem.type === 'image' ? (
                          <img
                            src={mediaItem.urls.medium || '/placeholder.svg'}
                            alt={`Media preview ${index + 1}`}
                            className="w-full h-auto max-h-64 object-cover rounded-md"
                            onError={(e) => {
                              e.currentTarget.src = '/placeholder.svg';
                              e.currentTarget.onerror = null;
                              console.error(`Failed to load media: ${mediaItem.urls.medium}`);
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
                      <p className="text-sm text-center text-blue-500 dark:text-blue-400 mt-1">Uploading...</p>
                    )}
                    {coordinates && (
                      <div className="relative">
                        <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-2">
                          Lat: {coordinates.lat.toFixed(4)}, Lng: {coordinates.lng.toFixed(4)}
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

                <div className="flex flex-wrap justify-center gap-2"> {/* Use flex-wrap for responsiveness */}
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
                        Uploading Media...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Media
                      </>
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
                        Getting location...
                      </>
                    ) : (
                      <>
                        <LocateFixed className="mr-2 h-4 w-4" /> Get Location
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
                    <Search className="mr-2 h-4 w-4" /> Search Location
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

                <div className="flex justify-center">
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white hover:ring-2 hover:ring-blue-500" disabled={isUploadingMedia || !canCreatePostUI || (!title.trim() && !message.trim() && uploadedMediaItems.length === 0 && !coordinates)}>
                    Post
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          !loadingJourneys && journeys.length === 0 && (
            <div className="text-center py-12">
              <Compass className="h-24 w-24 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
              <p className="text-xl text-gray-600 dark:text-gray-400 font-semibold">
                You don't have any journeys yet!
              </p>
              <p className="text-md text-gray-500 dark:text-gray-500 mt-2 mb-4">
                Start by creating your first journey.
              </p>
              {canCreateJourneyUI && (
                <Button
                  onClick={() => setIsCreateJourneyDialogOpen(true)}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white hover:ring-2 hover:ring-blue-500"
                >
                  <Plus className="mr-2 h-4 w-4" /> Create new journey
                </Button>
              )}
            </div>
          )
        )
      ) : null}

      {filteredPosts.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0 sm:space-x-4">
          <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        </div>
      )}

      {loadingPosts ? (
        <p className="text-center text-gray-600 dark:text-gray-400">Loading posts...</p>
      ) : filteredPosts.length === 0 && selectedJourney ? (
        <div className="text-center py-12">
          <Compass className="h-24 w-24 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
          <p className="text-xl text-gray-600 dark:text-gray-400 font-semibold">
            {postDate ? `No posts found for ${postDate.toDateString()}.` : "Your journey awaits! Start by adding your first post."}
          </p>
          {!postDate && isAuthenticated && canCreatePostUI && (
            <p className="text-md text-gray-500 dark:text-gray-500 mt-2">
              Use the "Share your day" section above to begin.
            </p>
          )}
        </div>
      ) : (
        viewMode === 'list' ? (
          <div className="space-y-6">
            {filteredPosts.map((post, index) => {
              // Permission checks for individual post actions
              const isPostAuthor = user?.id === post.user_id;
              const isJourneyOwner = selectedJourney?.user_id === user?.id;
              const isAdmin = user?.isAdmin;
              const canModifyAsCollaborator = journeyCollaborators.some(collab => collab.user_id === user?.id && collab.can_modify_post);
              const canDeleteAsCollaborator = journeyCollaborators.some(collab => collab.user_id === user?.id && collab.can_delete_posts);

              const canEditPost = isPostAuthor || isJourneyOwner || isAdmin || canModifyAsCollaborator;
              const canDeletePost = isPostAuthor || isJourneyOwner || isAdmin || canDeleteAsCollaborator;

              return (
                <ShineCard
                  key={post.id}
                  className="shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer group hover:ring-2 hover:ring-blue-500"
                  onClick={() => handlePostClick(post, index)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      {post.author_profile_image_url ? (
                        <img
                          src={post.author_profile_image_url}
                          alt={post.author_name || post.author_username}
                          className="w-10 h-10 rounded-full object-cover mr-3"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mr-3 text-gray-500 dark:text-gray-400 text-lg font-semibold">
                          {getAvatarInitials(post.author_name, post.author_username)}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">
                          {post.author_name || post.author_username}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {format(new Date(post.created_at), 'PPP p')}
                        </p>
                      </div>
                    </div>
                    {post.title && (
                      <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">{post.title}</h3>
                    )}
                    {post.media_items && post.media_items.length > 0 && (
                      <div className={
                        post.media_items.length === 1
                          ? "mb-4"
                          : "grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4"
                      }>
                        {post.media_items.map((mediaItem, mediaIndex) => (
                          <div key={mediaIndex} className="relative">
                            {mediaItem.type === 'image' && mediaItem.urls.large && (
                              <img
                                src={mediaItem.urls.large}
                                alt={`Post image ${mediaIndex + 1}`}
                                className="w-full h-auto max-h-96 object-cover rounded-md"
                                onError={(e) => {
                                  e.currentTarget.src = '/placeholder.svg';
                                  e.currentTarget.onerror = null;
                                  console.error(`Failed to load image: ${mediaItem.urls.large}`);
                                }}
                              />
                            )}
                            {mediaItem.type === 'video' && mediaItem.url && (
                              <video
                                src={mediaItem.url}
                                controls
                                className="w-full h-auto max-h-96 object-cover rounded-md"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-lg text-gray-800 dark:text-gray-200">{post.message}</p>
                      <div className="flex space-x-2">
                        {isAuthenticated && selectedJourney && canEditPost && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handleEditPost(post); }}
                            className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {isAuthenticated && selectedJourney && canDeletePost && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <AlertDialog key={`delete-dialog-${post.id}`}>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon" className="hover:ring-2 hover:ring-blue-500">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete your post
                                    and remove its data from our servers.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeletePost(post.id, post.journey_id, post.user_id)}>
                                    Continue
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                    </div>
                    {post.coordinates && (
                      <div className="mt-4">
                        <MapComponent coordinates={post.coordinates} />
                      </div>
                    )}
                  </CardContent>
                </ShineCard>
              );
            })}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post, index) => (
              <GridPostCard
                key={post.id}
                post={post}
                onClick={() => handlePostClick(post, index)}
              />
            ))}
          </div>
        ) : ( // viewMode === 'map'
          hasPostsWithCoordinates ? (
            <div className="w-full h-[70vh] rounded-md overflow-hidden">
              <MapComponent
                posts={filteredPosts} // Pass filtered posts to map
                onMarkerClick={handleSelectPostFromMap}
                className="w-full h-full"
                zoom={7} // Default zoom for map view
              />
            </div>
          ) : (
            <div className="text-center py-12">
              <Compass className="h-24 w-24 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
              <p className="text-xl text-gray-600 dark:text-gray-400 font-semibold">
                No posts with location data to display on the map.
              </p>
              <p className="text-md text-gray-500 dark:text-gray-500 mt-2">
                Add posts with location information to see them here!
              </p>
            </div>
          )
        )
      )}
      {selectedPostForDetail && isDetailDialogOpen && (
        <PostDetailDialog
          key={selectedPostForDetail.id}
          post={selectedPostForDetail}
          isOpen={isDetailDialogOpen}
          onClose={handleCloseDetailDialog}
          currentIndex={selectedPostIndex !== null ? selectedPostIndex : -1}
          totalPosts={posts.length}
          onNext={handleNextPost}
          onPrevious={handlePreviousPost}
        />
      )}

      {postToEdit && selectedJourney && (
        <EditPostDialog
          isOpen={isEditPostDialogOpen}
          onClose={() => { setIsEditPostDialogOpen(false); setPostToEdit(null); }}
          post={postToEdit}
          onUpdate={handlePostUpdated}
          journeyOwnerId={selectedJourney.user_id}
          journeyCollaborators={journeyCollaborators}
        />
      )}

      {selectedJourney && (
        <ManageJourneyDialog
          isOpen={isManageJourneyDialogOpen}
          onClose={() => setIsManageJourneyDialogOpen(false)}
          journey={selectedJourney}
          onJourneyUpdated={() => {
            fetchJourneys();
            fetchJourneyCollaborators(selectedJourney.id);
            fetchPosts(selectedJourney.id);
          }}
        />
      )}
    </div>
  );
};

export default Index;