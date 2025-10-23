"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Compass } from 'lucide-react';
import { showError } from '@/utils/toast';
import { format } from 'date-fns';
import MapComponent from '@/components/MapComponent';
import ShineCard from '@/components/ShineCard';
import { getAvatarInitials } from '@/lib/utils';
import AppFooter from '@/components/AppFooter';
import { API_BASE_URL } from '@/config/api';
import { Post, Journey } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const PublicJourneyPage: React.FC = () => {
  const { ownerUsername, journeyName } = useParams<{ ownerUsername: string; journeyName: string }>();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingJourney, setLoadingJourney] = useState<boolean>(true);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJourney = useCallback(async () => {
    if (!ownerUsername || !journeyName) {
      setError('Journey owner username or journey name is missing from the URL.');
      setLoadingJourney(false);
      return;
    }
    setLoadingJourney(true);
    try {
      const response = await fetch(`${API_BASE_URL}/public/journeys/by-name/${ownerUsername}/${journeyName}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch public journey');
      }
      const data: Journey = await response.json();
      setJourney(data);
      return data.id; // Return journey ID to fetch posts
    } catch (err: any) {
      console.error('Error fetching public journey:', err);
      setError(err.message || 'Failed to load journey. It might not exist or is not public.');
      showError(err.message || 'Failed to load journey.');
      setJourney(null);
      return null;
    } finally {
      setLoadingJourney(false);
    }
  }, [ownerUsername, journeyName]);

  const fetchPosts = useCallback(async (id: string) => {
    if (!id) {
      setLoadingPosts(false);
      return;
    }
    setLoadingPosts(true);
    try {
      const response = await fetch(`${API_BASE_URL}/public/journeys/${id}/posts`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch public posts');
      }
      const data: Post[] = await response.json();
      setPosts(data);
    } catch (err: any) {
      console.error('Error fetching public posts:', err);
      setError(err.message || 'Failed to load posts for this journey.');
      showError(err.message || 'Failed to load posts.');
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    const loadJourneyAndPosts = async () => {
      const id = await fetchJourney();
      if (id) {
        fetchPosts(id);
      } else {
        setLoadingPosts(false); // Stop loading posts if journey couldn't be fetched
      }
    };
    loadJourneyAndPosts();
  }, [fetchJourney, fetchPosts]);

  if (loadingJourney || loadingPosts) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
        <p className="text-lg text-gray-600 dark:text-gray-400">Loading public journey...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 text-center">
        <h1 className="text-4xl font-bold text-red-600 mb-4">Error</h1>
        <p className="text-xl text-gray-700 dark:text-gray-300 mb-6">{error}</p>
        <a href="/" className="text-blue-500 hover:text-blue-700 underline">
          Return to Home
        </a>
      </div>
    );
  }

  if (!journey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 text-center">
        <h1 className="text-4xl font-bold text-gray-700 dark:text-gray-300 mb-4">Journey Not Found</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-6">The public journey you are looking for does not exist or is not accessible.</p>
        <a href="/" className="text-blue-500 hover:text-blue-700 underline">
          Return to Home
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col w-full bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto flex-grow w-full p-4 sm:p-6 lg:p-8">
        <Card className="mb-8 shadow-lg shadow-neon-blue">
          <CardHeader className="text-center">
            <Compass className="h-16 w-16 mx-auto text-blue-600 dark:text-foreground mb-2" />
            <CardTitle className="text-4xl font-extrabold text-blue-600 dark:text-foreground mb-2">
              {journey.name}
            </CardTitle>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              A journey by {journey.owner_name || journey.owner_username}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Created on {format(new Date(journey.created_at), 'PPP')}
            </p>
          </CardHeader>
        </Card>

        {posts.length === 0 ? (
          <div className="text-center py-12">
            <Compass className="h-24 w-24 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
            <p className="text-xl text-gray-600 dark:text-gray-400 font-semibold">
              This journey has no public posts yet.
            </p>
            <p className="text-md text-gray-500 dark:text-gray-500 mt-2">
              Check back later!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <ShineCard key={post.id} className="shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    {post.author_profile_image_url ? (
                      <Avatar className="h-10 w-10 mr-3">
                        <AvatarImage src={post.author_profile_image_url} alt={post.author_name || post.author_username} />
                      </Avatar>
                    ) : (
                      <Avatar className="h-10 w-10 mr-3">
                        <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-lg font-semibold">
                          {getAvatarInitials(post.author_name, post.author_username)}
                        </AvatarFallback>
                      </Avatar>
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
                  <p className="text-lg text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-4">
                    {post.message}
                  </p>
                  {post.coordinates && (
                    <div className="mt-4">
                      <MapComponent coordinates={post.coordinates} />
                    </div>
                  )}
                </CardContent>
              </ShineCard>
            ))}
          </div>
        )}
      </div>
      <AppFooter />
    </div>
  );
};

export default PublicJourneyPage;