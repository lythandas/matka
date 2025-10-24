import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import { JourneyProvider } from "./contexts/JourneyContext.tsx"; // Import JourneyProvider
import './i18n'; // Import i18n configuration
import { I18nextProvider } from 'react-i18next'; // Import I18nextProvider
import i18n from './i18n'; // Import the i18n instance

createRoot(document.getElementById("root")!).render(
  <I18nextProvider i18n={i18n}> {/* Wrap with I18nextProvider */}
    <ThemeProvider defaultTheme="system" attribute="class" enableSystem>
      <AuthProvider>
        <JourneyProvider> {/* Wrap App with JourneyProvider */}
          <App />
        </JourneyProvider>
      </AuthProvider>
    </ThemeProvider>
  </I18nextProvider>
);