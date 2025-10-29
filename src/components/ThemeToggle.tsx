"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Monitor } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from 'react-i18next'; // Import useTranslation

interface ThemeToggleProps extends React.ComponentPropsWithoutRef<typeof Button> {}

export function ThemeToggle({ className, ...props }: ThemeToggleProps) {
  const { t } = useTranslation(); // Initialize useTranslation
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
    if (theme === "light") return t('themeToggle.toggleDarkTheme');
    if (theme === "dark") return t('themeToggle.toggleSystemTheme');
    return t('themeToggle.toggleLightTheme');
  }, [theme, t]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          onClick={cycleTheme}
          className="hover:ring-2 hover:ring-blue-500 hover:bg-transparent hover:text-inherit"
          aria-label={tooltipText}
          {...props}
        >
          <Icon className="h-7 w-7" /> {/* Increased icon size here */}
          <span className="sr-only">{tooltipText}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}