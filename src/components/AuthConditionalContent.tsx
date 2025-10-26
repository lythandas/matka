"use client";

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import Index from '@/pages/Index';
import AdminPage from '@/pages/AdminPage';
import LoginPage from '@/pages/LoginPage';
import NotFound from '@/pages/NotFound';
import PublicJourneyPage from '@/pages/PublicJourneyPage';

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
          {/* Public journey route is still accessible even if authenticated,
              but PublicJourneyPage itself will redirect if user has access. */}
          <Route path="/public-journey/:ownerUsername/:journeyName" element={<PublicJourneyPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    );
  } else {
    return (
      <Routes>
        <Route path="/public-journey/:ownerUsername/:journeyName" element={<PublicJourneyPage />} />
        <Route path="/" element={<LoginPage />} />
        {/* Redirect any other path to login if not authenticated */}
        <Route path="*" element={
          // If not authenticated and not on a public journey page, redirect to login
          window.location.pathname.startsWith('/public-journey/') ? <NotFound /> : <Navigate to="/" replace />
        } />
      </Routes>
    );
  }
};

export default AuthConditionalContent;