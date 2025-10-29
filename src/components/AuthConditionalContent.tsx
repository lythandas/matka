"use client";

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import Index from '@/pages/Index';
import AdminPage from '@/pages/AdminPage';
import LoginPage from '@/pages/LoginPage';
import NotFound from '@/pages/NotFound';
import PublicJourneyPage from '@/pages/PublicJourneyPage'; // Import the new PublicJourneyPage
import PublicPageLayout from './PublicPageLayout'; // Import the new PublicPageLayout

// ProtectedRoute component to guard admin access
const ProtectedRoute = ({ children, adminOnly = false }: { children: JSX.Element; adminOnly?: boolean }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (adminOnly && !user?.isAdmin) {
    // Optionally show an error toast here
    return <Navigate to="/" replace />;
  }

  return children;
};

const AuthConditionalContent: React.FC = () => {
  const { isAuthenticated, user } = useAuth(); // Get user to pass to PublicPageLayout

  return (
    <Routes>
      {/* Public Journey Route - always uses PublicPageLayout */}
      <Route path="/public-journey/:publicLinkId" element={<PublicPageLayout journey={user?.currentPublicJourney} isProtected={user?.currentPublicJourney?.has_passphrase} />}>
        <Route index element={<PublicJourneyPage />} />
      </Route>

      {isAuthenticated ? (
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Index />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          {/* ADD ALL CUSTOM AUTHENTICATED ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Route>
      ) : (
        <>
          <Route path="/" element={<LoginPage />} />
          {/* Redirect any other path to login if not authenticated, unless it's a public journey */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      )}
    </Routes>
  );
};

export default AuthConditionalContent;