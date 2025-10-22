"use client";

import React, { useState } from 'react';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import CreateJourneyDialog from './CreateJourneyDialog'; // Import CreateJourneyDialog
import { useCreateJourneyDialog } from '@/contexts/CreateJourneyDialogContext'; // New import

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { isCreateJourneyDialogOpen, setIsCreateJourneyDialogOpen } = useCreateJourneyDialog(); // Use context

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <TopBar
        onOpenMobileSidebar={setIsMobileSidebarOpen}
        setIsCreateJourneyDialogOpen={setIsCreateJourneyDialogOpen}
      />
      <div className="flex flex-grow">
        {!isMobile && (
          <Sidebar setIsCreateJourneyDialogOpen={setIsCreateJourneyDialogOpen} />
        )}
        <main className="flex-grow p-4 sm:p-6 lg:p-8 max-w-full md:max-w-[calc(100%-16rem)] mx-auto">
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