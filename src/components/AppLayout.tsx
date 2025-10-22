"use client";

import React, { useState } from 'react';
import TopBar from './TopBar';
import { useIsMobile } from '@/hooks/use-mobile';
import CreateJourneyDialog from './CreateJourneyDialog'; // Import CreateJourneyDialog
import { useCreateJourneyDialog } from '@/contexts/CreateJourneyDialogContext'; // New import

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();
  // Removed isMobileSidebarOpen state as sidebar is removed
  const { isCreateJourneyDialogOpen, setIsCreateJourneyDialogOpen } = useCreateJourneyDialog(); // Use context

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <TopBar
        // Removed onOpenMobileSidebar prop as sidebar is removed
        setIsCreateJourneyDialogOpen={setIsCreateJourneyDialogOpen}
      />
      <div className="flex flex-grow">
        {/* Sidebar removed */}
        <main className="flex-grow p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full"> {/* Adjusted max-w-full to max-w-3xl and removed md:max-w-[calc(100%-16rem)] */}
          {children}
        </main>
      </div>

      <CreateJourneyDialog
        isOpen={isCreateJourneyDialogOpen}
        onClose={() => setIsCreateJourneyDialogOpen(false)}
      />
    </div>
  );
};

export default AppLayout;