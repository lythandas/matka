import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"; // Import Navigate
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AppLayout from "./components/AppLayout";
import { CreateJourneyDialogProvider } from "./contexts/CreateJourneyDialogContext";
import LoginPage from "./pages/LoginPage"; // Import LoginPage
import { useAuth } from "./contexts/AuthContext"; // Import useAuth

const queryClient = new QueryClient();

const App = () => {
  const { isAuthenticated, usersExist } = useAuth(); // Use useAuth here

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <CreateJourneyDialogProvider>
            {/* Conditionally render AppLayout or LoginPage */}
            {isAuthenticated ? (
              <AppLayout>
                <Routes>
                  <Route path="/" element={<Index />} />
                  {/* Removed AdminPage route */}
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