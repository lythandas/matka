"use client";

import React, { useState, useEffect } from 'react';
import { Compass, Loader2 } from 'lucide-react';
import LoginDialog from '@/components/LoginDialog';
import RegisterDialog from '@/components/RegisterDialog';
import { useAuth } from '@/contexts/AuthContext';
import { fetchRandomLandscapeImage } from '@/utils/unsplash'; // Import the utility
import { showError } from '@/utils/toast';

interface UnsplashImageInfo {
  url: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
}

const LoginPage: React.FC = () => {
  const { isAuthenticated, usersExist, fetchUsersExist } = useAuth();
  const [showRegister, setShowRegister] = useState<boolean>(false);
  const [backgroundImage, setBackgroundImage] = useState<UnsplashImageInfo | null>(null);
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
        const image = await fetchRandomLandscapeImage();
        if (image) {
          setBackgroundImage({
            url: image.urls.full,
            alt: image.alt_description || 'Random landscape',
            photographer: image.user.name,
            photographerUrl: image.user.links.html,
          });
        } else {
          // Fallback if image fetching fails
          setBackgroundImage(null);
          showError("Failed to load background image. Please check your Unsplash API key or network.");
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

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden">
      {loadingImage ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-900">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        </div>
      ) : backgroundImage ? (
        <img
          src={backgroundImage.url}
          alt={backgroundImage.alt}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out"
          style={{ opacity: 1 }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 dark:from-gray-800 dark:to-gray-900" />
      )}

      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Matka Logo and Name */}
      <div className="absolute top-6 left-6 flex items-center z-10">
        <Compass className="mr-2 h-8 w-8 text-white" />
        <h1 className="text-3xl font-extrabold text-white">Matka</h1>
      </div>

      {/* Photographer Credit */}
      {backgroundImage && (
        <div className="absolute bottom-4 right-4 text-xs text-white/70 z-10">
          Photo by{' '}
          <a
            href={backgroundImage.photographerUrl + '?utm_source=Matka&utm_medium=referral'}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white"
          >
            {backgroundImage.photographer}
          </a>{' '}
          on{' '}
          <a
            href="https://unsplash.com/?utm_source=Matka&utm_medium=referral"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white"
          >
            Unsplash
          </a>
        </div>
      )}

      {/* Central Dialog */}
      <div className="relative z-10 p-4">
        {usersExist === null ? (
          <div className="flex flex-col items-center justify-center p-8 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow-2xl max-w-sm w-full">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
            <p className="text-lg text-gray-700 dark:text-gray-300">Checking user status...</p>
          </div>
        ) : showRegister ? (
          <RegisterDialog
            isOpen={true} // Always open when rendered
            onClose={() => {
              // After registration, force a re-check of usersExist
              fetchUsersExist();
              setShowRegister(false); // Attempt to close, though it will re-open as login
            }}
          />
        ) : (
          <LoginDialog
            isOpen={true} // Always open when rendered
            onClose={() => {
              // After login, this component will unmount due to isAuthenticated check
            }}
          />
        )}
      </div>
    </div>
  );
};

export default LoginPage;