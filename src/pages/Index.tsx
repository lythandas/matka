"use client";

import React, { useState, useEffect, useRef } from 'react';
import { MadeWithDyad } from "@/components/made-with-dyad";
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
import { Trash2, Plus, XCircle, ChevronDown, Compass } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from "@/components/ui/badge";
import AddContentDialog from '@/components/AddContentDialog';
import MapComponent from '@/components/MapComponent';
import PostDetailDialog from '@/components/PostDetailDialog';
import ShineCard from '@/components/ShineCard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useJourneys } from '@/contexts/JourneyContext';
import CreateJourneyDialog from '@/components/CreateJourneyDialog';

interface Post {
  id: string;
  title?: string;
  message: string;
  image_urls?: { small?: string; medium?: string; large?: string };
  spotify_embed_url?: string;
  coordinates?: { lat: number; lng: number };
  created_at: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

const Index = () => {
  const { isAuthenticated, login, logout } = useAuth();
  const { journeys, selectedJourney, setSelectedJourney, fetchJourneys, loadingJourneys } = useJourneys();
  const [title, setTitle] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<{ small?: string; medium?: string; large?: string } | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const [spotifyEmbedUrl, setSpotifyEmbedUrl] = useState<string>('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(true);
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const [isCreateJourneyDialogOpen, setIsCreateJourneyDialogOpen] = useState<boolean>(false);

  const [selectedPostForDetail, setSelectedPostForDetail] = useState<Post | null>(null);
  const [selectedPostIndex, setSelectedPostIndex] = useState<number | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState<boolean>(false);

  const fetchPosts = async (journeyId: string) => {
    setLoadingPosts(true);
    try {
      const response = await fetch(`${API_BASE_URL}/posts?journeyId=${journeyId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }
      const data: Post[] = await response.json();
      setPosts(data);
      setBackendConnected(true);
    } catch (error) {
      console.error('Error fetching posts:', error);
      showError('Failed to load posts.');
      setBackendConnected(false);
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    if (selectedJourney) {
      fetchPosts(selectedJourney.id);
    } else {
      setPosts([]); // Clear posts if no journey is selected
      setLoadingPosts(false);
    }
  }, [selectedJourney]);

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
      uploadImageToServer(file);
    } else {
      setUploadedImageUrls(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

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
        },
        body: JSON.stringify({
          journeyId: selectedJourney.id, // Associate post with selected journey
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="text-4xl font-extrabold text-blue-600 dark:text-blue-400 hover:bg-transparent hover:text-blue-700 dark:hover:text-blue-300 flex items-center hover:ring-2 hover:ring-blue-500"
              >
                {selectedJourney ? selectedJourney.name : "Select Journey"}
                <ChevronDown className="ml-2 h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Your Journeys</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {loadingJourneys ? (
                <DropdownMenuItem disabled>Loading journeys...</DropdownMenuItem>
              ) : (
                journeys.map((journey) => (
                  <DropdownMenuItem
                    key={journey.id}
                    onClick={() => setSelectedJourney(journey)}
                    className={selectedJourney?.id === journey.id ? "bg-accent text-accent-foreground" : ""}
                  >
                    {journey.name}
                  </DropdownMenuItem>
                ))
              )}
              {isAuthenticated && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsCreateJourneyDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Create New Journey
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center space-x-2">
            <ThemeToggle className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit" /> 
            <Button onClick={isAuthenticated ? logout : login} variant="outline" className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
              {isAuthenticated ? 'Logout' : 'Login'}
            </Button>
          </div>
        </div>

        <div className="flex justify-end mb-4">
          <Badge variant={backendConnected ? "default" : "destructive"}>
            Backend: {backendConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>

        {isAuthenticated && (
          <Card className="mb-8 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold">Share Your Day in "{selectedJourney?.name || 'No Journey Selected'}"</CardTitle>
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
        )}

        <h2 className="text-3xl font-bold mb-6 text-center text-gray-800 dark:text-gray-200">
          Posts in "{selectedJourney?.name || 'No Journey Selected'}"
        </h2>

        {loadingPosts ? (
          <p className="text-center text-gray-600 dark:text-gray-400">Loading posts...</p>
        ) : posts.length === 0 ? (
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
          <div className="space-y-6">
            {posts.map((post, index) => (
              <ShineCard
                key={post.id}
                className="shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer group hover:ring-2 hover:ring-blue-500"
                onClick={() => handlePostClick(post, index)}
              >
                <CardContent className="p-6">
                  {post.title && (
                    <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">{post.title}</h3>
                  )}
                  {post.image_urls?.medium && (
                    <img
                      src={post.image_urls.medium}
                      alt="Post image"
                      className="w-full h-auto max-h-96 object-cover rounded-md mb-4"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder.svg'; // Corrected path
                        e.currentTarget.onerror = null;
                        console.error(`Failed to load image: ${post.image_urls?.medium}`);
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
                    {isAuthenticated && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon" className="ml-4 hover:ring-2 hover:ring-blue-500" onClick={(e) => e.stopPropagation()}>
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
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {format(new Date(post.created_at), 'PPP p')}
                  </p>
                </CardContent>
              </ShineCard>
            ))}
          </div>
        )}
      </div>
      <MadeWithDyad />

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

      <CreateJourneyDialog
        isOpen={isCreateJourneyDialogOpen}
        onClose={() => setIsCreateJourneyDialogOpen(false)}
      />
    </div>
  );
};

export default Index;