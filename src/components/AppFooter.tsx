"use client";

import React from 'react';
import { Compass } from 'lucide-react';

const AppFooter: React.FC = () => {
  return (
    <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm flex flex-col items-center justify-center space-y-1 mt-8">
      <div className="flex flex-col items-center space-y-1 mb-1"> {/* Changed to flex-col and added margin-bottom */}
        <Compass className="h-5 w-5 text-blue-600 dark:text-blue-400" /> {/* Slightly larger icon */}
        <span className="font-bold text-lg text-blue-600 dark:text-blue-400">Matka</span> {/* Larger and bolder text */}
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