import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import { JourneyProvider } from "./contexts/JourneyContext.tsx";
import './i18n';
import { I18nextProvider, useTranslation } from 'react-i18next'; // Import useTranslation
import i18n from './i18n';
import React, { useEffect } from "react"; // Import React and useEffect

// Component to handle dynamic title updates
const TitleUpdater = () => {
  const { t } = useTranslation();

  useEffect(() => {
    const updateTitle = () => {
      document.title = t('app.htmlTitle');
    };

    // Set initial title
    updateTitle();

    // Update title when language changes
    i18n.on('languageChanged', updateTitle);

    // Cleanup event listener
    return () => {
      i18n.off('languageChanged', updateTitle);
    };
  }, [t]); // Re-run effect if 't' (translation function) changes

  return null; // This component doesn't render anything
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <TitleUpdater /> {/* Add the TitleUpdater component here */}
      <ThemeProvider defaultTheme="system" attribute="class" enableSystem>
        <AuthProvider>
          <JourneyProvider>
            <App />
          </JourneyProvider>
        </AuthProvider>
      </ThemeProvider>
    </I18nextProvider>
  </React.StrictMode>
);