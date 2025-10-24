"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, ArrowLeft, Trash2, KeyRound, Wrench, Globe } from 'lucide-react'; // Added Wrench and Globe icons
import { useAuth } from '@/contexts/AuthContext';
import { showError, showSuccess } from '@/utils/toast';
import { useNavigate } from 'react-router-dom';
import CreateUserDialog from '@/components/CreateUserDialog';
import ResetPasswordDialog from '@/components/ResetPasswordDialog';
import ManageJourneyDialog from '@/components/ManageJourneyDialog'; // Import ManageJourneyDialog
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarInitials } from '@/lib/utils';
import { API_BASE_URL } from '@/config/api';
import { User, Journey } from '@/types'; // Import Journey type
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
import { useTranslation } from 'react-i18next'; // Import useTranslation

const AdminPage: React.FC = () => {
  const { t } = useTranslation(); // Initialize useTranslation
  const navigate = useNavigate();
  const { user: currentUser, token } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState<boolean>(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState<boolean>(false);
  const [userToResetPassword, setUserToResetPassword] = useState<{ id: string; username: string } | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState<boolean>(false);

  const [journeys, setJourneys] = useState<Journey[]>([]); // New state for journeys
  const [loadingJourneys, setLoadingJourneys] = useState<boolean>(true); // New state for loading journeys
  const [isManageJourneyDialogOpen, setIsManageJourneyDialogOpen] = useState<boolean>(false); // New state for manage journey dialog
  const [journeyToManage, setJourneyToManage] = useState<Journey | null>(null); // New state for journey to manage
  const [isDeletingJourney, setIsDeletingJourney] = useState<boolean>(false); // New state for deleting journey

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
        throw new Error(t('common.failedToFetchUsers')); // Translated error
      }
      const data: User[] = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      showError(t('common.failedToLoadUsers')); // Translated error
    } finally {
      setLoadingUsers(false);
    }
  }, [token, currentUser, t]);

  const fetchJourneys = useCallback(async () => { // New function to fetch journeys
    if (!token || !currentUser?.isAdmin) {
      setLoadingJourneys(false);
      return;
    }
    setLoadingJourneys(true);
    try {
      const response = await fetch(`${API_BASE_URL}/journeys`, { // Admin can fetch all journeys
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error(t('common.failedToFetchJourneys')); // Translated error
      }
      const data: Journey[] = await response.json();
      setJourneys(data);
    } catch (error) {
      console.error('Error fetching journeys:', error);
      showError(t('common.failedToLoadJourneys')); // Translated error
    } finally {
      setLoadingJourneys(false);
    }
  }, [token, currentUser, t]);

  useEffect(() => {
    if (currentUser?.isAdmin) {
      fetchUsers();
      fetchJourneys(); // Fetch journeys when component mounts
    } else {
      showError(t('common.accessDeniedAdminPage')); // Translated error
      navigate('/');
    }
  }, [currentUser, navigate, fetchUsers, fetchJourneys, t]);

  const handleUserCreated = (newUser: User) => {
    setUsers((prev) => [...prev, newUser]);
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!token || !currentUser?.isAdmin) {
      showError(t('common.authRequiredNotAuthorizedDeleteUsers')); // Translated error
      return;
    }
    if (currentUser.id === userId) {
      showError(t('common.cannotDeleteOwnAdminAccount')); // Translated error
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
        throw new Error(errorData.message || t('common.failedToDeleteUser')); // Translated error
      }

      showSuccess(t('common.userDeletedSuccessfully', { username })); // Translated success
      setUsers((prev) => prev.filter((user) => user.id !== userId));
    } catch (error: any) {
      console.error('Error deleting user:', error);
      showError(error.message || t('common.failedToDeleteUser')); // Translated error
    } finally {
      setIsDeletingUser(false);
    }
  };

  const openResetPasswordDialog = (user: User) => {
    setUserToResetPassword({ id: user.id, username: user.username });
    setIsResetPasswordDialogOpen(true);
  };

  const openManageJourneyDialog = (journey: Journey) => { // New function to open manage journey dialog
    setJourneyToManage(journey);
    setIsManageJourneyDialogOpen(true);
  };

  const handleJourneyUpdated = () => { // Callback for when a journey is updated in the dialog
    fetchJourneys(); // Re-fetch journeys to update the list
  };

  const handleDeleteJourney = async (journeyId: string, journeyName: string) => { // New function to delete journey
    if (!token || !currentUser?.isAdmin) {
      showError(t('common.authRequiredNotAuthorizedDeleteJourneys')); // Translated error
      return;
    }

    setIsDeletingJourney(true);
    try {
      const response = await fetch(`${API_BASE_URL}/journeys/${journeyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('common.failedToDeleteJourney')); // Translated error
      }

      showSuccess(t('common.journeyDeletedSuccessfully', { journeyName })); // Translated success
      setJourneys((prev) => prev.filter((journey) => journey.id !== journeyId));
    } catch (error: any) {
      console.error('Error deleting journey:', error);
      showError(error.message || t('common.failedToDeleteJourney')); // Translated error
    } finally {
      setIsDeletingJourney(false);
    }
  };

  if (!currentUser?.isAdmin) {
    return null; // Should be redirected by useEffect, but a fallback
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <Button
          variant="outline"
          onClick={() => navigate('/')}
          className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('common.backToJourneys')}
        </Button>
        <h1 className="text-3xl font-bold">{t('adminPage.adminDashboard')}</h1>
      </div>

      {/* Manage Users Section */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold">{t('adminPage.manageUsers')}</CardTitle>
          <Button onClick={() => setIsCreateUserDialogOpen(true)} className="hover:ring-2 hover:ring-blue-500">
            <Plus className="mr-2 h-4 w-4" /> {t('adminPage.createNewUser')}
          </Button>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="ml-2 text-gray-600 dark:text-gray-400">{t('adminPage.loadingUsers')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('adminPage.user')}</TableHead>
                    <TableHead>{t('adminPage.admin')}</TableHead>
                    <TableHead>{t('adminPage.createdAt')}</TableHead>
                    <TableHead className="text-right">{t('adminPage.actions')}</TableHead>
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
                      <TableCell>{user.isAdmin ? t('common.yes') : t('common.no')}</TableCell>
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
                            <span className="sr-only">{t('adminPage.resetPassword')}</span>
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
                                <span className="sr-only">{t('adminPage.deleteUser')}</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('adminPage.areYouSure')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('adminPage.deleteUserDescription', { username: user.username })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteUser(user.id, user.username)}>
                                  {t('adminPage.continue')}
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

      {/* Manage Journeys Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold">{t('adminPage.manageJourneys')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingJourneys ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="ml-2 text-gray-600 dark:text-gray-400">{t('adminPage.loadingJourneys')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('adminPage.journeyName')}</TableHead>
                    <TableHead>{t('adminPage.owner')}</TableHead>
                    <TableHead>{t('adminPage.public')}</TableHead>
                    <TableHead>{t('adminPage.createdAt')}</TableHead>
                    <TableHead className="text-right">{t('adminPage.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {journeys.map((journey) => (
                    <TableRow key={journey.id}>
                      <TableCell className="font-medium">{journey.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Avatar className="h-7 w-7 mr-2">
                            {journey.owner_profile_image_url ? (
                              <AvatarImage src={journey.owner_profile_image_url} alt={journey.owner_name || journey.owner_username} />
                            ) : (
                              <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs">
                                {getAvatarInitials(journey.owner_name, journey.owner_username)}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <span>{journey.owner_name || journey.owner_username}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {journey.is_public ? <Globe className="h-4 w-4 text-green-500" /> : <Globe className="h-4 w-4 text-gray-400" />}
                      </TableCell>
                      <TableCell>{format(new Date(journey.created_at), 'PPP')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openManageJourneyDialog(journey)}
                            disabled={isDeletingJourney}
                            className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
                          >
                            <Wrench className="h-4 w-4" />
                            <span className="sr-only">{t('adminPage.manageJourney')}</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="icon"
                                disabled={isDeletingJourney}
                                className="hover:ring-2 hover:ring-blue-500"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">{t('adminPage.deleteJourney')}</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('adminPage.areYouSure')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('adminPage.deleteJourneyDescription', { journeyName: journey.name })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteJourney(journey.id, journey.name)}>
                                  {t('adminPage.continue')}
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

      {journeyToManage && (
        <ManageJourneyDialog
          isOpen={isManageJourneyDialogOpen}
          onClose={() => {
            setIsManageJourneyDialogOpen(false);
            setJourneyToManage(null);
          }}
          journey={journeyToManage}
          onJourneyUpdated={handleJourneyUpdated}
        />
      )}
    </div>
  );
};

export default AdminPage;