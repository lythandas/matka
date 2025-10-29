"use client";

import React from 'react';
import { Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // Import useTranslation

const AppFooter: React.FC = () => {
  const { t } = useTranslation(); // Initialize useTranslation
  return (
    <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center flex-wrap gap-x-2 gap-y-1 mt-8">
      <div className="flex items-center gap-x-1">
        <Compass className="h-5 w-5 text-blue-600 dark:text-foreground" />
        <span className="font-bold text-blue-600 dark:text-foreground">{t('app.name')}</span>
      </div>
      <span className="text-gray-500 dark:text-gray-400">-</span>
      <a
        href="https://www.dyad.sh/"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        {t('app.footer')}
      </a>
    </div>
  );
};

export default AppFooter;