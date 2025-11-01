"use client";

import React from 'react';
import TopBar from './TopBar';
import { useIsMobile } from '@/hooks/use-mobile';
import CreateJourneyDialog from './CreateJourneyDialog';
import { useCreateJourneyDialog } from '@/contexts/CreateJourneyDialogContext';
import AppFooter from './AppFooter';
import { useTranslation } from 'react-i18next';
import ScrollToTopButton from './ScrollToTopButton'; // Keep for mobile
import DraggableScrollbar from './DraggableScrollbar'; // Import the new DraggableScrollbar
import { Outlet } from 'react-router-dom';

interface AppLayoutProps {
  // children: React.ReactNode; // No longer needed with Outlet
}

const AppLayout: React.FC<AppLayoutProps> = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { isCreateJourneyDialogOpen, setIsCreateJourneyDialogOpen } = useCreateJourneyDialog();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <TopBar
        setIsCreateJourneyDialogOpen={setIsCreateJourneyDialogOpen}
      />
      <div className="flex flex-grow">
        <main className="flex-grow w-full">
          <Outlet />
        </main>
      </div>

      <CreateJourneyDialog
        isOpen={isCreateJourneyDialogOpen}
        onClose={() => setIsCreateJourneyDialogOpen(false)}
      />
      <AppFooter />
      {isMobile ? <ScrollToTopButton /> : <DraggableScrollbar />} {/* Conditional rendering */}
    </div>
  );
};

export default AppLayout;