"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button"; // Import Button component
import { Sun, Moon, Monitor } from "lucide-react"; // Import icons

interface ThemeToggleProps extends React.ComponentPropsWithoutRef<typeof Button> {}

export function ThemeToggle({ className, ...props }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  const Icon = React.useMemo(() => {
    if (theme === "light") return Sun;
    if (theme === "dark") return Moon;
    return Monitor;
  }, [theme]);

  const tooltipText = React.useMemo(() => {
    if (theme === "light") return "Toggle dark theme";
    if (theme === "dark") return "Toggle system theme";
    return "Toggle light theme";
  }, [theme]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
      aria-label={tooltipText}
      {...props}
    >
      <Icon className="h-5 w-5" />
      <span className="sr-only">{tooltipText}</span>
    </Button>
  );
}