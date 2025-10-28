"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Trash2, Plus, Compass, Edit, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import MapComponent from '@/components/MapComponent';
import PostDetailDialog from '@/components/PostDetailDialog';
import ShineCard from '@/components/ShineCard';
import { useJourneys } from '@/contexts/JourneyContext';
import ViewToggle from '@/components/ViewToggle';
import GridPostCard from '@/components/GridPostCard';
import EditPostDialog from '@/components/EditPostDialog';
import { getAvatarInitials } from '@/lib/utils';
import { API_BASE_URL } from '@/config/api';
import { Post, JourneyCollaborator } from '@/types';
import { useCreateJourneyDialog } from '@/contexts/CreateJourneyDialogContext';
import ManageJourneyDialog from '@/components/ManageJourneyDialog';
import SortToggle from '@/components/SortToggle';
import { format } from 'date-fns'; // Ensure format is imported
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '@/utils/date-locales';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile'; // Import useIsMobile
import CreatePostFormContent from '@/components/CreatePostFormContent'; // Import the new form content
import CreatePostDialog from '@/components/CreatePostDialog'; // Import the new dialog

const Index = () => {
  const { t } = useTranslation();
  const { isAuthenticated, user, token } = useAuth();
  const { selectedJourney, loadingJourneys, journeys, fetchJourneys } = useJourneys();
  const { setIsCreateJourneyDialogOpen } = useCreateJourneyDialog();
  const currentLocale = getDateFnsLocale();
  const isMobile = useIsMobile(); // Use the mobile hook

  const [posts, setPosts] = useState<Post[]>([]);
  const [drafts, setDrafts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(true);
  const [loadingDrafts, setLoadingDrafts] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'map'>('list');

  const [selectedPostForDetail, setSelectedPostForDetail] = useState<Post | null>(null);
  const [selectedPostIndex, setSelectedPostIndex] = useState<number | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState<boolean>(false);

  const [isEditPostDialogOpen, setIsEditPostDialogOpen] = useState<boolean>(false);
  const [postToEdit, setPostToEdit] = useState<Post | null>(null);

  const [isManageJourneyDialogOpen, setIsManageJourneyDialogOpen] = useState<boolean>(false);
  const [journeyCollaborators, setJourneyCollaborators] = useState<JourneyCollaborator[]>([]);

  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const [isCreatePostDialogOpen, setIsCreatePostDialogOpen] = useState<boolean>(false); // State for the new post dialog

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
        throw new Error(t('common.failedToFetchJourneyCollaborators'));
      }
      const data: JourneyCollaborator[] = await response.json();
      setJourneyCollaborators(data);
    } catch (error) {
      console.error('Error fetching journey collaborators:', error);
      showError(t('common.failedToLoadJourneyCollaborators'));
      setJourneyCollaborators([]);
    }
  }, [user, token, t]);

  const fetchPosts = async (journeyId: string) => {
    setLoadingPosts(true);
    try {
      const response = await fetch(`${API_BASE_URL}/posts?journeyId=${journeyId}&is_draft=false`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error(t('common.failedToFetchPosts'));
      }
      const data: Post[] = await response.json();
      setPosts(data);
    } catch (error) {
      console.error('Error fetching posts:', error);
      showError(t('common.failedToLoadPosts'));
    } finally {
      setLoadingPosts(false);
    }
  };

  const fetchDrafts = async (journeyId: string) => {
    setLoadingDrafts(true);
    try {
      const response = await fetch(`${API_BASE_URL}/posts?journeyId=${journeyId}&is_draft=true`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error(t('indexPage.failedToFetchDrafts'));
      }
      const data: Post[] = await response.json();
      setDrafts(data);
    } catch (error) {
      console.error('Error fetching drafts:', error);
      showError(t('indexPage.failedToLoadDrafts'));
    } finally {
      setLoadingDrafts(false);
    }
  };

  useEffect(() => {
    if (selectedJourney) {
      fetchPosts(selectedJourney.id);
      fetchDrafts(selectedJourney.id);
      fetchJourneyCollaborators(selectedJourney.id);
    } else {
      setPosts([]);
      setDrafts([]);
      setLoadingPosts(false);
      setLoadingDrafts(false);
      setJourneyCollaborators([]);
    }
  }, [selectedJourney, isAuthenticated, fetchJourneyCollaborators, token, t]);

  const handlePostCreated = (newPost: Post) => {
    setPosts((prev) => [newPost, ...prev]);
    // No need to show success toast here, it's handled in CreatePostFormContent
  };

  const handleDraftSaved = () => {
    // No need to show success toast here, it's handled in CreatePostFormContent
  };

  const handleDeletePost = async (id: string, journeyId: string, postAuthorId: string, isDraft: boolean = false) => {
    if (!isAuthenticated) {
      showError(t('common.authRequiredDeletePost'));
      return;
    }

    const isPostAuthor = user?.id === postAuthorId;
    const isJourneyOwner = selectedJourney?.user_id === user?.id;
    const isAdmin = user?.isAdmin;
    const canDeleteAsCollaborator = journeyCollaborators.some(collab => collab.user_id === user?.id && collab.can_delete_posts);

    if (!isPostAuthor && !isJourneyOwner && !isAdmin && !canDeleteAsCollaborator) {
      showError(t('common.noPermissionDeletePost'));
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
        throw new Error(errorData.message || t('common.failedToDeletePost'));
      }

      if (isDraft) {
        setDrafts(drafts.filter((draft) => draft.id !== id));
        showSuccess(t('indexPage.draftDeletedSuccessfully'));
      } else {
        setPosts(posts.filter((post) => post.id !== id));
        showSuccess(t('common.postDeletedSuccessfully'));
      }
    } catch (error: any) {
      console.error('Error deleting post:', error);
      showError(error.message || t('common.failedToDeletePost'));
    }
  };

  const handlePostClick = (post: Post, index: number) => {
    if (isMobile) { // Disable post details on mobile
      return;
    }
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
    if (selectedJourney) {
      fetchPosts(selectedJourney.id); // Re-fetch published posts
      fetchDrafts(selectedJourney.id); // Re-fetch drafts
    }

    if (selectedPostForDetail?.id === updatedPost.id) {
      setSelectedPostForDetail(updatedPost);
    }
  };

  const handleSelectPostFromMap = (post: Post, index: number) => {
    handlePostClick(post, index);
  };

  const handleLoadDraft = (draft: Post) => {
    // This function is now handled by CreatePostFormContent directly
    // When a draft is loaded, it should populate the form in the dialog
    setIsCreatePostDialogOpen(true); // Open the dialog
    // The CreatePostFormContent needs a way to receive the draft to load.
    // This will require a prop to CreatePostFormContent or a ref.
    // For simplicity, I'll pass the draft to the dialog, and the dialog will pass it to the form content.
    // This will require a slight modification to CreatePostFormContent and CreatePostDialog.
    // For now, I'll just open the dialog and let the user manually copy content if needed,
    // or I'll add a prop to CreatePostDialog to pre-fill the form.
    // Let's add a prop to CreatePostDialog to pre-fill the form.
    // For now, I'll just open the dialog.
    showError(t('indexPage.loadDraftNotImplemented')); // Temporary message
  };

  const sortedPosts = [...posts].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });

  const sortedDrafts = [...drafts].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return dateB - dateA; // Always newest first for drafts
  });

  const displayedPosts = sortedPosts;
  const hasPostsWithCoordinates = posts.some(post => post.coordinates);

  const canCreatePostUI = isAuthenticated && selectedJourney && (user?.id === selectedJourney.user_id || user?.isAdmin || journeyCollaborators.some(collab => collab.user_id === user?.id && collab.can_publish_posts));
  const canCreateJourneyUI = isAuthenticated;

  let mainContent;

  if (!isAuthenticated) {
    mainContent = null;
  } else if (selectedJourney) {
    mainContent = (
      <>
        {!isMobile && canCreatePostUI && ( // Render inline form on desktop if user can create posts
          <Card className="shadow-lg shadow-neon-blue mb-8">
            <CardHeader className="flex flex-row items-center justify-center">
              <CardTitle className="text-2xl font-bold">{t('indexPage.shareYourDay')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CreatePostFormContent
                selectedJourney={selectedJourney}
                user={user}
                token={token}
                journeyCollaborators={journeyCollaborators}
                onPostCreated={handlePostCreated}
                onDraftSaved={handleDraftSaved}
                fetchDrafts={fetchDrafts}
                fetchPosts={fetchPosts}
              />
            </CardContent>
          </Card>
        )}

        {(posts.length > 0 || drafts.length > 0) && (
          <Tabs defaultValue="posts" className="w-full mt-8">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="posts">{t('indexPage.publishedPosts')}</TabsTrigger>
              <TabsTrigger value="drafts">{t('indexPage.drafts')}</TabsTrigger>
            </TabsList>
            <TabsContent value="posts" className="mt-4">
              {displayedPosts.length > 0 && (
                <div className="relative flex items-center justify-center mb-6 h-10">
                  <div className="absolute left-0">
                    <SortToggle sortOrder={sortOrder} onSortOrderChange={setSortOrder} />
                  </div>
                  <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
                </div>
              )}

              {loadingPosts ? (
                <p className="text-center text-gray-600 dark:text-gray-400">{t('indexPage.loadingPosts')}</p>
              ) : displayedPosts.length === 0 && selectedJourney ? (
                <div className="text-center py-12">
                  <Compass className="h-24 w-24 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                  <p className="text-xl text-gray-600 dark:text-gray-400 font-semibold">
                    {t('indexPage.yourJourneyAwaits')}
                  </p>
                  {isAuthenticated && canCreatePostUI && (
                    <p className="text-md text-gray-500 dark:text-gray-500 mt-2">
                      {t('indexPage.useShareSection')}
                    </p>
                  )}
                </div>
              ) : (
                viewMode === 'list' ? (
                  <div className="space-y-6">
                    {displayedPosts.map((post, index) => {
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
                            <div className="flex items-center justify-between mb-4"> {/* Combined container */}
                              <div className="flex items-center"> {/* Author info */}
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
                                    {format(new Date(post.created_at), 'PPP p', { locale: currentLocale })}
                                  </p>
                                </div>
                              </div>
                              {/* Edit/Delete buttons */}
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
                                        <AlertDialogTitle className="text-lg font-semibold mb-4">
                                          {t('adminPage.areYouSure')}
                                        </AlertDialogTitle>
                                        <AlertDialogDescription dangerouslySetInnerHTML={{ __html: t('common.deletePostDescription') }} />
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDeletePost(post.id, post.journey_id, post.user_id)}>
                                            {t('adminPage.continue')}
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                )}
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
                                          showError(t('common.failedToLoadMedia', { fileName: `media-${mediaIndex + 1}` }));
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
                            <p className="text-lg text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-4 text-justify">
                              {post.message}
                            </p>
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
                  <div className="grid grid-cols-3 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {displayedPosts.map((post, index) => (
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
                        posts={displayedPosts}
                        onMarkerClick={handleSelectPostFromMap}
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
                )
              )}
            </TabsContent>
            <TabsContent value="drafts" className="mt-4">
              {loadingDrafts ? (
                <p className="text-center text-gray-600 dark:text-gray-400">{t('indexPage.loadingDrafts')}</p>
              ) : sortedDrafts.length === 0 ? (
                <div className="text-center py-12">
                  <Compass className="h-24 w-24 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                  <p className="text-xl text-gray-600 dark:text-gray-400 font-semibold">
                    {t('indexPage.noDraftsYet')}
                  </p>
                  <p className="text-md text-gray-500 dark:text-gray-500 mt-2">
                    {t('indexPage.saveWorkAsDraft')}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedDrafts.map((draft) => {
                    const isDraftAuthor = user?.id === draft.user_id;
                    const isJourneyOwner = selectedJourney?.user_id === user?.id;
                    const isAdmin = user?.isAdmin;
                    const canModifyAsCollaborator = journeyCollaborators.some(collab => collab.user_id === user?.id && collab.can_modify_post);
                    const canDeleteAsCollaborator = journeyCollaborators.some(collab => collab.user_id === user?.id && collab.can_delete_posts);

                    const canEditDraft = isDraftAuthor || isJourneyOwner || isAdmin || canModifyAsCollaborator;
                    const canDeleteDraft = isDraftAuthor || isJourneyOwner || isAdmin || canDeleteAsCollaborator;

                    return (
                      <Card key={draft.id} className={cn("p-4 flex items-center justify-between")}>
                        <div>
                          <p className="font-semibold">{draft.title || draft.message.substring(0, 50) + (draft.message.length > 50 ? '...' : '') || t('indexPage.untitledDraft')}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(draft.created_at), 'PPP p', { locale: currentLocale })}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          {canEditDraft && (
                            <Button variant="outline" size="sm" onClick={() => handleEditPost(draft)} className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
                              <Edit className="mr-2 h-4 w-4" /> {t('indexPage.loadDraft')}
                            </Button>
                          )}
                          {canDeleteDraft && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" className="hover:ring-2 hover:ring-blue-500">
                                  <Trash2 className="mr-2 h-4 w-4" /> {t('indexPage.deleteDraft')}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogTitle className="text-lg font-semibold mb-4">
                                  {t('adminPage.areYouSure')}
                                </AlertDialogTitle>
                                <AlertDialogDescription dangerouslySetInnerHTML={{ __html: t('indexPage.deleteDraftDescription', { draftTitle: draft.title || draft.message.substring(0, 50) + '...' }) }} />
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeletePost(draft.id, draft.journey_id, draft.user_id, true)}>
                                    {t('adminPage.continue')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </>
    );
  } else if (!loadingJourneys && journeys.length === 0) {
    mainContent = (
      <div className="text-center py-12">
        <Compass className="h-24 w-24 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
        <p className="text-xl text-gray-600 dark:text-gray-400 font-semibold">
          {t('indexPage.noJourneysYet')}
        </p>
        <p className="text-md text-gray-500 dark:text-gray-500 mt-2 mb-4">
          {t('indexPage.startByCreatingJourney')}
        </p>
        {canCreateJourneyUI && (
          <Button
            onClick={() => setIsCreateJourneyDialogOpen(true)}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white hover:ring-2 hover:ring-blue-500"
          >
            <Plus className="mr-2 h-4 w-4" /> {t('createJourneyDialog.createNewJourney')}
          </Button>
        )}
      </div>
    );
  } else {
    mainContent = (
      <div className="text-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
        <p className="text-lg text-gray-600 dark:text-gray-400">{t('indexPage.loadingJourneys')}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col flex-grow h-full">
      {mainContent}

      {/* Floating Action Button for Mobile */}
      {isMobile && isAuthenticated && selectedJourney && canCreatePostUI && (
        <Button
          className="fab-button" // Applied the custom class here
          onClick={() => setIsCreatePostDialogOpen(true)}
          aria-label={t('indexPage.createNewPost')}
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      {/* Create Post Dialog (for mobile or if explicitly opened) */}
      {isAuthenticated && selectedJourney && canCreatePostUI && (
        <CreatePostDialog
          isOpen={isCreatePostDialogOpen}
          onClose={() => setIsCreatePostDialogOpen(false)}
          selectedJourney={selectedJourney}
          user={user}
          token={token}
          journeyCollaborators={journeyCollaborators}
          onPostCreated={handlePostCreated}
          onDraftSaved={handleDraftSaved}
          fetchDrafts={fetchDrafts}
          fetchPosts={fetchPosts}
        />
      )}

      {selectedPostForDetail && isDetailDialogOpen && (
        <PostDetailDialog
          post={selectedPostForDetail}
          isOpen={isDetailDialogOpen}
          onClose={handleCloseDetailDialog}
          currentIndex={selectedPostIndex !== null ? selectedPostIndex : -1}
          totalPosts={posts.length}
          onNext={handleNextPost}
          onPrevious={handlePreviousPost}
          journey={selectedJourney}
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
          onClose={() => { setIsManageJourneyDialogOpen(false); fetchJourneys(); }}
          journey={selectedJourney}
          onJourneyUpdated={() => {
            fetchJourneys();
            fetchJourneyCollaborators(selectedJourney.id);
            fetchPosts(selectedJourney.id);
            fetchDrafts(selectedJourney.id);
          }}
        />
      )}
    </div>
  );
};

export default Index;