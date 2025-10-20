import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import { JourneyProvider } from "./contexts/JourneyContext.tsx"; // Import JourneyProvider

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="system" attribute="class" enableSystem>
    <AuthProvider>
      <JourneyProvider> {/* Wrap App with JourneyProvider */}
        <App />
      </JourneyProvider>
    </AuthProvider>
  </ThemeProvider>
);