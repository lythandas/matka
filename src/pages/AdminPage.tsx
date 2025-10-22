"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { showError, showSuccess } from '@/utils/toast';
import { useNavigate } from 'react-router-dom';
import { useJourneys } from '@/contexts/JourneyContext';
import CreateUserDialog from '@/components/CreateUserDialog';
import EditUserDialog from '@/components/EditUserDialog';
import ManageJourneyDialog from '@/components/ManageJourneyDialog'; // Changed to new dialog
import CreateRoleDialog from '@/components/CreateRoleDialog';
import EditRoleDialog from '@/components/EditRoleDialog';
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
import { format } from 'date-fns';
import { getPermissionDisplayName, userHasPermission } from '@/lib/permissions'; // Import userHasPermission
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarInitials } from '@/lib/utils';
import { API_BASE_URL } from '@/config/api';
import { User, Journey, Role, JourneyCollaborator } from '@/types';

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser, token } = useAuth();
  const { journeys, fetchJourneys, loadingJourneys } = useJourneys();

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState<boolean>(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [roles, setRoles] = useState<Role[]>([]);
  const [loadingRoles, setLoadingRoles] = useState<boolean>(true);
  const [isCreateRoleDialogOpen, setIsCreateRoleDialogOpen] = useState<boolean>(false);
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState<boolean>(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const [isManageJourneyDialogOpen, setIsManageJourneyDialogOpen] = useState<boolean>(false); // Changed from isEditJourneyDialogOpen
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);
  const [journeyCollaborators, setJourneyCollaborators] = useState<JourneyCollaborator[]>([]); // New state for journey collaborators

  const fetchUsers = useCallback(async () => {
    if (!token || currentUser?.role !== 'admin' || !userHasPermission(currentUser, 'manage_users')) {
      setLoadingUsers(false);
      return;
    }
    setLoadingUsers(true);
    try {
      const response = await fetch(`${API_BASE_URL}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data: User[] = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      showError('Failed to load users.');
    } finally {
      setLoadingUsers(false);
    }
  }, [token, currentUser]);

  const fetchRoles = useCallback(async () => {
    if (!token || currentUser?.role !== 'admin' || !userHasPermission(currentUser, 'manage_roles')) {
      setLoadingRoles(false);
      return;
    }
    setLoadingRoles(true);
    try {
      const response = await fetch(`${API_BASE_URL}/roles`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch roles');
      }
      const data: Role[] = await response.json();
      setRoles(data);
    } catch (error) {
      console.error('Error fetching roles:', error);
      showError('Failed to load roles.');
    } finally {
      setLoadingRoles(false);
    }
  }, [token, currentUser]);

  const fetchJourneyCollaborators = useCallback(async (journeyId: string) => {
    if (!token || !currentUser || !journeyId) {
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
        // If not authorized to view collaborators, just return empty
        if (response.status === 403 || response.status === 401) {
          setJourneyCollaborators([]);
          return;
        }
        throw new Error('Failed to fetch journey collaborators');
      }
      const data: JourneyCollaborator[] = await response.json();
      setJourneyCollaborators(data);
    } catch (error) {
      console.error('Error fetching journey collaborators:', error);
      setJourneyCollaborators([]); // Clear on error
    }
  }, [token, currentUser]);

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      fetchUsers();
      fetchRoles();
      fetchJourneys();
    } else {
      showError('Access denied: You must be an administrator to view this page.');
      navigate('/');
    }
  }, [currentUser, navigate, fetchUsers, fetchRoles, fetchJourneys]);

  // When a journey is selected for editing, fetch its collaborators
  useEffect(() => {
    if (isManageJourneyDialogOpen && selectedJourney) { // Changed state name
      fetchJourneyCollaborators(selectedJourney.id);
    } else {
      setJourneyCollaborators([]);
    }
  }, [isManageJourneyDialogOpen, selectedJourney, fetchJourneyCollaborators]); // Changed state name

  const handleUserUpdated = (updatedUser: User) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
  };

  const handleRoleUpdated = (updatedRole: Role) => {
    setRoles((prev) => prev.map((r) => (r.id === updatedRole.id ? updatedRole : r)));
    fetchUsers(); // Re-fetch users as their displayed permissions might change
  };

  const handleDeleteUser = async (userId: string) => {
    if (!token) {
      showError('Authentication required to delete a user.');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete user');
      }

      showSuccess('User deleted successfully!');
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      showError(error.message || 'Failed to delete user.');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!token) {
      showError('Authentication required to delete a role.');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/roles/${roleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete role');
      }

      showSuccess('Role deleted successfully!');
      fetchRoles();
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting role:', error);
      showError(error.message || 'Failed to delete role.');
    }
  };

  const handleDeleteJourney = async (journeyId: string, ownerId: string) => {
    if (!token || !currentUser) {
      showError('Authentication required to delete a journey.');
      return;
    }

    // Admin page allows deleting any journey, but still use the permission utility for consistency
    if (!userHasPermission(currentUser, 'delete_any_journey', ownerId, journeyCollaborators)) {
      showError('You do not have permission to delete this journey.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/journeys/${journeyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete journey');
      }

      showSuccess('Journey deleted successfully!');
      fetchJourneys();
    } catch (error: any) {
      console.error('Error deleting journey:', error);
      showError(error.message || 'Failed to delete journey.');
    }
  };

  if (currentUser?.role !== 'admin') {
    return null;
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-8">
        <Button
          variant="outline"
          onClick={() => navigate('/')}
          className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Journeys
        </Button>
        <h1 className="text-3xl font-bold">Admin dashboard</h1>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users">User management</TabsTrigger>
          <TabsTrigger value="roles">Role management</TabsTrigger>
          <TabsTrigger value="journeys">Journey management</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-2xl font-bold">Manage users</CardTitle>
              <Button onClick={() => setIsCreateUserDialogOpen(true)} className="hover:ring-2 hover:ring-blue-500">
                <Plus className="mr-2 h-4 w-4" /> Create new user
              </Button>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="flex justify-center items-center h-48">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  <p className="ml-2 text-gray-600 dark:text-gray-400">Loading users...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Permissions</TableHead>
                        <TableHead>Created at</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center">
                              <Avatar className="h-9 w-9 mr-3">
                                {user.profile_image_url ? (
                                  <AvatarImage src={user.profile_image_url} alt={user.name || user.username} />
                                ) : (
                                  <AvatarFallback className="bg-blue-500 text-white">
                                    {getAvatarInitials(user.name, user.username)}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <div>
                                <p className="font-medium">{user.name || user.username}</p>
                                {user.name && <p className="text-sm text-muted-foreground">@{user.username}</p>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{user.role}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {user.permissions.length > 0 ? (
                                user.permissions.map((perm) => (
                                  <span key={perm} className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded-full">
                                    {getPermissionDisplayName(perm)}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-gray-500">None</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{format(new Date(user.created_at!), 'PPP')}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => { setSelectedUser(user); setIsEditUserDialogOpen(true); }}
                                className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    disabled={user.id === currentUser?.id}
                                    className="hover:ring-2 hover:ring-blue-500"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone. This will permanently delete the user "{user.username}"
                                      and all their associated journeys and posts.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteUser(user.id)}>
                                      Continue
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-2xl font-bold">Manage roles</CardTitle>
              <Button onClick={() => setIsCreateRoleDialogOpen(true)} className="hover:ring-2 hover:ring-blue-500">
                <Plus className="mr-2 h-4 w-4" /> Create new role
              </Button>
            </CardHeader>
            <CardContent>
              {loadingRoles ? (
                <div className="flex justify-center items-center h-48">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  <p className="ml-2 text-gray-600 dark:text-gray-400">Loading roles...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Role name</TableHead>
                        <TableHead>Permissions</TableHead>
                        <TableHead>Created at</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roles.map((role) => (
                        <TableRow key={role.id}>
                          <TableCell className="font-medium">{role.name}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {role.permissions.length > 0 ? (
                                role.permissions.map((perm) => (
                                  <span key={perm} className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded-full">
                                    {getPermissionDisplayName(perm)}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-gray-500">None</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{format(new Date(role.created_at), 'PPP')}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => { setSelectedRole(role); setIsEditRoleDialogOpen(true); }}
                                className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    disabled={role.name === 'admin' || role.name === 'user'}
                                    className="hover:ring-2 hover:ring-blue-500"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone. This will permanently delete the role "{role.name}".
                                      You cannot delete roles that have users assigned to them or are default roles.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteRole(role.id)}>
                                      Continue
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="journeys" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold">Manage journeys</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingJourneys ? (
                <div className="flex justify-center items-center h-48">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  <p className="ml-2 text-gray-600 dark:text-gray-400">Loading journeys...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Created at</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {journeys.map((journey) => (
                        <TableRow key={journey.id}>
                          <TableCell className="font-medium">{journey.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Avatar className="h-8 w-8 mr-2">
                                {journey.owner_profile_image_url ? (
                                  <AvatarImage src={journey.owner_profile_image_url} alt={journey.owner_name || journey.owner_username} />
                                ) : (
                                  <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm">
                                    {getAvatarInitials(journey.owner_name, journey.owner_username)}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <p className="text-sm text-gray-800 dark:text-gray-200">
                                {journey.owner_name || journey.owner_username}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{format(new Date(journey.created_at), 'PPP')}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => { setSelectedJourney(journey); setIsManageJourneyDialogOpen(true); }} // Changed to new dialog
                                className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="icon" className="hover:ring-2 hover:ring-blue-500">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone. This will permanently delete the journey "{journey.name}"
                                      and all its associated posts.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteJourney(journey.id, journey.user_id)}>
                                      Continue
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateUserDialog
        isOpen={isCreateUserDialogOpen}
        onClose={() => { setIsCreateUserDialogOpen(false); fetchUsers(); }}
        onUserCreated={fetchUsers}
      />

      {selectedUser && (
        <EditUserDialog
          isOpen={isEditUserDialogOpen}
          onClose={() => { setIsEditUserDialogOpen(false); setSelectedUser(null); }}
          user={selectedUser}
          onUserUpdated={handleUserUpdated}
        />
      )}

      <CreateRoleDialog
        isOpen={isCreateRoleDialogOpen}
        onClose={() => { setIsCreateRoleDialogOpen(false); fetchRoles(); }}
        onRoleCreated={fetchRoles}
      />

      {selectedRole && (
        <EditRoleDialog
          isOpen={isEditRoleDialogOpen}
          onClose={() => { setIsEditRoleDialogOpen(false); setSelectedRole(null); }}
          role={selectedRole}
          onRoleUpdated={handleRoleUpdated}
        />
      )}

      {selectedJourney && (
        <ManageJourneyDialog // Changed to new dialog
          isOpen={isManageJourneyDialogOpen} // Changed state name
          onClose={() => { setIsManageJourneyDialogOpen(false); setSelectedJourney(null); }} // Changed state name
          journey={selectedJourney}
          onJourneyUpdated={() => {
            fetchJourneys(); // Refresh journeys list
            fetchJourneyCollaborators(selectedJourney.id); // Refresh collaborators
          }}
        />
      )}
    </div>
  );
};

export default AdminPage;