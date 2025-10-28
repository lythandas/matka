"use client";

import React from 'react';
import TopBar from './TopBar';
import { useIsMobile } from '@/hooks/use-mobile';
import CreateJourneyDialog from './CreateJourneyDialog';
import { useCreateJourneyDialog } from '@/contexts/CreateJourneyDialogContext';
import AppFooter from './AppFooter'; // Import AppFooter
import { useTranslation } from 'react-i18next'; // Import useTranslation
import ScrollToTopButton from './ScrollToTopButton'; // Import the new component

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { t } = useTranslation(); // Initialize useTranslation
  const isMobile = useIsMobile();
  const { isCreateJourneyDialogOpen, setIsCreateJourneyDialogOpen } = useCreateJourneyDialog();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <TopBar
        setIsCreateJourneyDialogOpen={setIsCreateJourneyDialogOpen}
      />
      <div className="flex flex-grow">
        <main className="flex-grow w-full"> {/* Removed max-w-3xl mx-auto and padding from here */}
          {children}
        </main>
      </div>

      <CreateJourneyDialog
        isOpen={isCreateJourneyDialogOpen}
        onClose={() => setIsCreateJourneyDialogOpen(false)}
      />
      <AppFooter /> {/* AppFooter moved here */}
      <ScrollToTopButton /> {/* Add the ScrollToTopButton here */}
    </div>
  );
};

export default AppLayout;