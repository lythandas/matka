"use client";

import * as React from "react";
import { useTheme } from "next-themes";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils"; // Import cn utility

interface ThemeToggleProps extends React.ComponentPropsWithoutRef<typeof ToggleGroup> {}

export function ThemeToggle({ className, ...props }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  return (
    <ToggleGroup
      type="single"
      value={theme}
      onValueChange={(value: "light" | "dark" | "system") => {
        if (value) setTheme(value);
      }}
      className={cn("w-full justify-start", className)}
      {...props}
    >
      <ToggleGroupItem value="light" aria-label="Toggle light theme" className="flex-1">
        Light
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" aria-label="Toggle dark theme" className="flex-1">
        Dark
      </ToggleGroupItem>
      <ToggleGroupItem value="system" aria-label="Toggle system theme" className="flex-1">
        System
      </ToggleGroupItem>
    </ToggleGroup>
  );
}