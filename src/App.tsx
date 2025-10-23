"use client";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AppLayout from "./components/AppLayout";
import { CreateJourneyDialogProvider } from "./contexts/CreateJourneyDialogContext";
import LoginPage from "./pages/LoginPage";
import AdminPage from "./pages/AdminPage"; // Import AdminPage
import PublicJourneyPage from "./pages/PublicJourneyPage"; // Import PublicJourneyPage
import { useAuth } from "./contexts/AuthContext";
import { useJourneys } from "./contexts/JourneyContext"; // Import useJourneys

const queryClient = new QueryClient();

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

const App = () => {
  const { isAuthenticated } = useAuth();
  // Removed posts and selectedDate from App component as they are now managed within Index.tsx
  // and passed to AppLayout from there.

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <CreateJourneyDialogProvider>
            {isAuthenticated ? (
              <AppLayout> {/* AppLayout now wraps the authenticated routes */}
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
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AppLayout>
            ) : (
              <Routes>
                <Route path="/public-journey/:ownerUsername/:journeyName" element={<PublicJourneyPage />} /> {/* New public route with human-readable URL */}
                <Route path="/" element={<LoginPage />} />
                {/* Redirect any other path to login if not authenticated */}
                <Route path="*" element={
                  // If not authenticated and not on a public journey page, redirect to login
                  window.location.pathname.startsWith('/public-journey/') ? <NotFound /> : <Navigate to="/" replace />
                } />
              </Routes>
            )}
          </CreateJourneyDialogProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;