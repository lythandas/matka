"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, ArrowLeft, Trash2, KeyRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { showError, showSuccess } from '@/utils/toast';
import { useNavigate } from 'react-router-dom';
import CreateUserDialog from '@/components/CreateUserDialog';
import ResetPasswordDialog from '@/components/ResetPasswordDialog'; // Import ResetPasswordDialog
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarInitials } from '@/lib/utils';
import { API_BASE_URL } from '@/config/api';
import { User } from '@/types';
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

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser, token } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState<boolean>(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState<boolean>(false);
  const [userToResetPassword, setUserToResetPassword] = useState<{ id: string; username: string } | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState<boolean>(false);

  const fetchUsers = useCallback(async () => {
    if (!token || !currentUser?.isAdmin) {
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

  useEffect(() => {
    if (currentUser?.isAdmin) {
      fetchUsers();
    } else {
      showError('Access denied: You must be an administrator to view this page.');
      navigate('/');
    }
  }, [currentUser, navigate, fetchUsers]);

  const handleUserCreated = (newUser: User) => {
    setUsers((prev) => [...prev, newUser]);
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!token || !currentUser?.isAdmin) {
      showError('Authentication required or not authorized to delete users.');
      return;
    }
    if (currentUser.id === userId) {
      showError('You cannot delete your own admin account.');
      return;
    }

    setIsDeletingUser(true);
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

      showSuccess(`User '${username}' deleted successfully!`);
      setUsers((prev) => prev.filter((user) => user.id !== userId));
    } catch (error: any) {
      console.error('Error deleting user:', error);
      showError(error.message || 'Failed to delete user.');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const openResetPasswordDialog = (user: User) => {
    setUserToResetPassword({ id: user.id, username: user.username });
    setIsResetPasswordDialogOpen(true);
  };

  if (!currentUser?.isAdmin) {
    return null; // Should be redirected by useEffect, but a fallback
  }

  return (
    <div className="w-full max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
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
                    <TableHead>Admin</TableHead>
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
                      <TableCell>{user.isAdmin ? 'Yes' : 'No'}</TableCell>
                      <TableCell>{format(new Date(user.created_at!), 'PPP')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openResetPasswordDialog(user)}
                            disabled={isDeletingUser}
                            className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                          >
                            <KeyRound className="h-4 w-4" />
                            <span className="sr-only">Reset password</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="icon"
                                disabled={user.id === currentUser?.id || isDeletingUser}
                                className="hover:ring-2 hover:ring-blue-500"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete user</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the user{' '}
                                  <span className="font-bold">@{user.username}</span> and all their associated
                                  journeys, posts, and collaborations.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteUser(user.id, user.username)}>
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

      <CreateUserDialog
        isOpen={isCreateUserDialogOpen}
        onClose={() => setIsCreateUserDialogOpen(false)}
        onUserCreated={handleUserCreated}
      />

      {userToResetPassword && (
        <ResetPasswordDialog
          isOpen={isResetPasswordDialogOpen}
          onClose={() => {
            setIsResetPasswordDialogOpen(false);
            setUserToResetPassword(null);
          }}
          userId={userToResetPassword.id}
          username={userToResetPassword.username}
        />
      )}
    </div>
  );
};

export default AdminPage;