"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CreateJourneyDialogContextType {
  isCreateJourneyDialogOpen: boolean;
  setIsCreateJourneyDialogOpen: (isOpen: boolean) => void;
}

const CreateJourneyDialogContext = createContext<CreateJourneyDialogContextType | undefined>(undefined);

export const CreateJourneyDialogProvider = ({ children }: { children: ReactNode }) => {
  const [isCreateJourneyDialogOpen, setIsCreateJourneyDialogOpen] = useState<boolean>(false);

  return (
    <CreateJourneyDialogContext.Provider value={{ isCreateJourneyDialogOpen, setIsCreateJourneyDialogOpen }}>
      {children}
    </CreateJourneyDialogContext.Provider>
  );
};

export const useCreateJourneyDialog = () => {
  const context = useContext(CreateJourneyDialogContext);
  if (context === undefined) {
    throw new Error('useCreateJourneyDialog must be used within a CreateJourneyDialogProvider');
  }
  return context;
};