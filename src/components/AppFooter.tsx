"use client";

import React from 'react';
import { Compass } from 'lucide-react';

const AppFooter: React.FC = () => {
  return (
    <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm flex flex-col items-center justify-center space-y-1 mt-8">
      <div className="flex flex-col items-center space-y-1 mb-1">
        <Compass className="h-5 w-5 text-border dark:text-foreground" />
        <span className="font-bold text-lg text-border dark:text-foreground">Matka</span>
      </div>
      {/* Removed the haiku/descriptive text */}
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