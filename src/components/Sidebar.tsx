"use client";

import React from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import { useJourneys } from '@/contexts/JourneyContext';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface SidebarProps {
  setIsCreateJourneyDialogOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ setIsCreateJourneyDialogOpen }) => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { journeys, selectedJourney, setSelectedJourney, loadingJourneys } = useJourneys();

  if (!isAuthenticated) {
    return null; // Don't render sidebar if not authenticated
  }

  return (
    <aside className="hidden md:flex flex-col w-64 border-r dark:border-gray-800 bg-sidebar-background text-sidebar-foreground p-4 h-full sticky top-0">
      <nav className="flex-grow space-y-2">
        <Button
          variant="ghost"
          className="w-full justify-start text-lg font-semibold text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={() => navigate('/')}
        >
          Journeys
        </Button>
        {user?.role === 'admin' && (
          <Button
            variant="ghost"
            className="w-full justify-start text-lg font-semibold text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => navigate('/admin')}
          >
            Admin Dashboard
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-between text-base font-semibold flex items-center mt-4",
                "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90",
                "hover:ring-2 hover:ring-sidebar-ring hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
              )}
            >
              {selectedJourney ? selectedJourney.name : "Select Journey"}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
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
      </nav>
    </aside>
  );
};

export default Sidebar;