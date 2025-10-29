"use client";

import React from 'react';
import { Outlet } from 'react-router-dom';
import { Compass, Lock } from 'lucide-react';
import AppFooter from './AppFooter';
import { useTranslation } from 'react-i18next';
import { Journey } from '@/types'; // Import Journey type

interface PublicPageLayoutProps {
  journey?: Journey | null; // Optional journey prop to display its name
  isProtected?: boolean; // Optional prop to indicate if the journey is passphrase protected
}

const PublicPageLayout: React.FC<PublicPageLayoutProps> = ({ journey, isProtected = false }) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="flex items-center justify-between py-4 px-4 sm:px-6 lg:px-8 border-b dark:border-gray-800 bg-background sticky top-0 z-30">
        <div className="flex items-center">
          <Compass className="mr-2 h-6 w-6 text-blue-600 dark:text-foreground" />
          <h1 className="text-2xl font-extrabold text-blue-600 dark:text-foreground">{t('app.name')}</h1>
        </div>
        {journey && (
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">{journey.name}</h2>
            {isProtected && (
              <Lock className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        )}
      </header>

      <div className="flex-grow">
        <Outlet /> {/* Renders the child route component */}
      </div>

      <AppFooter />
    </div>
  );
};

export default PublicPageLayout;