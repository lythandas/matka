"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { showError, showSuccess } from '@/utils/toast';
import { useAuth } from './AuthContext'; // Import useAuth
import { API_BASE_URL } from '@/config/api'; // Centralized API_BASE_URL
import { Journey } from '@/types'; // Centralized Journey interface

interface JourneyContextType {
  journeys: Journey[];
  selectedJourney: Journey | null;
  setSelectedJourney: (journey: Journey) => void;
  fetchJourneys: () => Promise<void>; // Renamed to reflect it fetches the list
  createJourney: (name: string, is_public?: boolean, passphrase?: string) => Promise<Journey | null>; // Updated signature
  loadingJourneys: boolean;
}

const JourneyContext = createContext<JourneyContextType | undefined>(undefined);

export const JourneyProvider = ({ children }: { children: ReactNode }) => {
  const { token, isAuthenticated } = useAuth(); // Get token and isAuthenticated from AuthContext
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selectedJourney, setSelectedJourneyState] = useState<Journey | null>(null);
  const [loadingJourneys, setLoadingJourneys] = useState<boolean>(true);

  // This function only fetches and sets the list of journeys.
  // It does NOT contain logic for setting the selectedJourney based on previous state.
  const fetchJourneysList = useCallback(async () => {
    setLoadingJourneys(true);
    try {
      if (!token) {
        setJourneys([]);
        setLoadingJourneys(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/journeys`, {
        headers: {
          'Authorization': `Bearer ${token}`, // Include the authentication token
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch journeys');
      }
      const data: Journey[] = await response.json();
      setJourneys(data);
    } catch (error) {
      console.error('Error fetching journeys:', error);
      showError('Failed to load journeys.');
      setJourneys([]); // Clear journeys on error
    } finally {
      setLoadingJourneys(false);
    }
  }, [token]); // fetchJourneysList only depends on token, making it stable

  // Effect to trigger fetching journeys when authentication state or token changes
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchJourneysList();
    } else if (!isAuthenticated) {
      // If not authenticated, clear journeys and selected journey
      setJourneys([]);
      setSelectedJourneyState(null);
      setLoadingJourneys(false);
    }
  }, [isAuthenticated, token, fetchJourneysList]);

  // Effect to handle selectedJourney logic when the list of journeys changes
  useEffect(() => {
    if (journeys.length > 0) {
      // If a journey was previously selected, try to find its updated version
      if (selectedJourney) {
        const updatedSelectedJourney = journeys.find(j => j.id === selectedJourney.id);
        if (updatedSelectedJourney) {
          setSelectedJourneyState(updatedSelectedJourney);
        } else {
          // If the previously selected journey no longer exists, select the first one
          setSelectedJourneyState(journeys[0]);
        }
      } else {
        // If no journey was selected, select the first one
        setSelectedJourneyState(journeys[0]);
      }
    } else {
      // If there are no journeys, clear selected journey
      setSelectedJourneyState(null);
    }
  }, [journeys]); // This effect only depends on journeys, breaking the loop

  const createJourney = async (name: string, is_public: boolean = false, passphrase?: string): Promise<Journey | null> => {
    if (!token) {
      showError('Authentication required to create a journey.');
      return null;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/journeys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // Include the authentication token
        },
        body: JSON.stringify({ name, is_public, passphrase }), // Pass is_public and passphrase
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create journey');
      }

      const newJourney: Journey = await response.json();
      showSuccess(`Journey '${newJourney.name}' created successfully!`);
      await fetchJourneysList(); // Re-fetch all journeys to update the list
      setSelectedJourneyState(newJourney); // Explicitly select the newly created journey
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
    <JourneyContext.Provider value={{ journeys, selectedJourney, setSelectedJourney, fetchJourneys: fetchJourneysList, createJourney, loadingJourneys }}>
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