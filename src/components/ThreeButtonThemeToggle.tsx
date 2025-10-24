"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Sun, Moon, Monitor } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTranslation } from 'react-i18next'; // Import useTranslation

interface ThreeButtonThemeToggleProps extends React.ComponentPropsWithoutRef<typeof ToggleGroup> {}

export function ThreeButtonThemeToggle({ className, ...props }: ThreeButtonThemeToggleProps) {
  const { t } = useTranslation(); // Initialize useTranslation
  const { theme, setTheme } = useTheme();

  return (
    <ToggleGroup
      type="single"
      value={theme}
      onValueChange={(value: "light" | "dark" | "system") => {
        if (value) setTheme(value);
      }}
      className={cn("grid grid-cols-3 w-full", className)}
      {...props}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroupItem
            value="light"
            aria-label={t('themeToggle.toggleLightTheme')}
            className={cn("flex-1", theme === "light" && "ring-2 ring-blue-500")}
          >
            <Sun className="h-4 w-4 mr-2" /> {t('themeToggle.light')}
          </ToggleGroupItem>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('themeToggle.toggleLightTheme')}</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroupItem
            value="dark"
            aria-label={t('themeToggle.toggleDarkTheme')}
            className={cn("flex-1", theme === "dark" && "ring-2 ring-blue-500")}
          >
            <Moon className="h-4 w-4 mr-2" /> {t('themeToggle.dark')}
          </ToggleGroupItem>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('themeToggle.toggleDarkTheme')}</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroupItem
            value="system"
            aria-label={t('themeToggle.toggleSystemTheme')}
            className={cn("flex-1", theme === "system" && "ring-2 ring-blue-500")}
          >
            <Monitor className="h-4 w-4 mr-2" /> {t('themeToggle.system')}
          </ToggleGroupItem>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('themeToggle.toggleSystemTheme')}</p>
        </TooltipContent>
      </Tooltip>
    </ToggleGroup>
  );
}