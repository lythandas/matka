"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { showError, showSuccess } from '@/utils/toast';

interface Journey {
  id: string;
  name: string;
  created_at: string;
}

interface JourneyContextType {
  journeys: Journey[];
  selectedJourney: Journey | null;
  setSelectedJourney: (journey: Journey) => void;
  fetchJourneys: () => Promise<void>;
  createJourney: (name: string) => Promise<Journey | null>;
  loadingJourneys: boolean;
}

const JourneyContext = createContext<JourneyContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const JourneyProvider = ({ children }: { children: ReactNode }) => {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selectedJourney, setSelectedJourneyState] = useState<Journey | null>(null);
  const [loadingJourneys, setLoadingJourneys] = useState<boolean>(true);

  const fetchJourneys = useCallback(async () => {
    setLoadingJourneys(true);
    try {
      const response = await fetch(`${API_BASE_URL}/journeys`);
      if (!response.ok) {
        throw new Error('Failed to fetch journeys');
      }
      const data: Journey[] = await response.json();
      setJourneys(data);
      if (data.length > 0 && !selectedJourney) {
        // Set the first journey as selected if none is selected yet
        setSelectedJourneyState(data[0]);
      } else if (selectedJourney) {
        // If a journey was already selected, ensure it's still in the list
        const currentJourneyExists = data.find(j => j.id === selectedJourney.id);
        if (!currentJourneyExists) {
          setSelectedJourneyState(data[0] || null); // Fallback to first or null
        }
      }
    } catch (error) {
      console.error('Error fetching journeys:', error);
      showError('Failed to load journeys.');
    } finally {
      setLoadingJourneys(false);
    }
  }, [selectedJourney]);

  useEffect(() => {
    fetchJourneys();
  }, [fetchJourneys]);

  const createJourney = async (name: string): Promise<Journey | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/journeys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create journey');
      }

      const newJourney: Journey = await response.json();
      setJourneys((prev) => [...prev, newJourney]);
      setSelectedJourneyState(newJourney); // Automatically select the new journey
      showSuccess(`Journey '${newJourney.name}' created successfully!`);
      return newJourney;
    } catch (error: any) {
      console.error('Error creating journey:', error);
      showError(error.message || 'Failed to create journey.');
      return null;
    }
  };

  const setSelectedJourney = (journey: Journey) => {
    setSelectedJourneyState(journey);
  };

  return (
    <JourneyContext.Provider value={{ journeys, selectedJourney, setSelectedJourney, fetchJourneys, createJourney, loadingJourneys }}>
      {children}
    </JourneyContext.Provider>
  );
};

export const useJourneys = () => {
  const context = useContext(JourneyContext);
  if (context === undefined) {
    throw new Error('useJourneys must be used within a JourneyProvider');
  }
  return context;
};