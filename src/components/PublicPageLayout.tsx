"use client";

import React, { useState, useCallback } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { Compass, Lock } from 'lucide-react';
import AppFooter from './AppFooter';
import { useTranslation } from 'react-i18next';
import { Journey } from '@/types'; // Import Journey type

// Define the context type that PublicPageLayout will provide
interface PublicPageLayoutContextType {
  setJourney: (journey: Journey | null) => void;
  setIsProtected: (isProtected: boolean) => void;
}

interface PublicPageLayoutProps {
  // No longer needs journey or isProtected props from AuthConditionalContent
}

const PublicPageLayout: React.FC<PublicPageLayoutProps> = () => {
  const { t } = useTranslation();
  const [currentJourney, setCurrentJourney] = useState<Journey | null>(null);
  const [currentIsProtected, setCurrentIsProtected] = useState<boolean>(false);

  const setJourney = useCallback((journey: Journey | null) => {
    setCurrentJourney(journey);
  }, []);

  const setIsProtected = useCallback((isProtected: boolean) => {
    setCurrentIsProtected(isProtected);
  }, []);

  const ownerDisplayName = currentJourney?.owner_name && currentJourney?.owner_surname
    ? `${currentJourney.owner_name} ${currentJourney.owner_surname}`
    : currentJourney?.owner_name || currentJourney?.owner_username;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="flex items-center justify-between py-4 px-4 sm:px-6 lg:px-8 border-b dark:border-gray-800 bg-background sticky top-0 z-30">
        <div className="flex items-center">
          <Compass className="mr-2 h-6 w-6 text-blue-600 dark:text-foreground" />
          <h1 className="text-2xl font-extrabold text-blue-600 dark:text-foreground">{t('app.name')}</h1>
        </div>
        {currentJourney && (
          <div className="flex items-baseline space-x-2"> {/* Changed to items-baseline for better alignment */}
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
              {currentJourney.name}
            </h2>
            {ownerDisplayName && (
              <p className="text-base font-normal text-gray-600 dark:text-gray-400">
                {t('publicJourneyPage.byOwner', { owner: ownerDisplayName })}
              </p>
            )}
            {currentIsProtected && (
              <Lock className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        )}
      </header>

      <div className="flex-grow">
        <Outlet context={{ setJourney, setIsProtected }} /> {/* Pass context here */}
      </div>

      <AppFooter />
    </div>
  );
};

export default PublicPageLayout;