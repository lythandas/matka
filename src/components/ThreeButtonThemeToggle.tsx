"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Sun, Moon, Monitor } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ThreeButtonThemeToggleProps extends React.ComponentPropsWithoutRef<typeof ToggleGroup> {}

export function ThreeButtonThemeToggle({ className, ...props }: ThreeButtonThemeToggleProps) {
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
            aria-label="Set light theme"
            className={cn("flex-1", theme === "light" && "ring-2 ring-blue-500")}
          >
            <Sun className="h-4 w-4 mr-2" /> Light
          </ToggleGroupItem>
        </TooltipTrigger>
        <TooltipContent>
          <p>Set light theme</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroupItem
            value="dark"
            aria-label="Set dark theme"
            className={cn("flex-1", theme === "dark" && "ring-2 ring-blue-500")}
          >
            <Moon className="h-4 w-4 mr-2" /> Dark
          </ToggleGroupItem>
        </TooltipTrigger>
        <TooltipContent>
          <p>Set dark theme</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroupItem
            value="system"
            aria-label="Set system theme"
            className={cn("flex-1", theme === "system" && "ring-2 ring-blue-500")}
          >
            <Monitor className="h-4 w-4 mr-2" /> System
          </ToggleGroupItem>
        </TooltipTrigger>
        <TooltipContent>
          <p>Set system theme</p>
        </TooltipContent>
      </Tooltip>
    </ToggleGroup>
  );
}