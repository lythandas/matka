import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx"; // Import AuthProvider

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="system" attribute="class" enableSystem>
    <AuthProvider> {/* Wrap App with AuthProvider */}
      <App />
    </AuthProvider>
  </ThemeProvider>
);