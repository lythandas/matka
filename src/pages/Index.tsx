import React, { useState, useEffect } from 'react';
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { showSuccess, showError } from '@/utils/toast';
import { format } from 'date-fns';

interface Post {
  id: string;
  message: string;
  image_url?: string;
  created_at: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const Index = () => {
  const [message, setMessage] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchPosts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/posts`);
      if (!response.ok) {
        throw new Error('Failed to fetch posts');
      }
      const data: Post[] = await response.json();
      setPosts(data);
    } catch (error) {
      console.error('Error fetching posts:', error);
      showError('Failed to load posts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setImageFile(event.target.files[0]);
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
        await new Promise<void>((resolve) => {
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
              imageBase64 = reader.result.split(',')[1];
              imageType = imageFile.type;
            }
            resolve();
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
        throw new Error('Failed to create post');
      }

      const newPost: Post = await response.json();
      setPosts([newPost, ...posts]);
      setMessage('');
      setImageFile(null);
      showSuccess('Post created successfully!');
    } catch (error) {
      console.error('Error creating post:', error);
      showError('Failed to create post.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-extrabold text-center mb-8 text-blue-600 dark:text-blue-400">
          My Journey
        </h1>

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
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="file:text-blue-600 file:dark:text-blue-400 file:bg-blue-50 file:dark:bg-blue-900 file:border-0 file:rounded-md file:px-4 file:py-2 file:mr-4 file:cursor-pointer"
              />
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                Post
              </Button>
            </form>
          </CardContent>
        </Card>

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
                    />
                  )}
                  <p className="text-lg mb-2 text-gray-800 dark:text-gray-200">{post.message}</p>
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