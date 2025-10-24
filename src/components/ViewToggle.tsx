"use client";

import React from 'react';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { List, Grid, Map } from 'lucide-react'; // Import Map icon
import { cn } from '@/lib/utils'; // For combining class names
import { useTranslation } from 'react-i18next'; // Import useTranslation

interface ViewToggleProps {
  viewMode: 'list' | 'grid' | 'map'; // Added 'map' to viewMode type
  onViewModeChange: (mode: 'list' | 'grid' | 'map') => void; // Added 'map' to callback type
  className?: string;
}

const ViewToggle: React.FC<ViewToggleProps> = ({ viewMode, onViewModeChange, className }) => {
  const { t } = useTranslation(); // Initialize useTranslation
  return (
    <ToggleGroup
      type="single"
      value={viewMode}
      onValueChange={(value: 'list' | 'grid' | 'map') => { // Updated onValueChange type
        if (value) onViewModeChange(value);
      }}
      className={cn("w-fit mx-auto", className)}
    >
      <ToggleGroupItem value="list" aria-label="Toggle list view">
        <List className="h-4 w-4 mr-2" /> {t('viewToggle.listView')}
      </ToggleGroupItem>
      <ToggleGroupItem value="grid" aria-label="Toggle grid view">
        <Grid className="h-4 w-4 mr-2" /> {t('viewToggle.gridView')}
      </ToggleGroupItem>
      <ToggleGroupItem value="map" aria-label="Toggle map view"> {/* New Map view toggle */}
        <Map className="h-4 w-4 mr-2" /> {t('viewToggle.mapView')}
      </ToggleGroupItem>
    </ToggleGroup>
  );
};

export default ViewToggle;