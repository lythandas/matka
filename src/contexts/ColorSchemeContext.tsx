"use client";

import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useJourneys } from './JourneyContext';

export type ColorScheme = 'vanilla' | 'red' | 'green' | 'blue' | 'black' | 'white' | 'orange' | 'purple' | 'brown' | 'teal';

export const COLOR_SCHEMES: ColorScheme[] = [
  'vanilla', 'red', 'green', 'blue', 'black', 'white', 'orange', 'purple', 'brown', 'teal',
];

interface ColorSchemeContextType {
  activeScheme: ColorScheme | null;
  journeyScheme: string | null | undefined;
  userScheme: string | undefined;
}

const ColorSchemeContext = createContext<ColorSchemeContextType | undefined>(undefined);

// Separate provider for public pages (no auth context available)
export const PublicColorSchemeProvider: React.FC<{ journeyColorScheme: string | null | undefined; children: ReactNode }> = ({ journeyColorScheme, children }) => {
  useEffect(() => {
    const html = document.documentElement;
    // Remove any existing theme classes
    COLOR_SCHEMES.forEach(s => html.classList.remove(`theme-${s}`));

    if (journeyColorScheme && journeyColorScheme !== 'vanilla') {
      html.classList.add(`theme-${journeyColorScheme}`);
    }
  }, [journeyColorScheme]);

  return (
    <ColorSchemeContext.Provider value={{ activeScheme: (journeyColorScheme as ColorScheme) || 'vanilla', journeyScheme: journeyColorScheme, userScheme: undefined }}>
      {children}
    </ColorSchemeContext.Provider>
  );
};

export const ColorSchemeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { selectedJourney } = useJourneys();

  const userScheme = user?.color_scheme;
  const journeyScheme = selectedJourney?.color_scheme;

  // Journey scheme takes precedence over user's global scheme
  const activeScheme = journeyScheme || userScheme || 'vanilla';

  useEffect(() => {
    const html = document.documentElement;
    // Remove any existing theme classes
    COLOR_SCHEMES.forEach(s => html.classList.remove(`theme-${s}`));

    // Only add a class for non-vanilla schemes
    if (activeScheme && activeScheme !== 'vanilla') {
      html.classList.add(`theme-${activeScheme}`);
    }
  }, [activeScheme]);

  return (
    <ColorSchemeContext.Provider value={{ activeScheme: activeScheme as ColorScheme, journeyScheme, userScheme }}>
      {children}
    </ColorSchemeContext.Provider>
  );
};

export const useColorScheme = () => {
  const context = useContext(ColorSchemeContext);
  if (context === undefined) {
    throw new Error('useColorScheme must be used within a ColorSchemeProvider');
  }
  return context;
};
