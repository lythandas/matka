"use client";

import React from 'react';
import { Compass } from 'lucide-react';

const AppFooter: React.FC = () => {
  return (
    <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm flex flex-col items-center justify-center space-y-1 mt-8">
      <div className="flex items-center space-x-2">
        <Compass className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <span className="font-semibold text-blue-600 dark:text-blue-400">Matka</span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">
        Matka means 'journey' or 'trip' in Finnish, perfectly capturing the essence of your travel and life experiences.
      </p>
      <a
        href="https://www.dyad.sh/"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        Made with Dyad
      </a>
    </div>
  );
};

export default AppFooter;