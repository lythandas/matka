"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Import useNavigate
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Compass } from 'lucide-react';
import { showError } from '@/utils/toast';
import { format } from 'date-fns';
import MapComponent from '@/components/MapComponent';
import ShineCard from '@/components/ShineCard';
import { getAvatarInitials } from '@/lib/utils';
import AppFooter from '@/components/AppFooter';
import { API_BASE_URL } from '@/config/api';
import { Post, Journey, JourneyCollaborator } from '@/types'; // Import JourneyCollaborator
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ViewToggle from '@/components/ViewToggle';
import GridPostCard from '@/components/GridPostCard';
import PostDetailDialog from '@/components/PostDetailDialog';
import { Button } from '@/components/ui/button';
import SortToggle from '@/components/SortToggle';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '@/utils/date-locales';
import i18n from '@/i18n'; // Import the i18n instance
import PassphraseDialog from '@/components/PassphraseDialog'; // Import the new PassphraseDialog

const PASSPHRASE_STORAGE_KEY = 'journey_passphrase_';

const PublicJourneyPage: React.FC = () => {
  const { t } = useTranslation();
  const { ownerUsername, journeyName } = useParams<{ ownerUsername: string; journeyName: string }>();
  const { isAuthenticated, user, token } = useAuth(); // Get user and token
  const navigate = useNavigate(); // Initialize useNavigate

  const [journey, setJourney] = useState<Journey | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingJourney, setLoadingJourney] = useState<boolean>(true);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'map'>('list');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const currentLocale = getDateFnsLocale();

  const [selectedPostForDetail, setSelectedPostForDetail] = useState<Post | null>(null);
  const [selectedPostIndex, setSelectedPostIndex] = useState<number | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState<boolean>(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState<boolean>(false); // New state for access check

  const [isPassphraseDialogOpen, setIsPassphraseDialogOpen] = useState<boolean>(false);
  const [isVerifyingPassphrase, setIsVerifyingPassphrase] = useState<boolean>(false);
  const [currentPassphrase, setCurrentPassphrase] = useState<string | undefined>(undefined); // Stored passphrase for API calls

  const getPassphraseFromStorage = useCallback((journeyIdentifier: string) => {
    return sessionStorage.getItem(PASSPHRASE_STORAGE_KEY + journeyIdentifier) || undefined;
  }, []);

  const setPassphraseInStorage = useCallback((journeyIdentifier: string, passphrase: string) => {
    sessionStorage.setItem(PASSPHRASE_STORAGE_KEY + journeyIdentifier, passphrase);
  }, []);

  const clearPassphraseFromStorage = useCallback((journeyIdentifier: string) => {
    sessionStorage.removeItem(PASSPHRASE_STORAGE_KEY + journeyIdentifier);
  }, []);

  const fetchJourney = useCallback(async (passphrase?: string): Promise<{ journey: Journey | null; requiresPassphrase: boolean }> => {
    console.log("PublicJourneyPage: Attempting to fetch journey with ownerUsername:", ownerUsername, "and journeyName:", journeyName);
    if (!ownerUsername || !journeyName) {
      const errorMessage = t('publicJourneyPage.journeyOwnerOrNameMissing');
      setError(errorMessage);
      showError(errorMessage);
      setLoadingJourney(false);
      return { journey: null, requiresPassphrase: false };
    }
    setLoadingJourney(true);
    setError(null);
    try {
      const encodedJourneyName = encodeURIComponent(journeyName);
      const headers: HeadersInit = {};
      if (passphrase) {
        headers['X-Journey-Passphrase'] = passphrase;
      }
      const response = await fetch(`${API_BASE_URL}/public/journeys/by-name/${ownerUsername}/${encodedJourneyName}`, { headers });

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch (jsonError) {
          console.warn("PublicJourneyPage: Failed to parse error response as JSON:", jsonError);
        }

        if (response.status === 401 && errorData.message === 'Unauthorized: Invalid passphrase') {
          console.log("PublicJourneyPage: Journey requires passphrase.");
          return { journey: null, requiresPassphrase: true };
        } else {
          console.error("PublicJourneyPage: Backend error response:", response.status, errorData);
          const message = errorData.message || t('common.failedToFetchPublicJourney');
          throw new Error(message);
        }
      }
      const data: Journey = await response.json();
      setJourney(data);
      console.log("PublicJourneyPage: Successfully fetched journey:", data);

      if (data.owner_language && i18n.language !== data.owner_language) {
        i18n.changeLanguage(data.owner_language);
      }

      return { journey: data, requiresPassphrase: false };
    } catch (err: any) {
      console.error('Error fetching public journey:', err);
      const errorMessage = err.message || t('common.failedToLoadJourneyNotPublic');
      setError(errorMessage);
      showError(errorMessage);
      setJourney(null);
      return { journey: null, requiresPassphrase: false };
    } finally {
      setLoadingJourney(false);
    }
  }, [ownerUsername, journeyName, t, i18n]);

  const checkUserCollaboration = useCallback(async (journeyId: string) => {
    if (!token || !user) return false;
    try {
      const response = await fetch(`${API_BASE_URL}/journeys/${journeyId}/collaborators`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        return false;
      }
      const collaborators: JourneyCollaborator[] = await response.json();
      return collaborators.some(collab => collab.user_id === user.id);
    } catch (error) {
      console.error('Error checking user collaboration:', error);
      return false;
    }
  }, [token, user]);

  const fetchPosts = useCallback(async (id: string, passphrase?: string) => {
    if (!id) {
      console.warn("PublicJourneyPage: No journey ID provided to fetch posts.");
      setLoadingPosts(false);
      return;
    }
    setLoadingPosts(true);
    setError(null);
    try {
      const headers: HeadersInit = {};
      if (passphrase) {
        headers['X-Journey-Passphrase'] = passphrase;
      }
      const response = await fetch(`${API_BASE_URL}/public/journeys/${id}/posts?is_draft=false`, { headers });
      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch (jsonError) {
          console.warn("PublicJourneyPage: Failed to parse posts error response as JSON:", jsonError);
        }
        console.error("PublicJourneyPage: Backend posts error response:", response.status, errorData);
        const message = errorData.message || t('common.failedToFetchPublicPosts');
        throw new Error(message);
      }
      const data: Post[] = await response.json();
      setPosts(data);
      console.log("PublicJourneyPage: Successfully fetched posts:", data);
    } catch (err: any) {
      console.error('Error fetching public posts:', err);
      const errorMessage = err.message || t('common.failedToLoadPostsForJourney');
      setError(errorMessage);
      showError(errorMessage);
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }, [t]);

  const handlePassphraseSubmit = async (passphraseInput: string) => {
    if (!journey && (!ownerUsername || !journeyName)) return;

    setIsVerifyingPassphrase(true);
    const journeyIdentifier = `${ownerUsername}-${journeyName}`;
    try {
      const { journey: fetchedJourney, requiresPassphrase } = await fetchJourney(passphraseInput);

      if (fetchedJourney) {
        setPassphraseInStorage(journeyIdentifier, passphraseInput);
        setCurrentPassphrase(passphraseInput);
        setIsPassphraseDialogOpen(false);
        await fetchPosts(fetchedJourney.id, passphraseInput);
      } else if (requiresPassphrase) {
        showError(t('publicJourneyPage.incorrectPassphrase'));
        clearPassphraseFromStorage(journeyIdentifier);
      } else {
        // This else block handles cases where fetchJourney returns null and requiresPassphrase is false,
        // which means a generic error occurred or the journey wasn't found/public.
        // In this scenario, we should still clear any stored passphrase and show an error.
        showError(t('publicJourneyPage.incorrectPassphrase')); // Or a more generic error message
        clearPassphraseFromStorage(journeyIdentifier);
      }
    } catch (err) {
      showError(t('publicJourneyPage.incorrectPassphrase'));
      clearPassphraseFromStorage(journeyIdentifier);
    } finally {
      setIsVerifyingPassphrase(false);
    }
  };

  useEffect(() => {
    const loadJourneyAndCheckAccess = async () => {
      setJourney(null);
      setPosts([]);
      setError(null);
      setLoadingJourney(true);
      setLoadingPosts(true);
      setIsCheckingAccess(true);
      setCurrentPassphrase(undefined);
      setIsPassphraseDialogOpen(false);

      const journeyIdentifier = ownerUsername && journeyName ? `${ownerUsername}-${journeyName}` : '';
      const storedPassphrase = journeyIdentifier ? getPassphraseFromStorage(journeyIdentifier) : undefined;
      setCurrentPassphrase(storedPassphrase);

      const { journey: fetchedJourney, requiresPassphrase } = await fetchJourney(storedPassphrase);

      if (fetchedJourney) {
        if (isAuthenticated && user) {
          const isOwner = user.id === fetchedJourney.user_id;
          const isCollaborator = await checkUserCollaboration(fetchedJourney.id);

          if (isOwner || isCollaborator) {
            console.log("PublicJourneyPage: Authenticated user has access to this journey. Redirecting to dashboard.");
            navigate('/');
            return;
          }
        }
        await fetchPosts(fetchedJourney.id, storedPassphrase);
      } else if (requiresPassphrase) {
        console.log("PublicJourneyPage: Setting isPassphraseDialogOpen to true."); // Added log
        setIsPassphraseDialogOpen(true);
        setLoadingPosts(false);
      } else {
        setLoadingPosts(false);
      }
      setIsCheckingAccess(false);
    };
    loadJourneyAndCheckAccess();
  }, [fetchJourney, fetchPosts, checkUserCollaboration, isAuthenticated, user, navigate, ownerUsername, journeyName, getPassphraseFromStorage, setPassphraseInStorage, clearPassphraseFromStorage]);

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

  const handleSelectPostFromMap = (post: Post, index: number) => {
    handlePostClick(post, index);
  };

  const hasPostsWithCoordinates = posts.some(post => post.coordinates);

  const sortedPosts = [...posts].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });

  let pageContent;

  if (loadingJourney || loadingPosts || isCheckingAccess) {
    pageContent = (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
        <p className="text-lg text-gray-600 dark:text-gray-400">{t('publicJourneyPage.loadingPublicJourney')}</p>
      </div>
    );
  } else if (error) {
    pageContent = (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 text-center">
        <h1 className="text-4xl font-bold text-red-600 mb-4">{t('common.error')}</h1>
        <p className="text-xl text-gray-700 dark:text-gray-300 mb-6">{error}</p>
        <a href="/" className="text-blue-500 hover:text-blue-700 underline">
          {t('publicJourneyPage.returnToHome')}
        </a>
      </div>
    );
  } else if (!journey) {
    pageContent = (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 text-center">
        <h1 className="text-4xl font-bold text-gray-700 dark:text-gray-300 mb-4">{t('publicJourneyPage.journeyNotFound')}</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-6">{t('publicJourneyPage.journeyNotFoundDescription')}</p>
        <a href="/" className="text-blue-500 hover:text-blue-700 underline">
          {t('publicJourneyPage.returnToHome')}
        </a>
      </div>
    );
  } else {
    pageContent = (
      <React.Fragment>
        <div className="max-w-3xl mx-auto flex-grow w-full p-4 sm:p-6 lg:p-8">
          <Card className="mb-8 shadow-lg shadow-neon-blue">
            <CardHeader className="text-center">
              <Compass className="h-16 w-16 mx-auto text-blue-600 dark:text-foreground mb-2" />
              <CardTitle className="text-4xl font-extrabold text-blue-600 dark:text-foreground mb-2">
                {journey.name}
              </CardTitle>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                {t('publicJourneyPage.aJourneyBy', { author: journey.owner_name || journey.owner_username })}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('publicJourneyPage.createdOn', { date: format(new Date(journey.created_at), 'PPP', { locale: currentLocale }) })}
              </p>
            </CardHeader>
          </Card>

          {posts.length > 0 && (
            <div className="relative flex items-center justify-center mb-6 h-10">
              <div className="absolute left-0">
                <SortToggle sortOrder={sortOrder} onSortOrderChange={setSortOrder} />
              </div>
              <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
              <div className="absolute right-0">
                <ThemeToggle />
              </div>
            </div>
          )}

          {posts.length === 0 ? (
            <div className="text-center py-12">
              <Compass className="h-24 w-24 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
              <p className="text-xl text-gray-600 dark:text-gray-400 font-semibold">
                {t('publicJourneyPage.noPublicPosts')}
              </p>
              <p className="text-md text-gray-500 dark:text-gray-500 mt-2">
                {t('publicJourneyPage.checkBackLater')}
              </p>
            </div>
          ) : (
            viewMode === 'list' ? (
              <div className="space-y-6">
                {sortedPosts.map((post, index) => (
                  <ShineCard
                    key={post.id}
                    className="shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer group hover:ring-2 hover:ring-blue-500"
                    onClick={() => handlePostClick(post, index)}
                  >
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
                            {format(new Date(post.created_at), 'PPP p', { locale: currentLocale })}
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
                                  alt={t('common.postImageAlt', { index: mediaIndex + 1 })}
                                  className="w-full h-auto max-h-96 object-cover rounded-md"
                                  onError={(e) => {
                                    e.currentTarget.src = '/placeholder.svg';
                                    e.currentTarget.onerror = null;
                                    console.error(t('common.failedToLoadImage'), mediaItem.urls.large);
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
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedPosts.map((post, index) => (
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
                    posts={sortedPosts}
                    onMarkerClick={handleSelectPostFromMap}
                    className="w-full h-full"
                    zoom={7}
                  />
                </div>
              ) : (
                <div className="text-center py-12">
                  <Compass className="h-24 w-24 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                  <p className="text-xl text-gray-600 dark:text-gray-400 font-semibold">
                    {t('publicJourneyPage.noPostsWithLocation')}
                  </p>
                  <p className="text-md text-gray-500 dark:text-gray-500 mt-2">
                    {t('publicJourneyPage.addPostsWithLocation')}
                  </p>
                </div>
              )
            )
          )}
          <AppFooter />

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
        </div>
      </React.Fragment>
    );
  }

  return (
    <div className="min-h-screen flex flex-col w-full bg-gray-50 dark:bg-gray-900">
      {pageContent}

      {isPassphraseDialogOpen && journey && ( // Only show if dialog is open AND journey data is available
        <PassphraseDialog
          isOpen={isPassphraseDialogOpen}
          onClose={() => {
            if (!currentPassphrase) {
              navigate('/');
            }
            setIsPassphraseDialogOpen(false);
          }}
          journeyName={journey.name}
          journeyOwner={journey.owner_name || journey.owner_username}
          onPassphraseSubmit={handlePassphraseSubmit}
          isVerifying={isVerifyingPassphrase}
        />
      )}
    </div>
  );
};

export default PublicJourneyPage;