"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { showSuccess, showError } from '@/utils/toast';
import { format, parseISO } from 'date-fns';
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
import { Trash2, Plus, XCircle, Compass, Edit, Upload, MapPin, LocateFixed, Search, Loader2, Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import MapComponent from '@/components/MapComponent';
import PostDetailDialog from '@/components/PostDetailDialog';
import ShineCard from '@/components/ShineCard';
import { useJourneys } from '@/contexts/JourneyContext';
import ViewToggle from '@/components/ViewToggle';
import GridPostCard from '@/components/GridPostCard';
import EditPostDialog from '@/components/EditPostDialog';
import { getAvatarInitials } from '@/lib/utils'; // Corrected import
import { API_BASE_URL } from '@/config/api';
import { MAX_CONTENT_FILE_SIZE_BYTES, SUPPORTED_MEDIA_TYPES } from '@/config/constants';
import { Post, MediaInfo, JourneyCollaborator } from '@/types';
import { useCreateJourneyDialog } from '@/contexts/CreateJourneyDialogContext';
import ManageJourneyDialog from '@/components/ManageJourneyDialog';
import LocationSearch from '@/components/LocationSearch';
import PostDatePicker from './../components/PostDatePicker';
import SortToggle from '@/components/SortToggle';
import { useTranslation } from 'react-i18next';
import { getDateFnsLocale } from '@/utils/date-locales';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';

const AUTO_SAVE_INTERVAL_MS = 60 * 1000; // 1 minute

const Index = () => {
  const { t } = useTranslation();
  const { isAuthenticated, user, token } = useAuth();
  const { selectedJourney, loadingJourneys, journeys, fetchJourneys } = useJourneys();
  const { setIsCreateJourneyDialogOpen } = useCreateJourneyDialog();
  const currentLocale = getDateFnsLocale();

  const [title, setTitle] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedMediaItems, setUploadedMediaItems] = useState<MediaInfo[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState<boolean>(false);
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [drafts, setDrafts] = useState<Post[]>([]); // New state for drafts
  const [loadingPosts, setLoadingPosts] = useState<boolean>(true);
  const [loadingDrafts, setLoadingDrafts] = useState<boolean>(true); // New state for loading drafts
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

  const [postDate, setPostDate] = useState<Date | undefined>(new Date());
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null); // ID of the draft currently being edited
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);

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
      const response = await fetch(`${API_BASE_URL}/posts?journeyId=${journeyId}&is_draft=false`, { // Fetch only published posts
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
      const response = await fetch(`${API_BASE_URL}/posts?journeyId=${journeyId}&is_draft=true`, { // Fetch only drafts
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
      fetchDrafts(selectedJourney.id); // Fetch drafts as well
      fetchJourneyCollaborators(selectedJourney.id);
    } else {
      setPosts([]);
      setDrafts([]);
      setLoadingPosts(false);
      setLoadingDrafts(false);
      setJourneyCollaborators([]);
    }
  }, [selectedJourney, isAuthenticated, fetchJourneyCollaborators, token, t]);

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

        const response = await fetch(`${API_BASE_URL}/media/upload-media`, { // Updated endpoint
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ fileBase64: base64Data, fileType: file.type, isProfileImage: false }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || t('common.failedToUploadMedia', { fileName: file.name }));
        }

        const data = await response.json();
        newUploadedMedia.push(data.mediaInfo);
      }
      setUploadedMediaItems((prev) => [...prev, ...newUploadedMedia]);
      setSelectedFiles([]);
      showSuccess(t('common.mediaUploadedSuccessfully'));
    } catch (error: any) {
      console.error('Error uploading media:', error);
      showError(error.message || t('common.failedToUploadMediaGeneric'));
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
          showError(t('common.fileSizeExceeds', { fileName: file.name, maxSize: MAX_CONTENT_FILE_SIZE_BYTES / (1024 * 1024) }));
          continue;
        }
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
          showError(t('common.fileNotImageOrVideo', { fileName: file.name }));
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
    showSuccess(t('common.mediaItemRemoved'));
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      showError(t('common.geolocationNotSupported'));
      return;
    }

    setLoadingLocation(true);
    setLocationSelectionMode('current');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCoordinates({ lat: latitude, lng: longitude });
        showSuccess(t('common.locationRetrievedSuccessfully'));
        setLoadingLocation(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMessage = t('common.failedToGetLocation');
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = t('common.permissionDeniedLocation');
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = t('common.locationUnavailable');
            break;
          case error.TIMEOUT:
            errorMessage = t('common.locationRequestTimedOut');
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
    showSuccess(t('common.locationCleared'));
  };

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setSelectedFiles([]);
    setUploadedMediaItems([]);
    setCoordinates(null);
    setLocationSelectionMode('none');
    setPostDate(new Date());
    setCurrentDraftId(null);
  };

  const saveDraft = useCallback(async () => {
    if (!isAuthenticated || !selectedJourney || isUploadingMedia || isSavingDraft) return;

    const isOwner = user?.id === selectedJourney.user_id;
    const isAdmin = user?.isAdmin;
    const canPublishAsCollaborator = journeyCollaborators.some(collab => collab.user_id === user?.id && collab.can_publish_posts);
    const canCreatePost = isOwner || isAdmin || canPublishAsCollaborator;

    if (!canCreatePost) return; // Cannot save draft if no permission to create posts

    // Only save if there's actual content
    if (!title.trim() && !message.trim() && uploadedMediaItems.length === 0 && !coordinates) {
      return;
    }

    setIsSavingDraft(true);
    try {
      const postData = {
        journeyId: selectedJourney.id,
        title: title.trim() || undefined,
        message: message.trim(),
        media_items: uploadedMediaItems.length > 0 ? uploadedMediaItems : undefined,
        coordinates: coordinates || undefined,
        created_at: postDate ? postDate.toISOString() : undefined,
        is_draft: true,
      };

      let response;
      if (currentDraftId) {
        response = await fetch(`${API_BASE_URL}/posts/${currentDraftId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(postData),
        });
      } else {
        response = await fetch(`${API_BASE_URL}/posts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(postData),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('indexPage.failedToSaveDraft'));
      }

      const savedDraft: Post = await response.json();
      setCurrentDraftId(savedDraft.id);
      fetchDrafts(selectedJourney.id); // Refresh drafts list
      showSuccess(t('indexPage.draftSavedSuccessfully'));
    } catch (error: any) {
      console.error('Error saving draft:', error);
      showError(error.message || t('indexPage.failedToSaveDraft'));
    } finally {
      setIsSavingDraft(false);
    }
  }, [isAuthenticated, selectedJourney, isUploadingMedia, isSavingDraft, user, journeyCollaborators, title, message, uploadedMediaItems, coordinates, postDate, currentDraftId, token, fetchDrafts, t]);

  useEffect(() => {
    let autoSaveTimer: number;
    if (isAuthenticated && selectedJourney) {
      autoSaveTimer = window.setInterval(saveDraft, AUTO_SAVE_INTERVAL_MS);
    }
    return () => {
      if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
      }
    };
  }, [isAuthenticated, selectedJourney, saveDraft]);


  const handleSubmit = async (event: React.FormEvent, publish: boolean = true) => {
    event.preventDefault();

    if (!isAuthenticated) {
      showError(t('common.authRequiredCreatePost'));
      return;
    }

    if (!selectedJourney) {
      showError(t('common.selectJourneyBeforePost'));
      return;
    }

    const isOwner = user?.id === selectedJourney.user_id;
    const isAdmin = user?.isAdmin;
    const canPublishAsCollaborator = journeyCollaborators.some(collab => collab.user_id === user?.id && collab.can_publish_posts);
    const canCreatePost = isOwner || isAdmin || canPublishAsCollaborator;

    if (!canCreatePost) {
      showError(t('common.noPermissionCreatePost'));
      return;
    }

    if (!title.trim() && !message.trim() && uploadedMediaItems.length === 0 && !coordinates) {
      showError(t('common.atLeastTitleMessageMediaOrCoordsRequired'));
      return;
    }
    if (isUploadingMedia) {
      showError(t('common.pleaseWaitForMediaUploads'));
      return;
    }

    try {
      const postData = {
        journeyId: selectedJourney.id,
        title: title.trim() || undefined,
        message: message.trim(),
        media_items: uploadedMediaItems.length > 0 ? uploadedMediaItems : undefined,
        coordinates: coordinates || undefined,
        created_at: postDate ? postDate.toISOString() : undefined,
        is_draft: !publish, // If publish is true, is_draft is false. If publish is false (save draft), is_draft is true.
      };

      let response;
      if (currentDraftId) {
        // Update existing draft or publish it
        response = await fetch(`${API_BASE_URL}/posts/${currentDraftId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(postData),
        });
      } else {
        // Create new post or draft
        response = await fetch(`${API_BASE_URL}/posts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(postData),
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || (publish ? t('common.failedToCreatePost') : t('indexPage.failedToSaveDraft')));
      }

      const resultPost: Post = await response.json();
      if (publish) {
        setPosts((prev) => [resultPost, ...prev]);
        showSuccess(t('common.postCreatedSuccessfully'));
      } else {
        fetchDrafts(selectedJourney.id); // Refresh drafts list
        showSuccess(t('indexPage.draftSavedSuccessfully'));
      }
      resetForm();
    } catch (error: any) {
      console.error('Error creating/saving post:', error);
      showError(error.message || (publish ? t('common.failedToCreatePost') : t('indexPage.failedToSaveDraft')));
    }
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
        if (currentDraftId === id) {
          resetForm();
        }
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
    if (updatedPost.is_draft) {
      setDrafts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
    } else {
      setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
      // If a draft was published, remove it from drafts list
      setDrafts((prev) => prev.filter((p) => p.id !== updatedPost.id));
    }

    if (selectedPostForDetail?.id === updatedPost.id) {
      setSelectedPostForDetail(updatedPost);
    }
  };

  const handleSelectPostFromMap = (post: Post, index: number) => {
    handlePostClick(post, index);
  };

  const handleLoadDraft = (draft: Post) => {
    setTitle(draft.title || '');
    setMessage(draft.message);
    setUploadedMediaItems(draft.media_items || []);
    setCoordinates(draft.coordinates || null);
    setPostDate(draft.created_at ? parseISO(draft.created_at) : new Date());
    setCurrentDraftId(draft.id);
    showSuccess(t('indexPage.draftLoadedSuccessfully', { title: draft.title || draft.message.substring(0, 20) + '...' }));
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
      <Card className="shadow-lg shadow-neon-blue">
        <CardHeader className="flex flex-row items-center justify-end">
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <Input
                placeholder={t('indexPage.titleOptional')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-grow"
                disabled={!canCreatePostUI}
              />
              <PostDatePicker
                selectedDate={postDate}
                onDateSelect={setPostDate}
                disabled={!canCreatePostUI || isUploadingMedia}
                className="w-full sm:w-auto"
              />
            </div>
            <Textarea
              placeholder={t('indexPage.messagePlaceholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full resize-none"
              disabled={!canCreatePostUI}
            />

            {(uploadedMediaItems.length > 0 || coordinates) && (
              <div className="space-y-4 p-4 border rounded-md bg-gray-50 dark:bg-gray-800">
                <h4 className="text-lg font-semibold">{t('indexPage.contentPreview')}</h4>
                {uploadedMediaItems.map((mediaItem, index) => (
                  <div key={index} className="relative">
                    {mediaItem.type === 'image' ? (
                      <img
                        src={mediaItem.urls.medium || '/placeholder.svg'}
                        alt={t('common.postImageAlt', { index: index + 1 })}
                        className="w-full h-auto max-h-64 object-cover rounded-md"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder.svg';
                          e.currentTarget.onerror = null;
                          showError(t('common.failedToLoadMedia', { fileName: `media-${index + 1}` }));
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
                  <p className="text-sm text-center text-blue-500 dark:text-blue-400 mt-1">{t('common.uploading')}</p>
                )}
                {coordinates && (
                  <div className="relative">
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-2">
                      {t('locationSearch.selected', { lat: coordinates.lat.toFixed(4), lng: coordinates.lng.toFixed(4) })}
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

            <div className="flex flex-wrap justify-center gap-2">
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
                    {t('indexPage.uploadingMedia')}
                  </>
                ) : (
                  selectedFiles.length > 0 ? `${selectedFiles.length} ${t('common.filesSelected')}` : (uploadedMediaItems.length > 0 ? t('editPostDialog.changeAddMedia') : t('editPostDialog.chooseMedia'))
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
                    {t('indexPage.gettingLocation')}
                  </>
                ) : (
                  <>
                    <LocateFixed className="mr-2 h-4 w-4" /> {t('indexPage.getLocation')}
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
                <Search className="mr-2 h-4 w-4" /> {t('indexPage.searchLocation')}
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

            <div className="flex justify-center gap-2">
              <Button
                type="button"
                onClick={(e) => handleSubmit(e, false)} // Save as draft
                className="bg-gray-600 hover:bg-gray-700 text-white hover:ring-2 hover:ring-gray-500"
                disabled={isUploadingMedia || !canCreatePostUI || (!title.trim() && !message.trim() && uploadedMediaItems.length === 0 && !coordinates) || isSavingDraft}
              >
                {isSavingDraft ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('indexPage.savingDraft')}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {t('indexPage.saveDraft')}
                  </>
                )}
              </Button>
              <Button
                type="submit" // Publish post
                className="bg-blue-600 hover:bg-blue-700 text-white hover:ring-2 hover:ring-blue-500"
                disabled={isUploadingMedia || !canCreatePostUI || (!title.trim() && !message.trim() && uploadedMediaItems.length === 0 && !coordinates)}
              >
                {t('indexPage.post')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
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
    <div className="w-full md:w-4/5 mx-auto p-4 sm:p-6 lg:p-8 flex flex-col md:flex-row flex-grow h-full">
      {/* Left Column: Post Form (Static) */}
      <div className="md:w-1/2 md:pr-2 flex-shrink-0 md:overflow-y-auto">
        {mainContent}
      </div>

      {/* Right Column: Post Feed (Scrollable) */}
      <div className="md:w-1/2 md:pl-2 flex-grow overflow-y-auto">
        {selectedJourney && (posts.length > 0 || drafts.length > 0) && (
          <Tabs defaultValue="posts" className="w-full">
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
                                          <AlertDialogTitle>{t('adminPage.areYouSure')}</AlertDialogTitle>
                                          <AlertDialogDescription dangerouslySetInnerHTML={{ __html: t('common.deletePostDescription') }} />
                                        </AlertDialogHeader>
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
                      <Card key={draft.id} className={cn("p-4 flex items-center justify-between", currentDraftId === draft.id && "ring-2 ring-blue-500")}>
                        <div>
                          <p className="font-semibold">{draft.title || draft.message.substring(0, 50) + (draft.message.length > 50 ? '...' : '') || t('indexPage.untitledDraft')}</p>
                          <p className="text-sm text-muted-foreground">
                            {t('indexPage.lastSaved', { date: format(new Date(draft.created_at), 'PPP p', { locale: currentLocale }) })}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          {canEditDraft && (
                            <Button variant="outline" size="sm" onClick={() => handleLoadDraft(draft)} className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
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
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('adminPage.areYouSure')}</AlertDialogTitle>
                                  <AlertDialogDescription dangerouslySetInnerHTML={{ __html: t('indexPage.deleteDraftDescription', { draftTitle: draft.title || draft.message.substring(0, 50) + '...' }) }} />
                                </AlertDialogHeader>
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
      </div>

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