"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { Compass, Lock } from 'lucide-react';
import AppFooter from './AppFooter';
import { useTranslation } from 'react-i18next';
import { Journey } from '@/types'; // Import Journey type
import { COLOR_SCHEMES } from '@/contexts/ColorSchemeContext';

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

  // Apply journey color scheme for public visitors
  useEffect(() => {
    const html = document.documentElement;
    COLOR_SCHEMES.forEach(s => html.classList.remove(`theme-${s}`));
    const scheme = currentJourney?.color_scheme;
    if (scheme && scheme !== 'vanilla') {
      html.classList.add(`theme-${scheme}`);
    }
    // Cleanup on unmount — remove theme classes when leaving public page
    return () => {
      COLOR_SCHEMES.forEach(s => html.classList.remove(`theme-${s}`));
    };
  }, [currentJourney?.color_scheme]);

  const ownerDisplayName = currentJourney?.owner_name && currentJourney?.owner_surname
    ? `${currentJourney.owner_name} ${currentJourney.owner_surname}`
    : currentJourney?.owner_name || currentJourney?.owner_username;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="flex items-center justify-between py-4 px-4 sm:px-6 lg:px-8 border-b border-border bg-background sticky top-0 z-30">
        <div className="flex items-center">
          <Compass className="mr-2 h-6 w-6 text-foreground" />
          <h1 className="text-2xl font-extrabold text-foreground">{t('app.name')}</h1>
        </div>
        {currentJourney && (
          <div className="flex items-baseline space-x-2">
            <h2 className="text-xl font-semibold text-foreground">
              {currentJourney.name}
            </h2>
            {ownerDisplayName && (
              <span className="text-base font-normal text-muted-foreground">
                {t('publicJourneyPage.byOwner', { owner: ownerDisplayName })}
              </span>
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