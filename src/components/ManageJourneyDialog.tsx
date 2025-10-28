"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, Search, Link as LinkIcon, Copy, Eye, PlusCircle, Pencil, Globe } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { showError, showSuccess } from '@/utils/toast';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarInitials } from "@/lib/utils";
import { API_BASE_URL } from '@/config/api';
import { Journey, JourneyCollaborator, User } from '@/types';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next'; // Import useTranslation
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


interface ManageJourneyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  journey: Journey;
  onJourneyUpdated: () => void;
}

const ManageJourneyDialog: React.FC<ManageJourneyDialogProps> = ({
  isOpen,
  onClose,
  journey,
  onJourneyUpdated,
}) => {
  const { t } = useTranslation(); // Initialize useTranslation
  const { token, user: currentUser } = useAuth();
  const [journeyName, setJourneyName] = useState<string>(journey.name);
  const [isRenaming, setIsRenaming] = useState<boolean>(false);

  const [isPublic, setIsPublic] = useState<boolean>(journey.is_public); // State for public status
  const [publicLinkId, setPublicLinkId] = useState<string | undefined>(journey.public_link_id); // State for public link ID
  const [isUpdatingPublicStatus, setIsUpdatingPublicStatus] = useState<boolean>(false);

  const [collaborators, setCollaborators] = useState<JourneyCollaborator[]>([]);
  const [loadingCollaborators, setLoadingCollaborators] = useState<boolean>(true);
  const [isUpdatingCollaborator, setIsUpdatingCollaborator] = useState<boolean>(false);

  const [searchUsername, setSearchUsername] = useState<string>('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState<User | null>(null);
  const [isAddingCollaborator, setIsAddingCollaborator] = useState<boolean>(false);
  const [isDeletingJourney, setIsDeletingJourney] = useState<boolean>(false);

  const debounceTimeoutRef = useRef<number | null>(null);

  const fetchCollaborators = useCallback(async () => {
    if (!token || !journey?.id) return;
    setLoadingCollaborators(true);
    try {
      const response = await fetch(`${API_BASE_URL}/journeys/${journey.id}/collaborators`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
          setCollaborators([]);
          return;
        }
        throw new Error(t('common.failedToFetchJourneyCollaborators')); // Translated error
      }
      const data: JourneyCollaborator[] = await response.json();
      setCollaborators(data);
    } catch (error) {
      console.error('Error fetching journey collaborators:', error);
      showError(t('common.failedToLoadJourneyCollaborators')); // Translated error
    } finally {
      setLoadingCollaborators(false);
    }
  }, [token, journey, t]);

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 2 || !token) {
      setSearchResults([]);
      return;
    }
    setLoadingSearch(true);
    try {
      const response = await fetch(`${API_BASE_URL}/users/search?query=${encodeURIComponent(query.trim())}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error(t('common.failedToSearchUsers')); // Translated error
      }
      const data: User[] = await response.json();
      const filteredData = data.filter(u =>
        !collaborators.some(collab => collab.user_id === u.id) && u.id !== journey.user_id
      );
      setSearchResults(filteredData);
    } catch (error) {
      console.error('Error searching users:', error);
      showError(t('common.failedToSearchForUsers')); // Translated error
      setSearchResults([]);
    } finally {
      setLoadingSearch(false);
    }
  }, [token, collaborators, journey.user_id, t]);

  useEffect(() => {
    if (isOpen && journey) {
      setJourneyName(journey.name);
      setIsPublic(journey.is_public);
      setPublicLinkId(journey.public_link_id);
      fetchCollaborators();
      setSearchUsername('');
      setSearchResults([]);
      setSelectedUserToAdd(null);
    }
  }, [isOpen, journey, fetchCollaborators]);

  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = window.setTimeout(() => {
      searchUsers(searchUsername);
    }, 300);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchUsername, searchUsers]);

  const handleRenameJourney = async () => {
    if (!journeyName.trim()) {
      showError(t('common.journeyNameCannotBeEmpty')); // Translated error
      return;
    }
    if (!token || !currentUser) {
      showError(t('common.authRequiredUpdateJourney')); // Translated error
      return;
    }

    const canEditJourneyName = currentUser.id === journey.user_id || currentUser.isAdmin;
    if (!canEditJourneyName) {
      showError(t('common.noPermissionEditJourney')); // Translated error
      return;
    }

    setIsRenaming(true);
    try {
      const response = await fetch(`${API_BASE_URL}/journeys/${journey.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: journeyName.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('common.failedToUpdateJourney')); // Translated error
      }

      showSuccess(t('common.journeyRenamedSuccessfully', { journeyName })); // Translated success
      onJourneyUpdated();
    } catch (error: any) {
      console.error('Error renaming journey:', error);
      showError(error.message || t('common.failedToRenameJourney')); // Translated error
    } finally {
      setIsRenaming(false);
    }
  };

  const handleTogglePublicStatus = async (checked: boolean) => {
    if (!token || !currentUser) {
      showError(t('common.authRequiredUpdateJourney'));
      return;
    }

    const canManageJourney = currentUser.id === journey.user_id || currentUser.isAdmin;
    if (!canManageJourney) {
      showError(t('common.noPermissionChangePublicStatus'));
      return;
    }

    setIsUpdatingPublicStatus(true);
    try {
      const endpoint = checked ? `${API_BASE_URL}/journeys/${journey.id}/publish` : `${API_BASE_URL}/journeys/${journey.id}/unpublish`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('common.failedToUpdatePublicStatus'));
      }

      const updatedJourney: Journey = await response.json();
      setIsPublic(updatedJourney.is_public);
      setPublicLinkId(updatedJourney.public_link_id);
      showSuccess(t('common.journeyPublicStatusUpdated', { status: updatedJourney.is_public ? t('common.public') : t('common.private') }));
      onJourneyUpdated();
    } catch (error: any) {
      console.error('Error updating public status:', error);
      showError(error.message || t('common.failedToUpdatePublicStatus'));
    } finally {
      setIsUpdatingPublicStatus(false);
    }
  };

  const handleCopyPublicLink = () => {
    if (publicLinkId) {
      const publicUrl = `${window.location.origin}/public-journey/${publicLinkId}`;
      navigator.clipboard.writeText(publicUrl)
        .then(() => showSuccess(t('common.shareLinkCopied')))
        .catch((err) => {
          console.error('Failed to copy:', err);
          showError(t('common.failedToCopyLink'));
        });
    }
  };

  const handleAddCollaborator = async () => {
    if (!selectedUserToAdd || !token) {
      showError(t('common.selectUserToAddCollaborator')); // Translated error
      return;
    }

    const canManageJourney = currentUser?.id === journey.user_id || currentUser?.isAdmin;
    if (!canManageJourney) {
      showError(t('common.noPermissionAddCollaborators')); // Translated error
      return;
    }

    setIsAddingCollaborator(true);
    try {
      const response = await fetch(`${API_BASE_URL}/journeys/${journey.id}/collaborators`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: selectedUserToAdd.username,
          // can_read_posts is implicitly true and handled by backend
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('common.failedToAddCollaborator')); // Translated error
      }

      showSuccess(t('common.collaboratorAddedSuccessfully', { username: selectedUserToAdd.username })); // Translated success
      fetchCollaborators();
      onJourneyUpdated();
      setSearchUsername('');
      setSearchResults([]);
      setSelectedUserToAdd(null);
    } catch (error: any) {
      console.error('Error adding collaborator:', error);
      showError(error.message || t('common.failedToAddCollaborator')); // Translated error
    } finally {
      setIsAddingCollaborator(false);
    }
  };

  const handleUpdateCollaboratorPermissions = async (
    userId: string,
    permissions: { can_read_posts: boolean; can_publish_posts: boolean; can_modify_post: boolean; can_delete_posts: boolean }
  ) => {
    if (!token) return;

    const canManageJourney = currentUser?.id === journey.user_id || currentUser?.isAdmin;
    if (!canManageJourney) {
      showError(t('common.noPermissionUpdateCollaboratorPermissions')); // Translated error
      return;
    }

    setIsUpdatingCollaborator(true);
    try {
      const response = await fetch(`${API_BASE_URL}/journeys/${journey.id}/collaborators/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          can_publish_posts: permissions.can_publish_posts,
          can_modify_post: permissions.can_modify_post,
          can_delete_posts: permissions.can_delete_posts,
          // can_read_posts is implicitly true and not sent for update
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('common.failedToUpdateCollaboratorPermissions')); // Translated error
      }

      showSuccess(t('common.permissionsUpdatedSuccessfully')); // Translated success
      fetchCollaborators();
      onJourneyUpdated();
    } catch (error: any) {
      console.error('Error updating collaborator permissions:', error);
      showError(error.message || t('common.failedToUpdateCollaboratorPermissions')); // Translated error
    } finally {
      setIsUpdatingCollaborator(false);
    }
  };

  const handleRemoveCollaborator = async (userId: string, username: string) => {
    if (!token) return;

    const canManageJourney = currentUser?.id === journey.user_id || currentUser?.isAdmin;
    if (!canManageJourney) {
      showError(t('common.noPermissionRemoveCollaborators')); // Translated error
      return;
    }

    setIsUpdatingCollaborator(true);
    try {
      const response = await fetch(`${API_BASE_URL}/journeys/${journey.id}/collaborators/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('common.failedToRemoveCollaborator')); // Translated error
      }

      showSuccess(t('common.collaboratorRemovedSuccessfully', { username })); // Translated success
      fetchCollaborators();
      onJourneyUpdated();
    } catch (error: any) {
      console.error('Error removing collaborator:', error);
      showError(error.message || t('common.failedToRemoveCollaborator')); // Translated error
    } finally {
      setIsUpdatingCollaborator(false);
    }
  };

  const handleDeleteJourney = async () => {
    if (!token || !currentUser) {
      showError(t('common.authRequiredDeleteJourney'));
      return;
    }

    const isOwner = currentUser.id === journey.user_id;
    const isAdmin = currentUser.isAdmin;

    if (!isOwner && !isAdmin) {
      showError(t('common.noPermissionDeleteJourney'));
      return;
    }

    setIsDeletingJourney(true);
    try {
      const response = await fetch(`${API_BASE_URL}/journeys/${journey.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('common.failedToDeleteJourney'));
      }

      showSuccess(t('common.journeyDeletedSuccessfully', { journeyName: journey.name }));
      onJourneyUpdated(); // Notify parent to refresh journey list
      onClose(); // Close the dialog
    } catch (error: any) {
      console.error('Error deleting journey:', error);
      showError(error.message || t('common.failedToDeleteJourney'));
    } finally {
      setIsDeletingJourney(false);
    }
  };

  const canManageJourney = currentUser?.id === journey.user_id || currentUser?.isAdmin;
  const canEditJourneyName = canManageJourney;
  const canDeleteThisJourney = currentUser?.id === journey.user_id || currentUser?.isAdmin;


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('manageJourneyDialog.manageJourney', { journeyName: journey?.name })}</DialogTitle>
          <DialogDescription>
            {t('manageJourneyDialog.updateDetailsCollaborators')}
          </DialogDescription>
        </DialogHeader>
        <div className="p-4 space-y-4 flex-grow overflow-y-auto">
          {/* Journey Owner */}
          <div className="border rounded-md p-4 bg-muted/50">
            <h3 className="text-lg font-semibold mb-2">{t('manageJourneyDialog.journeyOwner')}</h3>
            <div className="flex items-center space-x-3 mb-4">
              <Avatar className="h-10 w-10">
                {journey.owner_profile_image_url ? (
                  <AvatarImage src={journey.owner_profile_image_url} alt={journey.owner_name || journey.owner_username} />
                ) : (
                  <AvatarFallback className="bg-blue-500 text-white">
                    {getAvatarInitials(journey.owner_name, journey.owner_username)}
                  </AvatarFallback>
                )}
              </Avatar>
              <div>
                <p className="font-medium">{journey.owner_name || journey.owner_username}</p>
                {journey.owner_name && <p className="text-sm text-muted-foreground">@{journey.owner_username}</p>}
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t('manageJourneyDialog.ownerFullAccess')}
            </p>

            {/* Journey Name input */}
            <div className="grid grid-cols-4 items-center gap-4 mb-4">
              <Label htmlFor="journey-name" className="text-right">
                {t('manageJourneyDialog.journeyName')}
              </Label>
              <Input
                id="journey-name"
                value={journeyName}
                onChange={(e) => setJourneyName(e.target.value)}
                className="col-span-3"
                placeholder={t('createJourneyDialog.mySummerTrip')}
                disabled={isRenaming || !canEditJourneyName}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleRenameJourney} disabled={!journeyName.trim() || isRenaming || !canEditJourneyName} className="hover:ring-2 hover:ring-blue-500">
                {isRenaming ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('manageJourneyDialog.renaming')}
                  </>
                ) : (
                  t('manageJourneyDialog.saveJourneyName')
                )}
              </Button>
            </div>
          </div>

          {/* Public Sharing Section */}
          {canManageJourney && (
            <div className="border rounded-md p-4">
              <h3 className="text-lg font-semibold mb-2">{t('manageJourneyDialog.publicSharing')}</h3>
              <div className="flex items-center justify-between space-x-2 mb-4">
                <div className="flex items-center space-x-2">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <Label htmlFor="public-toggle">{t('manageJourneyDialog.makeJourneyPublic')}</Label>
                </div>
                <Switch
                  id="public-toggle"
                  checked={isPublic}
                  onCheckedChange={handleTogglePublicStatus}
                  disabled={isUpdatingPublicStatus || isRenaming || isAddingCollaborator || isUpdatingCollaborator}
                />
              </div>

              {isPublic && publicLinkId && (
                <div className="space-y-2">
                  <Label>{t('manageJourneyDialog.publicLink')}</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      value={`${window.location.origin}/public-journey/${publicLinkId}`}
                      readOnly
                      className="flex-grow"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyPublicLink}
                      disabled={isUpdatingPublicStatus}
                      className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                    >
                      <Copy className="h-4 w-4" />
                      <span className="sr-only">{t('common.copy')}</span>
                    </Button>
                  </div>
                </div>
              )}
              {isPublic && !publicLinkId && (
                <p className="text-sm text-muted-foreground mt-2">{t('manageJourneyDialog.publicLinkGenerating')}</p>
              )}
            </div>
          )}

          {/* Add Collaborator Section with Autocomplete */}
          <div className="border rounded-md p-4">
            <h3 className="text-lg font-semibold mb-2">{t('manageJourneyDialog.addNewCollaborator')}</h3>
            <Command className="rounded-lg border shadow-md mb-4">
              <CommandInput
                placeholder={t('manageJourneyDialog.searchUsernameToAdd')}
                value={searchUsername}
                onValueChange={setSearchUsername}
                disabled={isAddingCollaborator || isUpdatingCollaborator || !canManageJourney}
              />
              <CommandList>
                {loadingSearch && <CommandEmpty>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t('common.searching')}
                </CommandEmpty>}
                {!loadingSearch && searchResults.length === 0 && searchUsername.length >= 2 && (
                  <CommandEmpty>{t('common.noUsersFound')}</CommandEmpty>
                )}
                <CommandGroup heading={t('common.users')}>
                  {searchResults.map((userResult) => (
                    <CommandItem
                      key={userResult.id}
                      value={userResult.username}
                      onSelect={() => {
                        setSelectedUserToAdd(userResult);
                        setSearchUsername(userResult.username);
                        setSearchResults([]);
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-8 w-8">
                          {userResult.profile_image_url ? (
                            <AvatarImage src={userResult.profile_image_url} alt={userResult.name || userResult.username} />
                          ) : (
                            <AvatarFallback className="bg-gray-200 text-gray-500 text-xs">
                              {getAvatarInitials(userResult.name, userResult.username)}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <span>{userResult.name || userResult.username} (@{userResult.username})</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>

            {selectedUserToAdd && (
              <div className="space-y-3">
                <p className="text-sm font-medium mb-2" dangerouslySetInnerHTML={{ __html: t('manageJourneyDialog.addingCollaborator', { username: selectedUserToAdd.name || selectedUserToAdd.username }) }} />
                <Button
                  onClick={handleAddCollaborator}
                  disabled={isAddingCollaborator || isUpdatingCollaborator || !canManageJourney}
                  className="w-full hover:ring-2 hover:ring-blue-500"
                >
                  {isAddingCollaborator ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  {t('manageJourneyDialog.addCollaborator')}
                </Button>
              </div>
            )}
          </div>

          {/* Current Collaborators Section */}
          <div className="border rounded-md p-4">
            <h3 className="text-lg font-semibold mb-2">{t('manageJourneyDialog.currentCollaborators', { count: collaborators.length })}</h3>
            {loadingCollaborators ? (
              <div className="flex justify-center items-center h-24">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <p className="ml-2 text-gray-600 dark:text-gray-400">{t('common.loadingCollaborators')}</p>
              </div>
            ) : collaborators.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('manageJourneyDialog.noCollaboratorsAdded')}</p>
            ) : (
              <div className="space-y-4">
                {collaborators.map((collab) => (
                  <div key={collab.user_id} className="border p-3 rounded-md">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2 min-w-0">
                        <Avatar className="h-9 w-9">
                          {collab.profile_image_url ? (
                            <AvatarImage src={collab.profile_image_url} alt={collab.name || collab.username} />
                          ) : (
                            <AvatarFallback className="bg-gray-200 text-gray-500 text-sm">
                              {getAvatarInitials(collab.name, collab.username)}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="flex-grow truncate">
                          <p className="font-medium truncate">{collab.name || collab.username}</p>
                          {collab.name && <p className="text-sm text-muted-foreground truncate">@{collab.username}</p>}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <ToggleGroup
                          type="multiple"
                          value={[
                            collab.can_publish_posts ? 'publish' : '',
                            collab.can_modify_post ? 'modify' : '',
                            collab.can_delete_posts ? 'delete' : '',
                          ].filter(Boolean)}
                          onValueChange={(newValues: string[]) => {
                            handleUpdateCollaboratorPermissions(collab.user_id, {
                              ...collab,
                              can_read_posts: true, // Always true for collaborators
                              can_publish_posts: newValues.includes('publish'),
                              can_modify_post: newValues.includes('modify'),
                              can_delete_posts: newValues.includes('delete'),
                            });
                          }}
                          className="flex space-x-1"
                          disabled={isUpdatingCollaborator || isAddingCollaborator || !canManageJourney}
                        >
                          {/* Can publish posts */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <ToggleGroupItem
                                value="publish"
                                aria-label={t('manageJourneyDialog.allowCreatePosts')}
                                className={cn(
                                  "h-7 w-7 p-0",
                                  collab.can_publish_posts
                                    ? "bg-green-100 text-green-800 hover:bg-green-200"
                                    : "bg-red-100 text-red-800 hover:bg-red-200"
                                )}
                              >
                                <PlusCircle className="h-4 w-4" />
                              </ToggleGroupItem>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t('manageJourneyDialog.allowCreatePosts')}</p>
                            </TooltipContent>
                          </Tooltip>

                          {/* Can modify posts */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <ToggleGroupItem
                                value="modify"
                                aria-label={t('manageJourneyDialog.allowEditPosts')}
                                className={cn(
                                  "h-7 w-7 p-0",
                                  collab.can_modify_post
                                    ? "bg-green-100 text-green-800 hover:bg-green-200"
                                    : "bg-red-100 text-red-800 hover:bg-red-200"
                                )}
                              >
                                <Pencil className="h-4 w-4" />
                              </ToggleGroupItem>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t('manageJourneyDialog.allowEditPosts')}</p>
                            </TooltipContent>
                          </Tooltip>

                          {/* Can delete posts */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <ToggleGroupItem
                                value="delete"
                                aria-label={t('manageJourneyDialog.allowDeletePosts')}
                                className={cn(
                                  "h-7 w-7 p-0",
                                  collab.can_delete_posts
                                    ? "bg-green-100 text-green-800 hover:bg-green-200"
                                    : "bg-red-100 text-red-800 hover:bg-red-200"
                                )}
                              >
                                <Trash2 className="h-4 w-4" />
                              </ToggleGroupItem>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{t('manageJourneyDialog.allowDeletePosts')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </ToggleGroup>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => handleRemoveCollaborator(collab.user_id, collab.username)}
                          disabled={isUpdatingCollaborator || isAddingCollaborator || collab.user_id === currentUser?.id || !canManageJourney}
                          className="h-7 w-7 hover:ring-2 hover:ring-blue-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="flex justify-between items-center">
          {canDeleteThisJourney && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={isDeletingJourney || isRenaming || isAddingCollaborator || isUpdatingCollaborator || isUpdatingPublicStatus}
                  className="hover:ring-2 hover:ring-blue-500"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> {t('manageJourneyDialog.deleteJourney')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('adminPage.areYouSure')}</AlertDialogTitle>
                  <AlertDialogDescription dangerouslySetInnerHTML={{ __html: t('manageJourneyDialog.deleteJourneyDescription', { journeyName: journey.name }) }} />
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteJourney}>
                    {t('adminPage.continue')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="outline" onClick={onClose} disabled={isRenaming || isAddingCollaborator || isUpdatingCollaborator || isDeletingJourney || isUpdatingPublicStatus} className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
            {t('manageJourneyDialog.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageJourneyDialog;