"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { showSuccess, showError } from '@/utils/toast';
import { format } from 'date-fns';
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
import { Trash2, Plus, XCircle, Compass, Edit } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from "@/components/ui/badge";
import AddContentDialog from '@/components/AddContentDialog';
import MapComponent from '@/components/MapComponent';
import PostDetailDialog from '@/components/PostDetailDialog';
import ShineCard from '@/components/ShineCard';
import { useJourneys } from '@/contexts/JourneyContext';
import ViewToggle from '@/components/ViewToggle';
import GridPostCard from '@/components/GridPostCard';
import CreateUserDialog from '@/components/CreateUserDialog';
import LoginDialog from '@/components/LoginDialog';
import RegisterDialog from '@/components/RegisterDialog';
import EditPostDialog from '@/components/EditPostDialog';
import AppHeader from '@/components/AppHeader';
import UserProfileDropdown from '@/components/UserProfileDropdown';
import { getAvatarInitials } from '@/lib/utils';
import AppFooter from '@/components/AppFooter';

interface Post {
  id: string;
  title?: string;
  message: string;
  image_urls?: { small?: string; medium?: string; large?: string; original?: string };
  spotify_embed_url?: string;
  coordinates?: { lat: number; lng: number };
  created_at: string;
  user_id: string;
  author_username: string;
  author_name?: string;
  author_surname?: string;
  author_profile_image_url?: string;
}

interface Journey {
  id: string;
  name: string;
  created_at: string;
  user_id: string;
  owner_username: string;
  owner_name?: string;
  owner_surname?: string;
  owner_profile_image_url?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

const Index = () => {
  const { isAuthenticated, user, usersExist } = useAuth();
  const { selectedJourney, loadingJourneys, journeys } = useJourneys();
  const [title, setTitle] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<{ small?: string; medium?: string; large?: string; original?: string } | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [spotifyEmbedUrl, setSpotifyEmbedUrl] = useState<string>('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(true);
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState<boolean>(false);
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState<boolean>(false);
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const [selectedPostForDetail, setSelectedPostForDetail] = useState<Post | null>(null);
  const [selectedPostIndex, setSelectedPostIndex] = useState<number | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState<boolean>(false);

  const [isEditPostDialogOpen, setIsEditPostDialogOpen] = useState<boolean>(false);
  const [postToEdit, setPostToEdit] = useState<Post | null>(null);

  // Effect to check backend connectivity
  useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/`); // Ping the root endpoint
        setBackendConnected(response.ok);
      } catch (error) {
        console.error('Backend connection check failed:', error);
        setBackendConnected(false);
      }
    };
    checkBackendStatus();
    const interval = setInterval(checkBackendStatus, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchPosts = async (journeyId: string) => {
    setLoadingPosts(true);
    try {
      const response = await fetch(`${API_BASE_URL}/posts?journeyId=${journeyId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
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
    } else {
      setPosts([]);
      setLoadingPosts(false);
    }
  }, [selectedJourney, isAuthenticated]);

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
      showSuccess('Image uploaded successfully!');
    } catch (error: any) {
      console.error('Error uploading image:', error);
      showError(error.message || 'Failed to upload image.');
      setSelectedFile(null);
      setUploadedImageUrls(null);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleImageSelect = (file: File | null) => {
    setSelectedFile(file);
    if (file) {
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        showError(`Image size exceeds ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB limit.`);
        setSelectedFile(null);
        setUploadedImageUrls(null);
        return;
      }
      uploadImageToServer(file);
    } else {
      setUploadedImageUrls(null);
    }
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

    if (!title.trim() && !message.trim() && !uploadedImageUrls && !spotifyEmbedUrl && !coordinates) {
      showError('Please enter a title, message, or add some content (image, Spotify, location).');
      return;
    }
    if (isUploadingImage) {
      showError('Please wait for the image to finish uploading.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          journeyId: selectedJourney.id,
          title: title.trim() || undefined,
          message: message.trim(),
          imageUrls: uploadedImageUrls,
          spotifyEmbedUrl: spotifyEmbedUrl.trim() || undefined,
          coordinates: coordinates || undefined,
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
      setSelectedFile(null);
      setUploadedImageUrls(null);
      setSpotifyEmbedUrl('');
      setCoordinates(null);
      showSuccess('Post created successfully!');
    } catch (error: any) {
      console.error('Error creating post:', error);
      showError(error.message || 'Failed to create post.');
    }
  };

  const handleDeletePost = async (id: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/posts/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
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

  const showMatkaAsMainTitle = !selectedJourney && !loadingJourneys && journeys.length === 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <AppHeader />

        <div className="flex justify-end mb-4">
          <Badge variant={backendConnected ? "default" : "destructive"}>
            Backend: {backendConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>

        {/* NEW WELCOME SECTION FOR ADMIN REGISTRATION */}
        {!isAuthenticated && usersExist === false && (
          <div className="text-center py-12">
            <Compass className="h-32 w-32 mx-auto text-blue-600 dark:text-blue-400 mb-6" />
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">Welcome to Matka!</h2>
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
              It looks like you're just getting started. Please register your first admin account to begin your journey.
            </p>
            {/* The UserProfileDropdown in AppHeader will handle opening the RegisterDialog */}
          </div>
        )}

        {isAuthenticated && (
          selectedJourney ? (
            <Card className="mb-8 shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl font-semibold">Share Your Day in "{selectedJourney.name}"</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    placeholder="Add a title (optional)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full"
                  />
                  <Textarea
                    placeholder="What's on your mind today?"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    className="w-full resize-none"
                  />

                  {/* Content Previews */}
                  {(uploadedImageUrls || spotifyEmbedUrl || coordinates) && (
                    <div className="space-y-4 p-4 border rounded-md bg-gray-50 dark:bg-gray-800">
                      <h4 className="text-lg font-semibold">Content Preview:</h4>
                      {uploadedImageUrls?.medium && (
                        <div className="relative">
                          <img
                            src={uploadedImageUrls.medium}
                            alt="Image preview"
                            className="w-full h-auto max-h-64 object-cover rounded-md"
                            onError={(e) => {
                              e.currentTarget.src = '/placeholder.svg';
                              e.currentTarget.onerror = null;
                              console.error(`Failed to load image: ${uploadedImageUrls?.medium}`);
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleImageSelect(null)}
                            className="absolute top-2 right-2 bg-white/70 dark:bg-gray-900/70 rounded-full hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                          >
                            <XCircle className="h-5 w-5 text-red-500" />
                          </Button>
                          {isUploadingImage && (
                            <p className="text-sm text-center text-blue-500 dark:text-blue-400 mt-1">Uploading...</p>
                          )}
                        </div>
                      )}
                      {spotifyEmbedUrl && (
                        <div className="relative w-full aspect-video">
                          <iframe
                            src={spotifyEmbedUrl}
                            width="100%"
                            height="100%"
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            loading="lazy"
                            className="rounded-md"
                          ></iframe>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setSpotifyEmbedUrl('')}
                            className="absolute top-2 right-2 bg-white/70 dark:bg-gray-900/70 rounded-full hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                          >
                            <XCircle className="h-5 w-5 text-red-500" />
                          </Button>
                        </div>
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
                            onClick={() => setCoordinates(null)}
                            className="absolute top-2 right-2 bg-white/70 dark:bg-gray-900/70 rounded-full hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                          >
                            <XCircle className="h-5 w-5 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-center">
                    <AddContentDialog
                      onImageSelect={handleImageSelect}
                      onSpotifyEmbedChange={setSpotifyEmbedUrl}
                      onCoordinatesChange={setCoordinates}
                      uploadedImageUrl={uploadedImageUrls?.medium || null}
                      isUploadingImage={isUploadingImage}
                      currentSpotifyEmbedUrl={spotifyEmbedUrl}
                      currentCoordinates={coordinates}
                    >
                      <Button type="button" variant="outline" className="flex items-center hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
                        <Plus className="mr-2 h-4 w-4" /> Add Content
                      </Button>
                    </AddContentDialog>
                  </div>
                  <div className="flex justify-center">
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white hover:ring-2 hover:ring-blue-500" disabled={isUploadingImage || !selectedJourney}>
                      Post
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            isAuthenticated && !loadingJourneys && journeys.length === 0 && (
              <div className="text-center py-12">
                <Compass className="h-24 w-24 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                <p className="text-xl text-gray-600 dark:text-gray-400 font-semibold">
                  You don't have any journeys yet!
                </p>
                <p className="text-md text-gray-500 dark:text-gray-500 mt-2 mb-4">
                  Create your first journey to start sharing your experiences.
                </p>
                <Button onClick={() => { /* Handled by AppHeader's CreateJourneyDialog */ }} className="hover:ring-2 hover:ring-blue-500">
                  <Plus className="mr-2 h-4 w-4" /> Create New Journey
                </Button>
              </div>
            )
          )
        )}

        {posts.length > 0 && (
          <div className="mb-6">
            <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          </div>
        )}

        {loadingPosts ? (
          <p className="text-center text-gray-600 dark:text-gray-400">Loading posts...</p>
        ) : posts.length === 0 && selectedJourney ? (
          <div className="text-center py-12">
            <Compass className="h-24 w-24 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
            <p className="text-xl text-gray-600 dark:text-gray-400 font-semibold">
              Your journey awaits! Start by adding your first post.
            </p>
            {isAuthenticated && (
              <p className="text-md text-gray-500 dark:text-gray-500 mt-2">
                Use the "Share Your Day" section above to begin.
              </p>
            )}
          </div>
        ) : (
          viewMode === 'list' ? (
            <div className="space-y-6">
              {posts.map((post, index) => (
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
                    {post.image_urls?.large && (
                      <img
                        src={post.image_urls.large}
                        alt="Post image"
                        className="w-full h-auto max-h-96 object-cover rounded-md mb-4"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder.svg';
                          e.currentTarget.onerror = null;
                          console.error(`Failed to load image: ${post.image_urls?.large}`);
                        }}
                      />
                    )}
                    {post.spotify_embed_url && (
                      <div className="w-full aspect-video mb-4">
                        <iframe
                          src={post.spotify_embed_url}
                          width="100%"
                          height="100%"
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                          loading="lazy"
                          className="rounded-md"
                        ></iframe>
                      </div>
                    )}
                    {post.coordinates && (
                      <div className="mb-4">
                        <MapComponent coordinates={post.coordinates} />
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-lg text-gray-800 dark:text-gray-200">{post.message}</p>
                      <div className="flex space-x-2">
                        {isAuthenticated && (user?.id === post.user_id || user?.permissions.includes('edit_any_post') || user?.role === 'admin') && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handleEditPost(post); }}
                            className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {isAuthenticated && (user?.id === post.user_id || user?.permissions.includes('delete_any_post') || user?.role === 'admin') && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon" className="hover:ring-2 hover:ring-blue-500" onClick={(e) => e.stopPropagation()}>
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
                                <AlertDialogAction onClick={() => handleDeletePost(post.id)}>
                                  Continue
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </ShineCard>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post, index) => (
                <GridPostCard
                  key={post.id}
                  post={post}
                  onClick={() => handlePostClick(post, index)}
                />
              ))}
            </div>
          )
        )}
      </div>
      <AppFooter />

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

      {postToEdit && (
        <EditPostDialog
          isOpen={isEditPostDialogOpen}
          onClose={() => { setIsEditPostDialogOpen(false); setPostToEdit(null); }}
          post={postToEdit}
          onUpdate={handlePostUpdated}
        />
      )}

      <CreateUserDialog
        isOpen={isCreateUserDialogOpen}
        onClose={() => setIsCreateUserDialogOpen(false)}
      />

      {usersExist === false && (
        <RegisterDialog
          isOpen={isRegisterDialogOpen}
          onClose={() => setIsRegisterDialogOpen(false)}
        />
      )}

      {usersExist === true && !isAuthenticated && (
        <LoginDialog
          isOpen={isLoginDialogOpen}
          onClose={() => setIsLoginDialogOpen(false)}
        />
      )}
    </div>
  );
};

export default Index;