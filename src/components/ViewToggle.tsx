"use client";

import React from 'react';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { List, Grid, Map } from 'lucide-react'; // Import Map icon
import { cn } from '@/lib/utils'; // For combining class names
import { useTranslation } from 'react-i18next'; // Import useTranslation
import { useIsMobile } from '@/hooks/use-mobile'; // Import useIsMobile

interface ViewToggleProps {
  viewMode: 'list' | 'grid' | 'map'; // Added 'map' to viewMode type
  onViewModeChange: (mode: 'list' | 'grid' | 'map') => void; // Added 'map' to callback type
  className?: string;
}

const ViewToggle: React.FC<ViewToggleProps> = ({ viewMode, onViewModeChange, className }) => {
  const { t } = useTranslation(); // Initialize useTranslation
  const isMobile = useIsMobile(); // Determine if it's a mobile view

  return (
    <ToggleGroup
      type="single"
      value={viewMode}
      onValueChange={(value: 'list' | 'grid' | 'map') => { // Updated onValueChange type
        if (value) onViewModeChange(value);
      }}
      className={cn("w-fit mx-auto", className)}
    >
      <ToggleGroupItem value="list" aria-label={t('viewToggle.listView')}>
        <List className={cn("h-4 w-4", !isMobile && "mr-2")} />
        {!isMobile && t('viewToggle.listView')}
        {isMobile && <span className="sr-only">{t('viewToggle.listView')}</span>}
      </ToggleGroupItem>
      <ToggleGroupItem value="grid" aria-label={t('viewToggle.gridView')}>
        <Grid className={cn("h-4 w-4", !isMobile && "mr-2")} />
        {!isMobile && t('viewToggle.gridView')}
        {isMobile && <span className="sr-only">{t('viewToggle.gridView')}</span>}
      </ToggleGroupItem>
      <ToggleGroupItem value="map" aria-label={t('viewToggle.mapView')}> {/* New Map view toggle */}
        <Map className={cn("h-4 w-4", !isMobile && "mr-2")} />
        {!isMobile && t('viewToggle.mapView')}
        {isMobile && <span className="sr-only">{t('viewToggle.mapView')}</span>}
      </ToggleGroupItem>
    </ToggleGroup>
  );
};

export default ViewToggle;