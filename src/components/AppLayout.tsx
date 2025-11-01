"use client";

import React from 'react';
import TopBar from './TopBar';
import { useIsMobile } from '@/hooks/use-mobile';
import CreateJourneyDialog from './CreateJourneyDialog';
import { useCreateJourneyDialog } from '@/contexts/CreateJourneyDialogContext';
import AppFooter from './AppFooter'; // Import AppFooter
import { useTranslation } from 'react-i18next'; // Import useTranslation
import ScrollIndicator from './ScrollIndicator'; // Import the new ScrollIndicator component
import { Outlet } from 'react-router-dom'; // Import Outlet

interface AppLayoutProps {
  // children: React.ReactNode; // No longer needed with Outlet
}

const AppLayout: React.FC<AppLayoutProps> = () => {
  const { t } = useTranslation(); // Initialize useTranslation
  const isMobile = useIsMobile();
  const { isCreateJourneyDialogOpen, setIsCreateJourneyDialogOpen } = useCreateJourneyDialog();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <TopBar
        setIsCreateJourneyDialogOpen={setIsCreateJourneyDialogOpen}
      />
      <div className="flex flex-grow">
        <main className="flex-grow w-full">
          <Outlet /> {/* Renders the child route component */}
        </main>
      </div>

      <CreateJourneyDialog
        isOpen={isCreateJourneyDialogOpen}
        onClose={() => setIsCreateJourneyDialogOpen(false)}
      />
      <AppFooter />
      <ScrollIndicator /> {/* Render the new ScrollIndicator here */}
    </div>
  );
};

export default AppLayout;