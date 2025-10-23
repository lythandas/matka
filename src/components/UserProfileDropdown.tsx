"use client";

import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, Settings, User as UserIcon, Users } from 'lucide-react'; // Changed Wrench to Users icon for admin
import LoginDialog from './LoginDialog';
import RegisterDialog from './RegisterDialog';
import ManageAccountDialog from './ManageAccountDialog';
import { getAvatarInitials } from '@/lib/utils';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
// Removed ThemeToggle import

const UserProfileDropdown: React.FC = () => {
  const { isAuthenticated, user, logout, usersExist } = useAuth();
  const navigate = useNavigate(); // Initialize useNavigate
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState<boolean>(false);
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState<boolean>(false);
  const [isManageAccountDialogOpen, setIsManageAccountDialogOpen] = useState<boolean>(false);

  const displayName = user?.name || user?.username;

  const handleAuthButtonClick = () => {
    if (isAuthenticated) {
      logout();
    } else {
      if (usersExist === false) {
        setIsRegisterDialogOpen(true);
      } else {
        setIsLoginDialogOpen(true);
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <>
        <Button onClick={handleAuthButtonClick} variant="outline" className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
          {usersExist === false ? 'Register' : 'Login'}
        </Button>
        {usersExist === false && (
          <RegisterDialog
            isOpen={isRegisterDialogOpen}
            onClose={() => setIsRegisterDialogOpen(false)}
          />
        )}
        {usersExist === true && (
          <LoginDialog
            isOpen={isLoginDialogOpen}
            onClose={() => setIsLoginDialogOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 hover:ring-2 hover:ring-blue-500 hover:bg-transparent">
            <Avatar className="h-9 w-9">
              {user?.profile_image_url ? (
                <AvatarImage src={user.profile_image_url} alt={displayName} />
              ) : (
                <AvatarFallback className="bg-blue-500 text-white">
                  {getAvatarInitials(user?.name, user?.username)}
                </AvatarFallback>
              )}
            </Avatar>
            <span className="sr-only">Open user menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{displayName}</p>
              <p className="text-xs leading-none text-muted-foreground">@{user?.username}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {user?.isAdmin && ( // Only show Admin link if user is an admin
            <DropdownMenuItem onClick={() => navigate('/admin')}>
              <Users className="mr-2 h-4 w-4" />
              <span>Admin (Users)</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setIsManageAccountDialogOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Manage account</span>
          </DropdownMenuItem>
          {/* ThemeToggle moved to ManageAccountDialog */}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {user && (
        <ManageAccountDialog
          isOpen={isManageAccountDialogOpen}
          onClose={() => setIsManageAccountDialogOpen(false)}
          currentUser={user}
        />
      )}
    </>
  );
};

export default UserProfileDropdown;