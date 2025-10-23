"use client";

import React from 'react';
import TopBar from './TopBar';
import { useIsMobile } from '@/hooks/use-mobile';
import CreateJourneyDialog from './CreateJourneyDialog';
import { useCreateJourneyDialog } from '@/contexts/CreateJourneyDialogContext';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const { isCreateJourneyDialogOpen, setIsCreateJourneyDialogOpen } = useCreateJourneyDialog();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <TopBar
        setIsCreateJourneyDialogOpen={setIsCreateJourneyDialogOpen}
      />
      <div className="flex flex-grow">
        <main className="flex-grow p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full">
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