"use client";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { CreateJourneyDialogProvider } from "./contexts/CreateJourneyDialogContext";
import AuthConditionalContent from "./components/AuthConditionalContent"; // Import the new component

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Sonner />
      <TooltipProvider>
        <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <CreateJourneyDialogProvider>
            <AuthConditionalContent /> {/* Render the conditional content here */}
          </CreateJourneyDialogProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;