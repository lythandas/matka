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
import { useAuth } from "./contexts/AuthContext";

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

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <CreateJourneyDialogProvider>
            {isAuthenticated ? (
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
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AppLayout>
            ) : (
              <Routes>
                <Route path="/" element={<LoginPage />} />
                {/* Redirect any other path to login if not authenticated */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            )}
          </CreateJourneyDialogProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;