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
  // Removed useJourneys hook as journey selection is now in TopBar

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
        {/* Journey Dropdown removed from here */}
      </nav>
    </aside>
  );
};

export default Sidebar;