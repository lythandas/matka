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
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return (
      <AppLayout>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          {/* NEW: Public journey route - accessible even when authenticated */}
          <Route path="/public-journey/:publicLinkId" element={<PublicJourneyPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    );
  } else {
    return (
      <Routes>
        {/* NEW: Public journey route - accessible when not authenticated */}
        <Route path="/public-journey/:publicLinkId" element={<PublicJourneyPage />} />
        <Route path="/" element={<LoginPage />} />
        {/* Redirect any other path to login if not authenticated */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }
};

export default AuthConditionalContent;