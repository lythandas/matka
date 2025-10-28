"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Compass, Loader2, Map as MapIcon } from 'lucide-react';
import { API_BASE_URL } from '@/config/api';
import { Journey, Post } from '@/types';
import { showError } from '@/utils/toast';
import AppFooter from '@/components/AppFooter';
import MapComponent from '@/components/MapComponent';
import GridPostCard from '@/components/GridPostCard';
import ListPostCard from '@/components/ListPostCard'; // Import ListPostCard
import PostDetailDialog from '@/components/PostDetailDialog';
import { format } from 'date-fns'; // Ensure format is imported
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarInitials } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '@/utils/date-locales';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import ShineCard from '@/components/ShineCard';
import ViewToggle from '@/components/ViewToggle'; // Import ViewToggle

const PublicJourneyPage: React.FC = () => {
  const { t } = useTranslation();
  const { publicLinkId } = useParams<{ publicLinkId: string }>();
  const currentLocale = getDateFnsLocale();

  const [journey, setJourney] = useState<Journey | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedPostForDetail, setSelectedPostForDetail] = useState<Post | null>(null);
  const [selectedPostIndex, setSelectedPostIndex] = useState<number | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'map'>('list'); // New state for view mode

  const fetchPublicJourney = async () => {
    if (!publicLinkId) {
      setError(t('publicJourneyPage.invalidLink'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/public-journeys/${publicLinkId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('publicJourneyPage.failedToLoadJourney'));
      }
      const data = await response.json();
      setJourney(data.journey);
      setPosts(data.posts);
    } catch (err: any) {
      console.error('Error fetching public journey:', err);
      setError(err.message || t('publicJourneyPage.failedToLoadJourney'));
      showError(err.message || t('publicJourneyPage.failedToLoadJourney'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublicJourney();
  }, [publicLinkId]);

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

  const postsWithCoordinates = posts.filter(post => post.coordinates);
  const hasPostsWithCoordinates = postsWithCoordinates.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
        <p className="text-lg text-gray-600 dark:text-gray-400">{t('publicJourneyPage.loadingJourney')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <Compass className="h-24 w-24 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">{t('common.error')}</h1>
        <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">{error}</p>
        <Button onClick={() => window.location.href = '/'}>{t('notFoundPage.returnToHome')}</Button>
        <AppFooter />
      </div>
    );
  }

  if (!journey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <Compass className="h-24 w-24 text-gray-400 dark:text-gray-600 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">{t('publicJourneyPage.journeyNotFound')}</h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">{t('publicJourneyPage.checkLink')}</p>
        <Button onClick={() => window.location.href = '/'}>{t('notFoundPage.returnToHome')}</Button>
        <AppFooter />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="flex items-center justify-between py-4 px-4 sm:px-6 lg:px-8 border-b dark:border-gray-800 bg-background sticky top-0 z-30">
        <div className="flex items-center">
          <Compass className="mr-2 h-6 w-6 text-blue-600 dark:text-foreground" />
          <h1 className="text-2xl font-extrabold text-blue-600 dark:text-foreground">{t('app.name')}</h1>
        </div>
        <div className="flex items-center space-x-2">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">{journey.name}</h2>
        </div>
      </header>

      <main className="flex-grow w-full max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">{journey.name}</h1>
          <div className="flex items-center justify-center text-gray-600 dark:text-gray-400 text-sm">
            <Avatar className="h-6 w-6 mr-2">
              {journey.owner_profile_image_url ? (
                <AvatarImage src={journey.owner_profile_image_url} alt={journey.owner_name || journey.owner_username} />
              ) : (
                <AvatarFallback className="bg-blue-500 text-white text-xs">
                  {getAvatarInitials(journey.owner_name, journey.owner_username)}
                </AvatarFallback>
              )}
            </Avatar>
            <span>{t('publicJourneyPage.byOwner', { owner: journey.owner_name || journey.owner_username })}</span>
            <span className="mx-2">•</span>
            <span>{format(new Date(journey.created_at), 'PPP', { locale: currentLocale })}</span>
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-12">
            <Compass className="h-24 w-24 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
            <p className="text-xl text-gray-600 dark:text-gray-400 font-semibold">
              {t('publicJourneyPage.noPostsYet')}
            </p>
            <p className="text-md text-gray-500 dark:text-gray-500 mt-2">
              {t('publicJourneyPage.ownerHasNotAddedPosts')}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="relative flex items-center justify-center mb-6 h-10">
              <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
            </div>

            {viewMode === 'list' ? (
              <div className="space-y-6">
                {posts.map((post, index) => (
                  <ListPostCard
                    key={post.id}
                    post={post}
                    onClick={() => handlePostClick(post, index)}
                  />
                ))}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-3 sm:grid-cols-2 lg:grid-cols-3 gap-6"> {/* Changed here */}
                {posts.map((post, index) => (
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
                    posts={postsWithCoordinates}
                    onMarkerClick={handlePostClick}
                    className="w-full h-full"
                    zoom={7}
                  />
                </div>
              ) : (
                <div className="text-center py-12">
                  <Compass className="h-24 w-24 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                  <p className="text-xl text-gray-600 dark:text-gray-400 font-semibold">
                    {t('indexPage.noPostsWithLocation')}
                  </p>
                  <p className="text-md text-gray-500 dark:text-gray-500 mt-2">
                    {t('indexPage.addPostsWithLocation')}
                  </p>
                </div>
              )
            )}
          </div>
        )}
      </main>

      {selectedPostForDetail && isDetailDialogOpen && (
        <PostDetailDialog
          post={selectedPostForDetail}
          isOpen={isDetailDialogOpen}
          onClose={handleCloseDetailDialog}
          currentIndex={selectedPostIndex !== null ? selectedPostIndex : -1}
          totalPosts={posts.length}
          onNext={handleNextPost}
          onPrevious={handlePreviousPost}
          journey={journey}
        />
      )}

      <AppFooter />
    </div>
  );
};

export default PublicJourneyPage;