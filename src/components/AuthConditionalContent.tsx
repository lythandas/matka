"use client";

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import Index from '@/pages/Index';
import AdminPage from '@/pages/AdminPage';
import LoginPage from '@/pages/LoginPage';
import NotFound from '@/pages/NotFound';
import PublicJourneyPage from '@/pages/PublicJourneyPage';
import PublicPageLayout from './PublicPageLayout';

// ProtectedRoute component to guard admin access
const ProtectedRoute = ({ children, adminOnly = false }: { children: JSX.Element; adminOnly?: boolean }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (adminOnly && !user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const AuthConditionalContent: React.FC = () => {
  const { isAuthenticated, isAuthLoading } = useAuth();

  // Show a loading spinner while validating the stored token
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Journey Route - always uses PublicPageLayout */}
      <Route path="/public-journey/:publicLinkId" element={<PublicPageLayout />}>
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
