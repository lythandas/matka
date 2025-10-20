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
import { Trash2, Upload } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from "@/components/ui/badge"; // Import Badge component

interface Post {
  id: string;
  message: string;
  image_url?: string;
  created_at: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

const Index = () => {
  const { isAuthenticated, login, logout } = useAuth();
  const [message, setMessage] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [backendConnected, setBackendConnected] = useState<boolean>(false); // New state for backend status
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPosts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/posts`);
      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }
      const data: Post[] = await response.json();
      setPosts(data);
      setBackendConnected(true); // Set to true on successful fetch
    } catch (error) {
      console.error('Error fetching posts:', error);
      showError('Failed to load posts.');
      setBackendConnected(false); // Set to false on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];

      // Client-side size validation
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        showError('Image size exceeds 8MB limit.');
        setImageFile(null);
        if (fileInputRef.current) fileInputRef.current.value = ''; // Clear input
        return;
      }

      // Client-side type validation (basic check)
      if (!file.type.startsWith('image/')) {
        showError('Only image files are allowed.');
        setImageFile(null);
        if (fileInputRef.current) fileInputRef.current.value = ''; // Clear input
        return;
      }

      setImageFile(file);
    } else {
      setImageFile(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!message.trim() && !imageFile) {
      showError('Please enter a message or select an image.');
      return;
    }

    try {
      let imageBase64: string | undefined;
      let imageType: string | undefined;

      if (imageFile) {
        const reader = new FileReader();
        reader.readAsDataURL(imageFile);
        await new Promise<void>((resolve, reject) => {
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              imageBase64 = reader.result.split(',')[1];
              imageType = imageFile.type;
            }
            resolve();
          };
          reader.onerror = (error) => {
            console.error("FileReader error:", error);
            reject(new Error("Failed to read image file."));
          };
        });
      }

      const response = await fetch(`${API_BASE_URL}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, imageBase64, imageType }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create post');
      }

      const newPost: Post = await response.json();
      setPosts([newPost, ...posts]);
      setMessage('');
      setImageFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-extrabold text-blue-600 dark:text-blue-400">
            My Journey
          </h1>
          <div className="flex items-center space-x-2">
            <ThemeToggle />
            <Button onClick={isAuthenticated ? logout : login} variant="outline">
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
              <CardTitle className="text-2xl font-semibold">Share Your Day</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Textarea
                  placeholder="What's on your mind today?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="w-full resize-none"
                />
                <div className="flex items-center w-full">
                  <Input
                    id="image-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/bmp,image/tiff"
                    onChange={handleImageChange}
                    ref={fileInputRef}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    className="flex-1 justify-start text-gray-600 dark:text-gray-400"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {imageFile ? imageFile.name : "Choose Image (Max 8MB)"}
                  </Button>
                  {imageFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setImageFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      className="ml-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex justify-center">
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                    Post
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <h2 className="text-3xl font-bold mb-6 text-center text-gray-800 dark:text-gray-200">
          Recent Posts
        </h2>

        {loading ? (
          <p className="text-center text-gray-600 dark:text-gray-400">Loading posts...</p>
        ) : posts.length === 0 ? (
          <p className="text-center text-gray-600 dark:text-gray-400">No posts yet. Be the first to share!</p>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <Card key={post.id} className="shadow-md hover:shadow-lg transition-shadow duration-200">
                <CardContent className="p-6">
                  {post.image_url && (
                    <img
                      src={post.image_url}
                      alt="Post image"
                      className="w-full h-auto max-h-96 object-cover rounded-md mb-4"
                      onError={(e) => {
                        e.currentTarget.src = '/public/placeholder.svg'; // Fallback image
                        e.currentTarget.onerror = null; // Prevent infinite loop
                        console.error(`Failed to load image: ${post.image_url}`);
                      }}
                    />
                  )}
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-lg text-gray-800 dark:text-gray-200">{post.message}</p>
                    {isAuthenticated && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon" className="ml-4">
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
              </Card>
            ))}
          </div>
        )}
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;