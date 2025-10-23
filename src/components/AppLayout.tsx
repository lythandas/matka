"use client";

import React, { useState } from 'react';
import TopBar from './TopBar';
import { useIsMobile } from '@/hooks/use-mobile';
import CreateJourneyDialog from './CreateJourneyDialog'; // Import CreateJourneyDialog
import { useCreateJourneyDialog } from '@/contexts/CreateJourneyDialogContext'; // New import
import PostCalendar from './PostCalendar'; // Import PostCalendar
import { Post } from '@/types'; // Import Post type

interface AppLayoutProps {
  children: React.ReactNode;
  posts?: Post[]; // Pass posts to AppLayout
  selectedDate?: Date; // Pass selectedDate to AppLayout
  onDateSelect?: (date: Date | undefined) => void; // Pass onDateSelect to AppLayout
}

const AppLayout: React.FC<AppLayoutProps> = ({ children, posts, selectedDate, onDateSelect }) => {
  const isMobile = useIsMobile();
  const { isCreateJourneyDialogOpen, setIsCreateJourneyDialogOpen } = useCreateJourneyDialog();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <TopBar
        setIsCreateJourneyDialogOpen={setIsCreateJourneyDialogOpen}
      />
      <div className="flex flex-grow">
        {!isMobile && (
          <aside className="w-64 p-4 border-r dark:border-gray-800 bg-background sticky top-0 h-[calc(100vh-64px)] overflow-y-auto"> {/* Fixed sidebar */}
            <PostCalendar
              posts={posts || []}
              selectedDate={selectedDate}
              onDateSelect={onDateSelect || (() => {})}
            />
          </aside>
        )}
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