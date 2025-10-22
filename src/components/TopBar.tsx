"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Compass, Plus, ChevronDown, Wrench, Users } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import UserProfileDropdown from '@/components/UserProfileDropdown';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/AuthContext';
import { useJourneys } from '@/contexts/JourneyContext';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import ManageJourneyDialog from './ManageJourneyDialog';
import { userHasPermission } from '@/lib/permissions';

interface TopBarProps {
  setIsCreateJourneyDialogOpen: (isOpen: boolean) => void;
}

const TopBar: React.FC<TopBarProps> = ({ setIsCreateJourneyDialogOpen }) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { journeys, selectedJourney, setSelectedJourney, loadingJourneys, fetchJourneys } = useJourneys();

  const [isManageJourneyDialogOpen, setIsManageJourneyDialogOpen] = useState<boolean>(false);

  // Check if the current user has permission to manage the selected journey
  const canManageSelectedJourney = isAuthenticated && selectedJourney && userHasPermission(user, 'manage_journey_access', selectedJourney.user_id);

  const renderJourneyDropdown = (isMobileView: boolean) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-between text-base font-semibold flex items-center",
            isMobileView ? "w-full" : "min-w-[150px]",
            "bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
            "hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
          )}
        >
          {selectedJourney ? selectedJourney.name : "Select journey"}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className={isMobileView ? "w-full" : "w-56"} align={isMobileView ? "start" : "end"}>
        <DropdownMenuLabel>Your journeys</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loadingJourneys ? (
          <DropdownMenuItem disabled>Loading journeys...</DropdownMenuItem>
        ) : (
          journeys.map((journey) => (
            <DropdownMenuItem
              key={journey.id}
              onClick={() => {
                setSelectedJourney(journey);
              }}
              className={selectedJourney?.id === journey.id ? "bg-accent text-accent-foreground" : ""}
            >
              {journey.name}
            </DropdownMenuItem>
          ))
        )}
        {isAuthenticated && (userHasPermission(user, 'create_journey')) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {
              setIsCreateJourneyDialogOpen(true);
            }}>
              <Plus className="mr-2 h-4 w-4" /> Create new journey
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex items-center justify-between py-4 px-4 sm:px-6 lg:px-8 border-b dark:border-gray-800 bg-background sticky top-0 z-30 relative">
      <div className="flex items-center space-x-4">
        {isMobile && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 flex flex-col">
              <div className="p-4 border-b dark:border-gray-800 flex items-center">
                <Compass className="mr-2 h-6 w-6 text-blue-600 dark:text-foreground" />
                <h1 className="text-xl font-extrabold text-blue-600 dark:text-foreground">Matka</h1>
              </div>
              <nav className="flex-grow p-4 space-y-2">
                {isAuthenticated && (
                  <>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-lg font-semibold"
                      onClick={() => { navigate('/'); }}
                    >
                      Journeys
                    </Button>
                    {renderJourneyDropdown(true)} {/* Mobile journey dropdown */}
                    {canManageSelectedJourney && (
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-lg font-semibold"
                        onClick={() => setIsManageJourneyDialogOpen(true)}
                      >
                        <Wrench className="mr-2 h-4 w-4" /> Manage journey
                      </Button>
                    )}
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        )}
        {!isMobile && (
          <div className="flex items-center">
            <Compass className="mr-2 h-6 w-6 text-blue-600 dark:text-foreground" />
            <h1 className="text-2xl font-extrabold text-blue-600 dark:text-foreground">Matka</h1>
          </div>
        )}
      </div>

      {!isMobile && isAuthenticated && (
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center space-x-2">
          {renderJourneyDropdown(false)} {/* Desktop journey dropdown */}
          {canManageSelectedJourney && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsManageJourneyDialogOpen(true)}
              className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
            >
              <Wrench className="h-4 w-4" />
              <span className="sr-only">Manage journey</span>
            </Button>
          )}
        </div>
      )}

      <div className="flex items-center space-x-2">
        <UserProfileDropdown />
      </div>

      {selectedJourney && (
        <ManageJourneyDialog
          isOpen={isManageJourneyDialogOpen}
          onClose={() => setIsManageJourneyDialogOpen(false)}
          journey={selectedJourney}
          onJourneyUpdated={() => {
            fetchJourneys(); // Refresh journeys list
            // No need to fetch collaborators here, as ManageJourneyDialog handles its own collaborator fetching
          }}
        />
      )}
    </div>
  );
};

export default TopBar;