"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useOutletContext } from 'react-router-dom'; // Import useOutletContext
import { Compass, Loader2, Map as MapIcon, Lock } from 'lucide-react';
import { API_BASE_URL } from '@/config/api';
import { Journey, Post } from '@/types';
import { showError } from '@/utils/toast';
import MapComponent from '@/components/MapComponent';
import GridPostCard from '@/components/GridPostCard';
import ListPostCard from '@/components/ListPostCard'; // Import ListPostCard
import PostDetailDialog from '@/components/PostDetailDialog';
import { format } from 'date-fns'; // Ensure format is imported
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarInitials } from '@/lib/utils'; // Corrected import statement
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '@/utils/date-locales';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import ShineCard from '@/components/ShineCard';
import ViewToggle from '@/components/ViewToggle'; // Import ViewToggle
import { useIsMobile } from '@/hooks/use-mobile'; // Import useIsMobile
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PUBLIC_JOURNEY_PASSPHRASE_SESSION_DURATION_SECONDS } from '@/config/constants'; // Import the new constant

// Define the context type that PublicPageLayout will provide
interface PublicPageLayoutContextType {
  setJourney: (journey: Journey | null) => void;
  setIsProtected: (isProtected: boolean) => void;
}

const PublicJourneyPage: React.FC = () => {
  const { t } = useTranslation();
  const { publicLinkId } = useParams<{ publicLinkId: string }>();
  const currentLocale = getDateFnsLocale();
  const isMobile = useIsMobile(); // Use the mobile hook

  // Access the context from the parent PublicPageLayout
  const { setJourney: setJourneyInLayout, setIsProtected: setIsProtectedInLayout } = useOutletContext<PublicPageLayoutContextType>();

  const [journey, setJourney] = useState<Journey | null>(null); // Keep local state for rendering content
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [passphraseInput, setPassphraseInput] = useState<string>('');
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [showPassphraseForm, setShowPassphraseForm] = useState<boolean>(false); // New state to control form visibility

  const [selectedPostForDetail, setSelectedPostForDetail] = useState<Post | null>(null);
  const [selectedPostIndex, setSelectedPostIndex] = useState<number | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'map'>('list'); // New state for view mode

  const PASSPHRASE_STORAGE_KEY = `publicJourneyPassphrase_${publicLinkId}`;

  const fetchPublicJourney = useCallback(async (passphraseAttempt?: string) => {
    if (!publicLinkId) {
      setError(t('publicJourneyPage.invalidLink'));
      setLoading(false);
      setJourneyInLayout(null); // Clear layout journey on error
      setIsProtectedInLayout(false);
      return;
    }

    setLoading(true);
    setError(null);
    setIsAuthenticating(true);
    setShowPassphraseForm(false); // Hide form while fetching

    let effectivePassphrase = passphraseAttempt;

    // Check local storage for a valid session
    if (!effectivePassphrase) {
      const storedPassphraseData = localStorage.getItem(PASSPHRASE_STORAGE_KEY);
      if (storedPassphraseData) {
        try {
          const { passphrase: storedPassphrase, timestamp } = JSON.parse(storedPassphraseData);
          if (Date.now() < timestamp + PUBLIC_JOURNEY_PASSPHRASE_SESSION_DURATION_SECONDS * 1000) {
            effectivePassphrase = storedPassphrase;
          } else {
            localStorage.removeItem(PASSPHRASE_STORAGE_KEY); // Expired
          }
        } catch (e) {
          console.error("Failed to parse stored passphrase data:", e);
          localStorage.removeItem(PASSPHRASE_STORAGE_KEY);
        }
      }
    }

    try {
      const response = await fetch(`${API_BASE_URL}/public-journeys/${publicLinkId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ passphrase: effectivePassphrase }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // If passphrase is required or incorrect, show the form
        if (errorData.message === 'Passphrase required to access this journey.' || errorData.message === 'Incorrect passphrase.') {
          setShowPassphraseForm(true);
          setError(errorData.message); // Set error message for display in form
          setJourneyInLayout(null);
          setIsProtectedInLayout(true); // Indicate it's protected
          return; // Exit without setting journey/posts
        }
        throw new Error(errorData.message || t('publicJourneyPage.failedToLoadJourney'));
      }
      const data = await response.json();
      setJourney(data.journey);
      setPosts(data.posts);

      // Store passphrase if it was successfully used (either new or from session)
      if (effectivePassphrase) {
        localStorage.setItem(PASSPHRASE_STORAGE_KEY, JSON.stringify({
          passphrase: effectivePassphrase,
          timestamp: Date.now(),
        }));
      }

      // Update layout context with fetched journey data
      setJourneyInLayout(data.journey);
      setIsProtectedInLayout(!!data.journey.has_passphrase);
    } catch (err: any) {
      console.error('Error fetching public journey:', err);
      setError(err.message || t('publicJourneyPage.failedToLoadJourney'));
      showError(err.message || t('publicJourneyPage.failedToLoadJourney'));
      setJourneyInLayout(null);
      setIsProtectedInLayout(false);
    } finally {
      setLoading(false);
      setIsAuthenticating(false);
    }
  }, [publicLinkId, setJourneyInLayout, setIsProtectedInLayout, PASSPHRASE_STORAGE_KEY, t]);

  useEffect(() => {
    fetchPublicJourney();
    return () => {
      setJourneyInLayout(null);
      setIsProtectedInLayout(false);
    };
  }, [fetchPublicJourney, setJourneyInLayout, setIsProtectedInLayout]);

  const handlePassphraseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPublicJourney(passphraseInput);
  };

  const handlePostClick = useCallback((post: Post, index: number) => {
    if (isMobile) {
      return;
    }
    setSelectedPostForDetail(post);
    setSelectedPostIndex(index);
    setIsDetailDialogOpen(true);
  }, [isMobile]);

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

  if (loading && !showPassphraseForm) { // Only show loading if not waiting for passphrase
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
        <p className="text-lg text-gray-600 dark:text-gray-400">{t('publicJourneyPage.loadingJourney')}</p>
      </div>
    );
  }

  // Render content based on error or journey data
  const renderContent = () => {
    if (showPassphraseForm) { // Prioritize showing passphrase form if needed
      return (
        <div className="flex-grow flex flex-col items-center justify-center p-4">
          <Lock className="h-24 w-24 text-blue-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">{t('publicJourneyPage.journeyProtected')}</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">{t('publicJourneyPage.enterPassphrase')}</p>
          <form onSubmit={handlePassphraseSubmit} className="w-full max-w-sm space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="passphrase">{t('common.passphrase')}</Label>
              <Input
                id="passphrase"
                type="password"
                value={passphraseInput}
                onChange={(e) => setPassphraseInput(e.target.value)}
                placeholder={t('publicJourneyPage.passphrasePlaceholder')}
                disabled={isAuthenticating}
                required
              />
            </div>
            {error === 'Incorrect passphrase.' && (
              <p className="text-sm text-red-500">{t('publicJourneyPage.incorrectPassphrase')}</p>
            )}
            <Button type="submit" className="w-full" disabled={isAuthenticating}>
              {isAuthenticating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('publicJourneyPage.verifying')}
                </>
              ) : (
                t('publicJourneyPage.accessJourney')
              )}
            </Button>
          </form>
        </div>
      );
    }

    if (error && error !== 'Passphrase required to access this journey.' && error !== 'Incorrect passphrase.') {
      // Generic error display, excluding passphrase errors handled above
      return (
        <div className="flex-grow flex flex-col items-center justify-center p-4 text-center">
          <Compass className="h-24 w-24 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">{t('common.error')}</h1>
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">{error}</p>
          <Button onClick={() => window.location.href = '/'}>{t('notFoundPage.returnToHome')}</Button>
        </div>
      );
    }

    if (!journey) {
      return (
        <div className="flex-grow flex flex-col items-center justify-center p-4 text-center">
          <Compass className="h-24 w-24 text-gray-400 dark:text-gray-600 mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">{t('publicJourneyPage.journeyNotFound')}</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">{t('publicJourneyPage.checkLink')}</p>
          <Button onClick={() => window.location.href = '/'}>{t('notFoundPage.returnToHome')}</Button>
        </div>
      );
    }

    const ownerDisplayName = journey.owner_name && journey.owner_surname
      ? `${journey.owner_name} ${journey.owner_surname}`
      : journey.owner_name || journey.owner_username;

    return (
      <main className="flex-grow w-full max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">{journey.name}</h1>
          <div className="flex items-center justify-center text-gray-600 dark:text-gray-400 text-sm">
            <Avatar className="h-6 w-6 mr-2">
              {journey.owner_profile_image_url ? (
                <AvatarImage src={journey.owner_profile_image_url} alt={ownerDisplayName} />
              ) : (
                <AvatarFallback className="bg-blue-500 text-white text-xs">
                  {getAvatarInitials(journey.owner_name, journey.owner_username)}
                </AvatarFallback>
              )}
            </Avatar>
            <span>{t('publicJourneyPage.byOwner', { owner: ownerDisplayName })}</span>
            <span className="mx-2">•</span>
            <span>{format(new Date(journey.created_at), 'PPP', { locale: currentLocale })}</span>
            {journey.has_passphrase && (
              <>
                <span className="mx-2">•</span>
                <Lock className="h-4 w-4 mr-1 text-muted-foreground" />
                <span className="text-muted-foreground">{t('publicJourneyPage.passphraseProtected')}</span>
              </>
            )}
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
              <div className="grid grid-cols-3 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
    );
  };

  return (
    <>
      {renderContent()}

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
    </>
  );
};

export default PublicJourneyPage;