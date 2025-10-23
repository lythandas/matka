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
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Trash2, Search, Link as LinkIcon, Copy } from 'lucide-react';
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
import { Switch } from "@/components/ui/switch"; // Import Switch component

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
  const { token, user: currentUser } = useAuth();
  const [journeyName, setJourneyName] = useState<string>(journey.name);
  const [isPublic, setIsPublic] = useState<boolean>(journey.is_public); // New state for is_public
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [isTogglingPublic, setIsTogglingPublic] = useState<boolean>(false); // New state for public toggle loading

  const [collaborators, setCollaborators] = useState<JourneyCollaborator[]>([]);
  const [loadingCollaborators, setLoadingCollaborators] = useState<boolean>(true);
  const [isUpdatingCollaborator, setIsUpdatingCollaborator] = useState<boolean>(false);

  const [searchUsername, setSearchUsername] = useState<string>('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState<User | null>(null);
  const [isAddingCollaborator, setIsAddingCollaborator] = useState<boolean>(false);

  const debounceTimeoutRef = useRef<number | null>(null);

  // Generate human-readable share link
  const frontendBaseUrl = window.location.origin;
  const shareLink = `${frontendBaseUrl}/public-journey/${journey.owner_username}/${encodeURIComponent(journey.name)}`;

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
        throw new Error('Failed to fetch journey collaborators');
      }
      const data: JourneyCollaborator[] = await response.json();
      setCollaborators(data);
    } catch (error) {
      console.error('Error fetching journey collaborators:', error);
      showError('Failed to load journey collaborators.');
    } finally {
      setLoadingCollaborators(false);
    }
  }, [token, journey]);

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
        throw new Error('Failed to search users');
      }
      const data: User[] = await response.json();
      // Filter out current collaborators and the journey owner
      const filteredData = data.filter(u =>
        !collaborators.some(collab => collab.user_id === u.id) && u.id !== journey.user_id
      );
      setSearchResults(filteredData);
    } catch (error) {
      console.error('Error searching users:', error);
      showError('Failed to search for users.');
      setSearchResults([]);
    } finally {
      setLoadingSearch(false);
    }
  }, [token, collaborators, journey.user_id]);

  useEffect(() => {
    if (isOpen && journey) {
      setJourneyName(journey.name);
      setIsPublic(journey.is_public); // Initialize isPublic state
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
      showError('Journey name cannot be empty.');
      return;
    }
    if (!token || !currentUser) {
      showError('Authentication required to update a journey.');
      return;
    }

    // Permission check: only owner or admin can edit journey name
    const canEditJourneyName = currentUser.id === journey.user_id || currentUser.isAdmin;
    if (!canEditJourneyName) {
      showError('You do not have permission to edit this journey.');
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
        throw new Error(errorData.message || 'Failed to update journey');
      }

      showSuccess(`Journey renamed to '${journeyName}' successfully!`);
      onJourneyUpdated();
    } catch (error: any) {
      console.error('Error renaming journey:', error);
      showError(error.message || 'Failed to rename journey.');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleTogglePublic = async (checked: boolean) => {
    if (!token || !currentUser) {
      showError('Authentication required to update a journey.');
      return;
    }

    // Permission check: only owner or admin can change public status
    const canTogglePublic = currentUser.id === journey.user_id || currentUser.isAdmin;
    if (!canTogglePublic) {
      showError('You do not have permission to change the public status of this journey.');
      return;
    }

    setIsTogglingPublic(true);
    try {
      const response = await fetch(`${API_BASE_URL}/journeys/${journey.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ is_public: checked }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update public status');
      }

      setIsPublic(checked);
      showSuccess(`Journey is now ${checked ? 'public' : 'private'}!`);
      onJourneyUpdated();
    } catch (error: any) {
      console.error('Error toggling public status:', error);
      showError(error.message || 'Failed to update public status.');
    } finally {
      setIsTogglingPublic(false);
    }
  };

  const handleAddCollaborator = async () => {
    if (!selectedUserToAdd || !token) {
      showError('Please select a user to add as a collaborator.');
      return;
    }

    // Permission check: only owner or admin can add collaborators
    const canManageJourney = currentUser?.id === journey.user_id || currentUser?.isAdmin;
    if (!canManageJourney) {
      showError('You do not have permission to add collaborators to this journey.');
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
          // Default permissions are set on the backend: can_read_posts: true, can_publish_posts: true, can_modify_post: true, can_delete_posts: false
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add collaborator');
      }

      showSuccess(`User '${selectedUserToAdd.username}' added as collaborator.`);
      fetchCollaborators();
      onJourneyUpdated();
      setSearchUsername('');
      setSearchResults([]);
      setSelectedUserToAdd(null);
    } catch (error: any) {
      console.error('Error adding collaborator:', error);
      showError(error.message || 'Failed to add collaborator.');
    } finally {
      setIsAddingCollaborator(false);
    }
  };

  const handleUpdateCollaboratorPermissions = async (
    userId: string,
    permissions: { can_read_posts: boolean; can_publish_posts: boolean; can_modify_post: boolean; can_delete_posts: boolean }
  ) => {
    if (!token) return;

    // Permission check: only owner or admin can update collaborators
    const canManageJourney = currentUser?.id === journey.user_id || currentUser?.isAdmin;
    if (!canManageJourney) {
      showError('You do not have permission to update collaborator permissions for this journey.');
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
        body: JSON.stringify(permissions),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update collaborator permissions');
      }

      showSuccess(`Permissions updated for collaborator.`);
      fetchCollaborators(); // Re-fetch to get the latest state
      onJourneyUpdated();
    } catch (error: any) {
      console.error('Error updating collaborator permissions:', error);
      showError(error.message || 'Failed to update collaborator permissions.');
    } finally {
      setIsUpdatingCollaborator(false);
    }
  };

  const handleRemoveCollaborator = async (userId: string, username: string) => {
    if (!token) return;

    // Permission check: only owner or admin can remove collaborators
    const canManageJourney = currentUser?.id === journey.user_id || currentUser?.isAdmin;
    if (!canManageJourney) {
      showError('You do not have permission to remove collaborators from this journey.');
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
        throw new Error(errorData.message || 'Failed to remove collaborator');
      }

      showSuccess(`Collaborator '${username}' removed.`);
      fetchCollaborators();
      onJourneyUpdated();
    } catch (error: any) {
      console.error('Error removing collaborator:', error);
      showError(error.message || 'Failed to remove collaborator.');
    } finally {
      setIsUpdatingCollaborator(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink)
      .then(() => showSuccess('Share link copied to clipboard!'))
      .catch(() => showError('Failed to copy link.'));
  };

  // Permission checks for UI elements
  const canManageJourney = currentUser?.id === journey.user_id || currentUser?.isAdmin;
  const canEditJourneyName = canManageJourney;
  const canTogglePublicStatus = canManageJourney;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage journey: "{journey?.name}"</DialogTitle>
          <DialogDescription>
            Update journey details or manage collaborators.
          </DialogDescription>
        </DialogHeader>
        <div className="p-4 space-y-4 flex-grow overflow-y-auto">
          {/* Journey Owner */}
          <div className="border rounded-md p-4 bg-muted/50">
            <h3 className="text-lg font-semibold mb-2">Journey owner</h3>
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
              (Owner has full access and cannot be removed.)
            </p>

            {/* Journey Name input */}
            <div className="grid grid-cols-4 items-center gap-4 mb-4">
              <Label htmlFor="journey-name" className="text-right">
                Journey name
              </Label>
              <Input
                id="journey-name"
                value={journeyName}
                onChange={(e) => setJourneyName(e.target.value)}
                className="col-span-3"
                placeholder="e.g., My summer trip"
                disabled={isRenaming || !canEditJourneyName}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleRenameJourney} disabled={!journeyName.trim() || isRenaming || !canEditJourneyName} className="hover:ring-2 hover:ring-blue-500">
                {isRenaming ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Renaming...
                  </>
                ) : (
                  'Save journey name'
                )}
              </Button>
            </div>
          </div>

          {/* Public Access Section */}
          <div className="border rounded-md p-4">
            <h3 className="text-lg font-semibold mb-2">Public access</h3>
            <div className="flex items-center justify-between space-x-4 mb-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="public-toggle"
                  checked={isPublic}
                  onCheckedChange={handleTogglePublic}
                  disabled={isTogglingPublic || !canTogglePublicStatus}
                />
                <Label htmlFor="public-toggle" className="text-base">
                  Make journey public
                </Label>
              </div>
              {isTogglingPublic && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
            </div>
            {isPublic && (
              <div className="space-y-2">
                <Label htmlFor="share-link" className="text-sm">Shareable link:</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="share-link"
                    value={shareLink}
                    readOnly
                    className="flex-grow bg-muted"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                    className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                  >
                    <Copy className="h-4 w-4" />
                    <span className="sr-only">Copy link</span>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Anyone with this link can view your journey's posts without logging in.</p>
              </div>
            )}
          </div>

          {/* Add Collaborator Section with Autocomplete */}
          <div className="border rounded-md p-4">
            <h3 className="text-lg font-semibold mb-2">Add new collaborator</h3>
            <Command className="rounded-lg border shadow-md mb-4">
              <CommandInput
                placeholder="Search username to add..."
                value={searchUsername}
                onValueChange={setSearchUsername}
                disabled={isAddingCollaborator || isUpdatingCollaborator || !canManageJourney}
              />
              <CommandList>
                {loadingSearch && <CommandEmpty>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Searching...
                </CommandEmpty>}
                {!loadingSearch && searchResults.length === 0 && searchUsername.length >= 2 && (
                  <CommandEmpty>No users found.</CommandEmpty>
                )}
                <CommandGroup heading="Users">
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
                <p className="text-sm font-medium mb-2">
                  Adding <span className="font-bold text-primary">{selectedUserToAdd.name || selectedUserToAdd.username}</span> as a collaborator.
                  They will be able to publish posts on this journey by default.
                </p>
                <Button
                  onClick={handleAddCollaborator}
                  disabled={isAddingCollaborator || isUpdatingCollaborator || !canManageJourney}
                  className="w-full hover:ring-2 hover:ring-blue-500"
                >
                  {isAddingCollaborator ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Add collaborator
                </Button>
              </div>
            )}
          </div>

          {/* Current Collaborators Section */}
          <div className="border rounded-md p-4">
            <h3 className="text-lg font-semibold mb-2">Current collaborators ({collaborators.length})</h3>
            {loadingCollaborators ? (
              <div className="flex justify-center items-center h-24">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <p className="ml-2 text-gray-600 dark:text-gray-400">Loading collaborators...</p>
              </div>
            ) : collaborators.length === 0 ? (
              <p className="text-muted-foreground text-sm">No collaborators added yet.</p>
            ) : (
              <div className="space-y-4">
                {collaborators.map((collab) => (
                  <div key={collab.user_id} className="border p-3 rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-9 w-9">
                          {collab.profile_image_url ? (
                            <AvatarImage src={collab.profile_image_url} alt={collab.name || collab.username} />
                          ) : (
                            <AvatarFallback className="bg-gray-200 text-gray-500 text-sm">
                              {getAvatarInitials(collab.name, collab.username)}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div>
                          <p className="font-medium">{collab.name || collab.username}</p>
                          {collab.name && <p className="text-sm text-muted-foreground">@{collab.username}</p>}
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => handleRemoveCollaborator(collab.user_id, collab.username)}
                        disabled={isUpdatingCollaborator || isAddingCollaborator || collab.user_id === currentUser?.id || !canManageJourney}
                        className="hover:ring-2 hover:ring-blue-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`read-${collab.user_id}`}
                          checked={collab.can_read_posts}
                          onCheckedChange={(checked) =>
                            handleUpdateCollaboratorPermissions(collab.user_id, {
                              ...collab,
                              can_read_posts: checked as boolean,
                            })
                          }
                          disabled={isUpdatingCollaborator || isAddingCollaborator || !canManageJourney}
                        />
                        <Label htmlFor={`read-${collab.user_id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Can read posts
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`publish-${collab.user_id}`}
                          checked={collab.can_publish_posts}
                          onCheckedChange={(checked) =>
                            handleUpdateCollaboratorPermissions(collab.user_id, {
                              ...collab,
                              can_publish_posts: checked as boolean,
                            })
                          }
                          disabled={isUpdatingCollaborator || isAddingCollaborator || !canManageJourney}
                        />
                        <Label htmlFor={`publish-${collab.user_id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Can publish posts
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`modify-${collab.user_id}`}
                          checked={collab.can_modify_post}
                          onCheckedChange={(checked) =>
                            handleUpdateCollaboratorPermissions(collab.user_id, {
                              ...collab,
                              can_modify_post: checked as boolean,
                            })
                          }
                          disabled={isUpdatingCollaborator || isAddingCollaborator || !canManageJourney}
                        />
                        <Label htmlFor={`modify-${collab.user_id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Can modify posts
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`delete-${collab.user_id}`}
                          checked={collab.can_delete_posts}
                          onCheckedChange={(checked) =>
                            handleUpdateCollaboratorPermissions(collab.user_id, {
                              ...collab,
                              can_delete_posts: checked as boolean,
                            })
                          }
                          disabled={isUpdatingCollaborator || isAddingCollaborator || !canManageJourney}
                        />
                        <Label htmlFor={`delete-${collab.user_id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          Can delete posts
                        </Label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isRenaming || isAddingCollaborator || isUpdatingCollaborator || isTogglingPublic} className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageJourneyDialog;