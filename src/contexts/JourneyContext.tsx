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
  fetchJourneys: () => Promise<void>;
  createJourney: (name: string) => Promise<Journey | null>;
  loadingJourneys: boolean;
}

const JourneyContext = createContext<JourneyContextType | undefined>(undefined);

export const JourneyProvider = ({ children }: { children: ReactNode }) => {
  const { token, isAuthenticated } = useAuth(); // Get token and isAuthenticated from AuthContext
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selectedJourney, setSelectedJourneyState] = useState<Journey | null>(null);
  const [loadingJourneys, setLoadingJourneys] = useState<boolean>(true);

  const fetchJourneys = useCallback(async () => {
    setLoadingJourneys(true);
    try {
      if (!token) {
        // If no token, clear journeys and stop loading
        setJourneys([]);
        setSelectedJourneyState(null);
        setLoadingJourgers(false);
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

      // Update selectedJourney with the latest data if it exists
      if (selectedJourney) {
        const updatedSelectedJourney = data.find(j => j.id === selectedJourney.id);
        if (updatedSelectedJourney) {
          setSelectedJourneyState(updatedSelectedJourney);
        } else {
          // If previously selected journey no longer exists, select the first one or null
          setSelectedJourneyState(data[0] || null);
        }
      } else if (data.length > 0) {
        // If no journey was selected, select the first one
        setSelectedJourneyState(data[0]);
      }
    } catch (error) {
      console.error('Error fetching journeys:', error);
      showError('Failed to load journeys.');
    } finally {
      setLoadingJourneys(false);
    }
  }, [selectedJourney, token]); // Add token to dependencies

  useEffect(() => {
    // Only fetch if authenticated and token is available
    if (isAuthenticated && token) {
      fetchJourneys();
    } else if (!isAuthenticated) {
      // If not authenticated, clear journeys and stop loading
      setJourneys([]);
      setSelectedJourneyState(null);
      setLoadingJourneys(false);
    }
  }, [isAuthenticated, token, fetchJourneys]); // Update useEffect dependencies

  const createJourney = async (name: string): Promise<Journey | null> => {
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