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
import EditJourneyDialog from '@/components/EditJourneyDialog';
import CreateRoleDialog from '@/components/CreateRoleDialog'; // New import
import EditRoleDialog from '@/components/EditRoleDialog';     // New import
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
import { getPermissionDisplayName } from '@/lib/permissions';

interface User {
  id: string;
  username: string;
  role: string; // Now role name
  permissions: string[]; // Permissions derived from the role
  created_at: string;
}

interface Journey {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
}

interface Role { // New interface for roles
  id: string;
  name: string;
  permissions: string[];
  created_at: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser, token } = useAuth();
  const { journeys, fetchJourneys, loadingJourneys } = useJourneys();

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState<boolean>(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [roles, setRoles] = useState<Role[]>([]); // New state for roles
  const [loadingRoles, setLoadingRoles] = useState<boolean>(true); // New state for loading roles
  const [isCreateRoleDialogOpen, setIsCreateRoleDialogOpen] = useState<boolean>(false); // New state
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState<boolean>(false);     // New state
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);                 // New state

  const [isEditJourneyDialogOpen, setIsEditJourneyDialogOpen] = useState<boolean>(false);
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!token || currentUser?.role !== 'admin' || !currentUser?.permissions.includes('manage_users')) {
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
    if (!token || currentUser?.role !== 'admin' || !currentUser?.permissions.includes('manage_roles')) {
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

  useEffect(() => {
    if (currentUser?.role === 'admin') {
      fetchUsers();
      fetchRoles(); // Fetch roles for admin view
      fetchJourneys(); // Also fetch journeys for admin view
    } else {
      showError('Access Denied: You must be an administrator to view this page.');
      navigate('/'); // Redirect non-admins
    }
  }, [currentUser, navigate, fetchUsers, fetchRoles, fetchJourneys]);

  const handleUserUpdated = (updatedUser: User) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
  };

  const handleRoleUpdated = (updatedRole: Role) => {
    setRoles((prev) => prev.map((r) => (r.id === updatedRole.id ? updatedRole : r)));
    // Also re-fetch users as their displayed permissions might change
    fetchUsers();
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
      fetchUsers(); // Re-fetch users to update the list
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
      fetchRoles(); // Re-fetch roles to update the list
      fetchUsers(); // Re-fetch users as their roles might be affected
    } catch (error: any) {
      console.error('Error deleting role:', error);
      showError(error.message || 'Failed to delete role.');
    }
  };

  const handleDeleteJourney = async (journeyId: string) => {
    if (!token) {
      showError('Authentication required to delete a journey.');
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
      fetchJourneys(); // Re-fetch journeys to update the list
    } catch (error: any) {
      console.error('Error deleting journey:', error);
      showError(error.message || 'Failed to delete journey.');
    }
  };

  if (currentUser?.role !== 'admin') {
    return null; // Should be redirected by useEffect, but a fallback
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Button variant="outline" onClick={() => navigate('/')} className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Journeys
          </Button>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <div></div> {/* Placeholder for alignment */}
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-3"> {/* Updated to 3 columns */}
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="roles">Role Management</TabsTrigger> {/* New Tab */}
            <TabsTrigger value="journeys">Journey Management</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-2xl font-bold">Manage Users</CardTitle>
                <Button onClick={() => setIsCreateUserDialogOpen(true)} className="hover:ring-2 hover:ring-blue-500">
                  <Plus className="mr-2 h-4 w-4" /> Create New User
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
                          <TableHead>Username</TableHead>
                          <TableHead>Role</TableHead> {/* Changed from Permissions */}
                          <TableHead>Permissions</TableHead> {/* New column to show derived permissions */}
                          <TableHead>Created At</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.username}</TableCell>
                            <TableCell>{user.role}</TableCell> {/* Display role name */}
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
                            <TableCell>{format(new Date(user.created_at), 'PPP')}</TableCell>
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
                                      disabled={user.id === currentUser?.id} // Prevent admin from deleting themselves
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

          {/* New Role Management Tab */}
          <TabsContent value="roles" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-2xl font-bold">Manage Roles</CardTitle>
                <Button onClick={() => setIsCreateRoleDialogOpen(true)} className="hover:ring-2 hover:ring-blue-500">
                  <Plus className="mr-2 h-4 w-4" /> Create New Role
                </Button>
              </CardHeader>
              <CardContent>
                {loadingRoles ? (
                  <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <p className="ml-2 text-gray-600 dark:text-gray-400">Loading roles...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Role Name</TableHead>
                          <TableHead>Permissions</TableHead>
                          <TableHead>Created At</TableHead>
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
                                      disabled={role.name === 'admin' || role.name === 'user'} // Prevent deleting default roles
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
                <CardTitle className="text-2xl font-bold">Manage Journeys</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingJourneys ? (
                  <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <p className="ml-2 text-gray-600 dark:text-gray-400">Loading journeys...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Owner ID</TableHead>
                          <TableHead>Created At</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {journeys.map((journey) => (
                          <TableRow key={journey.id}>
                            <TableCell className="font-medium">{journey.name}</TableCell>
                            <TableCell>{journey.user_id}</TableCell>
                            <TableCell>{format(new Date(journey.created_at), 'PPP')}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end space-x-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => { setSelectedJourney(journey); setIsEditJourneyDialogOpen(true); }}
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
                                      <AlertDialogAction onClick={() => handleDeleteJourney(journey.id)}>
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
      </div>

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
        <EditJourneyDialog
          isOpen={isEditJourneyDialogOpen}
          onClose={() => { setIsEditJourneyDialogOpen(false); setSelectedJourney(null); }}
          journey={selectedJourney}
        />
      )}
    </div>
  );
};

export default AdminPage;