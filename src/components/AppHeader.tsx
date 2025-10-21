"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Compass, Plus, Wrench } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import UserProfileDropdown from '@/components/UserProfileDropdown';
import CreateJourneyDialog from '@/components/CreateJourneyDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useJourneys } from '@/contexts/JourneyContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const AppHeader: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { journeys, selectedJourney, setSelectedJourney, loadingJourneys } = useJourneys();
  const [isCreateJourneyDialogOpen, setIsCreateJourneyDialogOpen] = useState<boolean>(false);

  return (
    <header className="flex items-center justify-between py-4 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
      {/* Left: Matka Title */}
      <div className="flex items-center">
        <h1 className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 flex items-center">
          <Compass className="mr-2 h-6 w-6" /> Matka
        </h1>
      </div>

      {/* Center: Journey Dropdown */}
      <div className="flex-grow flex justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-10 px-4 text-base font-semibold flex items-center",
                "hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit",
                "min-w-[150px] justify-center" // Ensure consistent width and centering
              )}
            >
              {selectedJourney ? selectedJourney.name : "Select Journey"}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Your Journeys</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {loadingJourneys ? (
              <DropdownMenuItem disabled>Loading journeys...</DropdownMenuItem>
            ) : (
              journeys.map((journey) => (
                <DropdownMenuItem
                  key={journey.id}
                  onClick={() => setSelectedJourney(journey)}
                  className={selectedJourney?.id === journey.id ? "bg-accent text-accent-foreground" : ""}
                >
                  {journey.name}
                </DropdownMenuItem>
              ))
            )}
            {isAuthenticated && (user?.permissions.includes('create_journey') || user?.role === 'admin') && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setIsCreateJourneyDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Create New Journey
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Right: Utility Buttons */}
      <div className="flex items-center space-x-2">
        {isAuthenticated && user?.role === 'admin' && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/admin')}
            className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:border-transparent"
          >
            <Wrench className="h-[1.2rem] w-[1.2rem]" />
            <span className="sr-only">Admin Section</span>
          </Button>
        )}
        <ThemeToggle className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:border-transparent" />
        <UserProfileDropdown />
      </div>

      <CreateJourneyDialog
        isOpen={isCreateJourneyDialogOpen}
        onClose={() => setIsCreateJourneyDialogOpen(false)}
      />
    </header>
  );
};

export default AppHeader;