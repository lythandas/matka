"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
import { Loader2, Plus, Trash2, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { showError, showSuccess } from '@/utils/toast';
import { ALL_PERMISSIONS, getPermissionDisplayName } from '@/lib/permissions';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarInitials } from '@/lib/utils';
import { API_BASE_URL } from '@/config/api';
import { Journey, JourneyCollaborator, User } from '@/types';

interface ManageJourneyCollaboratorsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  journey: Journey;
  onCollaboratorsUpdated: () => void; // Callback to refresh journey data if needed
}

const journeySpecificPermissions = [
  'create_post',
  'delete_post', // Delete own posts in this journey
  'edit_post',   // Edit own posts in this journey
  'edit_journey', // Edit this journey's name
  'delete_journey', // Delete this journey
  'manage_journey_access', // Manage collaborators for this journey
];

const ManageJourneyCollaboratorsDialog: React.FC<ManageJourneyCollaboratorsDialogProps> = ({
  isOpen,
  onClose,
  journey,
  onCollaboratorsUpdated,
}) => {
  const { token, user: currentUser } = useAuth();
  const [collaborators, setCollaborators] = useState<JourneyCollaborator[]>([]);
  const [loadingCollaborators, setLoadingCollaborators] = useState<boolean>(true);
  const [isUpdatingCollaborator, setIsUpdatingCollaborator] = useState<boolean>(false);

  const [searchUsername, setSearchUsername] = useState<string>('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState<User | null>(null);
  const [newCollaboratorPermissions, setNewCollaboratorPermissions] = useState<string[]>([]);
  const [isAddingCollaborator, setIsAddingCollaborator] = useState<boolean>(false);

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

  useEffect(() => {
    if (isOpen && journey) {
      fetchCollaborators();
      setSearchUsername('');
      setSearchResults([]);
      setSelectedUserToAdd(null);
      setNewCollaboratorPermissions([]);
    }
  }, [isOpen, journey, fetchCollaborators]);

  const handleSearchUsers = useCallback(async () => {
    if (!searchUsername.trim() || !token) return;
    setLoadingSearch(true);
    try {
      const response = await fetch(`${API_BASE_URL}/users?username=${searchUsername.trim()}`, {
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
      if (filteredData.length === 0) {
        showError('No new users found matching your search.');
      }
    } catch (error) {
      console.error('Error searching users:', error);
      showError('Failed to search for users.');
    } finally {
      setLoadingSearch(false);
    }
  }, [searchUsername, token, collaborators, journey.user_id]);

  const handleAddCollaborator = async () => {
    if (!selectedUserToAdd || !token) return;
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
          permissions: newCollaboratorPermissions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add collaborator');
      }

      showSuccess(`User '${selectedUserToAdd.username}' added as collaborator.`);
      fetchCollaborators();
      onCollaboratorsUpdated();
      setSearchUsername('');
      setSearchResults([]);
      setSelectedUserToAdd(null);
      setNewCollaboratorPermissions([]);
    } catch (error: any) {
      console.error('Error adding collaborator:', error);
      showError(error.message || 'Failed to add collaborator.');
    } finally {
      setIsAddingCollaborator(false);
    }
  };

  const handleUpdateCollaboratorPermissions = async (userId: string, newPermissions: string[]) => {
    if (!token) return;
    setIsUpdatingCollaborator(true);
    try {
      const response = await fetch(`${API_BASE_URL}/journeys/${journey.id}/collaborators/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ permissions: newPermissions }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update permissions');
      }

      showSuccess('Collaborator permissions updated.');
      fetchCollaborators();
      onCollaboratorsUpdated();
    } catch (error: any) {
      console.error('Error updating collaborator permissions:', error);
      showError(error.message || 'Failed to update permissions.');
    } finally {
      setIsUpdatingCollaborator(false);
    }
  };

  const handleRemoveCollaborator = async (userId: string, username: string) => {
    if (!token) return;
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
      onCollaboratorsUpdated();
    } catch (error: any) {
      console.error('Error removing collaborator:', error);
      showError(error.message || 'Failed to remove collaborator.');
    } finally {
      setIsUpdatingCollaborator(false);
    }
  };

  const handleNewCollabPermissionChange = (permission: string, checked: boolean) => {
    setNewCollaboratorPermissions((prev) =>
      checked ? [...prev, permission] : prev.filter((p) => p !== permission)
    );
  };

  const handleExistingCollabPermissionChange = (
    collabId: string,
    currentPermissions: string[],
    permission: string,
    checked: boolean
  ) => {
    const updatedPermissions = checked
      ? [...currentPermissions, permission]
      : currentPermissions.filter((p) => p !== permission);
    handleUpdateCollaboratorPermissions(collabId, updatedPermissions);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Collaborators for "{journey?.name}"</DialogTitle>
          <DialogDescription>
            Add or remove users and manage their specific permissions for this journey.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          {/* Journey Owner */}
          <div className="border rounded-md p-4 bg-muted/50">
            <h3 className="text-lg font-semibold mb-2">Journey Owner</h3>
            <div className="flex items-center space-x-3">
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
            <p className="text-sm text-muted-foreground mt-2">
              (Owner has full access and cannot be removed or have permissions modified here.)
            </p>
          </div>

          {/* Add Collaborator Section */}
          <div className="border rounded-md p-4">
            <h3 className="text-lg font-semibold mb-2">Add New Collaborator</h3>
            <div className="flex space-x-2 mb-4">
              <Input
                placeholder="Search username to add..."
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
                disabled={isAddingCollaborator || isUpdatingCollaborator}
                className="flex-grow"
              />
              <Button onClick={handleSearchUsers} disabled={!searchUsername.trim() || loadingSearch || isAddingCollaborator || isUpdatingCollaborator}>
                {loadingSearch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Search
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="border rounded-md mb-4 max-h-40 overflow-y-auto">
                {searchResults.map((userResult) => (
                  <div
                    key={userResult.id}
                    className={`flex items-center justify-between p-2 hover:bg-accent cursor-pointer ${selectedUserToAdd?.id === userResult.id ? 'bg-accent' : ''}`}
                    onClick={() => setSelectedUserToAdd(userResult)}
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
                  </div>
                ))}
              </div>
            )}

            {selectedUserToAdd && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Assign permissions for {selectedUserToAdd.name || selectedUserToAdd.username}:</p>
                <div className="grid grid-cols-2 gap-2">
                  {journeySpecificPermissions.map((perm) => (
                    <div key={`new-${perm}`} className="flex items-center space-x-2">
                      <Checkbox
                        id={`new-perm-${perm}`}
                        checked={newCollaboratorPermissions.includes(perm)}
                        onCheckedChange={(checked) => handleNewCollabPermissionChange(perm, !!checked)}
                        disabled={isAddingCollaborator || isUpdatingCollaborator}
                      />
                      <Label htmlFor={`new-perm-${perm}`}>
                        {getPermissionDisplayName(perm)}
                      </Label>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={handleAddCollaborator}
                  disabled={isAddingCollaborator || isUpdatingCollaborator}
                  className="w-full hover:ring-2 hover:ring-blue-500"
                >
                  {isAddingCollaborator ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Add Collaborator
                </Button>
              </div>
            )}
          </div>

          {/* Current Collaborators Section */}
          <div className="border rounded-md p-4">
            <h3 className="text-lg font-semibold mb-2">Current Collaborators ({collaborators.length})</h3>
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
                        disabled={isUpdatingCollaborator || isAddingCollaborator || collab.user_id === currentUser?.id}
                        className="hover:ring-2 hover:ring-blue-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {journeySpecificPermissions.map((perm) => (
                        <div key={`${collab.user_id}-${perm}`} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${collab.user_id}-${perm}`}
                            checked={collab.permissions.includes(perm)}
                            onCheckedChange={(checked) =>
                              handleExistingCollabPermissionChange(collab.user_id, collab.permissions, perm, !!checked)
                            }
                            disabled={isUpdatingCollaborator || isAddingCollaborator || collab.user_id === currentUser?.id}
                          />
                          <Label htmlFor={`${collab.user_id}-${perm}`}>
                            {getPermissionDisplayName(perm)}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isUpdatingCollaborator || isAddingCollaborator} className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageJourneyCollaboratorsDialog;