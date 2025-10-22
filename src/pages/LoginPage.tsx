"use client";

import React, { useState, useEffect } from 'react';
import { Compass, Loader2 } from 'lucide-react';
import LoginDialog from '@/components/LoginDialog';
import RegisterDialog from '@/components/RegisterDialog';
import { useAuth } from '@/contexts/AuthContext';
import { fetchRandomWikimediaLandscapeImage, WikimediaImage } from '@/utils/wikimedia'; // Updated import
import { showError } from '@/utils/toast';

const LoginPage: React.FC = () => {
  const { isAuthenticated, usersExist, fetchUsersExist } = useAuth();
  const [showRegister, setShowRegister] = useState<boolean>(false);
  const [backgroundImage, setBackgroundImage] = useState<WikimediaImage | null>(null); // Updated type
  const [loadingImage, setLoadingImage] = useState<boolean>(true);

  useEffect(() => {
    // Fetch user existence status on component mount
    fetchUsersExist();
  }, [fetchUsersExist]);

  useEffect(() => {
    // Determine whether to show register or login dialog
    if (usersExist !== null) {
      setShowRegister(usersExist === false);
    }
  }, [usersExist]);

  useEffect(() => {
    const loadBackgroundImage = async () => {
      setLoadingImage(true);
      try {
        const image = await fetchRandomWikimediaLandscapeImage(); // Use the new async utility
        if (image) {
          setBackgroundImage(image);
          console.log("Attempting to load background image from URL:", image.url); // Log the URL
        } else {
          // Fallback if image fetching fails
          setBackgroundImage(null);
          showError("Failed to load background image from Wikimedia. Please check the utility file.");
        }
      } catch (error) {
        console.error("Error loading background image:", error);
        setBackgroundImage(null);
        showError("Failed to load background image.");
      } finally {
        setLoadingImage(false);
      }
    };

    loadBackgroundImage();
  }, []);

  // If already authenticated, this page shouldn't be shown
  if (isAuthenticated) {
    return null; // Or redirect to home, but App.tsx handles routing
  }

  const handleRegistrationSuccess = () => {
    fetchUsersExist(); // Re-check user status after registration
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden">
      {loadingImage ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : backgroundImage ? (
        <img
          src={backgroundImage.url}
          alt={backgroundImage.alt}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out"
          style={{ opacity: 1 }}
          onError={(e) => { // Added onError handler
            console.error("Failed to load background image:", e.currentTarget.src);
            showError("Failed to load background image. Please check the console for details.");
            setBackgroundImage(null); // Fallback to plain background on error
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-background" />
      )}

      {/* Removed the overlay div */}

      {/* Matka Logo and Name (White) */}
      <div className="absolute top-6 left-6 flex items-center z-10">
        <Compass className="mr-2 h-8 w-8 text-white" />
        <h1 className="text-3xl font-extrabold text-white">Matka</h1>
      </div>

      {/* Photographer Credit (White with hover) */}
      {backgroundImage && (
        <div className="absolute bottom-4 right-4 text-xs text-white/70 z-10">
          Photo by{' '}
          <a
            href={backgroundImage.photographerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white"
          >
            {backgroundImage.photographer}
          </a>{' '}
          on{' '}
          <a
            href="https://commons.wikimedia.org/wiki/Main_Page"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white"
          >
            Wikimedia Commons
          </a>
        </div>
      )}

      {/* Central Dialog */}
      <div className="relative z-10 p-4">
        {usersExist === null ? (
          <div className="flex flex-col items-center justify-center p-8 bg-card rounded-lg shadow-2xl max-w-sm w-full text-card-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-lg">Checking user status...</p>
          </div>
        ) : showRegister ? (
          <RegisterDialog onRegistrationSuccess={handleRegistrationSuccess} />
        ) : (
          <LoginDialog />
        )}
      </div>
    </div>
  );
};

export default LoginPage;